package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;
import org.json.JSONObject;

final class GraceOwnerRead {
 enum Endpoint {
  REMINDERS("/api/v1/calendar-reminders/device"), INBOX_ARRIVAL("/api/v1/eliza/google/gmail/inbox-v1/arrival"),
  PROFILE("/api/v1/user"), BILLING("/api/v1/billing/limits"), PLANS("/api/v1/subscriptions/plans"), REDEEM("/api/v1/subscription/redeem");
  final String path;
  Endpoint(String path) { this.path = path; }
 }

 static JSONObject read(Endpoint endpoint, String query, CloudDeviceAccount.Session owner) throws Exception {
  var connection = open(endpoint, query, owner);
  try {
   if (connection.getResponseCode() != 200) throw new IllegalStateException();
   try (var stream = connection.getInputStream()) { return new JSONObject(readBody(stream)); }
  } finally { connection.disconnect(); }
 }

 static void accountRequest(Context context, PluginCall call, Executor requests) {
  requests.execute(() -> {
   try {
    var input = call.getData();
    if (!(input.opt("action") instanceof String action)) throw new IllegalArgumentException("Invalid account request");
    Endpoint endpoint = switch (action) {
     case "profile" -> Endpoint.PROFILE;
     case "billing" -> Endpoint.BILLING;
     case "plans" -> Endpoint.PLANS;
     case "redeem" -> Endpoint.REDEEM;
     default -> throw new IllegalArgumentException("Invalid account request");
    };
    int fieldCount = switch (endpoint) { case PROFILE -> 1; case REDEEM -> 4; default -> 2; };
    if (input.length() != fieldCount) throw new IllegalArgumentException("Invalid account request");
    long generation = GracePasswordsOwner.generation();
    var owner = GracePasswordsOwner.stableSession(context);
    if (owner == null || generation != GracePasswordsOwner.generation()
        || (endpoint != Endpoint.PROFILE && !owner.accountId().equals(input.opt("accountId"))))
     throw new IllegalStateException("The device account changed");
    JSONObject payload = null;
    if (endpoint == Endpoint.REDEEM) {
     if (!(input.opt("code") instanceof String code) || code.length() > 64 || code.trim().isEmpty()
         || !(input.opt("idempotencyKey") instanceof String key) || !key.matches("[A-Za-z0-9._:-]{8,128}"))
      throw new IllegalArgumentException("Invalid membership code request");
     payload = new JSONObject().put("code", code).put("idempotencyKey", key);
    }
    var connection = open(endpoint, "", owner);
    try {
     if (payload != null) {
      connection.setRequestMethod("POST");
      connection.setRequestProperty("Content-Type", "application/json");
      connection.setDoOutput(true);
      byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
      connection.setFixedLengthStreamingMode(bytes.length);
      try (var stream = connection.getOutputStream()) { stream.write(bytes); }
     }
     int status = connection.getResponseCode();
     String body;
     try (var stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) { body = readBody(stream); }
     if (endpoint == Endpoint.PROFILE && status == 200) {
      var profile = new JSONObject(body).getJSONObject("data");
      if (!owner.accountId().equals(profile.opt("id")) || !owner.organizationId().equals(profile.opt("organization_id")))
       throw new IllegalStateException("The device account changed");
     }
     if (!owner.equals(GracePasswordsOwner.stableSession(context)) || generation != GracePasswordsOwner.generation())
      throw new IllegalStateException("The device account changed");
     call.resolve(new JSObject().put("status", status).put("body", body));
    } finally { connection.disconnect(); }
   } catch (Exception unavailable) { call.reject("Couldn't read the device account"); }
  });
 }

 private static HttpURLConnection open(Endpoint endpoint, String query, CloudDeviceAccount.Session owner) throws Exception {
  var connection = (HttpURLConnection) URI.create(BuildConfig.CLOUD_API_ORIGIN + endpoint.path + query).toURL().openConnection();
  connection.setInstanceFollowRedirects(false);
  connection.setUseCaches(false);
  connection.setConnectTimeout(3000);
  connection.setReadTimeout(5000);
  connection.setRequestProperty("Accept", "application/json");
  connection.setRequestProperty("Authorization", "Bearer " + owner.token());
  return connection;
 }

 private static String readBody(InputStream stream) throws Exception {
  if (stream == null) return "";
  byte[] bytes = new byte[65_536];
  int size = 0;
  while (size < bytes.length) {
   int read = stream.read(bytes, size, bytes.length - size);
   if (read < 0) break;
   size += read;
  }
  if (size == bytes.length && stream.read() != -1) throw new IllegalStateException();
  return new String(bytes, 0, size, StandardCharsets.UTF_8);
 }
}
