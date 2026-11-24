package technology.graceful.grace;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.KeyEvent;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.annotation.RequiresApi;
import java.util.concurrent.ConcurrentHashMap;
import ai.eliza.plugins.agent.embedded.EmbeddedAgentPlugin;
import ai.eliza.plugins.browsersurface.ElizaBridgeActivity;
import ai.eliza.plugins.browsersurface.ElizaSurfaceManagerPlugin;
import ai.eliza.plugins.wifi.WiFiPlugin;
import ai.eliza.plugins.passwords.PasswordsPlugin;

public class MainActivity extends ElizaBridgeActivity {
 private static final String HARDWARE_BACK = "window.dispatchEvent(new Event('hardware-back',{cancelable:true}))";
 private static final String LAUNCHER_HOME = "window.dispatchEvent(new Event('launcher-home'))";

 private final ConnectivityManager.NetworkCallback defaultNetwork = new NetworkChange();
 private volatile WifiNetworkChange wifiNetwork;
 private boolean hostTransparent;

 private class NetworkChange extends ConnectivityManager.NetworkCallback {
  private final ConcurrentHashMap<Network, String> states = new ConcurrentHashMap<>();

  NetworkChange() {}
  @RequiresApi(Build.VERSION_CODES.S)
  NetworkChange(int flags) { super(flags); }

  String stateOf(NetworkCapabilities capabilities) {
   boolean validated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
   boolean captive = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL);
   boolean internet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
   return validated + "|" + captive + "|" + internet;
  }

  @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
   String next = stateOf(capabilities);
   if (next.equals(states.put(network, next))) return;
   getBridge().triggerWindowJSEvent("android-network-changed");
  }

  @Override public void onLost(Network network) {
   states.remove(network);
   getBridge().triggerWindowJSEvent("android-network-changed");
  }
 }

 private final class WifiNetworkChange extends NetworkChange {
  private final ConcurrentHashMap<Network, WifiInfo> validated = new ConcurrentHashMap<>();

  WifiNetworkChange() {}
  @RequiresApi(Build.VERSION_CODES.S)
  WifiNetworkChange(int flags) { super(flags); }

  @Override String stateOf(NetworkCapabilities capabilities) {
   String base = super.stateOf(capabilities);
   if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
     && capabilities.getTransportInfo() instanceof WifiInfo info) {
    return base + "|" + info.getSSID() + "|" + info.getBSSID();
   }
   return base;
  }

  @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
   if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
     && capabilities.getTransportInfo() instanceof WifiInfo info) validated.put(network, info);
   else validated.remove(network);
   super.onCapabilitiesChanged(network, capabilities);
  }

  @Override public void onLost(Network network) {
   validated.remove(network);
   super.onLost(network);
  }
 }

 void setHostTransparent(boolean transparent) {
  if (hostTransparent == transparent) return;
  hostTransparent = transparent;
  getBridge().getWebView().setBackgroundColor(transparent ? Color.TRANSPARENT : ContextCompat.getColor(this, R.color.paper));
 }

 WifiInfo validatedWifi(Network network) {
  WifiNetworkChange watcher = wifiNetwork;
  return watcher == null ? null : watcher.validated.get(network);
 }

 @Override public void onCreate(Bundle state) {
  Intent launch = getIntent();
  Uri accountCallback = accountCallback(launch);
  String attachmentTicket = ManagedAttachmentImport.ticket(launch);
  if (ManagedAttachmentImport.targets(launch)) setIntent(new Intent(Intent.ACTION_MAIN));
  else if (accountCallback != null) setIntent(new Intent(launch).setData(null));
  registerPlugin(EmbeddedAgentPlugin.class);
  registerPlugin(GraceAccount.class);
  registerPlugin(GraceFiles.class);
  registerPlugin(ElizaSurfaceManagerPlugin.class);
  registerPlugin(PasswordsPlugin.class);
  registerPlugin(PrivateViewPlugin.class);
  registerPlugin(GraceDevicePlugin.class);
  registerPlugin(WiFiPlugin.class);
  registerPlugin(GraceRecordStorePlugin.class);
  registerPlugin(GraceRemindersPlugin.class);
  super.onCreate(state);
  preferSixtyHertz();
  findViewById(android.R.id.content).setBackgroundResource(R.color.paper);
  getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.paper));
  ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
   int edges = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
   Insets bars = insets.getInsets(edges);
   view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
   return new WindowInsetsCompat.Builder(insets).setInsets(edges | WindowInsetsCompat.Type.ime(), Insets.NONE).build();
  });
  getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
   @Override public void handleOnBackPressed() {
    if (isRendererGone()) return;
    getBridge().getWebView().evaluateJavascript(HARDWARE_BACK, answer -> {
     if (isRendererGone() || isFinishing() || "false".equals(answer)) return;
     getBridge().getWebView().evaluateJavascript(LAUNCHER_HOME, null);
    });
   }
  });
  acceptAccountCallback(accountCallback);
  acceptAttachmentImport(attachmentTicket);
 }

 @Override public void onStart() {
  super.onStart();
  ConnectivityManager connectivity = getSystemService(ConnectivityManager.class);
  connectivity.registerDefaultNetworkCallback(defaultNetwork);
  wifiNetwork = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
   ? new WifiNetworkChange(ConnectivityManager.NetworkCallback.FLAG_INCLUDE_LOCATION_INFO) : new WifiNetworkChange();
  connectivity.registerNetworkCallback(new NetworkRequest.Builder()
   .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
   .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
   .build(), wifiNetwork);
  GraceAgentService.resume(this);
  ManagedCalendarReminders.reconcile(this);
 }

 @Override public void onStop() {
  ConnectivityManager connectivity = getSystemService(ConnectivityManager.class);
  connectivity.unregisterNetworkCallback(wifiNetwork);
  wifiNetwork = null;
  connectivity.unregisterNetworkCallback(defaultNetwork);
  super.onStop();
 }

 private void preferSixtyHertz() {
  Display display = ContextCompat.getDisplayOrDefault(this);
  Display.Mode current = display.getMode();
  int chosen = 0;
  for (Display.Mode mode : display.getSupportedModes()) {
   if (mode.getPhysicalWidth() == current.getPhysicalWidth() && mode.getPhysicalHeight() == current.getPhysicalHeight() && Math.abs(mode.getRefreshRate() - 60f) <= 1f) { chosen = mode.getModeId(); break; }
  }
  WindowManager.LayoutParams attributes = getWindow().getAttributes();
  if (attributes.preferredDisplayModeId == chosen) return;
  attributes.preferredDisplayModeId = chosen;
  getWindow().setAttributes(attributes);
 }

 @Override public void onWindowFocusChanged(boolean hasFocus) {
  super.onWindowFocusChanged(hasFocus);
  if (!hasFocus) return;
  ManagedCalendarReminders.open(this);
  WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
  bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  bars.hide(WindowInsetsCompat.Type.systemBars());
 }

 @Override public boolean dispatchKeyEvent(KeyEvent event) {
  int key = event.getKeyCode();
  if (key != KeyEvent.KEYCODE_VOLUME_UP && key != KeyEvent.KEYCODE_VOLUME_DOWN) return super.dispatchKeyEvent(event);
  if (event.getAction() == KeyEvent.ACTION_DOWN) ((GraceDevicePlugin) getBridge().getPlugin("GraceDevice").getInstance()).stepVolume(key == KeyEvent.KEYCODE_VOLUME_UP);
  return true;
 }

 @Override public void onConfigurationChanged(Configuration config) { super.onConfigurationChanged(config); preferSixtyHertz(); }

 private Uri accountCallback(Intent intent) {
  if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return null;
  Uri data = intent.getData();
  return GraceAccount.handles(this, data) ? data : null;
 }

 private void acceptAccountCallback(Uri data) {
  if (data == null || getBridge() == null) return;
  var handle = getBridge().getPlugin("GraceAccount");
  if (handle != null && handle.getInstance() instanceof GraceAccount account) account.acceptCallback(data);
 }

 private void acceptAttachmentImport(String ticket) {
  if (ticket == null || getBridge() == null) return;
  var handle = getBridge().getPlugin("GraceFiles");
  if (handle != null && handle.getInstance() instanceof GraceFiles files) files.offerManagedImport(ticket);
 }

 @Override public void onNewIntent(Intent intent) {
  if (ManagedAttachmentImport.targets(intent)) {
   super.onNewIntent(new Intent(Intent.ACTION_MAIN));
   acceptAttachmentImport(ManagedAttachmentImport.ticket(intent));
   return;
  }
  Uri accountCallback = accountCallback(intent);
  super.onNewIntent(accountCallback == null ? intent : new Intent(intent).setData(null));
  acceptAccountCallback(accountCallback);
  if (!isRendererGone() && intent.hasCategory(Intent.CATEGORY_HOME)) getBridge().getWebView().evaluateJavascript(LAUNCHER_HOME, null);
 }
}
