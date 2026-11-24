package technology.graceful.grace;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.wifi.WifiConfiguration;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.util.function.Consumer;

@SuppressWarnings("deprecation")
final class GraceWifiJoin {
 private static final long TIMEOUT_MS = 30_000L;
 private static final long POLL_MS = 1_000L;
 private static final long RADIO_MS = 10_000L;
 private static final long RADIO_POLL_MS = 250L;

 enum Security { OPEN, OWE, WPA2, WPA3 }

 private final Context context;
 private final WifiManager wifi;
 private final ConnectivityManager connectivity;
 private final Handler main = new Handler(Looper.getMainLooper());

 GraceWifiJoin(Context context) {
  this.context = context;
  this.wifi = context.getSystemService(WifiManager.class);
  this.connectivity = context.getSystemService(ConnectivityManager.class);
 }

 static Security security(String name) {
  if (name == null) return null;
  return switch (name) {
   case "open" -> Security.OPEN;
   case "owe" -> Security.OWE;
   case "wpa2" -> Security.WPA2;
   case "wpa3" -> Security.WPA3;
   default -> null;
  };
 }

 static boolean acceptsPassword(Security security, String password) {
  boolean shared = security == Security.WPA2 || security == Security.WPA3;
  if (!shared) return password == null;
  return password != null && password.length() >= 8 && password.length() <= 63;
 }

 void turnOn(PluginCall call) {
  if (!wifi.setWifiEnabled(true)) {
   call.reject("Android did not turn Wi-Fi on", "WIFI_REQUEST_FAILED");
   return;
  }
  long deadline = System.currentTimeMillis() + RADIO_MS;
  Runnable[] check = { null };
  check[0] = () -> {
   if (wifi.isWifiEnabled()) call.resolve();
   else if (System.currentTimeMillis() >= deadline) call.reject("Wi-Fi did not come on", "WIFI_REQUEST_FAILED");
   else main.postDelayed(check[0], RADIO_POLL_MS);
  };
  main.post(check[0]);
 }

 void join(String ssid, Security security, String password, PluginCall call) {
  forget(ssid);
  int id = wifi.addNetwork(configuration(ssid, security, password));
  if (id == -1) {
   call.reject("Android did not take the network", "WIFI_REQUEST_FAILED");
   return;
  }
  if (!wifi.enableNetwork(id, true)) {
   wifi.removeNetwork(id);
   call.reject("Android did not start the join", "WIFI_REQUEST_FAILED");
   return;
  }
  wifi.reconnect();
  await(ssid, id, password != null, status -> {
   if (!"connected".equals(status) && !"captivePortal".equals(status)) wifi.removeNetwork(id);
   call.resolve(new JSObject().put("status", status));
  });
 }

 private void forget(String ssid) {
  String quoted = "\"" + ssid + "\"";
  for (WifiConfiguration saved : wifi.getConfiguredNetworks()) {
   if (quoted.equals(saved.SSID)) wifi.removeNetwork(saved.networkId);
  }
 }

 private static WifiConfiguration configuration(String ssid, Security security, String password) {
  WifiConfiguration config = new WifiConfiguration();
  config.SSID = "\"" + ssid + "\"";
  if (password != null) config.preSharedKey = "\"" + password + "\"";
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
   config.setSecurityParams(switch (security) {
    case OPEN -> WifiConfiguration.SECURITY_TYPE_OPEN;
    case OWE -> WifiConfiguration.SECURITY_TYPE_OWE;
    case WPA2 -> WifiConfiguration.SECURITY_TYPE_PSK;
    case WPA3 -> WifiConfiguration.SECURITY_TYPE_SAE;
   });
  } else {
   config.allowedKeyManagement.set(switch (security) {
    case OPEN -> WifiConfiguration.KeyMgmt.NONE;
    case OWE -> WifiConfiguration.KeyMgmt.OWE;
    case WPA2 -> WifiConfiguration.KeyMgmt.WPA_PSK;
    case WPA3 -> WifiConfiguration.KeyMgmt.SAE;
   });
  }
  return config;
 }

 private void await(String ssid, int id, boolean shared, Consumer<String> settle) {
  String quoted = "\"" + ssid + "\"";
  boolean[] done = { false };
  ConnectivityManager.NetworkCallback[] watch = { null };
  Runnable[] poll = { null };
  BroadcastReceiver[] supplicant = { null };
  Consumer<String> finish = status -> main.post(() -> {
   if (done[0]) return;
   done[0] = true;
   connectivity.unregisterNetworkCallback(watch[0]);
   context.unregisterReceiver(supplicant[0]);
   main.removeCallbacks(poll[0]);
   settle.accept(status);
  });
  watch[0] = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
   ? new ConnectivityManager.NetworkCallback(ConnectivityManager.NetworkCallback.FLAG_INCLUDE_LOCATION_INFO) {
     @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) { observe(capabilities, quoted, finish); }
    }
   : new ConnectivityManager.NetworkCallback() {
     @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) { observe(capabilities, quoted, finish); }
    };
  connectivity.registerNetworkCallback(new NetworkRequest.Builder()
   .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
   .build(), watch[0]);
  supplicant[0] = new BroadcastReceiver() {
   @Override public void onReceive(Context ignored, Intent intent) {
    if (shared && intent.getIntExtra(WifiManager.EXTRA_SUPPLICANT_ERROR, -1) == WifiManager.ERROR_AUTHENTICATING) finish.accept("wrongPassword");
   }
  };
  context.registerReceiver(supplicant[0], new IntentFilter(WifiManager.SUPPLICANT_STATE_CHANGED_ACTION), null, main);
  long deadline = System.currentTimeMillis() + TIMEOUT_MS;
  poll[0] = () -> {
   if (shared && rejectedPassword(id)) finish.accept("wrongPassword");
   else if (System.currentTimeMillis() >= deadline) finish.accept("notConnected");
   else main.postDelayed(poll[0], POLL_MS);
  };
  main.postDelayed(poll[0], POLL_MS);
 }

 private void observe(NetworkCapabilities capabilities, String quoted, Consumer<String> finish) {
  WifiInfo info = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && capabilities.getTransportInfo() instanceof WifiInfo shown
   ? shown : wifi.getConnectionInfo();
  if (info == null || !quoted.equals(info.getSSID())) return;
  if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)) finish.accept("captivePortal");
  else if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) finish.accept("connected");
 }

 // Android switches a saved network off once its password is refused; the
 // network-selection reason that names the password is not open to apps.
 private boolean rejectedPassword(int id) {
  for (WifiConfiguration saved : wifi.getConfiguredNetworks()) {
   if (saved.networkId == id) return saved.status == WifiConfiguration.Status.DISABLED;
  }
  return false;
 }
}
