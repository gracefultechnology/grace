package technology.graceful.grace;

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
   } else {
    browser = active;
   }
   if (vault || browser) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
   else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
   call.resolve();
  });
 }

 @PluginMethod public void setHostSurface(PluginCall call) {
  Boolean transparent = call.getBoolean("transparent");
  if (transparent == null) {
   call.reject("Invalid host surface");
   return;
  }
  getActivity().runOnUiThread(() -> {
   if (getActivity() instanceof MainActivity host) host.setHostTransparent(transparent);
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
  getActivity().runOnUiThread(() -> {
   if (!browser || vault || !getActivity().hasWindowFocus()) {
    call.reject("Private sign-in is unavailable");
    return;
   }
   try {
    getActivity().startActivity(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, category)
     .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    call.resolve();
   } catch (ActivityNotFoundException | SecurityException unavailable) {
    call.reject("No verification app could open");
   }
  });
 }
}
