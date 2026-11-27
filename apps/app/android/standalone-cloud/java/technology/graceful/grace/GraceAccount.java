package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordSurfaces;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.securestore.nativeonly.CloudPasswordBackup;
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
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GraceAccount")
public final class GraceAccount extends Plugin {
 private static final ExecutorService ACCOUNT = Executors.newSingleThreadExecutor();
 private static final ExecutorService RECOVERY = Executors.newSingleThreadExecutor();
 private static final String CLOUD_ORIGIN = BuildConfig.CLOUD_API_ORIGIN;
 private static final String MOBILE_ENVIRONMENT = BuildConfig.CLOUD_ENVIRONMENT;
 private CloudPasswordBackup passwordBackup;
 private GracePasswordRecovery recovery;
 private GraceBrowserGuide guide;
 private Runnable stopLeaseUpdates;

 @Override public void load() {
  guide = new GraceBrowserGuide(getContext());
  passwordBackup = new CloudPasswordBackup(account(getContext()), BuildConfig.APPLICATION_ID, MOBILE_ENVIRONMENT);
  recovery = new GracePasswordRecovery(getActivity(), this);
  stopLeaseUpdates = GraceDeviceLeaseJob.listen(getContext(), () -> ACCOUNT.execute(() -> {
   try { publishStatus(account(getContext())); }
   catch (Exception unavailable) { }
  }));
 }

 @Override protected void handleOnDestroy() {
  if (stopLeaseUpdates != null) stopLeaseUpdates.run();
  Picker active = picker;
  if (active != null) active.signal().cancel();
  Context app = getContext() != null ? getContext().getApplicationContext() : null;
  ACCOUNT.execute(() -> {
   if (picker == null) return;
   Picker previous = picker;
   picker = null;
   previous.signal().cancel();
   previous.enrollment().close();
   previous.call().resolve();
   if (app != null) {
    try { account(app).cancelNativeGoogle(previous.attempt()); }
    catch (Exception ignored) { }
   }
  });
  super.handleOnDestroy();
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
    recovery.run(operation, new GracePasswordRecovery.Approval(approval.scope(), approval.ownerId(), approval.revision(),
       approval.present(), approval::current, approval::run));
   } catch (Exception unavailable) {
    recovery.failed(operation, "This password backup approval has ended. Try again.");
   }
  });
 }

 private boolean recoveryAccountReady() {
  try { return recovery.deviceReady() && GracePasswordsOwner.stableSession(getContext()) != null; }
  catch (Exception unavailable) { return false; }
 }

 private record Picker(CloudDeviceAccount.NativeGoogleAttempt attempt, CancellationSignal signal, PluginCall call, boolean leaseUpgrade, GracePasswordsOwner.Enrollment enrollment) {}
 private volatile Picker picker;

 static CloudDeviceAccount.Session session(Context context) throws Exception {
  CloudDeviceAccount account = account(context);
  if (account.awaitingAcknowledgment()) throw new IllegalStateException("Account change in progress");
  return account.session();
 }

 static String vaultCredentialBinding(Context context, CloudDeviceAccount.Session current) throws Exception {
  return account(context).accountBinding(current.token());
 }

 static void maintainDeviceLease(Context context) throws Exception {
  CloudDeviceAccount account = account(context);
  var before = account.session();
  try { account.maintainLease(); }
  finally {
   if (!java.util.Objects.equals(before, account.session())) {
    GraceAgentService.deviceCredentialChanged(context);
    GraceDeviceLeaseJob.leaseChanged(context);
   }
  }
 }

 static boolean deviceOnly(Context context) throws Exception { return account(context).isDeviceOnly(); }

 static boolean handles(Context context, Uri address) { return account(context).handles(address); }

 static Uri hostedView(Context context, String view) throws Exception { return account(context).hostedView(view); }

 private static CloudDeviceAccount account(Context context) {
  return new CloudDeviceAccount(context, BuildConfig.CLOUD_WEB_ORIGIN, CLOUD_ORIGIN, BuildConfig.CLOUD_CALLBACK_PATH);
 }

 @PluginMethod public void status(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    CloudDeviceAccount account = account(getContext());
    try {
     if (finishAcknowledgment(account)) publishStatus(account);
    } catch (Exception unavailable) {
     if (account.leaseUpgradeStatus() != CloudDeviceAccount.LeaseUpgradeStatus.ACKNOWLEDGMENT_PENDING) throw unavailable;
    }
    call.resolve(accountStatus(account));
   }
   catch (Exception unavailable) { call.reject("Device account is unavailable"); }
   retryRevocation();
  });
 }

 @PluginMethod public void accountRequest(PluginCall call) {
  GraceOwnerRead.accountRequest(getContext(), call, ACCOUNT);
 }

 @PluginMethod public void connectGoogle(PluginCall call) {
  GraceGoogleConnection.connect(call, getActivity());
 }

 @PluginMethod public void disconnectGoogle(PluginCall call) {
  GraceGoogleConnection.disconnect(call, getActivity());
 }

 @PluginMethod public void readGoogle(PluginCall call) {
  GraceGoogleRead.run(call, input -> {
   var context = getContext();
   long generation = GracePasswordsOwner.generation();
   var owner = GracePasswordsOwner.stableSession(context);
   var account = account(context);
   var authority = account.mailAuthority();
   if (owner == null || authority == null || !input.matches(authority.accountId(), authority.epoch())
       || !owner.accountId().equals(authority.accountId()) || !owner.organizationId().equals(authority.organizationId()))
    throw new IllegalStateException("Connected account changed");
   var answer = account.readMail(authority, input.path(), input.query());
   if (GracePasswordsOwner.accountChanging() || generation != GracePasswordsOwner.generation())
    throw new IllegalStateException("Connected account changed");
   return new JSObject().put("status", answer.status()).put("body", answer.body());
  });
 }

 @PluginMethod public void beginSignIn(PluginCall call) {
  if (call.getData().has("method")) { call.reject("This sign-in method is unavailable in Grace"); return; }
  ACCOUNT.execute(() -> {
   GracePasswordsOwner.Enrollment enrollment = null;
   try {
    CloudDeviceAccount account = account(getContext());
    account.retryRevocation();
    if (finishAcknowledgment(account)) { publishStatus(account); call.resolve(); return; }
    closePicker(account);
    if (!hasGooglePlayServices()) { call.reject("Google sign-in is unavailable on this tablet"); return; }
    enrollment = GracePasswordsOwner.beginEnrollment(getContext());
    var attempt = account.prepareNativeGoogle(BuildConfig.APPLICATION_ID, MOBILE_ENVIRONMENT);
    if (attempt == null) { enrollment.close(); call.reject("Google sign-in is unavailable on this tablet"); return; }
    beginPicker(account, attempt, call, false, enrollment);
    enrollment = null;
   } catch (Exception unavailable) {
    if (enrollment != null) enrollment.close();
    call.reject("Couldn't open sign-in");
   }
  });
 }

 @PluginMethod public void signInMethods(PluginCall call) { GraceOwnerRead.signInMethods(call, ACCOUNT); }

 @PluginMethod public void sendSignInCode(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    String address = GraceOwnerRead.signInAddress(call, 1);
    var account = account(getContext());
    closePicker(account);
    account.sendEmailSignInCode(BuildConfig.APPLICATION_ID, MOBILE_ENVIRONMENT, address);
    call.resolve(new JSObject().put("kind", "sent"));
   } catch (Exception unavailable) { call.reject("Couldn't send a sign-in code"); }
  });
 }

 @PluginMethod public void verifySignInCode(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    String address = GraceOwnerRead.signInAddress(call, 2), code = GraceOwnerRead.signInCode(call);
    var account = account(getContext());
    CloudDeviceAccount.EmailSignIn result = changeAccount(() -> {
     var verified = account.verifyEmailSignInCode(address, code);
     if (verified == CloudDeviceAccount.EmailSignIn.SIGNED_IN) GracePasswordsOwner.confirmVerifiedAccount(getContext(), account.session());
     return verified;
    });
    switch (result) {
     case SIGNED_IN -> { publishStatus(account); call.resolve(new JSObject().put("kind", "signedIn")); }
     case ADDITIONAL_VERIFICATION -> call.resolve(new JSObject().put("kind", "additionalVerification"));
     case REFUSED -> call.reject("Couldn't verify the sign-in code");
    }
   } catch (Exception unavailable) { call.reject("Couldn't verify the sign-in code"); }
   finally { retryRevocation(); }
  });
 }

 @PluginMethod public void cancelSignInCode(PluginCall call) {
  ACCOUNT.execute(() -> {
   try { account(getContext()).cancelEmailSignInCode(); call.resolve(); }
   catch (Exception unavailable) { call.reject("Couldn't cancel email sign-in"); }
  });
 }

 @PluginMethod public void beginLeaseUpgrade(PluginCall call) {
  ACCOUNT.execute(() -> {
   GracePasswordsOwner.Enrollment enrollment = null;
   try {
    CloudDeviceAccount account = account(getContext());
    if (picker != null && picker.leaseUpgrade()) { call.resolve(); return; }
    account.retryRevocation();
    if (finishAcknowledgment(account)) { publishStatus(account); call.resolve(); return; }
    if (!hasGooglePlayServices()) { call.reject("Google sign-in is unavailable on this tablet"); return; }
    closePicker(account);
    enrollment = GracePasswordsOwner.beginEnrollment(getContext());
    var attempt = account.prepareNativeGoogleLeaseUpgrade(BuildConfig.APPLICATION_ID, MOBILE_ENVIRONMENT);
    if (attempt == null) { enrollment.close(); call.reject("Google sign-in is unavailable on this tablet"); return; }
    beginPicker(account, attempt, call, true, enrollment);
    enrollment = null;
   } catch (Exception unavailable) {
    if (enrollment != null) enrollment.close();
    call.reject("Couldn't sign in for email and calendar");
   }
  });
 }

 @PluginMethod public void cancelLeaseUpgrade(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    CloudDeviceAccount account = account(getContext());
    boolean picking = picker != null && picker.leaseUpgrade();
    if (picking || account.leaseUpgradeStatus() == CloudDeviceAccount.LeaseUpgradeStatus.SIGN_IN_PENDING) {
     if (picking) closePicker(account);
     account.cancelLeaseUpgrade();
     publishStatus(account);
    }
    call.resolve();
   } catch (Exception unavailable) { call.reject("Couldn't cancel sign-in for email and calendar"); }
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
  previous.enrollment().close();
  previous.call().resolve();
  account.cancelNativeGoogle(previous.attempt());
 }

 private void beginPicker(CloudDeviceAccount account, CloudDeviceAccount.NativeGoogleAttempt attempt,
   PluginCall call, boolean leaseUpgrade, GracePasswordsOwner.Enrollment enrollment) throws Exception {
  var activity = getActivity();
  if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
   enrollment.close();
   account.cancelNativeGoogle(attempt);
   throw new IllegalStateException("Activity unavailable");
  }
  try {
   if (leaseUpgrade) publishStatus(account);
   Picker next = new Picker(attempt, new CancellationSignal(), call, leaseUpgrade, enrollment);
   picker = next;
   activity.runOnUiThread(() -> pickGoogle(next));
  } catch (Exception unavailable) {
   picker = null;
   enrollment.close();
   account.cancelNativeGoogle(attempt);
   throw unavailable;
  }
 }

 private void pickGoogle(Picker pending) {
  if (pending.signal().isCanceled()) return;
  var activity = getActivity();
  if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
   ACCOUNT.execute(() -> finishPicker(pending, null, new GetCredentialCancellationException()));
   return;
  }
  try {
   var option = new GetSignInWithGoogleOption.Builder(pending.attempt().serverClientId())
       .setNonce(pending.attempt().nonce()).build();
   var request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
   CredentialManager.create(activity).getCredentialAsync(activity, request, pending.signal(), ACCOUNT,
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
  boolean published = false;
  try {
   if (response != null) {
    if (!(response.getCredential() instanceof CustomCredential custom)
        || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType()))
     throw new IllegalStateException("Invalid Google credential type");
    String idToken = GoogleIdTokenCredential.createFrom(custom.getData()).getIdToken();
    changeAccount(() -> {
     if (!account.finishNativeGoogle(pending.attempt(), idToken, null)) throw new IllegalStateException("Google sign-in expired");
     GracePasswordsOwner.confirmVerifiedAccount(getContext(), account.session());
     return null;
    });
    pending.enrollment().close();
    publishStatus(account);
    published = true;
    pending.call().resolve();
   } else if (error instanceof GetCredentialCancellationException) {
    pending.enrollment().close();
    pending.call().resolve();
   } else {
    pending.enrollment().close();
    pending.call().reject("Couldn't sign in with Google");
   }
  } catch (Exception unavailable) {
   pending.enrollment().close();
   pending.call().reject("Couldn't sign in with Google");
  } finally {
   pending.enrollment().close();
   try {
    account.cancelNativeGoogle(pending.attempt());
    if (pending.leaseUpgrade() && !published) publishStatus(account);
   }
   catch (Exception unavailable) { }
   if (pending.leaseUpgrade()) retryRevocation();
  }
 }

 @PluginMethod public void inboxArrival(PluginCall call) { guide.inboxArrival(call); }
 @PluginMethod public void browserGuideLease(PluginCall call) { guide.browserGuideLease(call); }

 @PluginMethod public void chooseBrowserLink(PluginCall call) { guide.chooseBrowserLink(call); }

 @PluginMethod public void startSpeech(PluginCall call) {
  ACCOUNT.execute(() -> {
   try {
    if (PasswordSurfaces.visible()) throw new IllegalStateException("Private surface active");
    var device = account(getContext());
    var speech = device.startSpeech();
    if (PasswordSurfaces.visible()) {
     device.stopSpeech(speech.sessionId());
     throw new IllegalStateException("Private surface active");
    }
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
    JSObject signedOut = projection(null);
    var activity = getActivity();
    if (activity != null) {
     activity.runOnUiThread(() -> {
      notifyListeners("sessionChanged", signedOut, true);
      call.resolve();
     });
    } else {
     notifyListeners("sessionChanged", signedOut, true);
     call.resolve();
    }
    retryRevocation();
   } catch (Exception unavailable) { call.reject("Couldn't sign out on this device"); }
  });
 }

 void acceptCallback(Uri data) {
  if (CloudPasswordBackup.isBackupReturn(data)) { acceptPasswordBackup(data); return; }
  ACCOUNT.execute(() -> {
   boolean upgradeReturn = false;
   try {
    var account = account(getContext());
    if (!account.handles(data)) return;
    upgradeReturn = account.leaseUpgradeStatus() == CloudDeviceAccount.LeaseUpgradeStatus.SIGN_IN_PENDING;
    boolean signedIn = false;
    try {
     signedIn = changeAccount(() -> {
      if (!account.exchange(data)) return false;
      GracePasswordsOwner.confirmVerifiedAccount(getContext(), account.session());
      return true;
     });
    } finally {
     if (signedIn || upgradeReturn) publishStatus(account);
    }
   } catch (Exception unavailable) { }
   finally { if (upgradeReturn) retryRevocation(); }
  });
 }

 private boolean finishAcknowledgment(CloudDeviceAccount account) throws Exception {
  if (!account.awaitingAcknowledgment()) return false;
  return changeAccount(() -> {
   if (!account.finishAcknowledgment()) return false;
   GracePasswordsOwner.confirmVerifiedAccount(getContext(), account.session());
   return true;
  });
 }

 private <T> T changeAccount(Callable<T> change) throws Exception {
  Context context = getContext().getApplicationContext();
  try {
   GracePasswordsOwner.enteringAccountChange(context);
   recovery.accountChanged();
   GraceAgentService.retire();
   return change.call();
  } finally {
   GracePasswordsOwner.leavingAccountChange();
   ManagedCalendarReminders.reconcile(context);
   GraceAgentService.finishAccountChange(context);
  }
 }

 private JSObject accountStatus(CloudDeviceAccount account) throws Exception {
  var upgrade = account.leaseUpgradeStatus();
  var current = upgrade == CloudDeviceAccount.LeaseUpgradeStatus.ACKNOWLEDGMENT_PENDING
      ? account.session() : GracePasswordsOwner.stableSession(getContext());
  var status = projection(current);
  if (upgrade == CloudDeviceAccount.LeaseUpgradeStatus.REQUIRED && current != null
      && !account.leaseUpgradeAvailable(BuildConfig.APPLICATION_ID, MOBILE_ENVIRONMENT))
   upgrade = CloudDeviceAccount.LeaseUpgradeStatus.NOT_REQUIRED;
  String mailLeaseUpgrade = switch (upgrade) {
   case NOT_REQUIRED -> null;
   case REQUIRED -> "required";
   case SIGN_IN_PENDING -> "signInPending";
   case ACKNOWLEDGMENT_PENDING -> "acknowledgmentPending";
  };
  if (current != null) {
   var authority = account.mailAuthority();
   if (mailLeaseUpgrade != null) status.put("mailLeaseUpgrade", mailLeaseUpgrade);
   else if (authority != null && current.accountId().equals(authority.accountId())
       && current.organizationId().equals(authority.organizationId()))
    status.put("mailLease", GraceGoogleRead.authority(authority.accountId(), authority.epoch()));
  }
  return status;
 }

 private void publishStatus(CloudDeviceAccount account) throws Exception {
  JSObject status = accountStatus(account);
  var activity = getActivity();
  if (activity == null) return;
  activity.runOnUiThread(() -> {
   var current = getActivity();
   if (current == null || current.isFinishing() || current.isDestroyed()) return;
   notifyListeners("sessionChanged", status, true);
  });
 }

 static JSObject projection(CloudDeviceAccount.Session session) {
  return GracePasswordsOwner.accountStatus(session);
 }

 private void retryRevocation() {
  try { account(getContext()).retryRevocation(); }
  catch (Exception unavailable) { }
 }
}
