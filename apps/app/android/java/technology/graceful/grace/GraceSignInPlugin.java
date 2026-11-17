package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.auth.cloud.CloudSignInConfig;
import ai.eliza.auth.cloud.CloudSignInEnvironment;
import ai.eliza.auth.cloud.CloudSignInPlugin;
import android.content.Context;
import android.content.pm.PackageManager;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Callable;

@CapacitorPlugin(name = "GraceSignIn")
public final class GraceSignInPlugin extends CloudSignInPlugin {
 static final CloudSignInEnvironment ENVIRONMENT = BuildConfig.DEBUG
  ? environment("staging", "cloud-staging.eliza.app", "elizacloud-staging")
  : environment("production", "cloud.eliza.app", "elizacloud");
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
   .environment(ENVIRONMENT);
  for (String scope : scopes) builder.googleScope(scope);
  return builder.build();
 }

 private static boolean googlePlay(Context context) {
  try { return context.getPackageManager().getApplicationInfo("com.google.android.gms", 0).enabled; }
  catch (PackageManager.NameNotFoundException absent) { return false; }
 }

 @Override protected CloudSignInConfig registration() { return googlePlay(getContext()) ? NATIVE : BROWSER; }
 @Override protected CloudCredentialSlots credentials(Runnable guard) { return GraceCredentials.slots(getContext(), guard); }
 @Override protected <T> T withCredentialRead(Callable<T> read) throws Exception { return GraceCredentials.withRead(read); }
 @Override protected Runnable reserveCredentialCommit() { return GraceCredentials.reserve(); }
 @Override protected Runnable observeCredentialCommit() { return GraceCredentials.observe(); }
}
