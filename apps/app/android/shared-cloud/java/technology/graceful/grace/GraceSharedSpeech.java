package technology.graceful.grace;

import ai.eliza.auth.cloud.CloudSignInFlow;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.passwords.PasswordSurfaces;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

final class GraceSharedSpeech {
 private static final String ROUTE = "/api/v1/voice/speech";
 private static final ExecutorService AUDIO = Executors.newSingleThreadExecutor();
 private final Context context;

 GraceSharedSpeech(Context context) { this.context = context.getApplicationContext(); }

 private static JSONObject post(CloudDeviceAccount.Session owner, String path, JSONObject body) throws Exception {
  var connection = (HttpsURLConnection) URI.create(BuildConfig.CLOUD_API_ORIGIN + ROUTE + path).toURL().openConnection();
  connection.setInstanceFollowRedirects(false);
  connection.setUseCaches(false);
  connection.setConnectTimeout(6000);
  connection.setReadTimeout(8000);
  connection.setRequestMethod("POST");
  connection.setRequestProperty("Authorization", "Bearer " + owner.token());
  connection.setRequestProperty("Accept", "application/json");
  try {
   if (body != null) {
    byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setDoOutput(true);
    connection.setFixedLengthStreamingMode(bytes.length);
    try (var output = connection.getOutputStream()) { output.write(bytes); }
   }
   if (connection.getResponseCode() != 200) throw new IOException("Cloud speech is unavailable");
   try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
    byte[] bytes = new byte[2048];
    int count;
    while ((count = input.read(bytes)) != -1) {
     if (output.size() + count > 8192) throw new IOException("Speech response too large");
     output.write(bytes, 0, count);
    }
    return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
   }
  } finally { connection.disconnect(); }
 }

 private boolean current(CloudDeviceAccount.Session owner, long generation) throws Exception {
  return !PasswordSurfaces.visible() && owner != null && owner.equals(GracePasswordsOwner.stableSession(context)) && generation == GracePasswordsOwner.generation();
 }

 void start(PluginCall call) {
  AUDIO.execute(() -> {
   String minted = null;
   CloudDeviceAccount.Session owner = null;
   try {
    long generation = GracePasswordsOwner.generation();
    owner = GracePasswordsOwner.stableSession(context);
    if (!current(owner, generation)) throw new IOException("Account changed");
    String nonce = post(owner, "/consent", new JSONObject()).getString("consentNonce");
    if (!CloudSignInFlow.validUuid(nonce) || !current(owner, generation)) throw new IOException("Invalid speech consent");
    var session = post(owner, "/session", new JSONObject().put("consentNonce", nonce));
    String id = session.getString("sessionId");
    if (!CloudSignInFlow.validUuid(id)) throw new IOException("Invalid speech session");
    minted = id;
    String token = session.getString("token"), expires = session.getString("expiresAt");
    String socket = "wss://" + URI.create(BuildConfig.CLOUD_API_ORIGIN).getRawAuthority() + ROUTE + "/ws?sessionId=" + id;
    if (session.getInt("version") != 1 || !socket.equals(session.getString("wsUrl")) ||
        !token.matches("[A-Za-z0-9_-]{43}") || !Instant.parse(expires).isAfter(Instant.now()) || !current(owner, generation))
     throw new IOException("Invalid speech session");
    call.resolve(new JSObject().put("version", 1).put("sessionId", id).put("token", token).put("expiresAt", expires).put("wsUrl", socket));
   } catch (Exception unavailable) {
    if (owner != null && minted != null) {
     try { revoke(owner, minted); } catch (Exception ignored) { }
    }
    call.reject("Speech is unavailable");
   }
  });
 }

 private static void revoke(CloudDeviceAccount.Session owner, String id) throws Exception {
  if (owner == null || !CloudSignInFlow.validUuid(id)) throw new IOException("Invalid speech session");
  if (!post(owner, "/session/" + id + "/revoke", null).getBoolean("revoked")) throw new IOException("Speech session is active");
 }

 void stop(PluginCall call) {
  AUDIO.execute(() -> {
   try {
    revoke(GracePasswordsOwner.stableSession(context), call.getString("sessionId"));
    call.resolve();
   } catch (Exception unavailable) { call.reject("Speech session couldn't be closed"); }
  });
 }
}
