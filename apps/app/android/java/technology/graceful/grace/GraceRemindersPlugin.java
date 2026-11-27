package technology.graceful.grace;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.util.Base64;
import android.util.Log;
import ai.eliza.plugins.reminders.ReminderConfiguration;
import ai.eliza.plugins.reminders.ReminderEngine;
import ai.eliza.plugins.reminders.ReminderPlugin;
import android.content.BroadcastReceiver;
import android.content.Intent;
import ai.eliza.plugins.reminders.SecureStringStore;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import android.os.Build;
import android.os.PowerManager;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.Permission;
import java.io.File;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "GraceReminders", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class GraceRemindersPlugin extends ReminderPlugin {
 private static final Executor FOREGROUND_IO = Executors.newSingleThreadExecutor();
 private static volatile GraceRemindersPlugin foreground;

 static boolean isForeground(Context context) {
  return foreground != null && context.getSystemService(PowerManager.class).isInteractive();
 }

 static void managedDueChanged() {
  var active = foreground;
  if (active == null) return;
  Activity activity = active.getActivity();
  if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;
  activity.runOnUiThread(() -> {
   Activity current = active.getActivity();
   if (foreground == active && current != null && !current.isFinishing() && !current.isDestroyed()) {
    active.notifyListeners("managedDueChanged", new JSObject());
   }
  });
 }

 @Override protected void handleOnResume() {
  super.handleOnResume();
  foreground = this;
  managedDueChanged();
 }

 @Override protected void handleOnPause() {
  if (foreground == this) foreground = null;
  ManagedCalendarReminders.postBackground(getContext().getApplicationContext());
  super.handleOnPause();
 }

 @PluginMethod public void managedDue(PluginCall call) {
  FOREGROUND_IO.execute(() -> {
   synchronized (GracePasswordsOwner.class) {
    try { call.resolve(new JSObject().put("reminders", ManagedCalendarReminders.due(getContext()))); }
    catch (Exception unavailable) { call.reject("Calendar reminders are unavailable"); }
   }
  });
 }

 @PluginMethod public void dismissManagedDue(PluginCall call) {
  FOREGROUND_IO.execute(() -> {
   synchronized (GracePasswordsOwner.class) {
    try {
     String id = call.getString("id", "");
     var reminders = ManagedCalendarReminders.due(getContext());
     for (int i = 0; i < reminders.length(); i++) {
      if (reminders.getJSONObject(i).getString("id").equals(id) && reminderEngine(getContext()).cancel(id)) {
       ManagedCalendarReminders.deleteBinding(getContext(), id);
       call.resolve(new JSObject().put("id", id));
       managedDueChanged();
       return;
      }
     }
    } catch (Exception unavailable) { }
   }
   call.reject("That reminder is no longer available");
  });
 }

 @PluginMethod public void openManagedDue(PluginCall call) {
  FOREGROUND_IO.execute(() -> {
   try {
    String id = call.getString("id", "");
    long generation = GracePasswordsOwner.generation();
    var details = ManagedCalendarReminders.detail(getContext(), id);
    if (GracePasswordsOwner.generation() != generation) throw new IllegalStateException();
    Activity activity = getActivity();
    if (activity == null || activity.isFinishing() || activity.isDestroyed()) throw new IllegalStateException();
    activity.runOnUiThread(() -> {
     try {
      Activity current = getActivity();
      if (foreground != this || current == null || current.isFinishing() || current.isDestroyed()
       || GracePasswordsOwner.generation() != generation || GracePasswordsOwner.accountChanging()) throw new IllegalStateException();
      current.startActivity(new Intent(Intent.ACTION_VIEW, details));
      call.resolve();
     } catch (Exception unavailable) { call.reject("Calendar reminder couldn’t open"); }
    });
   } catch (Exception unavailable) { call.reject("Calendar reminder couldn’t open"); }
  });
 }

 static final ReminderConfiguration CONFIGURATION = new ReminderConfiguration(
  "grace-reminders", "grace-reminders-legacy", "grace-reminder-taps", "grace-reminders",
  "Reminders", "Reminders for your calendar", "Reminder",
  "technology.graceful.grace.REMIND", "technology.graceful.grace.REMINDER_DECISION", "technology.graceful.grace.OPEN_REMINDER",
  "grace-reminder:", "grace-reminder-decision:", "grace-reminder-tap:",
  "technology.graceful.grace.reminder.id", "technology.graceful.grace.reminder.occurrence", "technology.graceful.grace.reminder.decision",
  "", Receiver.class, MainActivity.class, null, R.drawable.notification_icon);

 static final SecureStringStore.Factory STORE = context -> new SecureStringStore() {
  private File file(String key) {
   return new File(GraceRecordStorePlugin.folder(context, "reminders"), Base64.encodeToString(key.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING));
  }

  @Override public String identity() { return "grace-app-private-records-v1"; }

  @Override public String read(String key) throws Exception { return GraceRecordStorePlugin.load(file(key)).value(); }

  @Override public void write(String key, String value) throws Exception {
   GraceRecordStorePlugin.overwrite(file(key), value);
  }
 };

 public GraceRemindersPlugin() { super(CONFIGURATION, STORE); }

 @Override public void load() {
  super.load();
  Context app = getContext().getApplicationContext();
  FOREGROUND_IO.execute(() -> {
   synchronized (GracePasswordsOwner.class) {
    try { ManagedCalendarReminders.pruneOtherOwners(app, reminderEngine(app)); }
    catch (Exception unavailable) { }
   }
  });
 }

 @PluginMethod public void enableManagedReminders(PluginCall call) {
  try {
   if (GracePasswordsOwner.stableSession(getContext()) == null) { call.reject("Sign in to use Calendar reminders"); return; }
   if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
    requestPermissionForAlias("notifications", call, "enableManagedRemindersResult");
    return;
   }
   enableManagedRemindersResult(call);
  } catch (Exception unavailable) { call.reject("Calendar reminders are unavailable"); }
 }

 @PermissionCallback private void enableManagedRemindersResult(PluginCall call) {
  if (!reminderEngine(getContext()).notificationsAllowed()) { call.reject("Android notifications are unavailable"); return; }
  ManagedCalendarReminders.reconcile(getContext());
  call.resolve();
 }

 @Override protected void onReminderTapReady() {
  if (getActivity() instanceof MainActivity activity && activity.hasWindowFocus()) ManagedCalendarReminders.open(activity);
 }

 static ReminderEngine reminderEngine(Context context) { return ReminderEngine.get(context, CONFIGURATION, STORE); }

 public static class Receiver extends BroadcastReceiver {
  private static final Executor RESTORE_WORK = Executors.newSingleThreadExecutor();

  @Override public void onReceive(Context context, Intent intent) {
   String action = intent.getAction();
   var application = context.getApplicationContext();
   var pending = goAsync();
   try {
    RESTORE_WORK.execute(() -> {
     try { dispatch(application, intent); }
     catch (RuntimeException unavailable) { Log.w("GraceReminders", "Could not handle reminder broadcast for " + action, unavailable); }
     finally { pending.finish(); }
    });
   } catch (RejectedExecutionException unavailable) {
    pending.finish();
    Log.w("GraceReminders", "Could not schedule reminder broadcast for " + action, unavailable);
   }
  }

  private static void dispatch(Context context, Intent intent) {
   String id = intent.getStringExtra(CONFIGURATION.idExtra);
   synchronized (GracePasswordsOwner.class) {
    var engine = reminderEngine(context);
    if (id == null) {
     try { ManagedCalendarReminders.pruneOtherOwners(context, engine); }
     catch (Exception unavailable) { return; }
    }
    if (!ManagedCalendarReminders.allowed(context, id)) return;
    if (id != null && id.startsWith(ManagedCalendarReminders.PREFIX) &&
        CONFIGURATION.remindAction.equals(intent.getAction()) && isForeground(context)) managedDueChanged();
    else engine.dispatch(intent);
   }
  }
 }
}
