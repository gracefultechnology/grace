package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.auth.cloud.CloudPasswordBackup;
import ai.eliza.auth.cloud.CloudSignInConfig;
import ai.eliza.auth.cloud.CloudSignInEnvironment;
import ai.eliza.auth.cloud.CloudSignInPlugin;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Callable;

@CapacitorPlugin(name = "GraceSignIn")
public final class GraceSignInPlugin extends CloudSignInPlugin {
 static final CloudSignInEnvironment PRODUCTION = environment("production", "cloud.eliza.app", "elizacloud");
 static final CloudSignInEnvironment STAGING = environment("staging", "cloud-staging.eliza.app", "elizacloud-staging");
 static final CloudSignInConfig NATIVE = registration("native",
  "email",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly");
 static final CloudSignInConfig BROWSER = registration("browser");

 private static CloudSignInEnvironment environment(String name, String host, String tenant) {
  return new CloudSignInEnvironment(name, host, host, tenant, "Eliza Cloud", "/auth/grace/callback");
 }

 private static CloudSignInConfig registration(String mode, String... scopes) {
  CloudSignInConfig.Builder builder = CloudSignInConfig.builder()
   .clientId(BuildConfig.APPLICATION_ID)
   .deviceName("Grace tablet")
   .productName("Grace")
   .googleClientId("grace")
   .googleSignInMode(mode)
   .logTag("GraceSignIn")
   .readinessPreferences("grace-signin-readiness")
   .pendingSlot("grace-signin:v1:pending")
   .receiptSlotPrefix("grace-signin:v1:ack:")
   .retiringSlotPrefix("grace-signin:v1:retire:")
   .credentialSlotPrefix("grace-signin:v1:key:")
   .environment(PRODUCTION);
  for (String scope : scopes) builder.googleScope(scope);
  if (BuildConfig.DEBUG) builder.environment(STAGING);
  return builder.build();
 }

 private static boolean googlePlay(Context context) {
  try { return context.getPackageManager().getApplicationInfo("com.google.android.gms", 0).enabled; }
  catch (PackageManager.NameNotFoundException absent) { return false; }
 }

 private GracePasswordRecovery passwordRecovery;

 @PluginMethod public void passwordBackupStatus(PluginCall call) {
  getBridge().execute(() -> call.resolve(new JSObject().put("ready", passwordBackupReady())));
 }

 @PluginMethod public void openBackupRecovery(PluginCall call) {
  getBridge().execute(() -> {
   if (!passwordBackupReady()) {
    call.resolve(new JSObject().put("status", "unavailable"));
    return;
   }
   getActivity().runOnUiThread(() -> {
    if (getActivity().isFinishing() || getActivity().isDestroyed()) {
     call.resolve(new JSObject().put("status", "unavailable"));
     return;
    }
    if (passwordRecovery == null) passwordRecovery = new GracePasswordRecovery(getActivity(), this);
    call.resolve(new JSObject().put("status", passwordRecovery.open() ? "opened" : "unavailable"));
   });
  });
 }

 private boolean passwordBackupReady() {
  try {
   KeyguardManager guard = getContext().getSystemService(KeyguardManager.class);
   String key = GraceCredentials.cloudKey(getContext());
   return guard != null && guard.isDeviceSecure() && !guard.isDeviceLocked()
    && googlePlay(getContext()) && key != null && CloudPasswordBackup.available(registration(), PRODUCTION);
  } catch (Exception unavailable) {
   return false;
  }
 }

 void authorizePasswordBackup(CloudPasswordBackup.Purpose purpose, GracePasswordRecovery recovery) {
  getBridge().execute(() -> {
   try {
    Runnable intent = GraceCredentials.observe();
    String key = GraceCredentials.cloudKey(getContext());
    String owner = CloudPasswordBackup.currentAccount(PRODUCTION, key);
    Runnable guard = () -> {
     intent.run();
     try {
      if (!key.equals(GraceCredentials.cloudKey(getContext()))) throw new IllegalStateException("Grace account changed");
     } catch (RuntimeException failure) { throw failure; }
     catch (Exception failure) { throw new IllegalStateException("Grace account unavailable"); }
    };
    getActivity().runOnUiThread(() -> {
     boolean started = startNativePasswordBackup(PRODUCTION, purpose, new NativePasswordBackupCallback() {
      @Override public void approved(CloudPasswordBackup.Approval approval) {
       if (!owner.equals(approval.ownerId())) {
        recovery.failed("Choose the Google account you already use with Grace.");
        return;
       }
       recovery.run(purpose, approval, key, guard);
      }
      @Override public void refused(String reason) {
       recovery.failed("cancelled".equals(reason) ? null : "Grace could not confirm your account.");
      }
     });
     if (!started) recovery.failed("Grace could not start password backup.");
    });
   } catch (Exception unavailable) {
    recovery.failed("Sign in to Grace before using password backup.");
   }
  });
 }

 @Override protected CloudSignInConfig registration() { return googlePlay(getContext()) ? NATIVE : BROWSER; }
 @Override protected CloudCredentialSlots credentials(Runnable guard) { return GraceCredentials.slots(getContext(), guard); }
 @Override protected <T> T withCredentialRead(Callable<T> read) throws Exception { return GraceCredentials.withRead(read); }
 @Override protected Runnable reserveCredentialCommit() { return GraceCredentials.reserve(); }
 @Override protected Runnable observeCredentialCommit() { return GraceCredentials.observe(); }
}
