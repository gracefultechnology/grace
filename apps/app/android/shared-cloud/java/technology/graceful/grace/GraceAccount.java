package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.auth.cloud.CloudPasswordBackup;
import ai.eliza.auth.cloud.CloudSignInConfig;
import ai.eliza.auth.cloud.CloudSignInEnvironment;
import ai.eliza.auth.cloud.CloudSignInFlow;
import ai.eliza.auth.cloud.CloudSignInPlugin;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

@CapacitorPlugin(name = "GraceAccount")
public final class GraceAccount extends CloudSignInPlugin {
 private static final ExecutorService ACCOUNT = Executors.newSingleThreadExecutor();
 private static final CloudSignInEnvironment ENVIRONMENT = environment();
 private static final CloudSignInConfig REGISTRATION = CloudSignInConfig.builder()
  .clientId(BuildConfig.APPLICATION_ID)
  .deviceName("Grace tablet")
  .productName("Grace")
  .googleClientId("grace")
  .googleSignInMode("native")
  .googleScope("email")
  .logTag("GraceAccount")
  .readinessPreferences("grace-shared-signin-" + BuildConfig.CLOUD_PROFILE)
  .pendingSlot("shared-pending")
  .receiptSlotPrefix("shared-ack:")
  .retiringSlotPrefix("shared-retire:")
  .credentialSlotPrefix("shared-key:")
  .environment(ENVIRONMENT)
  .build();

 private record BackupOwner(CloudDeviceAccount.Session session, Runnable requireGeneration) {}
 private volatile GracePasswordsOwner.Enrollment enrollment;
 private SharedGraceCredentials account;
 private GracePasswordRecovery recovery;
 private GraceBrowserGuide guide;
 private GraceSharedSpeech speech;

 private static CloudSignInEnvironment environment() {
  String environment = switch (BuildConfig.CLOUD_PROFILE) {
   case "shared-production" -> "production";
   case "shared-staging" -> "staging";
   default -> throw new IllegalArgumentException("Invalid shared Cloud profile");
  };
  String tenant = "production".equals(environment) ? "elizacloud" : "elizacloud-staging";
  return new CloudSignInEnvironment(environment, host(BuildConfig.CLOUD_API_ORIGIN),
   host(BuildConfig.CLOUD_WEB_ORIGIN), tenant, "Eliza Cloud", BuildConfig.CLOUD_CALLBACK_PATH);
 }

 private static String host(String origin) {
  URI target = URI.create(origin);
  if (target.getHost() == null || !origin.equals("https://" + target.getHost())) {
   throw new IllegalArgumentException("Invalid shared Cloud origin");
  }
  return target.getHost();
 }

 private static SharedGraceCredentials credentialsFor(Context context) {
  return new SharedGraceCredentials(context, REGISTRATION, ENVIRONMENT);
 }

 static CloudDeviceAccount.Session session(Context context) throws Exception {
  if (GracePasswordsOwner.accountChanging()) throw new IllegalStateException("Account change in progress");
  return credentialsFor(context).session();
 }

 static boolean deviceOnly(Context context) throws Exception { return credentialsFor(context).deviceOnly(); }

 static boolean handles(Context context, Uri address) {
  return address != null && CloudSignInFlow.parseCallback(address.toString(), ENVIRONMENT) != null;
 }

 static Uri hostedView(Context context, String view) throws Exception {
  if (!"email".equals(view) && !"calendar".equals(view)) throw new IllegalArgumentException("Unknown hosted account view");
  throw new IllegalStateException("This hosted account view is unavailable on Eliza Cloud");
 }

 @Override public void load() {
  account = credentialsFor(getContext());
  recovery = new GracePasswordRecovery(getActivity(), this);
  guide = new GraceBrowserGuide(getContext());
  speech = new GraceSharedSpeech(getContext());
  super.load();
 }

 @Override protected CloudSignInConfig registration() { return REGISTRATION; }
 @Override protected CloudCredentialSlots credentials(Runnable guard) { return account.slots(guard); }
 @Override protected <T> T withCredentialRead(Callable<T> read) throws Exception { return SharedGraceCredentials.withRead(read); }
 @Override protected Runnable reserveCredentialCommit() { return account.reserve(); }
 @Override protected Runnable observeCredentialCommit() { return account.observe(); }
 @Override protected String credentialGeneration() { return account.generation(); }

 @Override protected Runnable adoptCredentialCommit(String generation) {
  return generation != null && generation.equals(account.generation()) ? account.guard(generation) : null;
 }

 @Override protected void savedKeyRenewed(CloudSignInEnvironment environment, String credentialId) throws Exception {
  readOwner();
 }

 void acceptCallback(Uri data) {
  if (handles(getContext(), data)) super.handleOnNewIntent(new Intent(Intent.ACTION_VIEW, data));
 }

 @Override protected void notifyListeners(String name, JSObject data, boolean retainUntilConsumed) {
  if ("signInCompleted".equals(name) || "signInRenewed".equals(name) || "signInIncomplete".equals(name)) {
   ACCOUNT.execute(this::publishSession);
  } else if ("sessionChanged".equals(name)) {
   super.notifyListeners(name, data, retainUntilConsumed);
  }
 }

 private CloudDeviceAccount.Session readOwner() throws Exception {
  try { return session(getContext()); }
  catch (Exception pending) {
   if (GracePasswordsOwner.accountChanging()) throw pending;
   var verified = account.verifyOwner();
   if (verified != null) {
    GracePasswordsOwner.confirmVerifiedAccount(getContext());
    GraceAgentService.resume(getContext());
    ManagedCalendarReminders.reconcile(getContext());
   }
   return verified;
  }
 }

 private void publishSession() {
  try { notifyListeners("sessionChanged", projection(readOwner() != null), true); }
  catch (Exception unavailable) { }
 }

 private static JSObject projection(boolean signedIn) {
  return new JSObject().put("kind", signedIn ? "signedIn" : "signedOut");
 }

 @Override @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { call.resolve(projection(readOwner() != null)); }
   catch (Exception unavailable) { call.reject("Device account is unavailable"); }
  });
 }

 @PluginMethod public void beginSignIn(PluginCall call) {
  String method = call.getString("method");
  if (call.getData().has("method") && !"browser".equals(method)) { call.reject("Unknown sign-in method"); return; }
  ACCOUNT.execute(() -> {
   try {
    if (readOwner() != null) { call.reject("Sign out before adding another account"); return; }
    var lease = GracePasswordsOwner.beginEnrollment(getContext());
    enrollment = lease;
    try {
     super.startGoogle(accountCall(call, data -> finishEnrollment(call, data), lease), "browser".equals(method) || !hasGooglePlayServices());
    } catch (RuntimeException refused) {
     lease.close();
     throw refused;
    }
   } catch (Exception unavailable) { call.reject("Couldn't open sign-in"); }
  });
 }

 private void finishEnrollment(PluginCall call, JSObject data) {
  if (!"authenticated".equals(data.optString("status"))) {
   try { super.cancel(accountCall(call, ignored -> call.reject("Complete sign-in in your browser"))); }
   catch (RuntimeException unavailable) { call.reject("Cloud sign-in could not complete"); }
   return;
  }
  final Runnable current;
  try { current = account.observe(); }
  catch (RuntimeException unavailable) { call.reject("Sign-in could not be verified"); return; }
  ACCOUNT.execute(() -> {
   try {
    current.run();
    var owner = readOwner();
    SharedGraceCredentials.withRead(() -> {
     current.run();
     if (owner == null || !owner.equals(session(getContext()))) throw new IllegalStateException("Account changed");
     notifyListeners("sessionChanged", projection(true), true);
     call.resolve();
     return null;
    });
   } catch (Exception unavailable) { call.reject("Sign-in could not be verified"); }
  });
 }

 @Override @PluginMethod public void startGoogle(PluginCall call) { beginSignIn(call); }

 @Override @PluginMethod public void signOut(PluginCall call) {
  recovery.accountChanged();
  try {
   super.signOut(accountCall(call, ignored -> {
    notifyListeners("sessionChanged", projection(false), true);
    call.resolve();
   }));
  } catch (RuntimeException unavailable) { call.reject("Couldn't sign out on this device"); }
 }

 @Override protected void handleOnDestroy() {
  super.handleOnDestroy();
  var lease = enrollment;
  if (lease != null) lease.close();
 }

 private static PluginCall accountCall(PluginCall caller, Consumer<JSObject> resolved) {
  return accountCall(caller, resolved, null);
 }

 private static PluginCall accountCall(PluginCall caller, Consumer<JSObject> resolved, GracePasswordsOwner.Enrollment lease) {
  var input = new JSObject().put("environment", ENVIRONMENT.name);
  return new PluginCall(null, caller.getPluginId(), caller.getCallbackId(), caller.getMethodName(), input) {
   @Override public void resolve(JSObject data) {
    if (lease != null) lease.close();
    resolved.accept(data);
   }
   @Override public void resolve() { resolve(new JSObject()); }
   @Override public void reject(String message, String code, Exception ignored, JSObject data) {
    if (lease != null) lease.close();
    caller.reject("Cloud account operation could not complete", code);
   }
  };
 }

 @PluginMethod public void manageAccount(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    if (readOwner() == null) { call.reject("Sign in to manage your account"); return; }
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

 @PluginMethod public void browserGuideLease(PluginCall call) { guide.browserGuideLease(call); }
 @PluginMethod public void chooseBrowserLink(PluginCall call) { guide.chooseBrowserLink(call); }
 @PluginMethod public void startSpeech(PluginCall call) { speech.start(call); }
 @PluginMethod public void stopSpeech(PluginCall call) { speech.stop(call); }

 @PluginMethod public void passwordRecoveryStatus(PluginCall call) {
  ACCOUNT.execute(() -> call.resolve(new JSObject().put("ready", passwordRecoveryReady())));
 }

 private boolean passwordRecoveryReady() {
  try { return recovery.deviceReady() && hasGooglePlayServices() && session(getContext()) != null
   && CloudPasswordBackup.available(REGISTRATION, ENVIRONMENT); }
  catch (Exception unavailable) { return false; }
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

 void cancelPasswordBackup() { cancelNativePasswordBackup(); }

 void authorizePasswordBackup(GracePasswordRecovery controller, GracePasswordRecovery.Operation request) {
  ACCOUNT.execute(() -> {
   try {
    if (!controller.isCurrent(request)) return;
    BackupOwner owner = SharedGraceCredentials.withRead(() -> new BackupOwner(session(getContext()), account.observe()));
    BooleanSupplier current = () -> {
     try {
      owner.requireGeneration().run();
      return controller.isCurrent(request) && recovery.deviceReady() && owner.session() != null
       && owner.session().equals(session(getContext()));
     } catch (Exception changed) { return false; }
    };
    if (!current.getAsBoolean() || !hasGooglePlayServices() || !CloudPasswordBackup.available(REGISTRATION, ENVIRONMENT)) {
     controller.failed(request, "Sign in to Grace to use cloud backup.");
     return;
    }
    var purpose = CloudPasswordBackup.Purpose.valueOf(request.purpose.name());
    boolean started = startNativePasswordBackup(ENVIRONMENT, purpose, current, new NativePasswordBackupCallback() {
     @Override public void approved(CloudPasswordBackup.Approval grant) {
      if (!grant.current() || !owner.session().accountId().equals(grant.ownerId())
        || !owner.session().organizationId().equals(grant.organizationId())) {
       controller.failed(request, "Choose the Google account you already use with Grace.");
       return;
      }
      controller.run(request, new GracePasswordRecovery.Approval(grant.scope(), grant.ownerId(),
       grant.revision(), grant.present(), grant::current,
       (revision, ciphertext) -> {
        var result = grant.run(revision, ciphertext);
        return new ai.eliza.plugins.securestore.nativeonly.CloudPasswordBackup.Response(
         result.status(), result.revision(), result.ciphertext());
       }));
     }

     @Override public void refused(String reason) {
      controller.failed(request, "cancelled".equals(reason) ? null : "Grace could not confirm your account.");
     }
    });
    if (!started) controller.failed(request, "Grace could not start password backup.");
   } catch (Exception unavailable) { controller.failed(request, "Sign in to Grace to use cloud backup."); }
  });
 }

 private boolean hasGooglePlayServices() {
  try { return getContext().getPackageManager().getApplicationInfo("com.google.android.gms", 0).enabled; }
  catch (android.content.pm.PackageManager.NameNotFoundException unavailable) { return false; }
 }
}
