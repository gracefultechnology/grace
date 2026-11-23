package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.securestore.nativeonly.CloudPasswordBackup;
import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval;
import ai.eliza.plugins.signin.BrowserSignIn;
import ai.eliza.plugins.signin.CredentialPolicy.Notice;
import ai.eliza.plugins.signin.CredentialReader;
import ai.eliza.plugins.signin.DeviceCustody;
import ai.eliza.plugins.signin.ElizaSignInPlugin;
import ai.eliza.plugins.signin.GoogleSignIn;
import ai.eliza.plugins.signin.SharedPasswordBackup;
import ai.eliza.plugins.signin.SignInCustody;
import ai.eliza.plugins.signin.SignInPolicy.Failure;
import ai.eliza.plugins.signin.SignInRegistration;
import ai.eliza.plugins.signin.SignInRegistration.Environment;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.CancellationSignal;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

@CapacitorPlugin(name = "GraceAccount")
public final class GraceAccount extends ElizaSignInPlugin {
 private static final ExecutorService ACCOUNT = Executors.newSingleThreadExecutor();
 private static final Object CREDENTIAL_CHANGE = new Object();
 private static final String ENVIRONMENT = switch (BuildConfig.CLOUD_PROFILE) {
  case "shared-production" -> "production";
  case "shared-staging" -> "staging";
  default -> throw new IllegalArgumentException("Invalid shared Cloud profile");
 };
 private static final URI API = URI.create(BuildConfig.CLOUD_API_ORIGIN);
 private static final Uri CALLBACK = Uri.parse(BuildConfig.CLOUD_WEB_ORIGIN + BuildConfig.CLOUD_CALLBACK_PATH);

 private record BackupAttempt(GracePasswordRecovery.Operation operation, CloudDeviceAccount.Session owner,
                              long generation, CancellationSignal picker) {}
 private volatile GracePasswordsOwner.Enrollment enrollment;
 private final AtomicReference<BackupAttempt> backupAttempt = new AtomicReference<>();
 private SharedPasswordBackup passwordBackup;
 private GracePasswordRecovery recovery;
 private GraceBrowserGuide guide;
 private GraceSharedSpeech speech;
 private CredentialReader.Subscription custodySubscription;
 private Runnable signOutCanonical;

 static CloudDeviceAccount.Session session(Context context) throws Exception {
  if (GracePasswordsOwner.accountChanging()) throw new IllegalStateException("Account change in progress");
  long generation = GracePasswordsOwner.generation();
  var current = DeviceCustody.reader(context, API.toString()).current();
  if (current == null) return null;
  var owner = new SharedGraceCredentials.Owner(current.account().userId(), current.account().organizationId());
  if (!new SharedGraceCredentials(context).exposesCanonical(owner)) return null;
  if (GracePasswordsOwner.accountChanging() || generation != GracePasswordsOwner.generation()) {
   throw new IllegalStateException("Account change in progress");
  }
  return new CloudDeviceAccount.Session(current.value(), owner.accountId(), owner.organizationId());
 }

 static String vaultCredentialBinding(Context context, CloudDeviceAccount.Session current) {
  return DeviceCustody.accountBinding(context, API.toString(), current.token());
 }

 static void maintainDeviceLease(Context context) {
  DeviceCustody.maintain(context, API.toString());
 }

 static boolean deviceOnly(Context context) throws Exception {
  return !GracePasswordsOwner.accountChanging() && new SharedGraceCredentials(context).legacyOwner() == null
   && DeviceCustody.deviceOnly(context, API.toString());
 }

 static boolean handles(Context context, Uri address) {
  return address != null && CALLBACK.getScheme().equals(address.getScheme())
   && CALLBACK.getEncodedAuthority().equals(address.getEncodedAuthority())
   && CALLBACK.getEncodedPath().equals(address.getEncodedPath());
 }

 static Uri hostedView(Context context, String view) throws Exception {
  if (!"email".equals(view) && !"calendar".equals(view)) throw new IllegalArgumentException("Unknown hosted account view");
  throw new IllegalStateException("This hosted account view is unavailable on Eliza Cloud");
 }

 @Override public void load() {
  recovery = new GracePasswordRecovery(getActivity(), this);
  guide = new GraceBrowserGuide(getContext());
  speech = new GraceSharedSpeech(getContext());
  super.load();
  custodySubscription = DeviceCustody.reader(getContext(), API.toString()).listen(notice -> {
   if (!GracePasswordsOwner.accountChanging() && (notice instanceof Notice.SignedOutNotice || notice instanceof Notice.ExpiredNotice)) {
    ACCOUNT.execute(this::retireUnconfirmedOwner);
   }
  });
 }

 @Override protected SignInCustody custody(Context context, SignInRegistration registration) {
  Environment expected = registration.environment(ENVIRONMENT);
  if (expected == null || !BuildConfig.APPLICATION_ID.equals(registration.clientId)
    || !API.toString().equals(expected.apiOrigin) || !CALLBACK.toString().equals(expected.redirectUri)) {
   throw new IllegalStateException("Mismatched shared Cloud registration");
  }
  passwordBackup = new SharedPasswordBackup(registration, expected);
  SignInCustody delegate = DeviceCustody.custody(context, registration);
  SharedGraceCredentials legacy = new SharedGraceCredentials(context);
  signOutCanonical = () -> delegate.signOut(expected);
  return new SignInCustody() {
   @Override public int beginSignIn(Environment environment) throws Refused {
    if (environment != expected || enrollment == null) throw new Refused(Failure.REJECTED);
    return delegate.beginSignIn(environment);
   }

   @Override public void signInEnded(Environment environment, int attempt) {
    if (environment == expected) delegate.signInEnded(environment, attempt);
   }

   @Override public Proof connect(int attempt, Environment environment, String token) throws Refused {
    if (environment != expected) throw new Refused(Failure.REJECTED);
    return delegate.connect(attempt, environment, token);
   }

   @Override public String redeem(int attempt, Environment environment, Proof proof) throws Refused {
    if (environment != expected) throw new Refused(Failure.REJECTED);
    try {
     return changeAccount(context, () -> {
      String credentialId = delegate.redeem(attempt, environment, proof);
      Held held = delegate.held(environment);
      boolean verified = false;
      try {
       verified = held != null && credentialId.equals(held.credentialId()) && legacy.acceptCanonical(
        new SharedGraceCredentials.Owner(held.account().userId(), held.account().organizationId()));
      } finally {
       if (!verified) delegate.signOut(environment);
      }
      if (!verified) throw new Refused(Failure.REJECTED);
      return credentialId;
     });
    } catch (Refused refused) { throw refused; }
    catch (Exception unavailable) { throw new Refused(Failure.UNAVAILABLE); }
   }

   @Override public Held held(Environment environment) {
    if (environment != expected) return null;
    try {
     if (session(context) != null) return delegate.held(environment);
    } catch (Exception unavailable) { return null; }
    return null;
   }

   @Override public boolean grantSession(Environment environment, Session session) {
    return environment == expected && delegate.grantSession(environment, session);
   }

   @Override public void signOut(Environment environment) {
    if (environment != expected) throw new IllegalStateException("Mismatched shared Cloud profile");
    try {
     changeAccount(context, () -> {
      legacy.signOut(false, signOutCanonical);
      return null;
     });
    } catch (Exception unavailable) { throw new IllegalStateException("Cloud sign-out could not be confirmed", unavailable); }
   }
  };
 }

 private <T> T changeAccount(Context context, Callable<T> change) throws Exception {
  synchronized (CREDENTIAL_CHANGE) {
   try {
    GracePasswordsOwner.enteringAccountChange(context);
    GraceAgentService.retire();
    recovery.accountChanged();
    return change.call();
   } finally {
    GracePasswordsOwner.leavingAccountChange();
    try {
     var owner = session(context);
     if (owner != null) GracePasswordsOwner.confirmVerifiedAccount(context, owner);
    } finally {
     GraceAgentService.finishAccountChange(context);
     ManagedCalendarReminders.reconcile(context);
     ACCOUNT.execute(this::publishSession);
    }
   }
  }
 }

 private void retireUnconfirmedOwner() {
  try {
   if (session(getContext()) == null) changeAccount(getContext(), () -> null);
  } catch (Exception unavailable) { publishSession(); }
 }

 void acceptCallback(Uri data) {
  if (handles(getContext(), data) && !CloudPasswordBackup.isBackupReturn(data)) BrowserSignIn.arrived(data.toString());
 }

 @Override protected void notifyListeners(String name, JSObject data, boolean retainUntilConsumed) {
  if ("sessionChanged".equals(name)) super.notifyListeners(name, data, retainUntilConsumed);
 }

 private void publishSession() {
  try { notifyListeners("sessionChanged", accountProjection(), true); }
  catch (Exception unavailable) { }
 }

 static JSObject projection(CloudDeviceAccount.Session session) {
  return GracePasswordsOwner.accountStatus(session);
 }

 private JSObject accountProjection() throws Exception {
  synchronized (CREDENTIAL_CHANGE) {
   var context = getContext();
   if (new SharedGraceCredentials(context).needsCleanup()) return projection(null).put("legacySignInNeedsCleanup", true);
   return projection(session(context));
  }
 }

 @Override @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { call.resolve(accountProjection()); }
   catch (Exception unavailable) { call.reject("Device account is unavailable"); }
  });
 }

 @PluginMethod public void beginSignIn(PluginCall call) {
  String method = call.getString("method");
  if (call.getData().has("method") && !"browser".equals(method)) { call.reject("Unknown sign-in method"); return; }
  ACCOUNT.execute(() -> {
   try {
    GracePasswordsOwner.Enrollment lease;
    synchronized (CREDENTIAL_CHANGE) {
     var legacy = new SharedGraceCredentials(getContext());
     legacy.recoverOwner();
     if (session(getContext()) != null) { call.reject("Sign out before adding another account"); return; }
     var held = DeviceCustody.reader(getContext(), API.toString()).current();
     if (held != null && changeAccount(getContext(), () ->
      legacy.acceptCanonical(new SharedGraceCredentials.Owner(held.account().userId(), held.account().organizationId())))) {
      finishEnrollment(call);
      return;
     }
     lease = GracePasswordsOwner.beginEnrollment(getContext());
     enrollment = lease;
    }
    try {
     PluginCall requested = accountCall(call, data -> {
      if (!"signed-in-as".equals(data.optString("verdict"))) { call.reject("Cloud sign-in could not complete"); return; }
      ACCOUNT.execute(() -> finishEnrollment(call));
     }, lease);
     if ("browser".equals(method) || !hasGooglePlayServices()) super.startGoogleInBrowser(requested);
     else super.startGoogle(requested);
    } catch (RuntimeException refused) {
     closeEnrollment(lease);
     throw refused;
    }
   } catch (Exception unavailable) {
    publishSession();
    call.reject("Couldn't open sign-in");
   }
  });
 }

 private void finishEnrollment(PluginCall call) {
  try {
   var owner = session(getContext());
   if (owner == null) { call.reject("Sign-in could not be verified"); return; }
   notifyListeners("sessionChanged", projection(owner), true);
   call.resolve();
  } catch (Exception unavailable) { call.reject("Sign-in could not be verified"); }
 }

 @Override @PluginMethod public void startGoogle(PluginCall call) { beginSignIn(call); }

 @Override public void startEmail(PluginCall call) { unsupportedSignIn(call); }
 @Override public void startPhone(PluginCall call) { unsupportedSignIn(call); }
 @Override public void reauthenticate(PluginCall call) { unsupportedSignIn(call); }
 @Override public void resend(PluginCall call) { unsupportedSignIn(call); }
 @Override public void verify(PluginCall call) { unsupportedSignIn(call); }
 @Override public void sendFactorCode(PluginCall call) { unsupportedSignIn(call); }

 private static void unsupportedSignIn(PluginCall call) { call.reject("This sign-in method is unavailable in Grace"); }

 @Override @PluginMethod public void signOut(PluginCall call) {
  recovery.accountChanged();
  try {
   super.signOut(accountCall(call, ignored -> {
    notifyListeners("sessionChanged", projection(null), true);
    call.resolve();
   }, null));
  } catch (RuntimeException unavailable) { call.reject("Couldn't sign out on this device"); }
 }

 @PluginMethod public void cleanupLegacySignIn(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    synchronized (CREDENTIAL_CHANGE) {
     if (GracePasswordsOwner.enrollmentInProgress()) throw new IllegalStateException("Sign-in is in progress");
     var context = getContext();
     var legacy = new SharedGraceCredentials(context);
     if (!legacy.needsCleanup()) throw new IllegalStateException("The previous sign-in no longer needs cleanup");
     changeAccount(context, () -> {
      legacy.signOut(true, signOutCanonical);
      return null;
     });
    }
    call.resolve();
   } catch (Exception unavailable) { call.reject("Couldn't clear the previous sign-in on this device"); }
  });
 }

 @Override protected void handleOnDestroy() {
  if (custodySubscription != null) custodySubscription.close();
  super.handleOnDestroy();
  var lease = enrollment;
  if (lease != null) closeEnrollment(lease);
 }

 private void closeEnrollment(GracePasswordsOwner.Enrollment lease) {
  if (enrollment == lease) enrollment = null;
  lease.close();
 }

 private PluginCall accountCall(PluginCall caller, Consumer<JSObject> resolved, GracePasswordsOwner.Enrollment lease) {
  var input = new JSObject().put("environment", ENVIRONMENT);
  return new PluginCall(null, caller.getPluginId(), caller.getCallbackId(), caller.getMethodName(), input) {
   @Override public void resolve(JSObject data) {
    if (lease != null) closeEnrollment(lease);
    resolved.accept(data);
   }
   @Override public void resolve() { resolve(new JSObject()); }
   @Override public void reject(String message, String code, Exception ignored, JSObject data) {
    if (lease != null) closeEnrollment(lease);
    caller.reject("Cloud account operation could not complete", code);
   }
  };
 }

 @PluginMethod public void manageAccount(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    if (session(getContext()) == null) { call.reject("Sign in to manage your account"); return; }
    open(Uri.parse(BuildConfig.CLOUD_WEB_ORIGIN), call);
   } catch (Exception unavailable) { call.reject("Couldn't open your account"); }
  });
 }

 @PluginMethod public void openHostedView(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { open(hostedView(getContext(), call.getString("view")), call); }
   catch (Exception unavailable) { call.reject("Couldn't open the connected account view"); }
  });
 }

 private void open(Uri destination, PluginCall call) {
  getActivity().runOnUiThread(() -> {
   try {
    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, destination));
    call.resolve();
   } catch (RuntimeException unavailable) { call.reject("Couldn't open the account page"); }
  });
 }

 @PluginMethod public void inboxArrival(PluginCall call) { guide.inboxArrival(call); }
 @PluginMethod public void browserGuideLease(PluginCall call) { guide.browserGuideLease(call); }
 @PluginMethod public void chooseBrowserLink(PluginCall call) { guide.chooseBrowserLink(call); }
 @PluginMethod public void startSpeech(PluginCall call) { speech.start(call); }
 @PluginMethod public void stopSpeech(PluginCall call) { speech.stop(call); }

 @PluginMethod public void passwordRecoveryStatus(PluginCall call) {
  ACCOUNT.execute(() -> call.resolve(new JSObject().put("ready", passwordRecoveryReady())));
 }

 private boolean passwordRecoveryReady() {
  try { return GracePasswordsOwner.stableSession(getContext()) != null && canStartBackup() && passwordBackup.available(); }
  catch (Exception unavailable) { return false; }
 }

 private boolean canStartBackup() {
  return passwordBackup != null && hasGooglePlayServices() && recovery.deviceReady();
 }

 @PluginMethod public void showPasswordRecovery(PluginCall call) {
  ACCOUNT.execute(() -> {
   if (!passwordRecoveryReady()) { call.reject("Password recovery is unavailable"); return; }
   getActivity().runOnUiThread(() -> {
    if (GracePasswordsOwner.accountChanging() || !recovery.deviceReady() || getActivity().isFinishing()
     || getActivity().isDestroyed() || !recovery.open()) call.reject("Password recovery is unavailable");
    else call.resolve();
   });
  });
 }

 @PluginMethod public void dismissPasswordRecovery(PluginCall call) {
  recovery.accountChanged();
  call.resolve();
 }

 void cancelPasswordBackup() {
  var attempt = backupAttempt.getAndSet(null);
  if (attempt != null) attempt.picker().cancel();
 }

 void authorizePasswordBackup(GracePasswordRecovery controller, GracePasswordRecovery.Operation operation) {
  ACCOUNT.execute(() -> {
   if (!controller.isCurrent(operation)) return;
   try {
    var owner = GracePasswordsOwner.stableSession(getContext());
    if (owner == null) {
     controller.failed(operation, "Sign in to Grace to use cloud backup.");
     return;
    }
    if (!canStartBackup()) {
     controller.failed(operation, "Password recovery is unavailable.");
     return;
    }
    var attempt = new BackupAttempt(operation, owner, GracePasswordsOwner.generation(), new CancellationSignal());
    if (!backupAttempt.compareAndSet(null, attempt)) {
     controller.failed(operation, "Password recovery is already open.");
     return;
    }
    startBackupPicker(attempt);
   } catch (Exception unavailable) {
    controller.failed(operation, "Grace could not start password backup.");
   }
  });
 }

 private void startBackupPicker(BackupAttempt attempt) {
  try {
   var owner = new PasswordBackupApproval.Owner(attempt.owner().accountId(), attempt.owner().organizationId());
   var approval = passwordBackup.begin(attempt.operation().purpose, owner, attempt.owner().token(), () -> backupCurrent(attempt));
   getActivity().runOnUiThread(() -> {
    if (attempt.picker().isCanceled() || !recovery.isCurrent(attempt.operation()) || !recovery.deviceReady()) {
     finishBackup(attempt, null);
     return;
    }
    GoogleSignIn.pick(getActivity(), approval.challenge(), attempt.picker(),
     result -> ACCOUNT.execute(() -> completeBackup(attempt, approval, result)));
   });
  } catch (Exception unavailable) {
   finishBackup(attempt, "Grace could not start password backup.");
  }
 }

 private boolean backupCurrent(BackupAttempt attempt) {
  try {
   return backupAttempt.get() == attempt && !attempt.picker().isCanceled()
    && recovery.isCurrent(attempt.operation()) && recovery.deviceReady()
    && attempt.generation() == GracePasswordsOwner.generation()
    && attempt.owner().equals(GracePasswordsOwner.stableSession(getContext()));
  } catch (Exception changed) { return false; }
 }

 private void completeBackup(BackupAttempt attempt, SharedPasswordBackup.Attempt approval, GoogleSignIn.Picked result) {
  if (!(result instanceof GoogleSignIn.Picked.Token token) || !backupCurrent(attempt)) {
   finishBackup(attempt, null);
   return;
  }
  try {
   var grant = approval.approve(token, () -> recovery.confirmNativeApproval(attempt.operation()));
   if (!grant.current()) {
    recovery.failed(attempt.operation(), null);
    return;
   }
   recovery.run(attempt.operation(), new GracePasswordRecovery.Approval(grant.scope(), grant.ownerId(), grant.revision(),
    grant.present(), grant::current, grant::run));
  } catch (Exception unavailable) {
   recovery.failed(attempt.operation(), "Grace could not confirm this backup with your Google account.");
  } finally {
   if (backupAttempt.compareAndSet(attempt, null)) attempt.picker().cancel();
  }
 }

 private void finishBackup(BackupAttempt attempt, String message) {
  if (!backupAttempt.compareAndSet(attempt, null)) return;
  attempt.picker().cancel();
  recovery.failed(attempt.operation(), message);
 }

 private boolean hasGooglePlayServices() {
  try { return getContext().getPackageManager().getApplicationInfo("com.google.android.gms", 0).enabled; }
  catch (android.content.pm.PackageManager.NameNotFoundException unavailable) { return false; }
 }
}
