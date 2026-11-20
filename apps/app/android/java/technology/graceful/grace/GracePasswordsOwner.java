package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.json.JSONObject;

final class GracePasswordsOwner {
 private static final String OWNER = "password-owner";
 private static final String ORIGINAL_ISSUER = "https://api.graceforseniors.com";
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

 static synchronized CloudDeviceAccount.Session stableSession(Context context) throws Exception {
  var account = GraceAccount.account(context);
  if (changingAccount || account.awaitingAcknowledgment()) throw new IllegalStateException("Account change in progress");
  return account.session();
 }

 static boolean accountChanging() { return changingAccount; }

 private static String credentialId(CloudDeviceAccount.Session session) throws NoSuchAlgorithmException {
  byte[] fingerprint = MessageDigest.getInstance("SHA-256").digest(session.token().getBytes(StandardCharsets.UTF_8));
  return Base64.getUrlEncoder().withoutPadding().encodeToString(fingerprint);
 }

 private static JSONObject ownerRecord(CloudDeviceAccount.Session session) throws Exception {
  return new JSONObject().put("accountId", session.accountId()).put("organizationId", session.organizationId())
   .put("credentialId", credentialId(session)).put("issuer", GraceAccount.CLOUD_ORIGIN);
 }

 static synchronized boolean admitted(Context context) {
  if (changingAccount || !hasNoPriorOwner(context)) return false;
  try {
   var current = stableSession(context);
   String stored = custody(context).read(OWNER);
   if (stored == null) return current == null && !changingAccount;
   var owner = new JSONObject(stored);
   return current != null && current.accountId().equals(owner.getString("accountId"))
    && current.organizationId().equals(owner.getString("organizationId"))
    && GraceAccount.CLOUD_ORIGIN.equals(owner.optString("issuer", ORIGINAL_ISSUER))
    && credentialId(current).equals(owner.optString("credentialId")) && !changingAccount;
  } catch (Exception unavailable) {
   return false;
  }
 }

 static synchronized void bindVerified(Context context, PasswordBackupApproval approval, boolean linkExisting) throws Exception {
  if (changingAccount || !hasNoPriorOwner(context) || !approval.current()) throw new IllegalStateException("Account verification changed");
  var current = stableSession(context);
  if (current == null || !current.accountId().equals(approval.ownerId())) throw new IllegalStateException("Account verification changed");
  var store = custody(context);
  String existing = store.read(OWNER);
  if (existing != null) {
   var owner = new JSONObject(existing);
   if (!GraceAccount.CLOUD_ORIGIN.equals(owner.optString("issuer", ORIGINAL_ISSUER))
       || !current.accountId().equals(owner.getString("accountId"))
       || !current.organizationId().equals(owner.getString("organizationId"))
       || (owner.has("scope") && !approval.scope().equals(owner.getString("scope")))) {
    throw new IllegalStateException("This vault belongs to another account");
   }
  } else if (PasswordVaultAccess.get(context).exists() && !linkExisting) {
   throw new IllegalStateException("Confirm linking the saved passwords");
  }
  if (changingAccount || !approval.current()) throw new IllegalStateException("Account verification changed");
  store.write(OWNER, ownerRecord(current).put("scope", approval.scope()).toString());
 }

 static void enteringAccountChange(Context context) throws Exception {
  synchronized (GracePasswordsOwner.class) { changingAccount = true; }
  PasswordVaultAccess.get(context).lockAndClose();
 }

 static synchronized void leavingAccountChange() {
  changingAccount = false;
 }

 static void confirmVerifiedAccount(Context context) {
  try { bindVerifiedAccount(context); }
  catch (Exception unavailable) { }
 }

 private static synchronized void bindVerifiedAccount(Context context) throws Exception {
  if (!changingAccount || !hasNoPriorOwner(context)) return;
  var account = GraceAccount.account(context);
  if (account.awaitingAcknowledgment()) return;
  var current = account.session();
  if (current == null) return;
  var store = custody(context);
  String stored = store.read(OWNER);
  if (stored == null) {
   if (!PasswordVaultAccess.get(context).exists()) store.write(OWNER, ownerRecord(current).toString());
   return;
  }
  var owner = new JSONObject(stored);
  if (GraceAccount.CLOUD_ORIGIN.equals(owner.optString("issuer", ORIGINAL_ISSUER))
    && current.accountId().equals(owner.getString("accountId"))
    && current.organizationId().equals(owner.getString("organizationId"))) {
   store.write(OWNER, owner.put("credentialId", credentialId(current)).put("issuer", GraceAccount.CLOUD_ORIGIN).toString());
  }
 }
}
