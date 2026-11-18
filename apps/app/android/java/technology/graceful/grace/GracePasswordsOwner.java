package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudSignInFlow;
import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import org.json.JSONObject;

final class GracePasswordsOwner {
 private static final String OWNER = "password-owner";
 private GracePasswordsOwner() {}

 private static boolean legacyClear(Context context) {
  var directory = context.getNoBackupFilesDir().toPath();
  return Files.notExists(directory.resolve("grace-passwords-owner.json"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(directory.resolve("grace-passwords-owner.json.bak"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(directory.resolve("local-runtime").resolve("verified-account"), LinkOption.NOFOLLOW_LINKS);
 }

 private static JsonCredentialSlots ownership(Context context) {
  return new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "password-account"),
    "technology.graceful.grace.password.owner.v1", slot -> 1024);
 }

 private static JSONObject owner(JsonCredentialSlots store) throws Exception {
  String record = store.read(OWNER);
  if (record == null) return null;
  JSONObject owner = new JSONObject(record);
  if (!owner.getString("scope").matches("[a-f0-9]{64}") || !CloudSignInFlow.validUuid(owner.getString("credentialId"))) {
   throw new IllegalStateException("Invalid password owner");
  }
  return owner;
 }

 static boolean admitted(Context context) {
  try {
   return GraceCredentials.withRead(() -> {
    if (!legacyClear(context)) return false;
    JSONObject binding = owner(ownership(context));
    GraceCredentials.PasswordCredential credential = GraceCredentials.passwordCredential(context);
    if (binding == null) return credential == null;
    return credential != null && binding.getString("credentialId").equals(credential.id())
      && binding.optString("environment").equals(credential.account().environment());
   });
  } catch (Exception unavailable) {
   return false;
  }
 }

 static void bindVerified(Context context, String scope, String expectedCloudKey, boolean linkExisting) throws Exception {
  GraceCredentials.withRead(() -> {
   GraceCredentials.PasswordCredential credential = GraceCredentials.passwordCredential(context);
   if (!legacyClear(context) || scope == null || !scope.matches("[a-f0-9]{64}") || credential == null ||
     !credential.account().key().equals(expectedCloudKey)) throw new IllegalStateException("Account verification changed");
   JsonCredentialSlots store = ownership(context);
   JSONObject binding = owner(store);
   if (binding != null && !scope.equals(binding.getString("scope"))) throw new IllegalStateException("This vault belongs to another account");
   if (binding == null && PasswordVaultAccess.get(context).exists() && !linkExisting) throw new IllegalStateException("Confirm linking the saved passwords");
   store.write(OWNER, new JSONObject().put("scope", scope).put("credentialId", credential.id()).put("environment", credential.account().environment()).toString());
   return null;
  });
 }
}
