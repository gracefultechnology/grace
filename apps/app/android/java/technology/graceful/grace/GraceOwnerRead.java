package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.Executor;
import org.json.JSONObject;

final class GraceOwnerRead {
 enum Endpoint {
  REMINDERS("/api/v1/calendar-reminders/device"), INBOX_ARRIVAL("/api/v1/eliza/google/gmail/inbox-v1/arrival"),
  PROFILE("/api/v1/user"), BILLING("/api/v1/billing/limits"), PLANS("/api/v1/subscriptions/plans"),
  MOBILE_CONFIG("/api/v1/app-auth/mobile/config"), REDEEM("/api/v1/subscription/redeem", true),
  CONNECT_GOOGLE("/api/v1/eliza/google/connect/native", true), DISCONNECT_GOOGLE("/api/v1/eliza/google/disconnect", true);
  final String path;
  final boolean post;
  Endpoint(String path) { this(path, false); }
  Endpoint(String path, boolean post) { this.path = path; this.post = post; }
 }

 record Reply(int status, String body) {}

 static void signInMethods(PluginCall call, Executor requests) {
  requests.execute(() -> {
   try {
    var methods = mobileConfiguration().getJSONObject("methods");
    call.resolve(new JSObject().put("emailCode", Boolean.TRUE.equals(methods.opt("email"))));
   } catch (Exception unavailable) { call.reject("Couldn't check sign-in options"); }
  });
 }

 static JSONObject mobileConfiguration() throws Exception {
  String redirect = BuildConfig.CLOUD_WEB_ORIGIN + BuildConfig.CLOUD_CALLBACK_PATH;
  String query = "?" + new Uri.Builder().appendQueryParameter("clientId", BuildConfig.APPLICATION_ID)
    .appendQueryParameter("environment", BuildConfig.CLOUD_ENVIRONMENT).appendQueryParameter("redirectUri", redirect)
    .build().getEncodedQuery();
  var config = read(Endpoint.MOBILE_CONFIG, query, null);
  if (!BuildConfig.APPLICATION_ID.equals(config.opt("clientId")) || !BuildConfig.CLOUD_ENVIRONMENT.equals(config.opt("environment"))
      || !redirect.equals(config.opt("redirectUri"))) throw new IllegalStateException("Sign-in configuration changed");
  return config;
 }

 static String signInAddress(PluginCall call, int fieldCount) {
  var input = call.getData();
  if (input.length() != fieldCount || !(input.opt("address") instanceof String value)) throw new IllegalArgumentException("Invalid sign-in address");
  String normalized = value.trim().toLowerCase(Locale.ROOT);
  if (normalized.length() > 254 || !normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw new IllegalArgumentException("Invalid sign-in address");
  return normalized;
 }

 static String signInCode(PluginCall call) {
  if (!(call.getData().opt("code") instanceof String code) || !code.matches("[0-9]{6}")) throw new IllegalArgumentException("Invalid sign-in code");
  return code;
 }

 static JSONObject read(Endpoint endpoint, String query, CloudDeviceAccount.Session owner) throws Exception {
  if (endpoint.post) throw new IllegalArgumentException("Invalid read endpoint");
  var connection = open(endpoint, query, owner);
  try {
   if (connection.getResponseCode() != 200) throw new IllegalStateException();
   try (var stream = connection.getInputStream()) { return new JSONObject(readBody(stream)); }
  } finally { connection.disconnect(); }
 }

 static Reply post(Endpoint endpoint, JSONObject payload, CloudDeviceAccount.Session owner) throws Exception {
  if (!endpoint.post) throw new IllegalArgumentException("Invalid change endpoint");
  return request(endpoint, payload, owner);
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
     payload = new JSONObject().put("code", code).put("idempotencyKey", key).put("expectedAccountId", owner.accountId());
    }
    Reply reply = request(endpoint, payload, owner);
    if (endpoint == Endpoint.PROFILE && reply.status() == 200) {
     var profile = new JSONObject(reply.body()).getJSONObject("data");
     if (!owner.accountId().equals(profile.opt("id")) || !owner.organizationId().equals(profile.opt("organization_id")))
      throw new IllegalStateException("The device account changed");
    }
    if (!owner.equals(GracePasswordsOwner.stableSession(context)) || generation != GracePasswordsOwner.generation())
     throw new IllegalStateException("The device account changed");
    call.resolve(new JSObject().put("status", reply.status()).put("body", reply.body()));
   } catch (Exception unavailable) { call.reject("Couldn't read the device account"); }
  });
 }

 private static Reply request(Endpoint endpoint, JSONObject payload, CloudDeviceAccount.Session owner) throws Exception {
  var connection = open(endpoint, "", owner);
  try {
   if (endpoint.post) connection.setRequestMethod("POST");
   if (payload != null) {
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setDoOutput(true);
    byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
    connection.setFixedLengthStreamingMode(bytes.length);
    try (var stream = connection.getOutputStream()) { stream.write(bytes); }
   }
   int status = connection.getResponseCode();
   try (var stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) {
    return new Reply(status, readBody(stream));
   }
  } finally { connection.disconnect(); }
 }

 private static HttpURLConnection open(Endpoint endpoint, String query, CloudDeviceAccount.Session owner) throws Exception {
  var connection = (HttpURLConnection) URI.create(BuildConfig.CLOUD_API_ORIGIN + endpoint.path + query).toURL().openConnection();
  connection.setInstanceFollowRedirects(false);
  connection.setUseCaches(false);
  connection.setConnectTimeout(3000);
  connection.setReadTimeout(5000);
  connection.setRequestProperty("Accept", "application/json");
  if (endpoint != Endpoint.MOBILE_CONFIG) connection.setRequestProperty("Authorization", "Bearer " + owner.token());
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
