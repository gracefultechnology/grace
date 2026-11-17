package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudCredentialSlots;
import ai.eliza.plugins.securestore.nativeonly.CredentialIntentFence;
import ai.eliza.plugins.securestore.nativeonly.CredentialMutationConductor;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import java.io.File;
import java.util.Objects;
import java.util.concurrent.Callable;
import org.json.JSONObject;
import org.json.JSONTokener;

final class GraceCredentials {
 private static final Object LIFECYCLE = new Object();
 private static final CredentialIntentFence INTENTS = new CredentialIntentFence(LIFECYCLE);
 private static final String KEY = GraceSignInPlugin.NATIVE.credentialSlot(GraceSignInPlugin.PRODUCTION);
 private static final String ACTIVATION = GraceSignInPlugin.NATIVE.receiptSlot(GraceSignInPlugin.PRODUCTION);
 private static long lifecycleEpoch, mutationEpoch = -1;

 private GraceCredentials() {}

 static Runnable reserve() { return bound(INTENTS.reserve()); }
 static Runnable observe() { return bound(INTENTS.current()); }
 private static Runnable bound(long intent) { return () -> INTENTS.require(intent); }

 static <T> T withRead(Callable<T> read) throws Exception {
  synchronized (LIFECYCLE) {
   synchronized (JsonCredentialSlots.LOCK) {
    if (mutationEpoch >= 0) throw new IllegalStateException("Credential change in progress");
    return read.call();
   }
  }
 }

 static String cloudKey(Context context) throws Exception {
  JsonCredentialSlots store = store(context);
  String saved = withRead(() -> read(store, ACTIVATION) == null ? read(store, KEY) : null);
  if (saved == null) return null;
  JSONObject credential = new JSONObject(saved);
  return credential.getLong("expiresAt") > System.currentTimeMillis() ? credential.getString("token") : null;
 }

 static CloudCredentialSlots slots(Context context, Runnable guard) {
  Context app = context.getApplicationContext();
  JsonCredentialSlots store = store(app);
  return new CloudCredentialSlots() {
   @Override public String read(String slot) throws Exception {
    synchronized (LIFECYCLE) { synchronized (JsonCredentialSlots.LOCK) { return GraceCredentials.read(store, slot); } }
   }
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

 private static boolean change(Context context, JsonCredentialSlots store, Runnable guard, String slot, boolean compare, String expected, String value) throws Exception {
  boolean bound = slot.equals(KEY) || slot.equals(ACTIVATION);
  return CredentialMutationConductor.mutate(host(context), guard, new CredentialMutationConductor.Mutation<Boolean>() {
   @Override public boolean requiresShutdown() throws Exception {
    String before = read(store, slot);
    return bound && (!compare || Objects.equals(before, expected)) && !Objects.equals(before, value);
   }
   @Override public Boolean commit() throws Exception {
    if (compare && !Objects.equals(read(store, slot), expected)) return false;
    guard.run();
    if (value == null) store.remove(slot);
    else store.write(slot, JSONObject.quote(value));
    if (!Objects.equals(value, read(store, slot))) throw new IllegalStateException("Credential commit unconfirmed");
    return true;
   }
  });
 }

 private static CredentialMutationConductor.Host host(Context context) {
  return new CredentialMutationConductor.Host() {
   @Override public Object lifecycleLock() { return LIFECYCLE; }
   @Override public Object credentialLock() { return JsonCredentialSlots.LOCK; }
   @Override public long beginRetirement() { return mutationEpoch = ++lifecycleEpoch; }
   @Override public void requireCurrent(long epoch) {
    if (epoch != lifecycleEpoch || mutationEpoch != epoch) throw new IllegalStateException("Credential change superseded");
   }
   @Override public long reserveStop() { return lifecycleEpoch; }
   @Override public void requestStop(long request) { context.stopService(new Intent(context, GraceAgentService.class)); }
   @Override public boolean stopped() throws Exception { return GraceAgentService.stopped(); }
   @Override public boolean stopAcknowledged(long request) { return true; }
   @Override public long elapsedRealtime() { return SystemClock.elapsedRealtime(); }
   @Override public void sleep(long millis) throws InterruptedException { Thread.sleep(millis); }
   @Override public <T> T commit(CredentialMutationConductor.Mutation<T> mutation) throws Exception { return mutation.commit(); }
   @Override public void finishMutation(long epoch, long request, boolean attempted, boolean committed) {
    if (mutationEpoch != epoch) return;
    mutationEpoch = -1;
    if (request >= 0 && (!attempted || committed)) GraceAgentService.start(context);
   }
  };
 }
}
