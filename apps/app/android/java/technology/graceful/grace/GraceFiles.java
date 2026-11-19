package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "GraceFiles", permissions = { @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }) })
public final class GraceFiles extends Plugin {
 private static final long MAX_BYTES = 20L * 1024 * 1024;
 private static final int MAX_FILES = 250;
 private static final Pattern ID = Pattern.compile("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}");
 private static final ExecutorService disk = Executors.newSingleThreadExecutor();
 private volatile Lease active;
 private Stage staged;
 private record Lease(String token, String owner, CloudDeviceAccount.Session session) {}
 private record Source(String origin, String account, String container, String reference, String content) {
  static Source from(JSONObject value) throws JSONException {
   return new Source(text(value, "origin"), text(value, "account"), text(value, "container"), text(value, "sourceRef"), text(value, "contentRef"));
  }
 }
 private record Attachment(JSONObject source, Source key, String version, String name, byte[] bytes) {}
 private static final String SOURCE = ".mail-source.json";
 private record Stage(Lease lease, String id, File temporary, JSObject entry) {}
 private interface Work { void run() throws Exception; }

 private void perform(PluginCall call, Work work) {
  disk.execute(() -> {
   try { work.run(); }
   catch (SecurityException denied) { call.reject("Files need the current device account", "account_changed"); }
   catch (Exception failed) { call.reject("Grace couldn't finish that file request", "files_unavailable"); }
  });
 }

 private CloudDeviceAccount.Session session() throws Exception {
  try {
   var session = GracePasswordsOwner.stableSession(getContext());
   if (session == null) throw new SecurityException();
   return session;
  } catch (IllegalStateException changing) { throw new SecurityException(changing); }
 }

 private static String owner(CloudDeviceAccount.Session account) throws Exception {
  byte[] digest = MessageDigest.getInstance("SHA-256").digest(("grace-files\u0000" + account.accountId()).getBytes(StandardCharsets.UTF_8));
  StringBuilder name = new StringBuilder();
  for (byte value : digest) name.append(String.format(Locale.ROOT, "%02x", value & 0xff));
  return name.toString();
 }

 private Lease current(PluginCall call) throws Exception {
  Lease lease = active;
  if (lease == null || !lease.token().equals(call.getString("lease")) || !lease.session().equals(session())) throw new SecurityException();
  return lease;
 }

 private File library(Lease lease) throws IOException {
  File folder = new File(getContext().getNoBackupFilesDir(), "grace-files/" + lease.owner());
  if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Library unavailable");
  return folder;
 }

 private File batches(Lease lease) throws IOException {
  return new File(library(lease), "mail-" + lease.session().organizationId());
 }

 private static List<File> rows(File parent) throws IOException {
  File[] rows = parent.listFiles(f -> f.isDirectory() && ID.matcher(f.getName()).matches());
  if (rows == null) throw new IOException("Catalog unavailable");
  return Arrays.asList(rows);
 }

 private List<File> catalog(Lease lease) throws IOException {
  List<File> files = new ArrayList<>(rows(library(lease)));
  File groups = batches(lease);
  if (groups.exists()) for (File batch : rows(groups)) files.addAll(rows(batch));
  return files;
 }

 private File folder(Lease lease, String id) throws IOException {
  if (!ID.matcher(id).matches()) throw new IllegalArgumentException();
  for (File folder : catalog(lease)) if (folder.getName().equals(id)) return folder;
  return null;
 }

 private static void discardDirectory(File folder) {
  File[] children = folder.listFiles();
  if (children != null) for (File child : children) {
   if (child.isDirectory()) discardDirectory(child); else child.delete();
  }
  folder.delete();
 }

 private static String kind(String name) {
  String lower = name.toLowerCase(Locale.ROOT);
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.matches(".*\\.(jpg|jpeg|png|webp|heic|heif)$")) return "photo";
  return "";
 }

 private static String displayName(String value, String expected) {
  String name = value == null ? "" : value.replaceAll("[\\p{Cntrl}/\\\\]", "").trim();
  if (name.startsWith(".") || name.length() > 180 || !expected.equals(kind(name))) throw new IllegalArgumentException();
  return name;
 }

 private static File item(File directory) throws IOException {
  File[] children = directory.listFiles(file -> file.isFile() && !kind(file.getName()).isEmpty());
  if (children == null || children.length != 1) throw new IOException("File unavailable");
  return children[0];
 }

 private static int pages(File file) throws IOException {
  if (!"pdf".equals(kind(file.getName()))) return 0;
  try (PdfRenderer pdf = new PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))) {
   int count = pdf.getPageCount();
   if (count < 1 || count > 1000) throw new IOException("Unsupported document");
   return count;
  }
 }

 private static JSObject entry(String id, File file) throws IOException {
  JSObject entry = new JSObject().put("id", id).put("name", file.getName()).put("kind", kind(file.getName()))
    .put("savedAt", file.lastModified()).put("pages", pages(file));
  try {
   JSONObject metadata = metadata(file.getParentFile());
   if (metadata != null) entry.put("source", metadata.getJSONObject("source")).put("version", metadata.getString("version"));
  } catch (JSONException invalid) { throw new IOException("Invalid attachment metadata", invalid); }
  return entry;
 }

 private static JSONObject metadata(File folder) throws IOException, JSONException {
  File file = new File(folder, SOURCE);
  return file.isFile() ? new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)) : null;
 }

 private void discard() {
  if (staged == null) return;
  staged.temporary().delete();
  staged.temporary().getParentFile().delete();
  staged = null;
 }

 @PluginMethod public void open(PluginCall call) {
  perform(call, () -> {
   var session = session();
   discard();
   Lease lease = new Lease(UUID.randomUUID().toString(), owner(session), session);
   library(lease);
   File[] abandoned = batches(lease).listFiles(f -> f.isDirectory() && f.getName().startsWith(".pending-"));
   if (abandoned != null) for (File f : abandoned) discardDirectory(f);
   active = lease;
   call.resolve(new JSObject().put("lease", lease.token()));
  });
 }

 @PluginMethod public void close(PluginCall call) {
  Lease lease;
  synchronized (GracePasswordsOwner.class) {
   lease = active;
   if (lease != null && lease.token().equals(call.getString("lease"))) active = null;
  }
  perform(call, () -> {
   if (staged != null && staged.lease().equals(lease)) discard();
   call.resolve();
  });
 }

 @PluginMethod public void list(PluginCall call) {
  perform(call, () -> {
   Lease lease = current(call);
   List<File> files = catalog(lease);
   JSArray catalog = new JSArray();
   files.sort(Comparator.comparingLong(File::lastModified).reversed());
   for (File folder : files) {
    if (catalog.length() >= MAX_FILES) break;
    catalog.put(entry(folder.getName(), item(folder)));
   }
   current(call);
   call.resolve(new JSObject().put("entries", catalog));
  });
 }

 @PluginMethod public void preview(PluginCall call) {
  perform(call, () -> {
   Lease lease = current(call);
   String id = call.getString("id", "");
   if (!ID.matcher(id).matches()) throw new IllegalArgumentException();
   File folder = folder(lease, id);
   if (folder == null) throw new IOException("File unavailable");
   File file = item(folder);
   int page = call.getInt("page", 0);
   int size = Boolean.TRUE.equals(call.getBoolean("small")) ? 136 : 1300;
   Bitmap bitmap;
   if ("pdf".equals(kind(file.getName()))) {
    try (PdfRenderer pdf = new PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))) {
     if (page < 1 || page > pdf.getPageCount()) throw new IllegalArgumentException();
     try (PdfRenderer.Page selected = pdf.openPage(page - 1)) {
      float scale = (float) size / Math.max(selected.getWidth(), selected.getHeight());
      bitmap = Bitmap.createBitmap(Math.max(1, Math.round(scale * selected.getWidth())), Math.max(1, Math.round(scale * selected.getHeight())), Bitmap.Config.ARGB_8888);
      bitmap.eraseColor(Color.WHITE);
      selected.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
     }
    }
   } else {
    if (page != 0) throw new IllegalArgumentException();
    bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(file), (decoder, info, source) -> {
     int width = info.getSize().getWidth(), height = info.getSize().getHeight();
     float scale = Math.min(1f, (float) size / Math.max(width, height));
     decoder.setTargetSize(Math.max(1, Math.round(scale * width)), Math.max(1, Math.round(scale * height)));
     decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
    });
   }
   try {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 80, bytes) || bytes.size() > 750_000) throw new IOException("Preview unavailable");
    current(call);
    call.resolve(new JSObject().put("id", id).put("page", page).put("image", "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)));
   } finally { bitmap.recycle(); }
  });
 }

 @PluginMethod public void pick(PluginCall call) {
  perform(call, () -> {
   current(call);
   String kind = call.getString("kind", "");
   if (!"pdf".equals(kind) && !"photo".equals(kind)) throw new IllegalArgumentException();
   Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("photo".equals(kind) ? "image/*" : "application/pdf");
   getActivity().runOnUiThread(() -> startActivityForResult(call, intent, "picked"));
  });
 }

 @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
  if (call == null) return;
  Uri uri = result.getData() == null ? null : result.getData().getData();
  if (result.getResultCode() != Activity.RESULT_OK || uri == null) { call.reject("Nothing was chosen", "cancelled"); return; }
  perform(call, () -> {
   current(call);
   String name;
   try (Cursor rows = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
    name = displayName(rows != null && rows.moveToFirst() ? rows.getString(0) : null, call.getString("kind", ""));
   }
   try (InputStream content = getContext().getContentResolver().openInputStream(uri)) { offer(call, stage(call, name, content)); }
  });
 }

 @PluginMethod public void capture(PluginCall call) {
  perform(call, () -> {
   current(call);
   if (getPermissionState("camera") != PermissionState.GRANTED) {
    getActivity().runOnUiThread(() -> requestPermissionForAlias("camera", call, "cameraAllowed"));
    return;
   }
   File folder = new File(getContext().getCacheDir(), "grace-capture");
   if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Capture unavailable");
   File destination = File.createTempFile("capture-", ".jpg", folder);
   call.getData().put("capture", destination.getName());
   Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".grace.capture", destination);
   Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri)
     .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
   intent.setClipData(ClipData.newRawUri("Photo", uri));
   getActivity().runOnUiThread(() -> {
    try { startActivityForResult(call, intent, "captured"); }
    catch (RuntimeException failed) { destination.delete(); call.reject("Camera unavailable", "files_unavailable"); }
   });
  });
 }

 @PermissionCallback private void cameraAllowed(PluginCall call) {
  if (call == null) return;
  if (getPermissionState("camera") == PermissionState.GRANTED) capture(call);
  else call.reject("Camera permission was declined", "denied");
 }

 @ActivityCallback private void captured(PluginCall call, ActivityResult result) {
  if (call == null) return;
  String name = call.getString("capture", "");
  if (!name.matches("capture-[0-9]+\\.jpg")) { call.reject("Capture unavailable", "files_unavailable"); return; }
  File file = new File(getContext().getCacheDir(), "grace-capture/" + name);
  perform(call, () -> {
   try {
    if (result.getResultCode() != Activity.RESULT_OK) { call.reject("No photo was taken", "cancelled"); return; }
    try (InputStream content = Files.newInputStream(file.toPath())) { offer(call, stage(call, "Photo " + System.currentTimeMillis() + ".jpg", content)); }
   } finally { file.delete(); }
  });
 }

 private void offer(PluginCall call, Stage candidate) {
  discard();
  staged = candidate;
  call.resolve(candidate.entry());
 }

 private Stage stage(PluginCall call, String name, InputStream content) throws Exception {
  Lease lease = current(call);
  if (content == null) throw new IOException("File unavailable");
  File owned = library(lease);
  if (catalog(lease).size() >= MAX_FILES) throw new IOException("Library is full");
  String id = UUID.randomUUID().toString();
  return stage(call, lease, new File(owned, "." + id), id, name, content);
 }

 private Stage stage(PluginCall call, Lease lease, File folder, String id, String name, InputStream content) throws Exception {
  if (!folder.mkdir()) throw new IOException("Cannot stage");
  File file = new File(folder, name);
  try {
   try (FileOutputStream output = new FileOutputStream(file)) {
    byte[] buffer = new byte[32_768];
    long copied = 0;
    int count;
    while ((count = content.read(buffer)) != -1) {
     copied += count;
     if (copied > MAX_BYTES) throw new IOException("File too large");
     output.write(buffer, 0, count);
    }
    if (copied == 0) throw new IOException("No content");
    output.getFD().sync();
   }
   if ("photo".equals(kind(name))) {
    Bitmap check = ImageDecoder.decodeBitmap(ImageDecoder.createSource(file), (decoder, info, source) -> decoder.setTargetSize(1, 1));
    check.recycle();
   }
   JSObject ready = entry(id, file);
   current(call);
   return new Stage(lease, id, file, ready);
  } catch (Exception failed) {
   file.delete();
   folder.delete();
   throw failed;
  }
 }

 @PluginMethod public void save(PluginCall call) {
  perform(call, () -> {
   current(call);
   String name = call.getString("name", "");
   String type = kind(name);
   String data = call.getString("data", "");
   if (type.isEmpty() || data.length() > 4 * ((MAX_BYTES + 2) / 3)) throw new IllegalArgumentException();
   try (InputStream content = new ByteArrayInputStream(Base64.decode(data, Base64.DEFAULT))) {
    Stage attachment = stage(call, displayName(name, type), content);
    try { publish(call, attachment); }
    finally {
     attachment.temporary().delete();
     attachment.temporary().getParentFile().delete();
    }
    call.resolve(attachment.entry());
   }
  });
 }

 @PluginMethod public void remove(PluginCall call) {
  perform(call, () -> {
   Lease lease = current(call);
   String id = call.getString("id", "");
   if (!ID.matcher(id).matches()) throw new IllegalArgumentException();
   File folder = folder(lease, id);
   if (folder != null) {
    File removed = new File(library(lease), ".removed-" + id);
    moveCurrent(call, lease, folder, removed);
    discardDirectory(removed);
    File group = folder.getParentFile();
    if (!group.equals(library(lease))) group.delete();
   }
   call.resolve();
  });
 }

 @PluginMethod public void commit(PluginCall call) {
  perform(call, () -> {
   String id = call.getString("id", "");
   Stage candidate = staged;
   if (candidate == null || !candidate.id().equals(id)) throw new SecurityException();
   publish(call, candidate);
   staged = null;
   call.resolve(new JSObject().put("id", id));
  });
 }

 private void publish(PluginCall call, Stage candidate) throws Exception {
  Lease lease = current(call);
  if (!candidate.lease().equals(lease)) throw new SecurityException();
  File destination = new File(library(lease), candidate.id());
  if (destination.exists()) throw new IOException("Already saved");
  moveCurrent(call, lease, candidate.temporary().getParentFile(), destination);
 }
 private void moveCurrent(PluginCall call, Lease lease, File from, File to) throws Exception {
  synchronized (GracePasswordsOwner.class) {
   if (!lease.equals(current(call))) throw new SecurityException();
   Files.move(from.toPath(), to.toPath(), StandardCopyOption.ATOMIC_MOVE);
  }
 }

 private static String text(JSONObject object, String field) throws JSONException {
  Object value = object.get(field);
  if (!(value instanceof String result) || result.isEmpty()) throw new IllegalArgumentException();
  return result;
 }

 private static Attachment attachment(JSONObject input) throws Exception {
  JSONObject raw = input.getJSONObject("file");
  String name = text(raw, "name");
  String kind = kind(name);
  String declared = text(raw, "kind");
  if (!(kind.equals("photo") && declared.equals("Photo") || kind.equals("pdf") && declared.equals("Pdf"))
      || !name.equals(displayName(name, kind))) throw new IllegalArgumentException();
  JSONObject source = new JSONObject();
  for (String field : new String[]{"id","kind","name","origin","account","container","sourceRef","contentRef"}) source.put(field, text(raw, field));
  Object group = raw.get("group"), savedAt = raw.get("savedAt"), pages = raw.get("pages");
  if (!(group instanceof String) || !(savedAt instanceof Integer || savedAt instanceof Long) || ((Number) savedAt).longValue() < 0
      || !(pages instanceof Integer) || (int) pages < 0) throw new IllegalArgumentException();
  source.put("group", group).put("savedAt", savedAt).put("pages", pages);
  String encoded = text(input, "data");
  if (encoded.length() > 4 * ((MAX_BYTES + 2) / 3)) throw new IOException("File too large");
  return new Attachment(source, Source.from(source), text(input, "version"), name, Base64.decode(encoded, Base64.DEFAULT));
 }

 @PluginMethod public void saveAttachments(PluginCall call) {
  perform(call, () -> {
   Lease lease = current(call);
   JSONArray attachments = call.getArray("attachments");
   if (attachments == null || attachments.length() == 0 || attachments.length() > MAX_FILES) throw new IllegalArgumentException();
   List<File> files = catalog(lease);
   Map<Source, File> stored = new HashMap<>();
   for (File folder : files) {
    JSONObject metadata = metadata(folder);
    if (metadata == null) continue;
    Source key = Source.from(metadata.getJSONObject("source"));
    if (stored.put(key, item(folder)) != null) throw new IOException("Duplicate attachment source");
   }
   File groups = batches(lease);
   if (!groups.isDirectory() && !groups.mkdir()) throw new IOException("Library unavailable");
   String batchId = UUID.randomUUID().toString();
   File pending = new File(groups, ".pending-" + batchId);
   if (!pending.mkdir()) throw new IOException("Cannot stage attachments");
   JSArray entries = new JSArray();
   Set<Source> returned = new HashSet<>();
   int count = files.size();
   try {
    for (int index = 0; index < attachments.length(); index++) {
     Attachment a = attachment(attachments.getJSONObject(index));
     File file = stored.get(a.key());
     if (file != null) {
      if (!Arrays.equals(a.bytes(), Files.readAllBytes(file.toPath()))) throw new IOException("Attachment content changed");
     } else {
      if (++count > MAX_FILES) throw new IOException("Library is full");
      String id = UUID.randomUUID().toString();
      Stage staged = stage(call, lease, new File(pending, id), id, a.name(), new ByteArrayInputStream(a.bytes()));
      if (staged.entry().getInt("pages") != a.source().getInt("pages")) throw new IOException("Document page count changed");
      file = staged.temporary();
      JSONObject metadata = new JSONObject().put("source", a.source()).put("version", a.version());
      try (FileOutputStream out = new FileOutputStream(new File(file.getParentFile(), SOURCE))) {
       out.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
       out.getFD().sync();
      }
      stored.put(a.key(), file);
     }
     if (returned.add(a.key())) entries.put(entry(file.getParentFile().getName(), file));
    }
    if (count != files.size()) moveCurrent(call, lease, pending, new File(groups, batchId));
    else current(call);
    call.resolve(new JSObject().put("entries", entries));
   } finally {
    if (pending.exists()) discardDirectory(pending);
   }
  });
 }

}
