package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval;
import ai.eliza.plugins.passwords.PasswordSurfaces;
import ai.eliza.plugins.passwords.PasswordUnlock;
import ai.eliza.plugins.passwords.PasswordVaultAccess;
import ai.eliza.plugins.securestore.nativeonly.PasswordVaultStore;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Application;
import android.app.KeyguardManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.text.InputFilter;
import android.text.InputType;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import java.util.Arrays;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import javax.crypto.AEADBadTagException;

final class GracePasswordRecovery implements Application.ActivityLifecycleCallbacks {
 private final ComponentActivity activity;
 private final GraceAccount signIn;
 private AlertDialog active;
 private volatile Operation operation;
 private volatile boolean destroyed;
 private volatile long foregroundVisit;

 static final class Operation {
  final PasswordBackupApproval.Purpose purpose;
  volatile CompletableFuture<?> pending;
  volatile boolean waitingForBrowser = true;
  Operation(PasswordBackupApproval.Purpose purpose) { this.purpose = purpose; }
 }

 GracePasswordRecovery(ComponentActivity activity, GraceAccount signIn) {
  this.activity = activity;
  this.signIn = signIn;
  activity.getApplication().registerActivityLifecycleCallbacks(this);
 }

 boolean open() {
  if (destroyed || active != null || !deviceReady()) return false;
  if (operation != null) {
   if (!operation.waitingForBrowser) return false;
   accountChanged();
  }
  show(new AlertDialog.Builder(activity)
   .setTitle("Backup and recovery")
   .setItems(new String[]{"Back up passwords", "Restore passwords", "Remove cloud backup", "Verify this tablet"},
    (dialog, choice) -> begin(switch (choice) {
     case 0 -> PasswordBackupApproval.Purpose.SAVE;
     case 1 -> PasswordBackupApproval.Purpose.READ;
     case 2 -> PasswordBackupApproval.Purpose.DELETE;
     default -> PasswordBackupApproval.Purpose.VERIFY;
    }))
   .setNegativeButton("Close", null), null);
  return true;
 }

 private void begin(PasswordBackupApproval.Purpose purpose) {
  Operation started = new Operation(purpose);
  operation = started;
  signIn.authorizePasswordBackup(this, started);
 }

 Operation pending() { return operation; }

 boolean isCurrent(Operation expected) { return !destroyed && operation == expected; }

 void run(Operation expected, PasswordBackupApproval approval) {
  expected.waitingForBrowser = false;
  Runnable account = () -> {
   if (!isCurrent(expected) || !approval.current()) throw new IllegalStateException("Password backup approval expired");
  };
  PasswordBackupApproval.Purpose purpose = expected.purpose;
  byte[] recoveryKey = null;
  try {
   account.run();
   if ((purpose == PasswordBackupApproval.Purpose.READ || purpose == PasswordBackupApproval.Purpose.DELETE) && !approval.present()) {
    failed(expected, "There is no cloud backup for this account.");
    return;
   }
   if (purpose == PasswordBackupApproval.Purpose.DELETE) {
    PasswordBackupApproval.Response removed = approval.run(approval.revision(), null);
    account.run();
    failed(expected, removed.status() == 204 ? "Cloud backup removed. Your passwords are still on this tablet." : cloudMessage(removed.status()));
    return;
   }
   recoveryKey = switch (purpose) {
    case SAVE -> showNewRecoveryKey(expected, approval.present());
    case READ -> askForRecoveryKey(expected);
    default -> null;
   };
   if (recoveryKey == null && purpose != PasswordBackupApproval.Purpose.VERIFY) { failed(expected, null); return; }
   final byte[] key = recoveryKey;
   Long visit = confirmDevice(expected);
   if (visit == null) { failed(expected, null); return; }
   account.run();
   PasswordVaultAccess vault = PasswordVaultAccess.get(activity);
   boolean linkExisting = !GracePasswordsOwner.admitted(activity) && vault.exists();
   if (linkExisting && !confirmLinkExisting(expected)) { failed(expected, null); return; }
   if (visit != foregroundVisit || !deviceReady()) { failed(expected, null); return; }
   account.run();
   GracePasswordsOwner.bindVerified(activity, approval, linkExisting);
   if (!GracePasswordsOwner.admitted(activity)) {
    failed(expected, "These saved passwords belong to another Grace account.");
    return;
   }
   Long ticket = unlock(expected);
   if (ticket == null) { failed(expected, null); return; }
   try {
    account.run();
    if (purpose == PasswordBackupApproval.Purpose.VERIFY) {
     failed(expected, "This tablet’s passwords are ready to use.");
     return;
    }
    if (purpose == PasswordBackupApproval.Purpose.SAVE) {
     byte[] encrypted = vault.use(ticket, store -> {
      account.run();
      return store.encryptBackup(approval.scope(), key);
     });
     try {
      account.run();
      PasswordBackupApproval.Response saved = approval.run(approval.revision(), encrypted);
      account.run();
      failed(expected, saved.status() == 204 ? "Backup saved. Keep your recovery key somewhere safe." : cloudMessage(saved.status()));
     } finally {
      Arrays.fill(encrypted, (byte) 0);
     }
    } else {
     PasswordBackupApproval.Response backup = approval.run(null, null);
     if (backup.status() != 200) { failed(expected, cloudMessage(backup.status())); return; }
     byte[] encrypted = backup.ciphertext();
     try {
      if (!approval.revision().equals(backup.revision())) { failed(expected, cloudMessage(412)); return; }
      boolean restored = vault.use(ticket, store -> {
       account.run();
       if (store.entries().length() != 0) return false;
       store.restoreBackup(approval.scope(), key, encrypted);
       return true;
      });
      failed(expected, restored ? "Passwords restored." : "Restore needs an empty password vault. Your saved passwords are still here.");
     } finally {
      Arrays.fill(encrypted, (byte) 0);
     }
    }
   } finally {
    vault.lock(ticket);
   }
  } catch (AEADBadTagException wrongKey) {
   failed(expected, "This recovery key could not open the backup. Check the key and try again.");
  } catch (Exception unavailable) {
   failed(expected, "Grace could not finish. Check your account and connection, then try again.");
  } finally {
   if (recoveryKey != null) Arrays.fill(recoveryKey, (byte) 0);
  }
 }

 private static String cloudMessage(int status) {
  if (status == 401) return "Your approval ended. Open Backup and recovery to try again.";
  if (status == 412) return "The cloud backup changed. Open Backup and recovery to try again.";
  if (status == 404) return "There is no cloud backup for this account.";
  if (status == 413) return "This password vault is too large to back up.";
  return "Grace could not finish. Check your connection and try again.";
 }

 private byte[] showNewRecoveryKey(Operation expected, boolean replacesBackup) throws Exception {
  byte[] key = PasswordVaultStore.newBackupRecoveryKey();
  boolean confirmed = false;
  try {
   CompletableFuture<Boolean> answer = new CompletableFuture<>();
   activity.runOnUiThread(() -> {
    if (!isCurrent(expected)) { answer.complete(false); return; }
    TextView recovery = new TextView(activity);
    recovery.setSaveEnabled(false);
    recovery.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
    recovery.setTextSize(24);
    recovery.setTypeface(android.graphics.Typeface.MONOSPACE);
    int margin = (int) (24 * activity.getResources().getDisplayMetrics().density);
    recovery.setPadding(margin, margin, margin, margin);
    recovery.setText(Base64.getUrlEncoder().withoutPadding().encodeToString(key).replaceAll("(.{5})(?!$)", "$1 "));
    String message = replacesBackup
     ? "This will replace your previous cloud backup. Write down the new key first. You will need it to restore your passwords."
     : "Write down this key. You will need it to restore your passwords on another tablet.";
    show(new AlertDialog.Builder(activity).setTitle("Your recovery key").setMessage(message).setView(recovery)
      .setPositiveButton("I wrote it down", (dialog, which) -> answer.complete(true))
      .setNegativeButton("Cancel", null),
     () -> { recovery.setText(""); answer.complete(false); });
   });
   confirmed = await(expected, answer);
   return confirmed ? key : null;
  } finally {
   if (!confirmed) Arrays.fill(key, (byte) 0);
  }
 }

 private byte[] askForRecoveryKey(Operation expected) throws Exception {
  CompletableFuture<byte[]> answer = new CompletableFuture<>();
  activity.runOnUiThread(() -> {
   if (!isCurrent(expected)) { answer.complete(null); return; }
   EditText recovery = new EditText(activity);
   recovery.setSaveEnabled(false);
   recovery.setLongClickable(false);
   recovery.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
   recovery.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
   recovery.setImeOptions(EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
   recovery.setTextSize(22);
   recovery.setFilters(new InputFilter[]{new InputFilter.LengthFilter(100)});
   recovery.setHint("Recovery key");
   AlertDialog prompt = show(new AlertDialog.Builder(activity).setTitle("Enter your recovery key").setView(recovery)
    .setPositiveButton("Continue", null).setNegativeButton("Cancel", null),
    () -> { recovery.setText(""); answer.complete(null); });
   prompt.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
    byte[] key = parseRecoveryKey(recovery.getText().toString());
    if (key == null) { recovery.setError("Enter the full key as written down."); return; }
    if (!answer.complete(key)) Arrays.fill(key, (byte) 0);
    prompt.dismiss();
   });
  });
  return await(expected, answer);
 }

 private static byte[] parseRecoveryKey(String input) {
  String compact = input.replaceAll("[ \\r\\n]", "");
  if (!compact.matches("[A-Za-z0-9_-]{43}")) return null;
  try {
   byte[] key = Base64.getUrlDecoder().decode(compact);
   if (Base64.getUrlEncoder().withoutPadding().encodeToString(key).equals(compact)) return key;
   Arrays.fill(key, (byte) 0);
  } catch (IllegalArgumentException invalid) {
   return null;
  }
  return null;
 }

 private boolean confirmLinkExisting(Operation expected) throws Exception {
  CompletableFuture<Boolean> answer = new CompletableFuture<>();
  activity.runOnUiThread(() -> {
   if (!isCurrent(expected)) { answer.complete(false); return; }
   show(new AlertDialog.Builder(activity).setTitle("Link saved passwords to your account?")
    .setMessage("This tablet already has saved passwords. Link them to the Grace account you just confirmed.")
    .setPositiveButton("Link saved passwords", (dialog, which) -> answer.complete(true))
    .setNegativeButton("Cancel", null), () -> answer.complete(false));
  });
  return await(expected, answer);
 }

 boolean deviceReady() {
  KeyguardManager lock = activity.getSystemService(KeyguardManager.class);
  return lock != null && lock.isDeviceSecure() && !lock.isDeviceLocked();
 }

 private Long confirmDevice(Operation expected) throws Exception {
  CompletableFuture<Long> answer = new CompletableFuture<>();
  CancellationSignal cancellation = new CancellationSignal();
  class Confirmation extends BiometricPrompt.AuthenticationCallback implements DefaultLifecycleObserver {
   boolean approved;
   @Override public void onResume(LifecycleOwner owner) {
    if (approved) answer.complete(isCurrent(expected) && deviceReady() ? foregroundVisit : null);
   }
   @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
    approved = true;
    if (activity.getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) onResume(activity);
   }
   @Override public void onAuthenticationError(int code, CharSequence message) { answer.complete(null); }
  }
  Confirmation confirmation = new Confirmation();
  activity.runOnUiThread(() -> {
   if (!isCurrent(expected) || answer.isDone() || !deviceReady()) { answer.complete(null); return; }
   try {
    activity.getLifecycle().addObserver(confirmation);
    BiometricPrompt.Builder prompt = new BiometricPrompt.Builder(activity).setTitle("Confirm backup and recovery");
    if (Build.VERSION.SDK_INT >= 30) prompt.setAllowedAuthenticators(BiometricManager.Authenticators.DEVICE_CREDENTIAL);
    else prompt.setDeviceCredentialAllowed(true);
    prompt.build().authenticate(cancellation, activity.getMainExecutor(), confirmation);
   } catch (RuntimeException unavailable) { answer.complete(null); }
  });
  try { return await(expected, answer); }
  finally {
   activity.runOnUiThread(() -> {
    activity.getLifecycle().removeObserver(confirmation);
    cancellation.cancel();
   });
  }
 }

 private Long unlock(Operation expected) throws Exception {
  CompletableFuture<Long> ticket = new CompletableFuture<>();
  activity.runOnUiThread(() -> {
   if (!isCurrent(expected)) { ticket.complete(null); return; }
   PasswordUnlock.prompt(activity, new PasswordUnlock.Result() {
    @Override public void unlocked(long value) {
     if (isCurrent(expected) && ticket.complete(value)) return;
     try { PasswordVaultAccess.get(activity).lock(value); }
     catch (Exception unavailable) { ticket.complete(null); }
    }
    @Override public void failed(String reason) { ticket.complete(null); }
   });
  });
  return await(expected, ticket);
 }

 private <T> T await(Operation expected, CompletableFuture<T> result) throws Exception {
  expected.pending = result;
  if (!isCurrent(expected)) result.cancel(false);
  try { return result.get(2, TimeUnit.MINUTES); }
  finally {
   expected.pending = null;
   if (!result.isDone()) {
    result.cancel(false);
    activity.runOnUiThread(() -> { if (isCurrent(expected)) dismiss(); });
   }
  }
 }

 void failed(Operation expected, String message) {
  activity.runOnUiThread(() -> {
   if (!isCurrent(expected)) return;
   operation = null;
   if (activity.isFinishing() || message == null) return;
   dismiss();
   show(new AlertDialog.Builder(activity).setTitle("Backup and recovery")
    .setMessage(message).setPositiveButton("Done", null), null);
  });
 }

 void accountChanged() {
  Operation pending = operation;
  operation = null;
  CompletableFuture<?> answer = pending == null ? null : pending.pending;
  if (answer != null) answer.cancel(false);
  signIn.cancelPasswordBackup();
  activity.runOnUiThread(this::dismiss);
 }

 private AlertDialog show(AlertDialog.Builder builder, Runnable cleanup) {
  AlertDialog dialog = builder.create();
  android.view.Window window = dialog.getWindow();
  if (window == null) throw new IllegalStateException("Protected password screen unavailable");
  window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
  Runnable resumeSurface = PasswordSurfaces.protect();
  active = dialog;
  dialog.setOnDismissListener(ignored -> {
   if (active == dialog) active = null;
   try { if (cleanup != null) cleanup.run(); }
   finally { resumeSurface.run(); }
  });
  dialog.setCanceledOnTouchOutside(false);
  try {
   dialog.show();
   if (dialog.getListView() != null) dialog.getListView().setFilterTouchesWhenObscured(true);
   for (int id : new int[]{AlertDialog.BUTTON_POSITIVE, AlertDialog.BUTTON_NEGATIVE}) {
    if (dialog.getButton(id) != null) dialog.getButton(id).setFilterTouchesWhenObscured(true);
   }
   return dialog;
  } catch (RuntimeException unavailable) {
   active = null;
   try { if (cleanup != null) cleanup.run(); }
   finally { resumeSurface.run(); }
   throw unavailable;
  }
 }

 private void dismiss() { if (active != null) active.dismiss(); }
 @Override public void onActivityPaused(Activity owner) {
  if (owner == activity) {
   foregroundVisit++;
   dismiss();
  }
 }
 @Override public void onActivityDestroyed(Activity owner) {
  if (owner != activity) return;
  destroyed = true;
  accountChanged();
  activity.getApplication().unregisterActivityLifecycleCallbacks(this);
 }
 @Override public void onActivityCreated(Activity owner, Bundle state) {}
 @Override public void onActivityStarted(Activity owner) {}
 @Override public void onActivityResumed(Activity owner) {}
 @Override public void onActivityStopped(Activity owner) {}
 @Override public void onActivitySaveInstanceState(Activity owner, Bundle state) {}
}
