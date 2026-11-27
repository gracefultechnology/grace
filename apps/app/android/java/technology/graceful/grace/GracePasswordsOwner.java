package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import com.getcapacitor.JSObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import org.json.JSONObject;

final class GracePasswordsOwner {
 private static final String OWNER = "password-owner";
 private static volatile boolean changingAccount;
 private static volatile long generation;
 private static Enrollment enrollment;

 static final class Enrollment implements AutoCloseable {
  @Override public void close() {
   synchronized (GracePasswordsOwner.class) {
    if (enrollment == this) enrollment = null;
   }
  }
 }

 static Enrollment beginEnrollment(Context context) throws Exception {
  var lease = new Enrollment();
  synchronized (GracePasswordsOwner.class) {
   if (enrollment != null || changingAccount) throw new IllegalStateException("Sign-in is already in progress");
   enrollment = lease;
   generation++;
  }
  try {
   PasswordVaultAccess.get(context).lockAndClose();
   return lease;
  } catch (Exception unavailable) {
   lease.close();
   throw unavailable;
  }
 }

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
  if (changingAccount) throw new IllegalStateException("Account change in progress");
  return GraceAccount.session(context);
 }

 static JSObject accountStatus(CloudDeviceAccount.Session session) {
  if (session == null) return new JSObject().put("kind", "signedOut");
  String profile = "standalone-production".equals(BuildConfig.CLOUD_PROFILE) ? "" : BuildConfig.CLOUD_PROFILE + "\u0000";
  String identity = "grace-voice-disclosure\u0000" + profile + session.organizationId() + "\u0000" + session.accountId();
  try {
   byte[] digest = MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8));
   var scope = new StringBuilder(64);
   for (byte value : digest) scope.append(String.format(Locale.ROOT, "%02x", value & 0xff));
   return new JSObject().put("kind", "signedIn").put("voiceDisclosureScope", scope.toString());
  } catch (NoSuchAlgorithmException unsupported) { throw new IllegalStateException(unsupported); }
 }

 static String storageOwner(CloudDeviceAccount.Session session) {
  if ("standalone-production".equals(BuildConfig.CLOUD_PROFILE)) return session.accountId();
  return BuildConfig.CLOUD_PROFILE + "\u0000" + session.organizationId() + "\u0000" + session.accountId();
 }

 private static boolean sameOwner(JSONObject owner, CloudDeviceAccount.Session session) throws Exception {
  String profile = owner.optString("profile", "standalone-production");
  String originalIssuer = switch (profile) {
   case "standalone-production" -> "https://api.graceforseniors.com";
   case "shared-staging" -> "https://cloud-staging.eliza.app";
   case "shared-production" -> "https://cloud.eliza.app";
   default -> "";
  };
  return BuildConfig.CLOUD_PROFILE.equals(profile) && BuildConfig.CLOUD_API_ORIGIN.equals(owner.optString("issuer", originalIssuer))
   && session.accountId().equals(owner.getString("accountId")) && session.organizationId().equals(owner.getString("organizationId"));
 }

 private static String credentialId(Context context, CloudDeviceAccount.Session current) throws Exception {
  String binding = GraceAccount.vaultCredentialBinding(context, current);
  if (binding == null) throw new IllegalStateException("The device account changed");
  return binding;
 }

 private static JSONObject ownerRecord(Context context, CloudDeviceAccount.Session current) throws Exception {
  return new JSONObject().put("profile", BuildConfig.CLOUD_PROFILE).put("issuer", BuildConfig.CLOUD_API_ORIGIN).put("accountId", current.accountId())
    .put("organizationId", current.organizationId()).put("credentialId", credentialId(context, current));
 }

 static long generation() { return generation; }

 static synchronized boolean enrollmentInProgress() { return enrollment != null; }

 static boolean accountChanging() { return changingAccount; }

 static synchronized boolean admitted(Context context) {
  if (changingAccount || enrollment != null || !hasNoPriorOwner(context)) return false;
  try {
   var current = stableSession(context);
   String stored = custody(context).read(OWNER);
   if (stored == null) return current == null && GraceAccount.deviceOnly(context) && !changingAccount;
   var owner = new JSONObject(stored);
   return current != null && sameOwner(owner, current)
    && credentialId(context, current).equals(owner.optString("credentialId")) && !changingAccount;
  } catch (Exception unavailable) {
   return false;
  }
 }

 static synchronized void bindVerified(Context context, GracePasswordRecovery.Approval approval, boolean linkExisting) throws Exception {
  if (changingAccount || !hasNoPriorOwner(context) || !approval.current()) throw new IllegalStateException("Account verification changed");
  var current = stableSession(context);
  if (current == null || !current.accountId().equals(approval.ownerId())) throw new IllegalStateException("Account verification changed");
  var store = custody(context);
  String existing = store.read(OWNER);
  if (existing != null) {
   var owner = new JSONObject(existing);
   if (!sameOwner(owner, current)
       || (owner.has("scope") && !approval.scope().equals(owner.getString("scope")))) {
    throw new IllegalStateException("This vault belongs to another account");
   }
  } else if (PasswordVaultAccess.get(context).exists() && !linkExisting) {
   throw new IllegalStateException("Confirm linking the saved passwords");
  }
  if (changingAccount || !approval.current()) throw new IllegalStateException("Account verification changed");
  store.write(OWNER, ownerRecord(context, current).put("scope", approval.scope()).toString());
 }

 static void enteringAccountChange(Context context) throws Exception {
  synchronized (GracePasswordsOwner.class) { changingAccount = true; generation++; }
  PasswordVaultAccess.get(context).lockAndClose();
 }

 static synchronized void leavingAccountChange() {
  changingAccount = false;
 }

 static void confirmVerifiedAccount(Context context, CloudDeviceAccount.Session verified) {
  try { bindVerifiedAccount(context, verified); }
  catch (Exception unavailable) { }
 }

 private static synchronized void bindVerifiedAccount(Context context, CloudDeviceAccount.Session verified) throws Exception {
  if (verified == null || !hasNoPriorOwner(context) || !verified.equals(GraceAccount.session(context))) return;
  var store = custody(context);
  String stored = store.read(OWNER);
  if (stored == null) {
   if (!PasswordVaultAccess.get(context).exists()) store.write(OWNER, ownerRecord(context, verified).toString());
   return;
  }
  var owner = new JSONObject(stored);
  if (sameOwner(owner, verified)) {
   store.write(OWNER, owner.put("credentialId", credentialId(context, verified)).put("issuer", BuildConfig.CLOUD_API_ORIGIN).toString());
  }
 }
}
