package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.auth.cloud.CloudSignInConfig;
import ai.eliza.auth.cloud.CloudSignInEnvironment;
import ai.eliza.auth.cloud.CloudSignInPlugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Callable;

@CapacitorPlugin(name = "GraceSignIn")
public final class GraceSignInPlugin extends CloudSignInPlugin {
 static final CloudSignInEnvironment PRODUCTION = environment("production", "cloud.eliza.app", "elizacloud");
 static final CloudSignInEnvironment STAGING = environment("staging", "cloud-staging.eliza.app", "elizacloud-staging");
 static final CloudSignInConfig REGISTRATION = registration();

 private static CloudSignInEnvironment environment(String name, String host, String tenant) {
  return new CloudSignInEnvironment(name, host, host, tenant, "Eliza Cloud", "/auth/grace/callback");
 }

 private static CloudSignInConfig registration() {
  CloudSignInConfig.Builder builder = CloudSignInConfig.builder()
   .clientId(BuildConfig.APPLICATION_ID)
   .deviceName("Grace tablet")
   .productName("Grace")
   .googleClientId("grace")
   .googleSignInMode("native")
   .googleScope("email")
   .googleScope("https://www.googleapis.com/auth/gmail.modify")
   .googleScope("https://www.googleapis.com/auth/gmail.send")
   .googleScope("https://www.googleapis.com/auth/calendar.events")
   .logTag("GraceSignIn")
   .readinessPreferences("grace-signin-readiness")
   .pendingSlot("grace-signin:v1:pending")
   .receiptSlotPrefix("grace-signin:v1:ack:")
   .retiringSlotPrefix("grace-signin:v1:retire:")
   .credentialSlotPrefix("grace-signin:v1:key:")
   .environment(PRODUCTION);
  if (BuildConfig.DEBUG) builder.environment(STAGING);
  return builder.build();
 }

 @Override protected CloudSignInConfig registration() { return REGISTRATION; }
 @Override protected CloudCredentialSlots credentials(Runnable guard) { return GraceCredentials.slots(getContext(), guard); }
 @Override protected <T> T withCredentialRead(Callable<T> read) throws Exception { return GraceCredentials.withRead(read); }
 @Override protected Runnable reserveCredentialCommit() { return GraceCredentials.reserve(); }
 @Override protected Runnable observeCredentialCommit() { return GraceCredentials.observe(); }
}
