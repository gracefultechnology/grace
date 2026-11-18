package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import ai.eliza.plugins.securestore.nativeonly.CloudPasswordBackup;
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

 static synchronized void bindVerified(Context context, CloudPasswordBackup.Approval approval, boolean linkExisting) throws Exception {
  if (changingAccount || !hasNoPriorOwner(context) || !approval.current()) throw new IllegalStateException("Account verification changed");
  var current = GraceAccount.account(context).session();
  if (current == null || !current.accountId().equals(approval.ownerId())) throw new IllegalStateException("Account verification changed");
  var store = custody(context);
  String existing = store.read(OWNER);
  if (existing != null) {
   var owner = new JSONObject(existing);
   if (!current.accountId().equals(owner.getString("accountId"))
       || !current.organizationId().equals(owner.getString("organizationId"))
       || (owner.has("scope") && !approval.scope().equals(owner.getString("scope")))) {
    throw new IllegalStateException("This vault belongs to another account");
   }
  } else if (PasswordVaultAccess.get(context).exists() && !linkExisting) {
   throw new IllegalStateException("Confirm linking the saved passwords");
  }
  if (changingAccount || !approval.current()) throw new IllegalStateException("Account verification changed");
  store.write(OWNER, new JSONObject().put("accountId", current.accountId())
    .put("organizationId", current.organizationId()).put("scope", approval.scope()).toString());
 }

 static void enteringAccountChange(Context context) {
  synchronized (GracePasswordsOwner.class) { changingAccount = true; }
  try { PasswordVaultAccess.get(context).lockAndClose(); }
  catch (Exception unavailable) { }
 }

 static synchronized void leavingAccountChange() {
  changingAccount = false;
 }

 static void confirmVerifiedAccount(Context context) {
  try { bindVerifiedAccount(context); }
  catch (Exception unavailable) { }
 }

 private static synchronized void bindVerifiedAccount(Context context) throws Exception {
  if (!hasNoPriorOwner(context)) return;
  var current = GraceAccount.account(context).session();
  if (current == null || PasswordVaultAccess.get(context).exists()) return;
  var store = custody(context);
  if (store.read(OWNER) == null) store.write(OWNER, new JSONObject()
   .put("accountId", current.accountId()).put("organizationId", current.organizationId()).toString());
 }
}
