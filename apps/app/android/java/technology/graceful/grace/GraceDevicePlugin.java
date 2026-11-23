package technology.graceful.grace;

import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GraceDevice")
public class GraceDevicePlugin extends Plugin {
 private static final int MEDIA = AudioManager.STREAM_MUSIC;
 private AudioManager audio;
 private final BroadcastReceiver screen = new BroadcastReceiver() {
  @Override public void onReceive(Context context, Intent intent) {
   notifyListeners("screen", new JSObject().put("on", Intent.ACTION_SCREEN_ON.equals(intent.getAction())));
  }
 };

 @Override public void load() {
  audio = getContext().getSystemService(AudioManager.class);
  IntentFilter changes = new IntentFilter(Intent.ACTION_SCREEN_ON);
  changes.addAction(Intent.ACTION_SCREEN_OFF);
  ContextCompat.registerReceiver(getContext(), screen, changes, ContextCompat.RECEIVER_NOT_EXPORTED);
 }

 @Override protected void handleOnResume() {
  super.handleOnResume();
  notifyListeners("volume", volume());
 }

 @Override protected void handleOnDestroy() {
  getContext().unregisterReceiver(screen);
  super.handleOnDestroy();
 }

 void stepVolume(boolean up) {
  audio.adjustStreamVolume(MEDIA, up ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER, 0);
  notifyListeners("volume", volume());
 }

 @PluginMethod public void getDevice(PluginCall call) {
  call.resolve(new JSObject()
   .put("volume", volume())
   .put("brightness", brightness())
   .put("battery", battery())
   .put("screenOn", getContext().getSystemService(PowerManager.class).isInteractive()));
 }

 @SuppressWarnings("deprecation")
 @PluginMethod public void getWifiSignIn(PluginCall call) {
  ConnectivityManager connectivity = getContext().getSystemService(ConnectivityManager.class);
  for (Network network : connectivity.getAllNetworks()) {
   NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
   if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
     && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)) {
    call.resolve(new JSObject().put("required", true));
    return;
   }
  }
  call.resolve(new JSObject().put("required", false));
 }

 @PluginMethod public void openWifiSignIn(PluginCall call) {
  getBridge().executeOnMainThread(() -> {
   try {
    getActivity().startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS));
    call.resolve();
   } catch (ActivityNotFoundException | SecurityException unavailable) {
    call.reject("Android’s Wi-Fi settings could not be opened", "unavailable", unavailable);
   }
  });
 }

 @PluginMethod public void setVolume(PluginCall call) {
  Integer step = call.getInt("step");
  if (step == null || step < audio.getStreamMinVolume(MEDIA) || step > audio.getStreamMaxVolume(MEDIA)) {
   call.reject("The volume step is outside the device's steps", "invalid-step");
   return;
  }
  audio.setStreamVolume(MEDIA, step, 0);
  Boolean muted = call.getBoolean("muted");
  if (muted != null && audio.isStreamMute(MEDIA) != muted) {
   audio.adjustStreamVolume(MEDIA, muted ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE, 0);
  }
  call.resolve(volume());
 }

 @PluginMethod public void setBrightness(PluginCall call) {
  Integer percent = call.getInt("percent");
  if (percent == null || percent < 0 || percent > 100) {
   call.reject("The brightness is outside 0 to 100 percent", "invalid-percent");
   return;
  }
  getBridge().executeOnMainThread(() -> {
   Window window = getActivity().getWindow();
   WindowManager.LayoutParams attributes = window.getAttributes();
   attributes.screenBrightness = percent / 100f;
   window.setAttributes(attributes);
   call.resolve(brightness());
  });
 }

 private JSObject volume() {
  return new JSObject().put("step", audio.getStreamVolume(MEDIA)).put("min", audio.getStreamMinVolume(MEDIA)).put("max", audio.getStreamMaxVolume(MEDIA)).put("muted", audio.isStreamMute(MEDIA));
 }

 private JSObject brightness() {
  float level = getActivity().getWindow().getAttributes().screenBrightness;
  return level < 0 ? new JSObject() : new JSObject().put("percent", Math.round(level * 100));
 }

 private JSObject battery() {
  BatteryManager battery = getContext().getSystemService(BatteryManager.class);
  int percent = battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
  JSObject facts = new JSObject().put("charging", battery.isCharging());
  return percent < 0 ? facts : facts.put("percent", percent);
 }
}
