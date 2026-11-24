package technology.graceful.grace;

import android.content.Context;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "GraceRecords")
public class GraceRecordStorePlugin extends Plugin {
 static final Set<String> RECORDS = new HashSet<>(Arrays.asList("commitments", "preferences", "setup", "memory", "calendar"));
 private static final ExecutorService IO = Executors.newSingleThreadExecutor();

 static final class Stale extends Exception {}

 record Stored(long revision, String value) {}

 static File folder(Context context, String name) {
  File folder = new File(context.getFilesDir(), name);
  if (!folder.isDirectory() && !folder.mkdirs()) throw new IllegalStateException("Cannot create " + folder);
  return folder;
 }

 static Stored load(File file) throws IOException, JSONException {
  try {
   JSONObject stored = new JSONObject(new String(new AtomicFile(file).readFully(), StandardCharsets.UTF_8));
   return new Stored(stored.getLong("revision"), stored.optString("value", null));
  } catch (FileNotFoundException absent) {
   return new Stored(0, null);
  }
 }

 static long commit(File file, long expected, String value) throws IOException, JSONException, Stale {
  try (RandomAccessFile lockFile = new RandomAccessFile(new File(file.getPath() + ".lock"), "rw"); FileLock lock = lockFile.getChannel().lock()) {
   if (load(file).revision() != expected) throw new Stale();
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
  if (!RECORDS.contains(name) && !name.matches("guided-task-[a-f0-9]{64}")) throw new IllegalArgumentException("Unknown record " + name);
  return new File(folder(getContext(), "records"), name + ".json");
 }

 @PluginMethod public void read(PluginCall call) {
  IO.execute(() -> {
   try {
    Stored stored = load(record(call));
    call.resolve(new JSObject().put("revision", stored.revision()).put("value", stored.value()));
   } catch (IOException | JSONException | RuntimeException failed) {
    call.reject("The record could not be read", "unreadable", failed);
   }
  });
 }

 @PluginMethod public void write(PluginCall call) {
  long revision = call.getLong("revision", call.getInt("revision", -1).longValue());
  String value = call.getString("value");
  if (revision < 0 || value == null) { call.reject("A write needs the revision it read and a value", "invalid"); return; }
  IO.execute(() -> {
   try {
    call.resolve(new JSObject().put("revision", commit(record(call), revision, value)));
   } catch (Stale stale) {
    call.reject("The record changed since it was read", "stale");
   } catch (IOException | JSONException | RuntimeException failed) {
    call.reject("The record could not be saved", "unsaved", failed);
   }
  });
 }
}
