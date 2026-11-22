package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class GraceOwnerRead {
 enum Endpoint {
  REMINDERS("/api/v1/calendar-reminders/device"), INBOX_ARRIVAL("/api/v1/eliza/google/gmail/inbox-v1/arrival");
  final String path;
  Endpoint(String path) { this.path = path; }
 }

 static JSONObject read(Endpoint endpoint, String query, CloudDeviceAccount.Session owner) throws Exception {
  var connection = (HttpURLConnection) URI.create(BuildConfig.CLOUD_API_ORIGIN + endpoint.path + query).toURL().openConnection();
  connection.setInstanceFollowRedirects(false);
  connection.setUseCaches(false);
  connection.setConnectTimeout(3000);
  connection.setReadTimeout(5000);
  connection.setRequestProperty("Accept", "application/json");
  connection.setRequestProperty("Authorization", "Bearer " + owner.token());
  try {
   if (connection.getResponseCode() != 200) throw new IllegalStateException();
   try (var stream = connection.getInputStream()) {
    byte[] bytes = new byte[65_536];
    int size = 0;
    while (size < bytes.length) {
     int read = stream.read(bytes, size, bytes.length - size);
     if (read < 0) break;
     size += read;
    }
    if (size == bytes.length && stream.read() != -1) throw new IllegalStateException();
    return new JSONObject(new String(bytes, 0, size, StandardCharsets.UTF_8));
   }
  } finally { connection.disconnect(); }
 }
}
