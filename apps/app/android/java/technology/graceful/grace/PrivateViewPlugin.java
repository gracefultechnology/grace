package technology.graceful.grace;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GracePrivateView")
public final class PrivateViewPlugin extends Plugin {
 private boolean vault;
 private boolean browser;
 private boolean account;
 @PluginMethod public void protect(PluginCall call) {
  String view = call.getString("view");
  Boolean active = call.getBoolean("active");
  if (active == null || !("vault".equals(view) || "browser".equals(view) || "account".equals(view))) {
   call.reject("Invalid private view");
   return;
  }
  Activity activity = getActivity();
  if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
   call.reject("Private view is unavailable");
   return;
  }
  activity.runOnUiThread(() -> {
   Activity current = getActivity();
   if (current == null || current.isFinishing() || current.isDestroyed()) {
    call.reject("Private view is unavailable");
    return;
   }
   switch (view) {
    case "vault" -> vault = active;
    case "browser" -> browser = active;
    default -> account = active;
   }
   if (vault || browser || account) current.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
   else current.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
   call.resolve();
  });
 }

 @PluginMethod public void setHostSurface(PluginCall call) {
  Boolean transparent = call.getBoolean("transparent");
  if (transparent == null) {
   call.reject("Invalid host surface");
   return;
  }
  Activity activity = getActivity();
  if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
   call.reject("Host surface is unavailable");
   return;
  }
  activity.runOnUiThread(() -> {
   Activity current = getActivity();
   if (current == null || current.isFinishing() || current.isDestroyed()) {
    call.reject("Host surface is unavailable");
    return;
   }
   if (current instanceof MainActivity host) host.setHostTransparent(transparent);
   call.resolve();
  });
 }

 @PluginMethod public void openVerificationApp(PluginCall call) {
  String app = call.getString("app", "");
  String category = switch (app) {
   case "email" -> Intent.CATEGORY_APP_EMAIL;
   case "messages" -> Intent.CATEGORY_APP_MESSAGING;
   default -> null;
  };
  if (category == null) {
   call.reject("Unknown verification app");
   return;
  }
  Activity activity = getActivity();
  if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
   call.reject("Private sign-in is unavailable");
   return;
  }
  activity.runOnUiThread(() -> {
   Activity current = getActivity();
   if (!browser || vault || current == null || current.isFinishing() || current.isDestroyed() || !current.hasWindowFocus()) {
    call.reject("Private sign-in is unavailable");
    return;
   }
   try {
    current.startActivity(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, category)
     .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    call.resolve();
   } catch (ActivityNotFoundException | SecurityException unavailable) {
    call.reject("No verification app could open");
   }
  });
 }
}
