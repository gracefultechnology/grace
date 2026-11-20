package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

final class ManagedAttachmentImport {
 static final String PATH = "/android/files/import";
 private static final String HOST = URI.create(BuildConfig.CLOUD_WEB_ORIGIN).getRawAuthority();
 private static final String ENDPOINT = BuildConfig.CLOUD_API_ORIGIN + "/api/v1/google-attachments/device";
 private static final int MAX_BYTES = 8 * 1024 * 1024;
 private static final int ENCODED_MAX = 4 * ((MAX_BYTES + 2) / 3);
 private static final Pattern TICKET = Pattern.compile("[0-9a-f]{2,8192}");
 private static final Pattern SHA = Pattern.compile("[0-9a-f]{64}");

 record Receipt(String name, String source, String sha, byte[] bytes) {}

 private ManagedAttachmentImport() {}

 static boolean targets(Intent intent) {
  Uri uri = intent == null ? null : intent.getData();
  return uri != null && PATH.equals(uri.getPath());
 }

 static String ticket(Intent intent) {
  if (!targets(intent) || !Intent.ACTION_VIEW.equals(intent.getAction())) return null;
  Uri uri = intent.getData();
  String fragment = uri.getEncodedFragment();
  return "https".equals(uri.getScheme()) && HOST.equals(uri.getEncodedAuthority()) && PATH.equals(uri.getEncodedPath()) &&
   uri.getEncodedQuery() == null && fragment != null && fragment.length() % 2 == 0 && TICKET.matcher(fragment).matches() ? fragment : null;
 }

 static Receipt fetch(String ticket, CloudDeviceAccount.Session owner) throws Exception {
  var connection = (HttpURLConnection) URI.create(ENDPOINT).toURL().openConnection();
  connection.setInstanceFollowRedirects(false);
  connection.setConnectTimeout(12_000);
  connection.setReadTimeout(16_000);
  connection.setRequestMethod("POST");
  connection.setRequestProperty("Authorization", "Bearer " + owner.token());
  connection.setRequestProperty("Content-Type", "application/json");
  connection.setRequestProperty("Accept", "application/json");
  connection.setDoOutput(true);
  try {
   var request = new JSONObject().put("ticket", ticket).toString().getBytes(StandardCharsets.UTF_8);
   connection.setFixedLengthStreamingMode(request.length);
   try (var output = connection.getOutputStream()) { output.write(request); }
   if (connection.getResponseCode() != 200) throw new IOException("Attachment unavailable");
   try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
    byte[] buffer = new byte[32_768];
    int count;
    while ((count = input.read(buffer)) != -1) {
     if (output.size() + count > ENCODED_MAX + 16_384) throw new IOException("Attachment response too large");
     output.write(buffer, 0, count);
    }
    return receipt(new JSONObject(output.toString(StandardCharsets.UTF_8.name())), owner);
   }
  } finally { connection.disconnect(); }
 }

 static Receipt receipt(JSONObject item, CloudDeviceAccount.Session owner) throws Exception {
  if (!owner.accountId().equals(item.get("accountId")) || !owner.organizationId().equals(item.get("organizationId")) ||
      !Boolean.TRUE.equals(item.get("supported")) || !(item.get("version") instanceof Integer version) || version != 1) throw new SecurityException();
  String grant = bounded(item, "grantId");
  String message = bounded(item, "messageId");
  String history = bounded(item, "historyId");
  String part = bounded(item, "partId");
  String mime = bounded(item, "mimeType");
  String expected = bounded(item, "sha256");
  Object declared = item.get("size");
  Object data = item.get("dataBase64");
  if (!history.matches("[0-9]{1,20}") || !part.matches("[0-9.]{1,32}") || !SHA.matcher(expected).matches() ||
      !(declared instanceof Integer size) || size < 1 || size > MAX_BYTES || !(data instanceof String encoded) ||
      encoded.length() != 4 * ((size + 2) / 3)) throw new IOException("Invalid attachment");
  byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
  if (bytes.length != size || !hash(bytes).equals(expected)) throw new IOException("Attachment content changed");
  String extension = switch (mime) {
   case "application/pdf" -> starts(bytes, 0, "%PDF-") ? ".pdf" : null;
   case "image/jpeg" -> bytes.length > 2 && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff ? ".jpg" : null;
   case "image/png" -> bytes.length > 8 && bytes[0] == (byte) 0x89 && starts(bytes, 1, "PNG\r\n\u001a\n") ? ".png" : null;
   case "image/webp" -> starts(bytes, 0, "RIFF") && starts(bytes, 8, "WEBP") ? ".webp" : null;
   default -> null;
  };
  if (extension == null) throw new IOException("Unsupported attachment");
  String name = bounded(item, "name").trim();
  if (name.length() > 120 || name.startsWith(".") || name.matches(".*[\\p{Cntrl}/\\\\].*")) name = "Attachment";
  String lower = name.toLowerCase(Locale.ROOT);
  if (!lower.endsWith(extension) && !(".jpg".equals(extension) && lower.endsWith(".jpeg"))) name += extension;
  String identity = new JSONArray().put("gmail-original").put(owner.accountId()).put(owner.organizationId()).put(grant)
    .put(message).put(part).toString();
  return new Receipt(name, hash(identity.getBytes(StandardCharsets.UTF_8)), expected, bytes);
 }

 static String hash(byte[] input) throws Exception {
  byte[] digest = MessageDigest.getInstance("SHA-256").digest(input);
  StringBuilder result = new StringBuilder(64);
  for (byte value : digest) result.append(String.format(Locale.ROOT, "%02x", value & 0xff));
  return result.toString();
 }

 private static String bounded(JSONObject value, String key) throws Exception {
  Object field = value.get(key);
  if (!(field instanceof String text) || text.isBlank() || text.length() > 255) throw new IOException("Invalid attachment field");
  return text;
 }

 private static boolean starts(byte[] source, int offset, String marker) {
  return source.length >= offset + marker.length() && new String(source, offset, marker.length(), StandardCharsets.ISO_8859_1).equals(marker);
 }
}
