package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.auth.cloud.CloudPasswordBackup;
import ai.eliza.auth.cloud.CloudSignInConfig;
import ai.eliza.auth.cloud.CloudSignInEnvironment;
import ai.eliza.auth.cloud.CloudSignInPlugin;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
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

 private static volatile WeakReference<GraceSignInPlugin> activeHost = new WeakReference<>(null);
 private GracePasswordRecovery passwordRecovery;

 @Override public void load() {
  super.load();
  activeHost = new WeakReference<>(this);
 }

 @Override protected void handleOnDestroy() {
  if (activeHost.get() == this) activeHost.clear();
  super.handleOnDestroy();
 }

 static void passwordOwnerChanged(boolean retiring) {
  new Handler(Looper.getMainLooper()).post(() -> {
   GraceSignInPlugin plugin = activeHost.get();
   if (plugin == null) return;
   if (retiring && plugin.passwordRecovery != null) plugin.passwordRecovery.accountChanged();
   plugin.notifyListeners("passwordOwnerChanged", new JSObject());
  });
 }

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

 private record BackupConnection(GraceCredentials.BackupAccount account, CloudSignInEnvironment environment) {}

 private BackupConnection passwordBackupConnection() throws Exception {
  GraceCredentials.BackupAccount account = GraceCredentials.backupAccount(getContext());
  if (account == null) return null;
  CloudSignInEnvironment environment = switch (account.environment()) {
   case "production" -> PRODUCTION;
   case "staging" -> BuildConfig.DEBUG ? STAGING : null;
   default -> null;
  };
  return environment == null ? null : new BackupConnection(account, environment);
 }

 private boolean passwordBackupReady() {
  try {
   KeyguardManager guard = getContext().getSystemService(KeyguardManager.class);
   BackupConnection owner = passwordBackupConnection();
   return guard != null && guard.isDeviceSecure() && !guard.isDeviceLocked() && googlePlay(getContext())
    && owner != null && CloudPasswordBackup.available(registration(), owner.environment());
  } catch (Exception unavailable) {
   return false;
  }
 }

 void cancelPasswordBackup() {
  cancelNativePasswordBackup();
 }

 void authorizePasswordBackup(GracePasswordRecovery recovery, GracePasswordRecovery.Operation operation) {
  getBridge().execute(() -> {
   try {
    Runnable intent = GraceCredentials.observe();
    BackupConnection selected = passwordBackupConnection();
    if (selected == null) { recovery.failed(operation, "Sign in to one Grace account before using password backup."); return; }
    String key = selected.account().key();
    String owner = CloudPasswordBackup.currentAccount(selected.environment(), key);
    Runnable guard = () -> {
     intent.run();
     try {
      if (!recovery.isCurrent(operation) || !selected.equals(passwordBackupConnection()))
       throw new IllegalStateException("Grace account changed");
     } catch (RuntimeException failure) { throw failure; }
     catch (Exception failure) { throw new IllegalStateException("Grace account unavailable"); }
    };
    getActivity().runOnUiThread(() -> {
     if (!recovery.isCurrent(operation)) return;
     boolean started = startNativePasswordBackup(selected.environment(), operation.purpose, new NativePasswordBackupCallback() {
      @Override public void approved(CloudPasswordBackup.Approval approval) {
       if (!owner.equals(approval.ownerId())) {
        recovery.failed(operation, "Choose the Google account you already use with Grace.");
        return;
       }
       recovery.run(operation, approval, key, guard);
      }
      @Override public void refused(String reason) {
       recovery.failed(operation, "cancelled".equals(reason) ? null : "Grace could not confirm your account.");
      }
     });
     if (!started) recovery.failed(operation, "Grace could not start password backup.");
    });
   } catch (Exception unavailable) {
    recovery.failed(operation, "Sign in to Grace before using password backup.");
   }
  });
 }

 @Override protected CloudSignInConfig registration() { return googlePlay(getContext()) ? NATIVE : BROWSER; }
 @Override protected CloudCredentialSlots credentials(Runnable guard) { return GraceCredentials.slots(getContext(), guard); }
 @Override protected <T> T withCredentialRead(Callable<T> read) throws Exception { return GraceCredentials.withRead(read); }
 @Override protected Runnable reserveCredentialCommit() { return GraceCredentials.reserve(); }
 @Override protected Runnable observeCredentialCommit() { return GraceCredentials.observe(); }
}
