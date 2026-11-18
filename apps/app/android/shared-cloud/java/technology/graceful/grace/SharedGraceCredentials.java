package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.auth.cloud.CloudSignInConfig;
import ai.eliza.auth.cloud.CloudSignInEnvironment;
import ai.eliza.auth.cloud.CloudSignInFlow;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Callable;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;
import org.json.JSONTokener;

final class SharedGraceCredentials {
 private static final String GENERATION = "credential-intent";
 private static final String OWNER = "verified-owner";
 private static final Object MUTATION = new Object();
 private final Context context;
 private final JsonCredentialSlots store;
 private final String keySlot, receiptSlot, pendingSlot;

 SharedGraceCredentials(Context context, CloudSignInConfig registration, CloudSignInEnvironment environment) {
  this.context = context.getApplicationContext();
  store = new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "shared-cloud-account-" + BuildConfig.CLOUD_PROFILE),
    "technology.graceful.grace.shared-account.v1." + BuildConfig.CLOUD_PROFILE, slot -> 16384);
  keySlot = registration.credentialSlot(environment);
  receiptSlot = registration.receiptSlot(environment);
  pendingSlot = registration.pendingSlot;
 }

 private String read(String name) throws Exception {
  String serialized = store.read(name);
  if (serialized == null) return null;
  Object parsed = new JSONTokener(serialized).nextValue();
  if (!(parsed instanceof String value)) throw new IOException("Unreadable credential record");
  return value;
 }

 private void save(String name, String value) throws Exception {
  if (value == null) store.remove(name);
  else store.write(name, JSONObject.quote(value));
  if (!Objects.equals(value, read(name))) throw new IOException("Credential change was not committed");
 }

 static <T> T withRead(Callable<T> read) throws Exception {
  synchronized (JsonCredentialSlots.LOCK) { return read.call(); }
 }

 String generation() {
  try {
   return withRead(() -> {
    String current = read(GENERATION);
    if (current == null) { current = UUID.randomUUID().toString(); save(GENERATION, current); }
    return current;
   });
  } catch (Exception failure) { throw new IllegalStateException("Account change unavailable"); }
 }

 Runnable observe() { return guard(generation()); }

 Runnable reserve() {
  try {
   return withRead(() -> {
    String next = UUID.randomUUID().toString();
    save(GENERATION, next);
    return guard(next);
   });
  } catch (Exception failure) { throw new IllegalStateException("Account change unavailable"); }
 }

 Runnable guard(String expected) {
  return () -> {
   if (expected == null || !expected.equals(generation())) throw new IllegalStateException("Account changed");
  };
 }

 CloudCredentialSlots slots(Runnable guard) {
  return new CloudCredentialSlots() {
   public String read(String slot) throws Exception { return withRead(() -> SharedGraceCredentials.this.read(slot)); }
   public void write(String slot, String value) throws Exception { change(slot, false, null, value, guard); }
   public void remove(String slot) throws Exception { change(slot, false, null, null, guard); }
   public boolean compareExchange(String slot, String expected, String value) throws Exception { return change(slot, true, expected, value, guard); }
  };
 }

 private boolean change(String slot, boolean compare, String expected, String value, Runnable guard) throws Exception {
  synchronized (MUTATION) {
   String previous = withRead(() -> read(slot));
   guard.run();
   if (compare && !Objects.equals(previous, expected)) return false;
   if (Objects.equals(previous, value)) return true;
   boolean retires = slot.equals(keySlot) || slot.equals(receiptSlot) || slot.equals(pendingSlot);
   try {
    if (retires) {
     GracePasswordsOwner.enteringAccountChange(context);
     GraceAgentService.retire();
    }
    return withRead(() -> {
     guard.run();
     if (compare && !Objects.equals(expected, read(slot))) return false;
     if (slot.equals(keySlot)) save(OWNER, null);
     save(slot, value);
     return true;
    });
   } finally {
    if (retires) {
     GracePasswordsOwner.leavingAccountChange();
     GraceAgentService.finishAccountChange(context);
     ManagedCalendarReminders.reconcile(context);
    }
   }
  }
 }

 private record Key(String id, String token) {
  @Override public String toString() { return "SharedGraceCredentials.Key"; }
 }

 private Key acknowledged() throws Exception {
  if (read(receiptSlot) != null || read(pendingSlot) != null) throw new IOException("Account change in progress");
  String value = read(keySlot);
  if (value == null) return null;
  JSONObject key = new JSONObject(value);
  String id = key.getString("credentialId"), token = key.getString("token");
  if (!CloudSignInFlow.validUuid(id) || !token.startsWith("eliza_")) throw new IOException("Invalid account credential");
  if (key.getLong("expiresAt") <= System.currentTimeMillis()) return null;
  return new Key(id, token);
 }

 CloudDeviceAccount.Session session() throws Exception {
  return withRead(() -> {
   Key key = acknowledged();
   if (key == null) return null;
   String value = read(OWNER);
   if (value == null) throw new IOException("Account verification needed");
   JSONObject owner = new JSONObject(value);
   if (!key.id.equals(owner.getString("credentialId"))) throw new IOException("Account verification changed");
   return new CloudDeviceAccount.Session(key.token, owner.getString("accountId"), owner.getString("organizationId"));
  });
 }

 CloudDeviceAccount.Session verifyOwner() throws Exception {
  Runnable current = observe();
  Key key = withRead(this::acknowledged);
  if (key == null) return null;
  HttpsURLConnection connection = (HttpsURLConnection) URI.create(BuildConfig.CLOUD_API_ORIGIN + "/api/v1/user").toURL().openConnection();
  connection.setInstanceFollowRedirects(false);
  connection.setUseCaches(false);
  connection.setConnectTimeout(8000);
  connection.setReadTimeout(10000);
  connection.setRequestProperty("Authorization", "Bearer " + key.token);
  connection.setRequestProperty("Accept", "application/json");
  try {
   int status = connection.getResponseCode();
   if (status == 401) {
    String rejected = withRead(() -> key.equals(acknowledged()) ? read(keySlot) : null);
    if (rejected != null) change(keySlot, true, rejected, null, current);
    throw new IOException("Account credential was rejected");
   }
   if (status != 200) throw new IOException("Account verification failed");
   try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
    byte[] chunk = new byte[2048];
    int count;
    while ((count = input.read(chunk)) != -1) {
     if (output.size() + count > 65536) throw new IOException("Account response too large");
     output.write(chunk, 0, count);
    }
    JSONObject data = new JSONObject(new String(output.toByteArray(), StandardCharsets.UTF_8)).getJSONObject("data");
    String user = data.getString("id"), org = data.getString("organization_id");
    if (!CloudSignInFlow.validUuid(user) || !CloudSignInFlow.validUuid(org)) throw new IOException("Invalid account identity");
    return withRead(() -> {
     current.run();
     if (!key.equals(acknowledged())) throw new IOException("Account changed");
     String value = new JSONObject().put("credentialId", key.id).put("accountId", user).put("organizationId", org).toString();
     if (!value.equals(read(OWNER))) save(OWNER, value);
     return new CloudDeviceAccount.Session(key.token, user, org);
    });
   }
  } finally { connection.disconnect(); }
 }
}
