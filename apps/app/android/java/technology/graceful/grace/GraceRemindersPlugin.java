package technology.graceful.grace;

import android.Manifest;
import android.content.Context;
import android.util.Base64;
import ai.eliza.plugins.reminders.ReminderConfiguration;
import ai.eliza.plugins.reminders.ReminderEngine;
import ai.eliza.plugins.reminders.ReminderPlugin;
import ai.eliza.plugins.reminders.ReminderReceiver;
import ai.eliza.plugins.reminders.SecureStringStore;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.File;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "GraceReminders", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class GraceRemindersPlugin extends ReminderPlugin {
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
   File file = file(key);
   GraceRecordStorePlugin.commit(file, GraceRecordStorePlugin.load(file).revision(), value);
  }
 };

 public GraceRemindersPlugin() { super(CONFIGURATION, STORE); }

 public static class Receiver extends ReminderReceiver {
  @Override protected ReminderEngine engine(Context context) { return ReminderEngine.get(context, CONFIGURATION, STORE); }
 }
}
