package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.plugins.securestore.nativeonly.CredentialIntentFence;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import java.io.File;
import java.util.Objects;
import java.util.concurrent.Callable;
import org.json.JSONObject;
import org.json.JSONTokener;

final class GraceCredentials {
 private static final Object LIFECYCLE = new Object();
 private static final CredentialIntentFence INTENTS = new CredentialIntentFence(LIFECYCLE);
 private static final String KEY = GraceSignInPlugin.NATIVE.credentialSlot(GraceSignInPlugin.ENVIRONMENT);
 private static final String ACTIVATION = GraceSignInPlugin.NATIVE.receiptSlot(GraceSignInPlugin.ENVIRONMENT);

 private GraceCredentials() {}

 static Runnable reserve() { return bound(INTENTS.reserve()); }
 static Runnable observe() { return bound(INTENTS.current()); }
 private static Runnable bound(long intent) { return () -> INTENTS.require(intent); }

 static <T> T withRead(Callable<T> read) throws Exception {
  synchronized (LIFECYCLE) { synchronized (JsonCredentialSlots.LOCK) { return read.call(); } }
 }

 static String cloudKey(Context context) throws Exception {
  JsonCredentialSlots store = store(context);
  String saved = withRead(() -> agentKey(store));
  if (saved == null) return null;
  JSONObject credential = new JSONObject(saved);
  return credential.getLong("expiresAt") > System.currentTimeMillis() ? credential.getString("token") : null;
 }

 static CloudCredentialSlots slots(Context context, Runnable guard) {
  Context app = context.getApplicationContext();
  JsonCredentialSlots store = store(app);
  return new CloudCredentialSlots() {
   @Override public String read(String slot) throws Exception { return withRead(() -> GraceCredentials.read(store, slot)); }
   @Override public void write(String slot, String value) throws Exception { change(app, store, guard, slot, false, null, value); }
   @Override public void remove(String slot) throws Exception { change(app, store, guard, slot, false, null, null); }
   @Override public boolean compareExchange(String slot, String expected, String value) throws Exception { return change(app, store, guard, slot, true, expected, value); }
  };
 }

 private static JsonCredentialSlots store(Context context) {
  return new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "grace-signin"), "technology.graceful.grace.signin.v1", slot -> 16 * 1024);
 }

 private static String read(JsonCredentialSlots store, String slot) throws Exception {
  String raw = store.read(slot);
  if (raw == null) return null;
  Object value = new JSONTokener(raw).nextValue();
  if (!(value instanceof String)) throw new IllegalStateException("Unexpected sign-in record");
  return (String) value;
 }

 private static String agentKey(JsonCredentialSlots store) throws Exception {
  return read(store, ACTIVATION) == null ? read(store, KEY) : null;
 }

 private static boolean change(Context context, JsonCredentialSlots store, Runnable guard, String slot, boolean compare, String expected, String value) throws Exception {
  boolean restart = false;
  try {
   synchronized (LIFECYCLE) {
    synchronized (JsonCredentialSlots.LOCK) {
     guard.run();
     String before = read(store, slot);
     if (compare && !Objects.equals(before, expected)) return false;
     if (Objects.equals(before, value)) return true;
     String agent = agentKey(store);
     try {
      if (value == null) store.remove(slot);
      else store.write(slot, JSONObject.quote(value));
      if (!Objects.equals(value, read(store, slot))) throw new IllegalStateException("Credential commit unconfirmed");
     } finally {
      restart = !Objects.equals(agent, agentKey(store));
     }
     return true;
    }
   }
  } finally {
   if (restart) GraceAgentService.restart(context);
  }
 }
}
