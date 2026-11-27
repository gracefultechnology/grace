package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.securestore.nativeonly.CloudPasswordBackup;
import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval;
import ai.eliza.plugins.signin.BrowserSignIn;
import ai.eliza.plugins.signin.CloudRequests;
import ai.eliza.plugins.signin.CredentialPolicy;
import ai.eliza.plugins.signin.CredentialPolicy.MailLeaseUpgrade;
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
import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.CancellationSignal;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

@CapacitorPlugin(name = "GraceAccount")
public final class GraceAccount extends ElizaSignInPlugin {
 private static final ExecutorService ACCOUNT = Executors.newSingleThreadExecutor();
 private static final ExecutorService RECOVERY = Executors.newSingleThreadExecutor();
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
 private record Enrollment(GracePasswordsOwner.Enrollment owner, MailLeaseUpgrade upgrade) {
  boolean mailUpgrade() { return upgrade != null; }
 }
 private record EmailSignIn(String address, int number) {}
 private EmailSignIn emailSignIn;
 private long emailRequest;
 private volatile Enrollment enrollment;
 private final AtomicReference<BackupAttempt> backupAttempt = new AtomicReference<>();
 private SharedPasswordBackup passwordBackup;
 private GracePasswordRecovery recovery;
 private GraceBrowserGuide guide;
 private GraceSharedSpeech speech;
 private CloudRequests mailReads;
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
  mailReads = CloudRequests.forMailReads(getContext().getCacheDir());
  super.load();
  custodySubscription = DeviceCustody.reader(getContext(), API.toString()).listen(notice -> {
   if (GracePasswordsOwner.accountChanging()) return;
   if (notice instanceof Notice.SignedOutNotice || notice instanceof Notice.ExpiredNotice) {
    ACCOUNT.execute(this::retireUnconfirmedOwner);
   } else if (notice instanceof Notice.Announce) {
    ACCOUNT.execute(() -> {
     GraceAgentService.deviceCredentialChanged(getContext());
     publishSession();
    });
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
    var work = enrollment;
    if (environment != expected || work == null || work.mailUpgrade()) throw new Refused(Failure.REJECTED);
    return delegate.beginSignIn(environment);
   }

   @Override public MailLeaseUpgrade mailLeaseUpgrade(Environment environment) {
    var work = enrollment;
    if (environment != expected || work == null || !work.mailUpgrade()) return null;
    return work.upgrade().equals(delegate.mailLeaseUpgrade(environment)) ? work.upgrade() : null;
   }

   @Override public int beginMailLeaseUpgrade(Environment environment, MailLeaseUpgrade target) throws Refused {
    var work = enrollment;
    if (environment != expected || work == null || !target.equals(work.upgrade())) throw new Refused(Failure.REJECTED);
    return delegate.beginMailLeaseUpgrade(environment, target);
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
   var owner = session(context);
   var account = projection(owner);
   if (owner != null) {
    var custody = DeviceCustody.cloud(context, API.toString());
    var credentials = custody.credentials().state();
    var current = enrollment;
    if (current != null && current.mailUpgrade()) {
     var state = credentials.attempt() instanceof CredentialPolicy.Attempt.Acknowledging ? "acknowledgmentPending" : "signInPending";
     account.put("mailLeaseUpgrade", state);
    } else if (CredentialPolicy.mailLeaseUpgrade(credentials) != null) {
     account.put("mailLeaseUpgrade", "required");
    } else {
     var authority = custody.mailAuthority();
     if (authority != null && owner.accountId().equals(authority.account().userId())
         && owner.organizationId().equals(authority.account().organizationId()))
      account.put("mailLease", GraceGoogleRead.authority(owner.accountId(), String.valueOf(authority.version())));
    }
   }
   return account;
  }
 }

 @Override @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { call.resolve(accountProjection()); }
   catch (Exception unavailable) { call.reject("Device account is unavailable"); }
  });
 }

 @PluginMethod public void accountRequest(PluginCall call) {
  GraceOwnerRead.accountRequest(getContext(), call, ACCOUNT);
 }

 @PluginMethod public void connectGoogle(PluginCall call) {
  GraceGoogleConnection.connect(call, getActivity());
 }

 @PluginMethod public void disconnectGoogle(PluginCall call) {
  GraceGoogleConnection.disconnect(call, getActivity());
 }

 @PluginMethod public void readGoogle(PluginCall call) {
  GraceGoogleRead.run(call, input -> {
   var context = getContext();
   long generation = GracePasswordsOwner.generation();
   var owner = session(context);
   var custody = DeviceCustody.cloud(context, API.toString());
   var authority = custody.mailAuthority();
   if (owner == null || authority == null || !input.matches(authority.account().userId(), String.valueOf(authority.version()))
       || !owner.accountId().equals(authority.account().userId()) || !owner.organizationId().equals(authority.account().organizationId()))
    throw new IllegalStateException("Connected account changed");
   var result = mailReads.readMail(API.toString(), custody, authority, input.target(), Map.of("Accept", "application/json"));
   if (!(result instanceof CloudRequests.Answered answer) || answer.body() == null
       || GracePasswordsOwner.accountChanging() || generation != GracePasswordsOwner.generation())
    throw new IllegalStateException("Connected account read was not confirmed");
   return new JSObject().put("status", answer.status()).put("body", new String(answer.body(), StandardCharsets.UTF_8));
  });
 }

 @PluginMethod public void beginSignIn(PluginCall call) {
  if (call.getData().has("method")) { unsupportedSignIn(call); return; }
  ACCOUNT.execute(() -> {
   try {
    cancelEmailSignIn(call);
    Enrollment lease;
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
     if (!hasGooglePlayServices()) { call.reject("Google sign-in is unavailable on this tablet"); return; }
     lease = new Enrollment(GracePasswordsOwner.beginEnrollment(getContext()), null);
     enrollment = lease;
    }
    try {
     PluginCall requested = accountCall(call, data -> {
      if (cancelled(data)) { call.resolve(); return; }
      if (!"signed-in-as".equals(data.optString("verdict"))) { call.reject("Cloud sign-in could not complete"); return; }
      ACCOUNT.execute(() -> finishEnrollment(call));
     }, lease);
     super.startGoogle(requested);
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

 @PluginMethod public void signInMethods(PluginCall call) { GraceOwnerRead.signInMethods(call, ACCOUNT); }

 @PluginMethod public void sendSignInCode(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    String address = GraceOwnerRead.signInAddress(call, 1);
    if (session(getContext()) != null || enrollment != null) throw new IllegalStateException("A device account is active");
    var legacy = new SharedGraceCredentials(getContext());
    legacy.recoverOwner();
    if (legacy.needsCleanup()) throw new IllegalStateException("Clear the previous device sign-in first");
    cancelEmailSignIn(call);
    long request = emailRequest;
    var input = new JSObject().put("email", address);
    super.startEmail(accountCall(call, input, receipt -> ACCOUNT.execute(() -> {
     int number = receipt.optInt("attempt", 0);
     if (number <= 0 || !"code-on-its-way".equals(receipt.optString("verdict"))) { call.reject("Couldn't send a sign-in code"); return; }
     if (request != emailRequest) {
      cancelEmailAttempt(call, number);
      call.reject("Email sign-in has ended");
      return;
     }
     emailSignIn = new EmailSignIn(address, number);
     call.resolve(new JSObject().put("kind", "sent"));
    }), null));
   } catch (Exception unavailable) { call.reject("Couldn't send a sign-in code"); }
  });
 }

 @PluginMethod public void verifySignInCode(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    String address = GraceOwnerRead.signInAddress(call, 2), code = GraceOwnerRead.signInCode(call);
    var attempt = emailSignIn;
    if (attempt == null || !attempt.address().equals(address)) throw new IllegalStateException("Email sign-in has ended");
    Enrollment lease;
    synchronized (CREDENTIAL_CHANGE) {
     if (session(getContext()) != null || enrollment != null) throw new IllegalStateException("A device account is active");
     lease = new Enrollment(GracePasswordsOwner.beginEnrollment(getContext()), null);
     enrollment = lease;
    }
    try {
     var input = new JSObject().put("attempt", attempt.number()).put("code", code);
     super.verify(accountCall(call, input, receipt -> ACCOUNT.execute(() -> {
      if (emailSignIn != attempt) { call.reject("Email sign-in has ended"); return; }
      String verdict = receipt.optString("verdict");
      if ("signed-in-as".equals(verdict)) {
       emailSignIn = null;
       finishEnrollment(call, new JSObject().put("kind", "signedIn"));
      } else if ("factor-asked".equals(verdict)) {
       cancelEmailSignIn(call);
       call.resolve(new JSObject().put("kind", "additionalVerification"));
      } else {
       if ("ended".equals(verdict)) emailSignIn = null;
       call.reject("Couldn't verify the sign-in code");
      }
     }), lease));
    } catch (RuntimeException refused) {
     closeEnrollment(lease);
     throw refused;
    }
   } catch (Exception unavailable) { call.reject("Couldn't verify the sign-in code"); }
  });
 }

 @PluginMethod public void cancelSignInCode(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { cancelEmailSignIn(call); call.resolve(); }
   catch (RuntimeException unavailable) { call.reject("Couldn't cancel email sign-in"); }
  });
 }

 private void cancelEmailSignIn(PluginCall call) {
  emailRequest++;
  var attempt = emailSignIn;
  emailSignIn = null;
  if (attempt != null) cancelEmailAttempt(call, attempt.number());
 }

 private void cancelEmailAttempt(PluginCall call, int number) {
  JSObject input = new JSObject().put("attempt", number).put("environment", ENVIRONMENT);
  super.cancel(new PluginCall(null, call.getPluginId(), call.getCallbackId(), call.getMethodName(), input) {
   @Override public void resolve(JSObject data) {}
   @Override public void resolve() {}
   @Override public void reject(String message, String code, Exception ignored, JSObject data) {}
  });
 }

 @PluginMethod public void beginLeaseUpgrade(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    if (!hasGooglePlayServices()) { call.reject("Google sign-in is unavailable on this tablet"); return; }
    Enrollment lease;
    synchronized (CREDENTIAL_CHANGE) {
     var owner = session(getContext());
     var target = CredentialPolicy.mailLeaseUpgrade(DeviceCustody.cloud(getContext(), API.toString()).credentials().state());
     if (enrollment != null || owner == null || target == null || !owner.accountId().equals(target.account().userId())
         || !owner.organizationId().equals(target.account().organizationId())) {
      call.reject("This device does not need mail sign-in");
      return;
     }
     lease = new Enrollment(GracePasswordsOwner.beginEnrollment(getContext()), target);
     enrollment = lease;
    }
    try {
     publishSession();
     upgradeMailLeaseWithPicker(accountCall(call, data -> {
      if (cancelled(data)) {
       call.resolve();
       return;
      }
      if ("factor-asked".equals(data.optString("verdict"))) {
       super.cancelMailLeaseUpgrade(accountCall(call, ignored -> call.reject("Mail sign-in requires additional verification"), null));
       return;
      }
      if (!"signed-in-as".equals(data.optString("verdict"))) {
       call.reject("Mail sign-in could not complete");
       return;
      }
      ACCOUNT.execute(() -> finishEnrollment(call));
     }, lease));
    } catch (RuntimeException refused) {
     closeEnrollment(lease);
     throw refused;
    }
   } catch (Exception unavailable) {
    publishSession();
    call.reject("Couldn't open mail sign-in");
   }
  });
 }

 @PluginMethod public void cancelLeaseUpgrade(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    if ("signInPending".equals(accountProjection().optString("mailLeaseUpgrade"))) {
     super.cancelMailLeaseUpgrade(accountCall(call, ignored -> { publishSession(); call.resolve(); }, null));
    } else call.resolve();
   } catch (Exception unavailable) { call.reject("Couldn't cancel mail sign-in"); }
  });
 }

 private void finishEnrollment(PluginCall call) {
  finishEnrollment(call, null);
 }

 private void finishEnrollment(PluginCall call, JSObject result) {
  try {
   var owner = session(getContext());
   if (owner == null) { call.reject("Sign-in could not be verified"); return; }
   notifyListeners("sessionChanged", accountProjection(), true);
   if (result == null) call.resolve(); else call.resolve(result);
  } catch (Exception unavailable) { call.reject("Sign-in could not be verified"); }
 }

 @Override @PluginMethod public void startGoogle(PluginCall call) { beginSignIn(call); }

 @Override public void upgradeMailLease(PluginCall call) { beginLeaseUpgrade(call); }
 @Override public void startEmail(PluginCall call) { unsupportedSignIn(call); }
 @Override public void startPhone(PluginCall call) { unsupportedSignIn(call); }
 @Override public void reauthenticate(PluginCall call) { unsupportedSignIn(call); }
 @Override public void resend(PluginCall call) { unsupportedSignIn(call); }
 @Override public void verify(PluginCall call) { unsupportedSignIn(call); }
 @Override public void sendFactorCode(PluginCall call) { unsupportedSignIn(call); }

 private static void unsupportedSignIn(PluginCall call) { call.reject("This sign-in method is unavailable in Grace"); }

 private static boolean cancelled(JSObject data) {
  return "ended".equals(data.optString("verdict")) && "cancelled".equals(data.optString("problem"));
 }

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

 private void closeEnrollment(Enrollment lease) {
  if (enrollment == lease) enrollment = null;
  lease.owner().close();
  if (lease.mailUpgrade()) publishSession();
 }

 private PluginCall accountCall(PluginCall caller, Consumer<JSObject> resolved, Enrollment lease) {
  return accountCall(caller, new JSObject(), resolved, lease);
 }

 private PluginCall accountCall(PluginCall caller, JSObject input, Consumer<JSObject> resolved, Enrollment lease) {
  input.put("environment", ENVIRONMENT);
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

 @PluginMethod public void inboxArrival(PluginCall call) { guide.inboxArrival(call); }
 @PluginMethod public void browserGuideLease(PluginCall call) { guide.browserGuideLease(call); }
 @PluginMethod public void chooseBrowserLink(PluginCall call) { guide.chooseBrowserLink(call); }
 @PluginMethod public void startSpeech(PluginCall call) { speech.start(call); }
 @PluginMethod public void stopSpeech(PluginCall call) { speech.stop(call); }

 @PluginMethod public void passwordRecoveryStatus(PluginCall call) {
  RECOVERY.execute(() -> call.resolve(new JSObject().put("ready", passwordRecoveryReady())));
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
   try {
    if (!passwordRecoveryReady()) { call.reject("Password recovery is unavailable"); return; }
    Activity activity = getActivity();
    if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
     call.reject("Password recovery is unavailable");
     return;
    }
    activity.runOnUiThread(() -> {
     Activity current = getActivity();
     if (GracePasswordsOwner.accountChanging() || !recovery.deviceReady() || current == null
      || current.isFinishing() || current.isDestroyed() || !recovery.open()) call.reject("Password recovery is unavailable");
     else call.resolve();
    });
   } catch (Exception unavailable) {
    call.reject("Password recovery is unavailable");
   }
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
  RECOVERY.execute(() -> {
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
   Activity activity = getActivity();
   if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
    finishBackup(attempt, null);
    return;
   }
   activity.runOnUiThread(() -> {
    Activity current = getActivity();
    if (current == null || current.isFinishing() || current.isDestroyed()
     || attempt.picker().isCanceled() || !recovery.isCurrent(attempt.operation()) || !recovery.deviceReady()) {
     finishBackup(attempt, null);
     return;
    }
    GoogleSignIn.pick(current, approval.challenge(), attempt.picker(),
     result -> RECOVERY.execute(() -> completeBackup(attempt, approval, result)));
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
