package technology.graceful.grace;

import android.Manifest;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "GraceWake", permissions = {
 @Permission(alias = "microphone", strings = Manifest.permission.RECORD_AUDIO)
})
public final class GraceWakePlugin extends Plugin {
 private static final String MICROPHONE = "microphone";
 private final ExecutorService worker = Executors.newSingleThreadExecutor();
 private final List<PluginCall> stops = new ArrayList<>();
 private final List<PluginCall> chimes = new ArrayList<>();
 private AudioManager audio;
 private KeyguardManager keyguard;
 private GraceWakeDetector detector;
 private GraceWakeDetector.Capture capture;
 private Long generation;
 private MediaPlayer chime;
 private boolean modelReady;
 private boolean captureFailed;
 private boolean resumed;
 private boolean destroyed;
 private boolean screenReceiverRegistered;
 private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
  @Override public void onReceive(Context context, Intent intent) {
   onMain(GraceWakePlugin.this::reconcile);
  }
 };

 @Override public void load() {
  audio = getContext().getSystemService(AudioManager.class);
  keyguard = getContext().getSystemService(KeyguardManager.class);
  IntentFilter filter = new IntentFilter(Intent.ACTION_USER_PRESENT);
  filter.addAction(Intent.ACTION_SCREEN_OFF);
  ContextCompat.registerReceiver(getContext(), screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
  screenReceiverRegistered = true;
  if (!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_MICROPHONE)) return;
  worker.execute(() -> {
   try {
    detector = new GraceWakeDetector(getContext().getAssets());
    onMain(() -> {
     if (destroyed) return;
     modelReady = true;
     reportAndReconcile();
    });
   } catch (RuntimeException | LinkageError failure) {
    Log.w("GraceWake", "Local keyword model could not start", failure);
   }
  });
 }

 @PluginMethod public void status(PluginCall call) {
  onMain(() -> call.resolve(currentStatus()));
 }

 @PluginMethod public void requestPermission(PluginCall call) {
  onMain(() -> {
   if (!available() || permitted()) call.resolve(currentStatus());
   else requestPermissionForAlias(MICROPHONE, call, "microphonePermission");
  });
 }

 @PermissionCallback private void microphonePermission(PluginCall call) {
  onMain(() -> {
   call.resolve(currentStatus());
   reportAndReconcile();
  });
 }

 @PluginMethod public void configure(PluginCall call) {
  Object value = call.getData().opt("generation");
  if (value == JSONObject.NULL) {
   onMain(() -> {
    generation = null;
    if (capture == null) call.resolve();
    else stops.add(call);
    reconcile();
   });
   return;
  }
  if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())
   || number.doubleValue() != number.longValue() || number.longValue() < 0 || number.longValue() > 9_007_199_254_740_991L) {
   call.reject("Invalid wake generation", "invalid-generation");
   return;
  }
  onMain(() -> {
   generation = number.longValue();
   reconcile();
   call.resolve();
  });
 }

 @PluginMethod public void chime(PluginCall call) {
  onMain(() -> {
   if (!resumed || audio.isStreamMute(AudioManager.STREAM_MUSIC) || audio.getStreamVolume(AudioManager.STREAM_MUSIC) == 0) {
    call.resolve();
    return;
   }
   chimes.add(call);
   if (chime != null) return;
   try {
    chime = MediaPlayer.create(getContext(), R.raw.grace_wake_chime, new AudioAttributes.Builder()
     .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(), 0);
    if (chime == null) {
     finishChime();
     return;
    }
    reconcile();
    chime.setOnCompletionListener(player -> finishChime());
    chime.setOnErrorListener((player, what, extra) -> { finishChime(); return true; });
    chime.start();
   } catch (RuntimeException failure) {
    finishChime();
   }
  });
 }

 @Override protected void handleOnResume() {
  resumed = true;
  captureFailed = false;
  reportAndReconcile();
 }

 @Override protected void handleOnPause() {
  resumed = false;
  reconcile();
  finishChime();
 }

 @Override protected void handleOnDestroy() {
  destroyed = true;
  if (screenReceiverRegistered) {
   screenReceiverRegistered = false;
   try { getContext().unregisterReceiver(screenReceiver); } catch (IllegalArgumentException ignored) { }
  }
  reconcile();
  finishChime();
  worker.execute(() -> { if (detector != null) detector.close(); });
  worker.shutdown();
 }

 private void onMain(Runnable action) {
  var bridge = getBridge();
  if (bridge != null) bridge.executeOnMainThread(action);
 }

 private boolean permitted() {
  return getPermissionState(MICROPHONE) == PermissionState.GRANTED;
 }

 private boolean available() {
  return modelReady && !captureFailed;
 }

 private JSObject currentStatus() {
  return new JSObject().put("available", available()).put("permitted", permitted());
 }

 private void reportAndReconcile() {
  notifyListeners("wakeStatus", currentStatus());
  reconcile();
 }

 private boolean ready() {
  return !destroyed && available() && resumed && chime == null && permitted() && !keyguard.isKeyguardLocked();
 }

 private void reconcile() {
  Long wanted = ready() ? generation : null;
  if (capture != null) {
   if (wanted == null || capture.generation != wanted) capture.cancelled = true;
  } else if (wanted != null) {
   var next = new GraceWakeDetector.Capture(wanted);
   capture = next;
   worker.execute(() -> process(next));
  }
 }

 private void process(GraceWakeDetector.Capture session) {
  boolean detected = false;
  boolean failed = false;
  try {
   detected = detector.listen(session, this::playbackActive);
  } catch (RuntimeException | LinkageError failure) {
   failed = !session.cancelled;
   if (failed) Log.w("GraceWake", "Local keyword capture stopped", failure);
  } finally {
   boolean heard = detected;
   boolean unavailable = failed;
   onMain(() -> complete(session, heard, unavailable));
  }
 }

 private boolean playbackActive() {
  return audio.isMusicActive();
 }

 private void complete(GraceWakeDetector.Capture session, boolean heard, boolean failed) {
  capture = null;
  for (PluginCall stop : stops) stop.resolve();
  stops.clear();
  if (!session.cancelled && generation != null && generation == session.generation) {
   if (failed && permitted()) {
    captureFailed = true;
    notifyListeners("wakeStatus", currentStatus());
   } else if (heard && ready() && !playbackActive()) {
    generation = null;
    notifyListeners("wakeDetected", new JSObject().put("generation", session.generation));
   }
  }
  reconcile();
 }

 private void finishChime() {
  if (chime != null) {
   chime.release();
   chime = null;
  }
  for (PluginCall call : chimes) call.resolve();
  chimes.clear();
  reconcile();
 }
}
