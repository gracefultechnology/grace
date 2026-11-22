package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import java.io.File;
import java.io.IOException;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.json.JSONTokener;

final class SharedGraceCredentials {
 private static final String VERIFIED_OWNER = "verified-owner";
 private static final String REPAIRED_CREDENTIAL = "canonical-owner-verified";
 private static final Pattern ACCOUNT_ID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", Pattern.CASE_INSENSITIVE);

 record Owner(String accountId, String organizationId) {
  Owner {
   accountId = identifier(accountId);
   organizationId = identifier(organizationId);
  }
 }

 private record LegacyBinding(String credentialId, Owner owner) {}

 private final JsonCredentialSlots slots;
 private final String credentialSlot, receiptSlot;

 SharedGraceCredentials(Context context) {
  String environment = switch (BuildConfig.CLOUD_PROFILE) {
   case "shared-production" -> "production";
   case "shared-staging" -> "staging";
   default -> throw new IllegalArgumentException("Invalid shared Cloud profile");
  };
  credentialSlot = "shared-key:" + environment;
  receiptSlot = "shared-ack:" + environment;
  slots = new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "shared-cloud-account-" + BuildConfig.CLOUD_PROFILE),
    "technology.graceful.grace.shared-account.v1." + BuildConfig.CLOUD_PROFILE, slot -> 16384);
 }

 Owner legacyOwner() throws Exception {
  synchronized (JsonCredentialSlots.LOCK) {
   LegacyBinding legacy = legacyBinding();
   return legacy == null ? null : legacy.owner();
  }
 }

 boolean acceptCanonical(Owner confirmed) throws Exception {
  Objects.requireNonNull(confirmed);
  synchronized (JsonCredentialSlots.LOCK) {
   LegacyBinding legacy = legacyBinding();
   if (legacy == null) return true;
   if (!legacy.owner().equals(confirmed)) return false;
   slots.write(REPAIRED_CREDENTIAL, JSONObject.quote(legacy.credentialId()));
   if (!legacy.credentialId().equals(read(REPAIRED_CREDENTIAL))) throw new IOException("Could not record account verification");
   return true;
  }
 }

 private LegacyBinding legacyBinding() throws Exception {
  String credential = read(credentialSlot);
  String owner = read(VERIFIED_OWNER);
  if (credential == null && owner == null && read(receiptSlot) == null) return null;
  if (credential == null) throw new IOException("The previous Cloud account needs verification");
  String credentialId = identifier(new JSONObject(credential).getString("credentialId"));
  if (credentialId.equals(read(REPAIRED_CREDENTIAL))) return null;
  if (owner == null || read(receiptSlot) != null) throw new IOException("The previous Cloud owner could not be confirmed");
  JSONObject verified = new JSONObject(owner);
  if (!credentialId.equals(identifier(verified.getString("credentialId")))) throw new IOException("The previous Cloud owner does not match its credential");
  return new LegacyBinding(credentialId, new Owner(verified.getString("accountId"), verified.getString("organizationId")));
 }

 private String read(String key) throws Exception {
  String serialized = slots.read(key);
  if (serialized == null) return null;
  Object value = new JSONTokener(serialized).nextValue();
  if (!(value instanceof String content)) throw new IOException("Unreadable account record");
  return content;
 }

 private static String identifier(String value) {
  if (value == null || !ACCOUNT_ID.matcher(value).matches()) throw new IllegalArgumentException("Invalid Cloud account identity");
  return UUID.fromString(value).toString();
 }
}
