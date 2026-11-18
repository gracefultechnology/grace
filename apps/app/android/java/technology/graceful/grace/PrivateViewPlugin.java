package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordSurfaces;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GracePrivateView")
public final class PrivateViewPlugin extends Plugin {
 private boolean vault;
 private boolean browser;
 private TextToSpeech speech;
 private volatile boolean speechReady;
 private final PasswordSurfaces.Listener secretSurface = visible -> {
  if (visible) stopSpeech();
 };

 @Override public void load() {
  PasswordSurfaces.addListener(secretSurface);
  speech = new TextToSpeech(getContext(), status -> speechReady = status == TextToSpeech.SUCCESS);
 }

 @PluginMethod public void protect(PluginCall call) {
  String view = call.getString("view");
  Boolean active = call.getBoolean("active");
  if (active == null || !("vault".equals(view) || "browser".equals(view))) {
   call.reject("Invalid private view");
   return;
  }
  getActivity().runOnUiThread(() -> {
   if ("vault".equals(view)) {
    vault = active;
    if (!active) stopSpeech();
   } else {
    browser = active;
   }
   if (vault || browser) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
   else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
   call.resolve();
  });
 }

 @PluginMethod public void openLockSettings(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   try {
    getActivity().startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
    call.resolve();
   } catch (ActivityNotFoundException | SecurityException unavailable) {
    call.reject("Android security settings are unavailable");
   }
  });
 }

 @PluginMethod public void readHelp(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   if (!vault || PasswordSurfaces.visible() || !speechReady || speech == null
       || speech.speak(getContext().getString(R.string.grace_passwords_help), TextToSpeech.QUEUE_FLUSH, null, "passwords-help") == TextToSpeech.ERROR) {
    call.reject("Spoken help is unavailable");
    return;
   }
   call.resolve();
  });
 }

 @PluginMethod public void stopHelp(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   stopSpeech();
   call.resolve();
  });
 }

 private void stopSpeech() {
  if (speech != null) speech.stop();
 }

 @Override protected void handleOnStop() {
  stopSpeech();
 }

 @Override protected void handleOnDestroy() {
  PasswordSurfaces.removeListener(secretSurface);
  if (speech != null) speech.shutdown();
 }
}
