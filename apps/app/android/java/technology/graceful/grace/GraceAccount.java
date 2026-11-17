package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GraceAccount")
public final class GraceAccount extends Plugin {
 private static final ExecutorService ACCOUNT = Executors.newSingleThreadExecutor();

 static CloudDeviceAccount account(Context context) {
  return new CloudDeviceAccount(context, "https://app.graceforseniors.com", "https://api.graceforseniors.com", "/android/auth/callback");
 }

 @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    CloudDeviceAccount account = account(getContext());
    boolean signedIn = account.credential() != null;
    if (!signedIn && finishAcknowledgment(account)) { didSignIn(); signedIn = true; }
    if (signedIn) GracePasswordsOwner.confirmVerifiedAccount(getContext());
    call.resolve(projection(signedIn));
   }
   catch (Exception unavailable) { call.reject("Device account is unavailable"); }
   retryRevocation();
  });
 }

 @PluginMethod public void beginSignIn(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    CloudDeviceAccount account = account(getContext());
    account.retryRevocation();
    if (finishAcknowledgment(account)) { didSignIn(); call.resolve(); return; }
    open(account.begin(), call);
   } catch (Exception unavailable) { call.reject("Couldn't open sign-in"); }
  });
 }

 @PluginMethod public void manageAccount(PluginCall call) {
  open(account(getContext()).manageAccount(), call);
 }

 @PluginMethod public void openHostedView(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { open(account(getContext()).hostedView(call.getString("view")), call); }
   catch (Exception unavailable) { call.reject("Couldn't open the connected account view"); }
  });
 }

 @PluginMethod public void startSpeech(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    var speech = account(getContext()).startSpeech();
    call.resolve(new JSObject().put("version", 1).put("sessionId", speech.sessionId()).put("token", speech.token())
       .put("expiresAt", speech.expiresAt()).put("wsUrl", speech.wsUrl()));
   } catch (Exception unavailable) { call.reject("Speech is unavailable"); }
  });
 }

 @PluginMethod public void stopSpeech(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    account(getContext()).stopSpeech(call.getString("sessionId"));
    call.resolve();
   } catch (Exception unavailable) { call.reject("Speech session couldn't be closed"); }
  });
 }

 @PluginMethod public void signOut(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    try {
     GracePasswordsOwner.enteringAccountChange(getContext());
     account(getContext()).clear();
    } finally { GracePasswordsOwner.leavingAccountChange(); }
    getActivity().runOnUiThread(() -> {
     getContext().stopService(new Intent(getContext(), GraceAgentService.class));
     notifyListeners("sessionChanged", projection(false));
     call.resolve();
    });
    retryRevocation();
   } catch (Exception unavailable) { call.reject("Couldn't sign out on this device"); }
  });
 }

 void acceptCallback(Uri data) {
  ACCOUNT.execute(() -> {
   try {
    try {
     GracePasswordsOwner.enteringAccountChange(getContext());
     if (account(getContext()).exchange(data)) {
      GracePasswordsOwner.confirmVerifiedAccount(getContext());
      didSignIn();
     }
    } finally { GracePasswordsOwner.leavingAccountChange(); }
   } catch (Exception unavailable) { }
  });
 }

 private boolean finishAcknowledgment(CloudDeviceAccount account) throws Exception {
  if (!account.awaitingAcknowledgment()) return false;
  try {
   GracePasswordsOwner.enteringAccountChange(getContext());
   if (!account.finishAcknowledgment()) return false;
   GracePasswordsOwner.confirmVerifiedAccount(getContext());
   return true;
  } finally { GracePasswordsOwner.leavingAccountChange(); }
 }

 private void didSignIn() {
  getActivity().runOnUiThread(() -> {
   if (getActivity().isFinishing() || getActivity().isDestroyed()) return;
   notifyListeners("sessionChanged", projection(true));
   try { getActivity().startForegroundService(new Intent(getContext(), GraceAgentService.class).setAction("restart")); }
   catch (IllegalStateException unavailable) { }
  });
 }

 private static JSObject projection(boolean signedIn) {
  return new JSObject().put("kind", signedIn ? "signedIn" : "signedOut");
 }

 private void open(Uri address, PluginCall call) {
  getActivity().runOnUiThread(() -> {
   try {
    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, address));
    call.resolve();
   } catch (Exception unavailable) { call.reject("Couldn't open Grace in the browser"); }
  });
 }

 private void retryRevocation() {
  try { account(getContext()).retryRevocation(); }
  catch (Exception unavailable) { }
 }
}
