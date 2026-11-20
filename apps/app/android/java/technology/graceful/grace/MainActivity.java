package technology.graceful.grace;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
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
import ai.eliza.plugins.agent.embedded.EmbeddedAgentPlugin;
import ai.eliza.plugins.browsersurface.ElizaBridgeActivity;
import ai.eliza.plugins.browsersurface.ElizaSurfaceManagerPlugin;
import ai.eliza.plugins.wifi.WiFiPlugin;
import ai.eliza.plugins.passwords.PasswordsPlugin;

public class MainActivity extends ElizaBridgeActivity {
 private static final String HARDWARE_BACK = "window.dispatchEvent(new Event('hardware-back',{cancelable:true}))";
 private static final String LAUNCHER_HOME = "window.dispatchEvent(new Event('launcher-home'))";

 private final ConnectivityManager.NetworkCallback defaultNetwork = new ConnectivityManager.NetworkCallback() {
  @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
   getBridge().triggerWindowJSEvent("android-network-changed");
  }

  @Override public void onLost(Network network) {
   getBridge().triggerWindowJSEvent("android-network-changed");
  }
 };

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
  if (BuildConfig.IS_LAUNCHER) registerPlugin(WiFiPlugin.class);
  registerPlugin(GraceRecordStorePlugin.class);
  registerPlugin(GraceRemindersPlugin.class);
  super.onCreate(state);
  preferSixtyHertz();
  findViewById(android.R.id.content).setBackgroundResource(R.color.paper);
  getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
  ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
   int edges = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
   Insets bars = insets.getInsets(edges);
   view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
   return new WindowInsetsCompat.Builder(insets).setInsets(edges | WindowInsetsCompat.Type.ime(), Insets.NONE).build();
  });
  getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
   @Override public void handleOnBackPressed() {
    if (isRendererGone()) { if (!BuildConfig.IS_LAUNCHER) leave(this); return; }
    getBridge().getWebView().evaluateJavascript(HARDWARE_BACK, answer -> {
     if (isRendererGone() || isFinishing() || "false".equals(answer)) return;
     if (BuildConfig.IS_LAUNCHER) getBridge().getWebView().evaluateJavascript(LAUNCHER_HOME, null);
     else leave(this);
    });
   }
  });
  acceptAccountCallback(accountCallback);
  acceptAttachmentImport(attachmentTicket);
 }

 @Override public void onStart() {
  super.onStart();
  if (BuildConfig.IS_LAUNCHER) getSystemService(ConnectivityManager.class).registerDefaultNetworkCallback(defaultNetwork);
  GraceAgentService.resume(this);
  ManagedCalendarReminders.reconcile(this);
 }

 @Override public void onStop() {
  if (BuildConfig.IS_LAUNCHER) getSystemService(ConnectivityManager.class).unregisterNetworkCallback(defaultNetwork);
  super.onStop();
 }

 private void leave(OnBackPressedCallback callback) {
  callback.setEnabled(false);
  getOnBackPressedDispatcher().onBackPressed();
  callback.setEnabled(true);
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
  return GraceAccount.account(this).handles(data) ? data : null;
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
