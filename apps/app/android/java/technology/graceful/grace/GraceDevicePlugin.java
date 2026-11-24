package technology.graceful.grace;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import ai.eliza.plugins.wifi.WiFiStateReader;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GraceDevice")
public class GraceDevicePlugin extends Plugin {
 private static final int MEDIA = AudioManager.STREAM_MUSIC;
 private static final String VOLUME_CHANGED = "android.media.VOLUME_CHANGED_ACTION";
 private static final String MUTE_CHANGED = "android.media.STREAM_MUTE_CHANGED_ACTION";
 private static final String STREAM_TYPE = "android.media.EXTRA_VOLUME_STREAM_TYPE";
 private AudioManager audio;
 private final BroadcastReceiver reports = new BroadcastReceiver() {
  @Override public void onReceive(Context context, Intent intent) {
   String action = intent.getAction();
   if (VOLUME_CHANGED.equals(action) || MUTE_CHANGED.equals(action)) {
    if (intent.getIntExtra(STREAM_TYPE, MEDIA) == MEDIA) notifyListeners("volume", volume());
   } else notifyListeners("screen", new JSObject().put("on", Intent.ACTION_SCREEN_ON.equals(action)));
  }
 };

 @Override public void load() {
  audio = getContext().getSystemService(AudioManager.class);
  IntentFilter changes = new IntentFilter(Intent.ACTION_SCREEN_ON);
  changes.addAction(Intent.ACTION_SCREEN_OFF);
  changes.addAction(VOLUME_CHANGED);
  changes.addAction(MUTE_CHANGED);
  ContextCompat.registerReceiver(getContext(), reports, changes, ContextCompat.RECEIVER_NOT_EXPORTED);
 }

 @Override protected void handleOnDestroy() {
  getContext().unregisterReceiver(reports);
  super.handleOnDestroy();
 }

 void stepVolume(boolean up) {
  audio.adjustStreamVolume(MEDIA, up ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER, 0);
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
  MainActivity activity = getActivity() instanceof MainActivity host ? host : null;
  boolean hasIdentity = activity != null
   && getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
   && getContext().getSystemService(LocationManager.class).isLocationEnabled();
  boolean required = false;
  boolean validated = false;
  JSArray access = new JSArray();
  for (Network network : connectivity.getAllNetworks()) {
   NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
   if (capabilities == null || !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
     || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue;
   if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)) {
    required = true;
    continue;
   }
   if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) continue;
   validated = true;
   if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || activity == null || !hasIdentity) continue;
   WifiInfo info = activity.validatedWifi(network);
   if (info == null) continue;
   String ssid = WiFiStateReader.Companion.disclosedSsid(info.getSSID());
   String bssid = info.getBSSID();
   int security = info.getCurrentSecurityType();
   if (ssid == null || bssid == null || security == WifiInfo.SECURITY_TYPE_UNKNOWN) continue;
   boolean secured = security != WifiInfo.SECURITY_TYPE_OPEN && security != WifiInfo.SECURITY_TYPE_OWE;
   access.put(new JSObject().put("ssid", ssid).put("bssid", bssid).put("secured", secured));
  }
  JSObject status = new JSObject().put("required", required).put("validated", validated);
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) status.put("access", access);
  call.resolve(status);
 }

 @PluginMethod public void turnOnWifi(PluginCall call) {
  if (!GraceDeviceOwner.manages(getContext())) call.reject("Grace does not manage this tablet", "NOT_MANAGED");
  else getBridge().executeOnMainThread(() -> new GraceWifiJoin(getContext()).turnOn(call));
 }

 @PluginMethod public void joinWifi(PluginCall call) {
  String ssid = call.getString("ssid");
  GraceWifiJoin.Security security = GraceWifiJoin.security(call.getString("security"));
  String password = call.getString("password");
  call.getData().remove("password");
  if (!GraceDeviceOwner.manages(getContext())) {
   call.reject("Grace does not manage this tablet", "NOT_MANAGED");
  } else if (ssid == null || ssid.isEmpty() || security == null || !GraceWifiJoin.acceptsPassword(security, password)) {
   call.reject("The network or its password is not one Android can join", "INVALID_ARGUMENT");
  } else {
   getBridge().executeOnMainThread(() -> new GraceWifiJoin(getContext()).join(ssid, security, password, call));
  }
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
