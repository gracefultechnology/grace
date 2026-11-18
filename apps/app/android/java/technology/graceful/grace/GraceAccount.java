package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.CancellationSignal;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.GetCredentialUnsupportedException;
import androidx.credentials.exceptions.NoCredentialException;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
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

 private record Picker(CloudDeviceAccount.NativeGoogleAttempt attempt, CancellationSignal signal, PluginCall call) {}
 private Picker picker;

 static CloudDeviceAccount account(Context context) {
  return new CloudDeviceAccount(context, "https://app.graceforseniors.com", "https://api.graceforseniors.com", "/android/auth/callback");
 }

 @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    CloudDeviceAccount account = account(getContext());
    boolean signedIn = account.credential() != null;
    if (!signedIn && account.finishAcknowledgment()) { didSignIn(); signedIn = true; }
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
    if (account.finishAcknowledgment()) { didSignIn(); call.resolve(); return; }
    closePicker(account);
    var attempt = "browser".equals(call.getString("method")) || !hasGooglePlayServices() ? null
        : account.prepareNativeGoogle(getContext().getPackageName(), "production");
    if (attempt == null) open(account.begin(), call);
    else {
     Picker next = new Picker(attempt, new CancellationSignal(), call);
     picker = next;
     getActivity().runOnUiThread(() -> pickGoogle(next));
    }
   } catch (Exception unavailable) { call.reject("Couldn't open sign-in"); }
  });
 }

 private boolean hasGooglePlayServices() {
  try { return getContext().getPackageManager().getApplicationInfo("com.google.android.gms", 0).enabled; }
  catch (android.content.pm.PackageManager.NameNotFoundException unavailable) { return false; }
 }

 private void closePicker(CloudDeviceAccount account) throws Exception {
  if (picker == null) return;
  Picker previous = picker;
  picker = null;
  previous.signal().cancel();
  previous.call().resolve();
  account.cancelNativeGoogle(previous.attempt());
 }

 private void pickGoogle(Picker pending) {
  if (pending.signal().isCanceled()) return;
  try {
   var option = new GetGoogleIdOption.Builder().setServerClientId(pending.attempt().serverClientId())
       .setNonce(pending.attempt().nonce()).setFilterByAuthorizedAccounts(false).setAutoSelectEnabled(false).build();
   var request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
   CredentialManager.create(getActivity()).getCredentialAsync(getActivity(), request, pending.signal(), ACCOUNT,
       new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
        @Override public void onResult(GetCredentialResponse response) { finishPicker(pending, response, null); }
        @Override public void onError(GetCredentialException error) { finishPicker(pending, null, error); }
       });
  } catch (RuntimeException unavailable) {
   ACCOUNT.execute(() -> finishPicker(pending, null, new GetCredentialProviderConfigurationException()));
  }
 }

 private void finishPicker(Picker pending, GetCredentialResponse response, GetCredentialException error) {
  if (picker != pending) return;
  picker = null;
  CloudDeviceAccount account = account(getContext());
  try {
   if (response != null) {
    if (!(response.getCredential() instanceof CustomCredential custom)
        || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType()))
     throw new IllegalStateException("Invalid Google credential type");
    String idToken = GoogleIdTokenCredential.createFrom(custom.getData()).getIdToken();
    if (!account.finishNativeGoogle(pending.attempt(), idToken)) throw new IllegalStateException("Google sign-in expired");
    didSignIn();
    pending.call().resolve();
   } else if (error instanceof NoCredentialException || error instanceof GetCredentialProviderConfigurationException
       || error instanceof GetCredentialUnsupportedException) {
    open(account.begin(), pending.call());
   } else if (error instanceof GetCredentialCancellationException) {
    pending.call().resolve();
   } else {
    pending.call().reject("Couldn't sign in with Google");
   }
  } catch (Exception unavailable) {
   pending.call().reject("Couldn't sign in with Google");
  } finally {
   try { account.cancelNativeGoogle(pending.attempt()); }
   catch (Exception unavailable) { }
  }
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
    CloudDeviceAccount account = account(getContext());
    closePicker(account);
    account.clear();
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
    if (account(getContext()).exchange(data)) didSignIn();
   } catch (Exception unavailable) { }
  });
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
