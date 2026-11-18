package technology.graceful.grace;

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
import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "GraceFiles", permissions = { @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }) })
public final class GraceFiles extends Plugin {
 private static final long MAX_BYTES = 20L * 1024 * 1024;
 private static final int MAX_FILES = 250;
 private static final Pattern ID = Pattern.compile("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}");
 private final ExecutorService disk = Executors.newSingleThreadExecutor();
 private volatile Lease active;
 private Stage staged;
 private record Lease(String token, String owner) {}
 private record Stage(Lease lease, String id, File temporary, JSObject entry) {}
 private interface Work { void run() throws Exception; }

 private void perform(PluginCall call, Work work) {
  disk.execute(() -> {
   try { work.run(); }
   catch (SecurityException denied) { call.reject("Files need the current device account", "account_changed"); }
   catch (Exception failed) { call.reject("Grace couldn't finish that file request", "files_unavailable"); }
  });
 }

 private String owner() throws Exception {
  var account = GraceAccount.account(getContext()).session();
  if (account == null) throw new SecurityException();
  byte[] digest = MessageDigest.getInstance("SHA-256").digest(("grace-files\u0000" + account.accountId()).getBytes(StandardCharsets.UTF_8));
  StringBuilder name = new StringBuilder();
  for (byte value : digest) name.append(String.format(Locale.ROOT, "%02x", value & 0xff));
  return name.toString();
 }

 private Lease current(PluginCall call) throws Exception {
  Lease lease = active;
  if (lease == null || !lease.token().equals(call.getString("lease")) || !lease.owner().equals(owner())) throw new SecurityException();
  return lease;
 }

 private File library(Lease lease) throws IOException {
  File folder = new File(getContext().getNoBackupFilesDir(), "grace-files/" + lease.owner());
  if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Library unavailable");
  return folder;
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
  return new JSObject().put("id", id).put("name", file.getName()).put("kind", kind(file.getName()))
    .put("savedAt", file.lastModified()).put("pages", pages(file));
 }

 private void discard() {
  if (staged == null) return;
  staged.temporary().delete();
  staged.temporary().getParentFile().delete();
  staged = null;
 }

 @PluginMethod public void open(PluginCall call) {
  perform(call, () -> {
   String owner = owner();
   discard();
   Lease lease = new Lease(UUID.randomUUID().toString(), owner);
   library(lease);
   active = lease;
   call.resolve(new JSObject().put("lease", lease.token()));
  });
 }

 @PluginMethod public void close(PluginCall call) {
  Lease lease = active;
  if (lease != null && lease.token().equals(call.getString("lease"))) active = null;
  perform(call, () -> {
   if (staged != null && staged.lease().equals(lease)) discard();
   call.resolve();
  });
 }

 @PluginMethod public void list(PluginCall call) {
  perform(call, () -> {
   Lease lease = current(call);
   File[] files = library(lease).listFiles(file -> file.isDirectory() && ID.matcher(file.getName()).matches());
   if (files == null) throw new IOException("Catalog unavailable");
   JSArray catalog = new JSArray();
   Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
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
   File file = item(new File(library(lease), id));
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
     .setClipData(ClipData.newRawUri("Photo", uri)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
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
  File[] existing = owned.listFiles(file -> file.isDirectory() && ID.matcher(file.getName()).matches());
  if (existing == null || existing.length >= MAX_FILES) throw new IOException("Library is full");
  String id = UUID.randomUUID().toString();
  File folder = new File(owned, "." + id);
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
   File folder = new File(library(lease), id);
   if (folder.exists()) {
    File file = item(folder);
    current(call);
    File removed = new File(folder.getParentFile(), ".removed-" + id);
    Files.move(folder.toPath(), removed.toPath(), StandardCopyOption.ATOMIC_MOVE);
    Files.delete(new File(removed, file.getName()).toPath());
    Files.delete(removed.toPath());
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
  current(call);
  Files.move(candidate.temporary().getParentFile().toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE);
 }
}
