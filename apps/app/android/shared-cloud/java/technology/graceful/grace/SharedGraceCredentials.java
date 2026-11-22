package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import ai.eliza.plugins.signin.CredentialPolicy.Account;
import ai.eliza.plugins.signin.DeviceCustody;
import ai.eliza.plugins.signin.DeviceKeyClient.Answer;
import ai.eliza.plugins.signin.DeviceKeyClient.Acknowledgement;
import android.content.Context;
import java.io.File;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.json.JSONTokener;

final class SharedGraceCredentials {
 private static final String VERIFIED_OWNER = "verified-owner";
 private static final String REPAIRED_CREDENTIAL = "canonical-owner-verified";
 private static final String PENDING = "shared-pending";
 private static final String SIGN_OUT = "legacy-sign-out";
 private static final String UNSELECTED = "unselected";
 private static final String GENERATION = "credential-intent";
 private static final String RENEWAL_REQUEST = "mobile-key-renewal-request-v1";
 private static final String RENEWAL_RECEIPT = "mobile-key-renewal-v1";
 private static final Pattern ACCOUNT_ID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", Pattern.CASE_INSENSITIVE);
 private static final Pattern BEARER = Pattern.compile("eliza_mobile_[\\x21-\\x7e]{7,499}");

 record Owner(String accountId, String organizationId) {
  Owner {
   accountId = identifier(accountId);
   organizationId = identifier(organizationId);
  }
 }

 private record Snapshot(String key, String receipt, String retiring, String pending, String owner, String repaired, String generation, String signOut) {
  @Override public String toString() { return "Legacy credential slots"; }
 }
 private record Key(String localId, String serverId, String secret, long expiresAt) {
  @Override public String toString() { return "Legacy key"; }
 }
 private record OwnerBinding(String localId, Owner owner) {}
 private record Receipt(String serverId, Key before, Key after, String confirmedGeneration) {}

 private final Context context;
 private final JsonCredentialSlots slots;
 private final String environment, credentialSlot, receiptSlot, retiringSlot;

 SharedGraceCredentials(Context context) {
  this.context = context.getApplicationContext();
  environment = switch (BuildConfig.CLOUD_PROFILE) {
   case "shared-production" -> "production";
   case "shared-staging" -> "staging";
   default -> throw new IllegalArgumentException("Invalid shared Cloud profile");
  };
  credentialSlot = "shared-key:" + environment;
  receiptSlot = "shared-ack:" + environment;
  retiringSlot = "shared-retire:" + environment;
  slots = new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "shared-cloud-account-" + BuildConfig.CLOUD_PROFILE),
    "technology.graceful.grace.shared-account.v1." + BuildConfig.CLOUD_PROFILE, slot -> 16384);
 }

 Owner legacyOwner() throws Exception {
  synchronized (JsonCredentialSlots.LOCK) {
   Snapshot saved = snapshot();
   OwnerBinding previous = binding(saved);
   return previous == null || previous.localId().equals(saved.repaired()) ? null : previous.owner();
  }
 }

 boolean exposesCanonical(Owner confirmed) throws Exception {
  synchronized (JsonCredentialSlots.LOCK) {
   Snapshot saved = snapshot();
   OwnerBinding previous = binding(saved);
   return previous == null || previous.localId().equals(saved.repaired()) && previous.owner().equals(confirmed);
  }
 }

 boolean acceptCanonical(Owner confirmed) throws Exception {
  Objects.requireNonNull(confirmed);
  synchronized (JsonCredentialSlots.LOCK) {
   OwnerBinding previous = binding(snapshot());
   if (previous == null) return true;
   if (!previous.owner().equals(confirmed)) return false;
   save(REPAIRED_CREDENTIAL, previous.localId());
   return true;
  }
 }

 void recoverOwner() throws Exception {
  Snapshot saved;
  synchronized (JsonCredentialSlots.LOCK) { saved = snapshot(); }
  if (saved.signOut() != null) throw needsVerification();
  Key key = key(saved.key());
  OwnerBinding prior = owner(saved.owner());
  Receipt receipt = receipt(saved.receipt());
  if (key == null) {
   if (prior != null || receipt != null && receipt.before() != null) throw needsVerification();
   if (receipt != null || saved.pending() != null) synchronized (JsonCredentialSlots.LOCK) {
    requireSnapshot(saved);
    save(receiptSlot, null);
    save(PENDING, null);
   }
   return;
  }
  Owner known = matchingOwner(key, receipt, prior);
  boolean renewal = receipt != null && receipt.before() != null;
  if (known != null && (renewal || receipt == null || key.expiresAt() <= System.currentTimeMillis())) return;
  long now = System.currentTimeMillis();
  Key verification = key;
  if (key.expiresAt() <= now) {
   verification = liveSuccessor(saved, key, receipt, now);
   if (verification == null) throw needsVerification();
  }
  var authority = DeviceCustody.legacyCredentials(context, BuildConfig.CLOUD_API_ORIGIN);
  if (receipt != null && !renewal) {
   if (!Objects.equals(key.serverId(), receipt.serverId()) ||
       !(authority.acknowledge(key.serverId(), key.secret()) instanceof Answer.Answered<Acknowledgement>)) throw needsVerification();
  } else if (renewal && receipt.after() != null && key.equals(receipt.after())) {
   authority.acknowledge(key.serverId(), key.secret());
  }
  if (!(authority.user(verification.secret()) instanceof Answer.Answered<Account> answered)) throw needsVerification();
  var verified = new Owner(answered.value().userId(), answered.value().organizationId());
  if (prior != null && !prior.owner().equals(verified)) throw needsVerification();
  synchronized (JsonCredentialSlots.LOCK) {
   requireSnapshot(saved);
   save(VERIFIED_OWNER, new JSONObject().put("credentialId", key.localId())
    .put("accountId", verified.accountId()).put("organizationId", verified.organizationId()).toString());
   if (receipt != null && !renewal) save(receiptSlot, null);
  }
 }

 boolean needsCleanup() throws Exception {
  synchronized (JsonCredentialSlots.LOCK) { return needsCleanup(snapshot()); }
 }

 private boolean needsCleanup(Snapshot saved) throws Exception {
  Key selected = key(saved.key());
  if (saved.signOut() != null) {
   if (selected != null && !selected.localId().equals(saved.signOut())) throw needsVerification();
   if (!UNSELECTED.equals(saved.signOut())) identifier(saved.signOut());
   retirementSecrets(saved, selected, receipt(saved.receipt()));
   return true;
  }
  long now = System.currentTimeMillis();
  if (selected == null || selected.expiresAt() <= 0 || selected.expiresAt() > now ||
      saved.owner() != null || saved.repaired() != null) return false;
  Receipt receipt = receipt(saved.receipt());
  matchingOwner(selected, receipt, null);
  retirementSecrets(saved, selected, receipt);
  return liveSuccessor(saved, selected, receipt, now) == null;
 }

 private static Key liveSuccessor(Snapshot saved, Key selected, Receipt receipt, long now) {
  if (receipt == null || receipt.after() == null || !selected.equals(receipt.before()) ||
      receipt.confirmedGeneration() == null || !receipt.confirmedGeneration().equals(saved.generation()) ||
      receipt.after().expiresAt() <= now) return null;
  return receipt.after();
 }

 void signOut(boolean cleanupOnly, Runnable signOutCanonical) throws Exception {
  Snapshot saved;
  synchronized (JsonCredentialSlots.LOCK) { saved = snapshot(); }
  if ((cleanupOnly || saved.signOut() != null) && !needsCleanup(saved)) throw needsVerification();
  Key selected = key(saved.key());
  Set<String> secrets = retirementSecrets(saved, selected, receipt(saved.receipt()));
  synchronized (JsonCredentialSlots.LOCK) { requireSnapshot(saved); }
  signOutCanonical.run();
  if (secrets.isEmpty() && saved.receipt() == null && saved.pending() == null &&
      saved.owner() == null && saved.repaired() == null && saved.signOut() == null) return;
  synchronized (JsonCredentialSlots.LOCK) {
   requireSnapshot(saved);
   if (saved.signOut() == null) save(SIGN_OUT, selected == null ? UNSELECTED : selected.localId());
   saved = snapshot();
  }
  if (!secrets.isEmpty()) {
   var authority = DeviceCustody.legacyCredentials(context, BuildConfig.CLOUD_API_ORIGIN);
   for (String token : secrets) {
    if (!authority.revoke(token)) throw new IOException("The previous Cloud sign-out could not be confirmed");
   }
  }
  synchronized (JsonCredentialSlots.LOCK) {
   requireSnapshot(saved);
   for (String slot : new String[]{PENDING, receiptSlot, retiringSlot, VERIFIED_OWNER, REPAIRED_CREDENTIAL, credentialSlot, SIGN_OUT}) save(slot, null);
  }
 }

 private static Set<String> retirementSecrets(Snapshot saved, Key selected, Receipt receipt) throws Exception {
  Set<String> secrets = new LinkedHashSet<>();
  add(secrets, selected);
  if (receipt != null) {
   add(secrets, receipt.before());
   add(secrets, receipt.after());
  }
  JSONObject duty = saved.retiring() == null ? null : new JSONObject(saved.retiring());
  while (duty != null) {
   secrets.add(secret(duty.getString("token")));
   duty = duty.has("earlier") ? duty.getJSONObject("earlier") : null;
  }
  return secrets;
 }

 private OwnerBinding binding(Snapshot saved) throws Exception {
  if (saved.signOut() != null) throw needsVerification();
  Key key = key(saved.key());
  Receipt receipt = receipt(saved.receipt());
  OwnerBinding prior = owner(saved.owner());
  if (key == null && receipt == null && prior == null) return null;
  if (key == null) throw needsVerification();
  Owner known = matchingOwner(key, receipt, prior);
  if (known == null || receipt != null && receipt.before() == null && key.expiresAt() > System.currentTimeMillis()) throw needsVerification();
  return new OwnerBinding(key.localId(), known);
 }

 private static Owner matchingOwner(Key key, Receipt receipt, OwnerBinding prior) throws IOException {
  if (receipt != null && receipt.before() != null && !key.equals(receipt.before()) && !key.equals(receipt.after())) throw needsVerification();
  if (prior == null) return null;
  if (key.localId().equals(prior.localId()) ||
      receipt != null && receipt.before() != null && receipt.before().localId().equals(prior.localId())) return prior.owner();
  throw needsVerification();
 }

 private static OwnerBinding owner(String stored) throws Exception {
  if (stored == null) return null;
  JSONObject value = new JSONObject(stored);
  return new OwnerBinding(identifier(value.getString("credentialId")), new Owner(value.getString("accountId"), value.getString("organizationId")));
 }

 private Receipt receipt(String stored) throws Exception {
  if (stored == null) return null;
  JSONObject value = new JSONObject(stored);
  return switch (value.optString("kind")) {
   case RENEWAL_REQUEST -> {
    requireRegistration(value);
    yield new Receipt(null, key(value.getString("predecessor")), null, null);
   }
   case RENEWAL_RECEIPT -> {
    JSONObject proof = value.getJSONObject("proof");
    requireRegistration(proof);
    Key before = key(value.getString("predecessor")), after = key(value.getString("successor"));
    if (before.localId().equals(after.localId()) || before.secret().equals(after.secret()) ||
        after.expiresAt() <= before.expiresAt() || !Objects.equals(after.serverId(), identifier(proof.getString("credentialId"))) ||
        !after.secret().equals(proof.getString("secret"))) throw needsVerification();
    String confirmedGeneration = Boolean.TRUE.equals(value.opt("confirmed")) ? identifier(value.getString("generation")) : null;
    yield new Receipt(null, before, after, confirmedGeneration);
   }
   case "" -> {
    requireRegistration(value);
    yield new Receipt(identifier(value.getString("credentialId")), null, null, null);
   }
   default -> throw needsVerification();
  };
 }

 private void requireRegistration(JSONObject value) throws Exception {
  if (!BuildConfig.APPLICATION_ID.equals(value.getString("clientId")) || !environment.equals(value.getString("environment")) ||
      !(BuildConfig.CLOUD_WEB_ORIGIN + BuildConfig.CLOUD_CALLBACK_PATH).equals(value.getString("redirectUri"))) throw needsVerification();
 }

 private static Key key(String stored) throws Exception {
  if (stored == null) return null;
  JSONObject value = new JSONObject(stored);
  return new Key(identifier(value.getString("credentialId")),
   value.has("serverCredentialId") ? identifier(value.getString("serverCredentialId")) : null,
   secret(value.getString("token")), value.getLong("expiresAt"));
 }

 private static void add(Set<String> secrets, Key key) {
  if (key != null) secrets.add(key.secret());
 }

 private static String secret(String value) throws IOException {
  if (!BEARER.matcher(value).matches()) throw new IOException("Unreadable Cloud credential");
  return value;
 }

 private Snapshot snapshot() throws Exception {
  return new Snapshot(read(credentialSlot), read(receiptSlot), read(retiringSlot), read(PENDING),
   read(VERIFIED_OWNER), read(REPAIRED_CREDENTIAL), read(GENERATION), read(SIGN_OUT));
 }

 private void requireSnapshot(Snapshot saved) throws Exception {
  if (!saved.equals(snapshot())) throw new IOException("The previous Cloud account changed");
 }

 private void save(String slot, String value) throws Exception {
  if (value == null) slots.remove(slot);
  else slots.write(slot, JSONObject.quote(value));
  if (!Objects.equals(value, read(slot))) throw new IOException("Could not save the previous Cloud account change");
 }

 private String read(String key) throws Exception {
  String serialized = slots.read(key);
  if (serialized == null) return null;
  Object value = new JSONTokener(serialized).nextValue();
  if (!(value instanceof String content)) throw new IOException("Unreadable account record");
  return content;
 }

 private static IOException needsVerification() { return new IOException("The previous Cloud owner could not be confirmed"); }

 private static String identifier(String value) {
  if (value == null || !ACCOUNT_ID.matcher(value).matches()) throw new IllegalArgumentException("Invalid Cloud account identity");
  return UUID.fromString(value).toString();
 }
}
