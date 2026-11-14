package technology.graceful.grace;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import ai.eliza.plugins.browsersurface.ElizaBridgeActivity;
import ai.eliza.plugins.browsersurface.ElizaSurfaceManagerPlugin;
import ai.eliza.plugins.wifi.WiFiPlugin;

/** Grace's window: the web UI in Capacitor's bridge WebView, drawn over the website, which
 * ElizaSurfaceManager keeps in a WebView below it (createSurface with layer "below-host").
 * ElizaBridgeActivity owns the WebView lifecycle: no mixed content, renderer-death recovery and
 * the stopped-page pause. */
public class MainActivity extends ElizaBridgeActivity {
 /** Cancelable: the web UI consumes Back with preventDefault(), and dispatchEvent answers false. */
 private static final String HARDWARE_BACK = "window.dispatchEvent(new Event('hardware-back',{cancelable:true}))";
 private static final String LAUNCHER_HOME = "window.dispatchEvent(new Event('launcher-home'))";

 @Override public void onCreate(Bundle state) {
  registerPlugin(ElizaSurfaceManagerPlugin.class);
  // Grace's own Wi-Fi settings (spec/app/network.md) are the launcher's; the standalone app has no
  // Wi-Fi permission (standalone/AndroidManifest.xml) and leaves Wi-Fi to the system.
  if (BuildConfig.IS_LAUNCHER) registerPlugin(WiFiPlugin.class);
  super.onCreate(state);
  preferSixtyHertz();
  // below-host (plugin-native-browser-surface/src/definitions.ts, SurfaceLayer): the bridge
  // WebView and every view up to the content FrameLayout are transparent, and paper (the window
  // background, res/values/styles.xml) is painted beneath both WebViews for the frame between a
  // website resize and the host's next draw.
  findViewById(android.R.id.content).setBackgroundResource(R.color.paper);
  getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
  // The keyboard overlays the interface, which keeps its full height so the rail stays whole (SystemBars'
  // insetsHandling is "disable", capacitor.config.ts); the web UI lifts its windows by the height
  // ElizaSurfaceManager reports (keyboardChanged). Only the bars and a cutout inset the content.
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
     // Unconsumed: the launcher goes Home and never leaves; the standalone app leaves.
     if (BuildConfig.IS_LAUNCHER) getBridge().getWebView().evaluateJavascript(LAUNCHER_HOME, null);
     else leave(this);
    });
   }
  });
 }

 private void leave(OnBackPressedCallback callback) {
  callback.setEnabled(false);
  getOnBackPressedDispatcher().onBackPressed();
  callback.setEnabled(true);
 }

 /** The transparent host is blended over the below-host page every frame the page draws, so a
  * website's endless animation redraws the window at the display's full rate: about 1.4 cores at
  * 90 Hz on a 3.9 GB tablet. Where the display has a 60 Hz mode at its current resolution the
  * window asks for it; any other display keeps the system's choice. The activity survives a
  * resolution change (configChanges), so onConfigurationChanged asks again. */
 private void preferSixtyHertz() {
  Display display = ContextCompat.getDisplayOrDefault(this);
  Display.Mode current = display.getMode();
  int chosen = 0;
  for (Display.Mode mode : display.getSupportedModes()) {
   if (mode.getPhysicalWidth() == current.getPhysicalWidth() && mode.getPhysicalHeight() == current.getPhysicalHeight() && Math.abs(mode.getRefreshRate() - 60f) <= 1f) { chosen = mode.getModeId(); break; }
  }
  // 0 clears an earlier request, so a stale mode at an old resolution is never pinned.
  WindowManager.LayoutParams attributes = getWindow().getAttributes();
  if (attributes.preferredDisplayModeId == chosen) return;
  attributes.preferredDisplayModeId = chosen;
  getWindow().setAttributes(attributes);
 }

 /** Full screen: the bars stay hidden until a swipe from the edge shows them briefly. Android can
  * restore them when focus returns from a dialog, the keyboard or another app. */
 @Override public void onWindowFocusChanged(boolean hasFocus) {
  super.onWindowFocusChanged(hasFocus);
  if (!hasFocus) return;
  WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
  bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  bars.hide(WindowInsetsCompat.Type.systemBars());
 }

 @Override public void onConfigurationChanged(Configuration config) { super.onConfigurationChanged(config); preferSixtyHertz(); }

 /** Home pressed while the launcher is already Home. */
 @Override public void onNewIntent(Intent intent) {
  super.onNewIntent(intent);
  if (!isRendererGone() && intent.hasCategory(Intent.CATEGORY_HOME)) getBridge().getWebView().evaluateJavascript(LAUNCHER_HOME, null);
 }
}
