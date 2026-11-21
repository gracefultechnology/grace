package technology.graceful.grace;

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
}
