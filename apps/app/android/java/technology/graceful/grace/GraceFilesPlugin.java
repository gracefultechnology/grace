package technology.graceful.grace;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.AtomicFile;
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
import java.util.Arrays;
import java.util.Comparator;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@CapacitorPlugin(name = "GraceFiles", permissions = { @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }) })
public class GraceFilesPlugin extends Plugin {
 private File library() { return GraceRecordStorePlugin.folder(getContext(), "library"); }

 private static String kind(String name) {
  String lower = name.toLowerCase(Locale.ROOT);
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.matches(".*\\.(jpe?g|png|webp|heic)$")) return "photo";
  return null;
 }

 private File named(String name) {
  if (name == null || name.isBlank() || name.length() > 200 || name.startsWith(".") || name.contains("/") || kind(name) == null) throw new IllegalArgumentException("Not a photo or PDF name: " + name);
  return new File(library(), name);
 }

 private File unused(String name) {
  File file = named(name);
  int dot = name.lastIndexOf('.');
  for (int copy = 2; file.exists(); copy++) file = named(name.substring(0, dot) + " (" + copy + ")" + name.substring(dot));
  return file;
 }

 private static int pages(File file) throws IOException {
  try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY); PdfRenderer renderer = new PdfRenderer(descriptor)) {
   return renderer.getPageCount();
  }
 }

 private static JSObject entry(File file) throws IOException {
  String kind = kind(file.getName());
  return new JSObject().put("name", file.getName()).put("kind", kind).put("path", file.getAbsolutePath())
   .put("size", file.length()).put("savedAt", file.lastModified()).put("pages", "pdf".equals(kind) ? pages(file) : 0);
 }

 private void copy(InputStream in, File file) throws IOException {
  AtomicFile atomic = new AtomicFile(file);
  FileOutputStream out = atomic.startWrite();
  try (in) {
   in.transferTo(out);
   atomic.finishWrite(out);
  } catch (IOException | RuntimeException failed) {
   atomic.failWrite(out);
   throw failed;
  }
 }

 private void saved(PluginCall call, File file) {
  try {
   call.resolve(entry(file));
  } catch (IOException | RuntimeException unreadable) {
   file.delete();
   call.reject("That file could not be opened", "unreadable", unreadable);
  }
 }

 @PluginMethod public void list(PluginCall call) {
  File[] files = library().listFiles((folder, name) -> kind(name) != null);
  JSArray entries = new JSArray();
  try {
   for (File file : Arrays.stream(files == null ? new File[0] : files).sorted(Comparator.comparingLong(File::lastModified).reversed()).toList()) entries.put(entry(file));
   call.resolve(new JSObject().put("files", entries));
  } catch (IOException | RuntimeException failed) {
   call.reject("The saved files could not be read", "unreadable", failed);
  }
 }

 @PluginMethod public void save(PluginCall call) {
  try {
   File file = unused(call.getString("name"));
   copy(new ByteArrayInputStream(Base64.decode(call.getString("data", ""), Base64.DEFAULT)), file);
   saved(call, file);
  } catch (IOException | RuntimeException failed) {
   call.reject("The file could not be saved", "unsaved", failed);
  }
 }

 @PluginMethod public void remove(PluginCall call) {
  try {
   File file = named(call.getString("name"));
   if (file.exists() && !file.delete()) throw new IOException("Could not delete " + file.getName());
   call.resolve();
  } catch (IOException | RuntimeException failed) {
   call.reject("The file could not be removed", "unsaved", failed);
  }
 }

 @PluginMethod public void page(PluginCall call) {
  int number = call.getInt("page", 1), width = call.getInt("width", 1200);
  try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(named(call.getString("name")), ParcelFileDescriptor.MODE_READ_ONLY); PdfRenderer renderer = new PdfRenderer(descriptor)) {
   if (number < 1 || number > renderer.getPageCount() || width < 1 || width > 4096) throw new IllegalArgumentException("No page " + number);
   try (PdfRenderer.Page page = renderer.openPage(number - 1)) {
    Bitmap bitmap = Bitmap.createBitmap(width, Math.max(1, width * page.getHeight() / page.getWidth()), Bitmap.Config.ARGB_8888);
    bitmap.eraseColor(Color.WHITE);
    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
    ByteArrayOutputStream png = new ByteArrayOutputStream();
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
    bitmap.recycle();
    call.resolve(new JSObject().put("image", "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP)).put("pages", renderer.getPageCount()));
   }
  } catch (IOException | RuntimeException failed) {
   call.reject("That page could not be shown", "unreadable", failed);
  }
 }

 @PluginMethod public void choose(PluginCall call) {
  boolean photo = "photo".equals(call.getString("kind"));
  Intent intent = photo && Build.VERSION.SDK_INT >= 33
   ? new Intent(MediaStore.ACTION_PICK_IMAGES)
   : new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(photo ? "image/*" : "application/pdf");
  startActivityForResult(call, intent, "chosen");
 }

 @ActivityCallback private void chosen(PluginCall call, ActivityResult result) {
  Uri uri = result.getData() == null ? null : result.getData().getData();
  if (result.getResultCode() != Activity.RESULT_OK || uri == null) { call.reject("Nothing was chosen", "cancelled"); return; }
  try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
   String name = cursor != null && cursor.moveToFirst() ? cursor.getString(0) : null;
   File file = unused(name);
   copy(getContext().getContentResolver().openInputStream(uri), file);
   saved(call, file);
  } catch (IOException | RuntimeException failed) {
   call.reject("That file could not be saved", "unsaved", failed);
  }
 }

 @PluginMethod public void capture(PluginCall call) {
  if (getPermissionState("camera") != PermissionState.GRANTED) { requestPermissionForAlias("camera", call, "cameraAllowed"); return; }
  File file = unused("Photo " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH.mm.ss")) + ".jpg");
  call.getData().put("file", file.getName());
  Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".files", file);
  startActivityForResult(call, new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri).addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION), "captured");
 }

 @PermissionCallback private void cameraAllowed(PluginCall call) {
  if (getPermissionState("camera") == PermissionState.GRANTED) capture(call);
  else call.reject("The camera is not allowed", "denied");
 }

 @ActivityCallback private void captured(PluginCall call, ActivityResult result) {
  File file = named(call.getString("file"));
  if (result.getResultCode() != Activity.RESULT_OK || file.length() == 0) { file.delete(); call.reject("No photo was taken", "cancelled"); return; }
  saved(call, file);
 }
}
