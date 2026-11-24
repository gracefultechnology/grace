package technology.graceful.grace;

import android.Manifest;
import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.UserManager;

public final class GraceDeviceOwner extends DeviceAdminReceiver {
 private static final String[] HELD = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION };

 static boolean manages(Context context) {
  return context.getSystemService(DevicePolicyManager.class).isDeviceOwnerApp(context.getPackageName());
 }

 static void apply(Context context) {
  if (!manages(context)) return;
  DevicePolicyManager policy = context.getSystemService(DevicePolicyManager.class);
  ComponentName admin = new ComponentName(context, GraceDeviceOwner.class);
  for (String permission : HELD) {
   policy.setPermissionGrantState(admin, context.getPackageName(), permission, DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED);
  }
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) policy.setLocationEnabled(admin, true);
  policy.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_LOCATION);
 }

 @Override public void onEnabled(Context context, Intent intent) { apply(context); }

 @Override public void onProfileProvisioningComplete(Context context, Intent intent) { apply(context); }
}
