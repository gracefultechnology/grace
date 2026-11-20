package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.securestore.nativeonly.CloudPasswordBackup;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.SystemClock;
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
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

@CapacitorPlugin(name = "GraceAccount")
public final class GraceAccount extends Plugin {
 private static final ExecutorService ACCOUNT = Executors.newSingleThreadExecutor();
 private static final ExecutorService RECOVERY = Executors.newSingleThreadExecutor();
 private static final ExecutorService CHOICES = Executors.newSingleThreadExecutor();
 private static final ScheduledExecutorService CHOICE_DEADLINE = Executors.newSingleThreadScheduledExecutor();
 private static final int CHOICE_DEADLINE_MS = 30_000;
 static final String CLOUD_ORIGIN = "https://api.graceforseniors.com";
 private CloudPasswordBackup passwordBackup;
 private GracePasswordRecovery recovery;
 private record GuideLease(String id, CloudDeviceAccount.Session owner) {}
 private GuideLease guideLease;

 @Override public void load() {
  passwordBackup = new CloudPasswordBackup(account(getContext()), "technology.graceful.grace", "production");
  recovery = new GracePasswordRecovery(getActivity(), this);
 }

 @PluginMethod public void passwordRecoveryStatus(PluginCall call) {
  RECOVERY.execute(() -> call.resolve(new JSObject().put("ready", recoveryAccountReady() && passwordBackup.available())));
 }

 @PluginMethod public void showPasswordRecovery(PluginCall call) {
  getActivity().runOnUiThread(() -> {
   if (GracePasswordsOwner.accountChanging() || getActivity().isFinishing() || getActivity().isDestroyed() || !recovery.open()) {
    call.reject("Password recovery is unavailable");
   } else call.resolve();
  });
 }

 @PluginMethod public void dismissPasswordRecovery(PluginCall call) {
  recovery.accountChanged();
  call.resolve();
 }

 void authorizePasswordBackup(GracePasswordRecovery controller, GracePasswordRecovery.Operation request) {
  RECOVERY.execute(() -> {
   if (!controller.isCurrent(request)) return;
   try {
    if (!recoveryAccountReady()) throw new IllegalStateException("Account verification required");
    Uri address = passwordBackup.begin(request.purpose);
    getActivity().runOnUiThread(() -> {
     if (!controller.isCurrent(request) || GracePasswordsOwner.accountChanging()) return;
     try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, address)); }
     catch (Exception unavailable) { controller.failed(request, "Couldn't open secure password backup approval."); }
    });
   } catch (Exception unavailable) {
    controller.failed(request, "Sign in to Grace to use cloud backup.");
   }
  });
 }

 void cancelPasswordBackup() { passwordBackup.cancel(); }

 private void acceptPasswordBackup(Uri data) {
  GracePasswordRecovery.Operation operation = recovery.pending();
  if (operation == null || !passwordBackup.accepts(data)) return;
  RECOVERY.execute(() -> {
   try {
    var approval = passwordBackup.exchange(data, operation.purpose, () -> recovery.isCurrent(operation) && recoveryAccountReady());
    recovery.run(operation, approval);
   } catch (Exception unavailable) {
    recovery.failed(operation, "This password backup approval has ended. Try again.");
   }
  });
 }

 private boolean recoveryAccountReady() {
  try { return GracePasswordsOwner.stableSession(getContext()) != null; }
  catch (Exception unavailable) { return false; }
 }

 private record Picker(CloudDeviceAccount.NativeGoogleAttempt attempt, CancellationSignal signal, PluginCall call) {}
 private Picker picker;

 static CloudDeviceAccount account(Context context) {
  return new CloudDeviceAccount(context, "https://app.graceforseniors.com", CLOUD_ORIGIN, "/android/auth/callback");
 }

 @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    CloudDeviceAccount account = account(getContext());
    if (finishAcknowledgment(account)) didSignIn();
    boolean signedIn = GracePasswordsOwner.stableSession(getContext()) != null;
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
    changeAccount(() -> {
     if (!account.finishNativeGoogle(pending.attempt(), idToken)) throw new IllegalStateException("Google sign-in expired");
     GracePasswordsOwner.confirmVerifiedAccount(getContext());
     return null;
    });
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

 @PluginMethod public void browserGuideLease(PluginCall call) {
  CHOICES.execute(() -> {
   var lease = currentGuideLease();
   call.resolve(new JSObject().put("id", lease == null ? JSONObject.NULL : lease.id()));
  });
 }

 private synchronized GuideLease currentGuideLease() {
  CloudDeviceAccount.Session owner;
  try { owner = GracePasswordsOwner.stableSession(getContext()); }
  catch (Exception unavailable) { owner = null; }
  if (owner == null) guideLease = null;
  else if (guideLease == null || !owner.equals(guideLease.owner())) guideLease = new GuideLease(UUID.randomUUID().toString(), owner);
  return guideLease;
 }

 @PluginMethod public void chooseBrowserLink(PluginCall call) {
  CHOICES.execute(() -> {
   var lease = currentGuideLease();
   if (lease == null || !lease.id().equals(call.getString("lease"))) {
    call.resolve(choiceUnavailable("disabled"));
    return;
   }
   var owner = lease.owner();
   try {
    String goal = call.getString("goal");
    var candidates = call.getArray("candidates");
    if (goal == null || goal.isBlank() || goal.length() > 2000 || candidates == null || candidates.length() < 1 || candidates.length() > 16) {
     call.resolve(choiceUnavailable("disabled"));
     return;
    }
    byte[] request = new JSONObject().put("kind", "choice").put("goal", goal).put("candidates", candidates)
     .toString().getBytes(StandardCharsets.UTF_8);
    if (request.length > 32768 || !currentDecisionOwner(owner)) {
     call.resolve(choiceUnavailable("disabled"));
     return;
    }
    var connection = (HttpURLConnection) URI.create(CLOUD_ORIGIN + "/api/v1/decisions").toURL().openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(8000);
    connection.setReadTimeout(CHOICE_DEADLINE_MS);
    connection.setRequestMethod("POST");
    connection.setRequestProperty("Authorization", "Bearer " + owner.token());
    connection.setRequestProperty("Accept", "application/json");
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setDoOutput(true);
    connection.setFixedLengthStreamingMode(request.length);
    long deadline = SystemClock.elapsedRealtime() + CHOICE_DEADLINE_MS;
    var cancel = CHOICE_DEADLINE.schedule(connection::disconnect, CHOICE_DEADLINE_MS, TimeUnit.MILLISECONDS);
    try {
     try (var output = connection.getOutputStream()) { output.write(request); }
     int status = connection.getResponseCode();
     if (status != 200) {
      boolean providerError = (status < 400 || status >= 500) && currentDecisionOwner(owner);
      call.resolve(choiceUnavailable(providerError ? "provider_error" : "disabled"));
      return;
     }
     try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[512];
      int count;
      while ((count = input.read(buffer)) != -1) {
       if (output.size() + count > 16384) {
        call.resolve(choiceUnavailable("provider_error"));
        return;
       }
       output.write(buffer, 0, count);
      }
      if (!currentDecisionOwner(owner)) call.resolve(choiceUnavailable("disabled"));
      else if (SystemClock.elapsedRealtime() >= deadline) call.resolve(choiceUnavailable("provider_error"));
      else call.resolve(new JSObject(new String(output.toByteArray(), StandardCharsets.UTF_8)));
     }
    } finally {
     cancel.cancel(false);
     connection.disconnect();
    }
   } catch (Exception unavailable) {
    call.resolve(choiceUnavailable(currentDecisionOwner(owner) ? "provider_error" : "disabled"));
   }
  });
 }

 private boolean currentDecisionOwner(CloudDeviceAccount.Session owner) {
  try { return owner.equals(GracePasswordsOwner.stableSession(getContext())); }
  catch (Exception unavailable) { return false; }
 }

 private static JSObject choiceUnavailable(String reason) {
  return new JSObject().put("status", "unavailable").put("reason", reason);
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
  recovery.accountChanged();
  ACCOUNT.execute(() -> {
   try {
    changeAccount(() -> {
     CloudDeviceAccount account = account(getContext());
     closePicker(account);
     account.clear();
     return null;
    });
    getActivity().runOnUiThread(() -> {
     notifyListeners("sessionChanged", projection(false));
     call.resolve();
    });
    retryRevocation();
   } catch (Exception unavailable) { call.reject("Couldn't sign out on this device"); }
  });
 }

 void acceptCallback(Uri data) {
  if (CloudPasswordBackup.isBackupReturn(data)) { acceptPasswordBackup(data); return; }
  ACCOUNT.execute(() -> {
   try {
    var account = account(getContext());
    if (!account.handles(data)) return;
    if (changeAccount(() -> {
     if (!account.exchange(data)) return false;
     GracePasswordsOwner.confirmVerifiedAccount(getContext());
     return true;
    })) didSignIn();
   } catch (Exception unavailable) { }
  });
 }

 private boolean finishAcknowledgment(CloudDeviceAccount account) throws Exception {
  if (!account.awaitingAcknowledgment()) return false;
  return changeAccount(() -> {
   if (!account.finishAcknowledgment()) return false;
   GracePasswordsOwner.confirmVerifiedAccount(getContext());
   return true;
  });
 }

 private <T> T changeAccount(Callable<T> change) throws Exception {
  Context context = getContext().getApplicationContext();
  try {
   GracePasswordsOwner.enteringAccountChange(context);
   synchronized (this) { guideLease = null; }
   recovery.accountChanged();
   GraceAgentService.retire();
   return change.call();
  } finally {
   GracePasswordsOwner.leavingAccountChange();
   ManagedCalendarReminders.reconcile(context);
   GraceAgentService.finishAccountChange(context);
  }
 }

 private void didSignIn() {
  getActivity().runOnUiThread(() -> {
   if (getActivity().isFinishing() || getActivity().isDestroyed()) return;
   notifyListeners("sessionChanged", projection(true));
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
