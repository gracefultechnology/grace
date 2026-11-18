package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordSurfaces;
import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "GraceGuideSpeech", permissions = @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO}))
public final class GraceGuideSpeechPlugin extends Plugin {
 private PluginCall active;
 private SpeechRecognizer recognizer;
 private final WebViewListener renderer = new WebViewListener() {
  @Override public void onPageStarted(WebView view) { finish(active, "cancelled", null); }
 };
 private final PasswordSurfaces.Listener privateSurface = visible -> {
  if (visible) finish(active, "cancelled", null);
 };

 @Override public void load() {
  PasswordSurfaces.addListener(privateSurface);
  getBridge().addWebViewListener(renderer);
 }

 private boolean permittedSurface() {
  return getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)
    && !PasswordSurfaces.visible()
    && (getActivity().getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) == 0;
 }

 @PluginMethod public void listen(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   if (call.getString("id") == null || active != null || !permittedSurface()) {
    call.resolve(result("cancelled", null));
    return;
   }
   if (!hasRecognizer()) {
    call.resolve(result("unavailable", null));
    return;
   }
   active = call;
   if (getPermissionState("microphone") == PermissionState.GRANTED) start(call);
   else requestPermissionForAlias("microphone", call, "permissionReturned");
  });
 }

 private boolean hasRecognizer() {
  try {
   return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
     && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
  } catch (RuntimeException unavailable) {
   return false;
  }
 }

 @PermissionCallback private void permissionReturned(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   if (active != call) return;
   if (getPermissionState("microphone") == PermissionState.GRANTED && permittedSurface()) start(call);
   else finish(call, "unavailable", null);
  });
 }

 private void start(PluginCall call) {
  try {
   recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
   recognizer.setRecognitionListener(new RecognitionListener() {
    @Override public void onResults(Bundle results) {
     var matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
     String text = matches == null || matches.isEmpty() ? null : matches.get(0);
     if (!permittedSurface()) finish(call, "cancelled", null);
     else if (text == null || text.isBlank() || text.length() > 160) finish(call, "no-match", null);
     else finish(call, "complete", text);
    }
    @Override public void onError(int error) {
     finish(call, error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
       ? "no-match" : "unavailable", null);
    }
    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onPartialResults(Bundle partialResults) {}
    @Override public void onEvent(int eventType, Bundle params) {}
   });
   recognizer.startListening(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
     .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
     .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
     .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
     .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1));
  } catch (RuntimeException unavailable) {
   finish(call, "unavailable", null);
  }
 }

 @PluginMethod public void cancel(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   String id = call.getString("id");
   if (active != null && id != null && id.equals(active.getString("id"))) finish(active, "cancelled", null);
   call.resolve();
  });
 }

 private static JSObject result(String status, String text) {
  var result = new JSObject().put("status", status);
  if (text != null) result.put("text", text);
  return result;
 }

 private void finish(PluginCall call, String status, String text) {
  if (call == null || call != active) return;
  active = null;
  if (recognizer != null) {
   recognizer.destroy();
   recognizer = null;
  }
  call.resolve(result(status, text));
 }

 @Override protected void handleOnPause() {
  finish(active, "cancelled", null);
 }

 @Override protected void handleOnDestroy() {
  PasswordSurfaces.removeListener(privateSurface);
  getBridge().removeWebViewListener(renderer);
  finish(active, "cancelled", null);
 }
}
