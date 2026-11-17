package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import org.json.JSONObject;

final class GracePasswordsOwner {
 private static final String OWNER = "password-owner";
 private static volatile boolean changingAccount;

 private GracePasswordsOwner() {}

 private static JsonCredentialSlots custody(Context context) {
  return new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "standalone-password-account"),
    "technology.graceful.grace.password.standalone-owner.v1", slot -> 1024);
 }

 private static boolean hasNoPriorOwner(Context context) {
  var directory = context.getNoBackupFilesDir().toPath();
  return Files.notExists(directory.resolve("grace-passwords-owner.json"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(directory.resolve("grace-passwords-owner.json.bak"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(directory.resolve("password-account"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(directory.resolve("local-runtime").resolve("verified-account"), LinkOption.NOFOLLOW_LINKS);
 }

 static boolean admitted(Context context) {
  if (changingAccount || !hasNoPriorOwner(context)) return false;
  try {
   var current = GraceAccount.account(context).session();
   String stored = custody(context).read(OWNER);
   if (stored == null) return current == null && !changingAccount;
   var owner = new JSONObject(stored);
   return current != null && current.accountId().equals(owner.getString("accountId"))
    && current.organizationId().equals(owner.getString("organizationId")) && !changingAccount;
  } catch (Exception unavailable) {
   return false;
  }
 }

 static void enteringAccountChange(Context context) {
  changingAccount = true;
  try { PasswordVaultAccess.get(context).lockAndClose(); }
  catch (Exception unavailable) { }
 }

 static void leavingAccountChange() {
  changingAccount = false;
 }

 static void confirmVerifiedAccount(Context context) {
  try { bindVerifiedAccount(context); }
  catch (Exception unavailable) { }
 }

 private static void bindVerifiedAccount(Context context) throws Exception {
  if (!hasNoPriorOwner(context)) return;
  var current = GraceAccount.account(context).session();
  if (current == null || PasswordVaultAccess.get(context).exists()) return;
  var store = custody(context);
  if (store.read(OWNER) == null) store.write(OWNER, new JSONObject()
   .put("accountId", current.accountId()).put("organizationId", current.organizationId()).toString());
 }
}
