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

 @PluginMethod public void openEmail(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   if (!browser || !getActivity().hasWindowFocus()) {
    call.reject("Private sign-in is unavailable");
    return;
   }
   try {
    getActivity().startActivity(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_EMAIL)
     .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    call.resolve();
   } catch (ActivityNotFoundException | SecurityException unavailable) {
    call.reject("No mail app could open");
   }
  });
 }
}
