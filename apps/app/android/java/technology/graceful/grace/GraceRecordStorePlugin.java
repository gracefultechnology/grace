package technology.graceful.grace;

import android.content.Context;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "GraceRecords")
public class GraceRecordStorePlugin extends Plugin {
 static final Set<String> RECORDS = Set.of("commitments", "preferences", "setup", "memory", "calendar");

 static final class Stale extends Exception {}

 record Stored(long revision, String value) {}

 static File folder(Context context, String name) {
  File folder = new File(context.getFilesDir(), name);
  if (!folder.isDirectory() && !folder.mkdirs()) throw new IllegalStateException("Cannot create " + folder);
  return folder;
 }

 static Stored read(File file) throws IOException, JSONException {
  AtomicFile atomic = new AtomicFile(file);
  if (!atomic.exists()) return new Stored(0, null);
  JSONObject stored = new JSONObject(new String(atomic.readFully(), StandardCharsets.UTF_8));
  return new Stored(stored.getLong("revision"), stored.optString("value", null));
 }

 static long write(File file, long expected, String value) throws IOException, JSONException, Stale {
  try (RandomAccessFile lockFile = new RandomAccessFile(new File(file.getPath() + ".lock"), "rw"); FileLock lock = lockFile.getChannel().lock()) {
   if (read(file).revision() != expected) throw new Stale();
   AtomicFile atomic = new AtomicFile(file);
   FileOutputStream out = atomic.startWrite();
   try {
    out.write(new JSONObject().put("revision", expected + 1).put("value", value).toString().getBytes(StandardCharsets.UTF_8));
    atomic.finishWrite(out);
   } catch (IOException | JSONException failed) {
    atomic.failWrite(out);
    throw failed;
   }
   return expected + 1;
  }
 }

 private File record(PluginCall call) {
  String name = call.getString("name", "");
  if (!RECORDS.contains(name)) throw new IllegalArgumentException("Unknown record " + name);
  return new File(folder(getContext(), "records"), name + ".json");
 }

 @PluginMethod public void read(PluginCall call) {
  try {
   Stored stored = read(record(call));
   call.resolve(new JSObject().put("revision", stored.revision()).put("value", stored.value()));
  } catch (IOException | JSONException | RuntimeException failed) {
   call.reject("The record could not be read", "unreadable", failed);
  }
 }

 @PluginMethod public void write(PluginCall call) {
  Long revision = call.getLong("revision");
  String value = call.getString("value");
  if (revision == null || revision < 0 || value == null) { call.reject("A write needs the revision it read and a value", "invalid"); return; }
  try {
   call.resolve(new JSObject().put("revision", write(record(call), revision, value)));
  } catch (Stale stale) {
   call.reject("The record changed since it was read", "stale");
  } catch (IOException | JSONException | RuntimeException failed) {
   call.reject("The record could not be saved", "unsaved", failed);
  }
 }
}
