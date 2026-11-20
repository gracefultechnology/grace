package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import android.content.ContextWrapper;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

public final class GracePasswordCustodyInstrumentedTest {
 private final Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
 @Rule public final TemporaryFolder files = new TemporaryFolder(target.getCacheDir());

 @Test public void replacingTheDeviceCredentialKeepsItsPreviouslyBoundVaultLocked() throws Exception {
  Context context = new ContextWrapper(target) {
   @Override public File getNoBackupFilesDir() { return files.getRoot(); }
   @Override public Context getApplicationContext() { return this; }
  };
  var sessions = new JsonCredentialSlots(new File(files.getRoot(), "eliza-cloud-device-account"),
    "eliza-cloud-device-account.v1", slot -> 1024);
  var owners = new JsonCredentialSlots(new File(files.getRoot(), "standalone-password-account"),
    "technology.graceful.grace.password.standalone-owner.v1", slot -> 1024);
  var identity = new JSONObject().put("accountId", UUID.randomUUID().toString())
    .put("organizationId", UUID.randomUUID().toString());
  var credential = new JSONObject(identity.toString()).put("expiresAt", System.currentTimeMillis() + TimeUnit.HOURS.toMillis(1));
  assertEquals(1, GraceAccount.projection(GracePasswordsOwner.stableSession(context)).length());
  sessions.write("credential", credential.put("token", freshToken()).toString());
  var status = GraceAccount.projection(GracePasswordsOwner.stableSession(context));
  String scope = status.getString("voiceDisclosureScope");
  assertEquals("signedIn", status.getString("kind"));
  assertEquals(2, status.length());
  assertTrue(scope.matches("[0-9a-f]{64}"));
  GracePasswordsOwner.confirmVerifiedAccount(context);
  assertFalse(GracePasswordsOwner.admitted(context));
  completeVerifiedSignIn(context);
  assertTrue(GracePasswordsOwner.admitted(context));

  sessions.write("credential", credential.put("token", freshToken()).toString());
  GracePasswordsOwner.confirmVerifiedAccount(context);
  assertFalse(GracePasswordsOwner.admitted(context));

  completeVerifiedSignIn(context);
  assertTrue(GracePasswordsOwner.admitted(context));
  assertEquals(scope, GraceAccount.projection(GracePasswordsOwner.stableSession(context)).getString("voiceDisclosureScope"));

  owners.write("password-owner", identity.toString());
  GracePasswordsOwner.confirmVerifiedAccount(context);
  assertFalse(GracePasswordsOwner.admitted(context));

  completeVerifiedSignIn(context);
  assertTrue(GracePasswordsOwner.admitted(context));
  owners.write("password-owner", identity.put("issuer", "https://other.example").toString());
  completeVerifiedSignIn(context);
  assertFalse(GracePasswordsOwner.admitted(context));
  owners.write("password-owner", identity.put("issuer", GraceAccount.CLOUD_ORIGIN).toString());
  sessions.write("credential", credential.put("organizationId", UUID.randomUUID().toString()).toString());
  completeVerifiedSignIn(context);
  assertFalse(GracePasswordsOwner.admitted(context));
  assertNotEquals(scope, GraceAccount.projection(GracePasswordsOwner.stableSession(context)).getString("voiceDisclosureScope"));
 }

 private static void completeVerifiedSignIn(Context context) throws Exception {
  try {
   GracePasswordsOwner.enteringAccountChange(context);
   GracePasswordsOwner.confirmVerifiedAccount(context);
  } finally {
   GracePasswordsOwner.leavingAccountChange();
  }
 }

 private static String freshToken() {
  return UUID.randomUUID().toString() + UUID.randomUUID().toString();
 }
}
