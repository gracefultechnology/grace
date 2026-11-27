package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

final class GraceBrowserGuide {
 private final Context context;
 private record GuideLease(String id, CloudDeviceAccount.Session owner, long generation) {}
 private GuideLease guideLease;
 private static final ExecutorService LEASE = Executors.newSingleThreadExecutor();
 private static final ExecutorService INBOX = Executors.newSingleThreadExecutor();
 private static final ExecutorService CHOICES = Executors.newSingleThreadExecutor();
 private static final ScheduledExecutorService CHOICE_DEADLINE = Executors.newSingleThreadScheduledExecutor();
 private static final int CHOICE_DEADLINE_MS = 30_000;

 GraceBrowserGuide(Context context) { this.context = context.getApplicationContext(); }

 void browserGuideLease(PluginCall call) {
  LEASE.execute(() -> {
   var lease = currentGuideLease();
   call.resolve(new JSObject().put("id", lease == null ? JSONObject.NULL : lease.id()));
  });
 }

 private synchronized GuideLease currentGuideLease() {
  long before = GracePasswordsOwner.generation();
  CloudDeviceAccount.Session owner;
  try { owner = GracePasswordsOwner.stableSession(context); }
  catch (Exception unavailable) { owner = null; }
  long after = GracePasswordsOwner.generation();
  if (owner == null || before != after || GracePasswordsOwner.accountChanging()) guideLease = null;
  else if (guideLease == null || !owner.equals(guideLease.owner()) || guideLease.generation() != after) {
   guideLease = new GuideLease(UUID.randomUUID().toString(), owner, after);
  }
  return guideLease;
 }

 void inboxArrival(PluginCall call) {
  INBOX.execute(() -> {
   var lease = currentGuideLease();
   try {
    if (lease == null || !lease.id().equals(call.getString("lease"))) throw new IllegalStateException();
    String cursor = call.getString("cursor");
    if (cursor != null && (cursor.isEmpty() || cursor.length() > 4096)) throw new IllegalArgumentException();
    var packet = GraceOwnerRead.read(GraceOwnerRead.Endpoint.INBOX_ARRIVAL,
     cursor == null ? "" : "?cursor=" + android.net.Uri.encode(cursor), lease.owner());
    if (!(packet.opt("arrived") instanceof Boolean arrived) || !(packet.opt("cursor") instanceof String next)
     || next.isEmpty() || next.length() > 4096 || !currentDecisionOwner(lease)) throw new IllegalStateException();
    call.resolve(new JSObject().put("cursor", next).put("arrived", arrived));
   } catch (Exception unavailable) { call.reject("Inbox check unavailable"); }
  });
 }

 void chooseBrowserLink(PluginCall call) {
  CHOICES.execute(() -> {
   var lease = currentGuideLease();
   if (lease == null || !lease.id().equals(call.getString("lease"))) {
    call.resolve(choiceUnavailable("disabled"));
    return;
   }
   var owner = lease.owner();
   try {
    String goal = call.getString("goal");
    var candidates = call.getArray("candidates");
    if (goal == null || goal.isBlank() || goal.length() > 2000 || candidates == null || candidates.length() < 1 || candidates.length() > 16) {
     call.resolve(choiceUnavailable("disabled"));
     return;
    }
    byte[] request = new JSONObject().put("kind", "choice").put("goal", goal).put("candidates", candidates)
     .toString().getBytes(StandardCharsets.UTF_8);
    if (request.length > 32768 || !currentDecisionOwner(lease)) {
     call.resolve(choiceUnavailable("disabled"));
     return;
    }
    var connection = (HttpURLConnection) URI.create(BuildConfig.CLOUD_API_ORIGIN + "/api/v1/decisions").toURL().openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(CHOICE_DEADLINE_MS);
    connection.setRequestMethod("POST");
    connection.setRequestProperty("Authorization", "Bearer " + owner.token());
    connection.setRequestProperty("Accept", "application/json");
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setDoOutput(true);
    connection.setFixedLengthStreamingMode(request.length);
    long deadline = SystemClock.elapsedRealtime() + CHOICE_DEADLINE_MS;
    var cancel = CHOICE_DEADLINE.schedule(connection::disconnect, CHOICE_DEADLINE_MS, TimeUnit.MILLISECONDS);
    try {
     try (var output = connection.getOutputStream()) { output.write(request); }
     int status = connection.getResponseCode();
     if (status != 200) {
      boolean providerError = (status < 400 || status >= 500) && currentDecisionOwner(lease);
      call.resolve(choiceUnavailable(providerError ? "provider_error" : "disabled"));
      return;
     }
     try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[512];
      int count;
      while ((count = input.read(buffer)) != -1) {
       if (output.size() + count > 16384) {
        call.resolve(choiceUnavailable("provider_error"));
        return;
       }
       output.write(buffer, 0, count);
      }
      if (!currentDecisionOwner(lease)) call.resolve(choiceUnavailable("disabled"));
      else if (SystemClock.elapsedRealtime() >= deadline) call.resolve(choiceUnavailable("provider_error"));
      else call.resolve(new JSObject(new String(output.toByteArray(), StandardCharsets.UTF_8)));
     }
    } finally {
     cancel.cancel(false);
     connection.disconnect();
    }
   } catch (Exception unavailable) {
    call.resolve(choiceUnavailable(currentDecisionOwner(lease) ? "provider_error" : "disabled"));
   }
  });
 }

 private boolean currentDecisionOwner(GuideLease expected) {
  return expected.equals(currentGuideLease());
 }

 private static JSObject choiceUnavailable(String reason) {
  return new JSObject().put("status", "unavailable").put("reason", reason);
 }

}
