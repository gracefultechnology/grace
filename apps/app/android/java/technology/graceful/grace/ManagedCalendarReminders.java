package technology.graceful.grace;

import ai.eliza.plugins.reminders.ReminderEngine;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.io.File;
import java.util.Locale;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

final class ManagedCalendarReminders {
 static final String PREFIX = "owned-calendar-";
 private static final Executor WORK = Executors.newSingleThreadExecutor();
 record ApprovedReminder(String id, String title, long fireAt, String binding) {}
 record LocalReminder(String id, String status, long alarmAt) {
  boolean terminal() { return "completed".equals(status) || "cancelled".equals(status); }
 }

 private ManagedCalendarReminders() {}

 static String ownerPrefix(CloudDeviceAccount.Session owner) throws Exception {
  return PREFIX + hex(GracePasswordsOwner.storageOwner(owner)).substring(0, 24) + "-";
 }

 private static String hex(String value) throws Exception {
  var bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
  var result = new StringBuilder();
  for (byte entry : bytes) result.append(String.format(Locale.ROOT, "%02x", entry & 255));
  return result.toString();
 }

 static boolean allowed(Context context, String id) {
  if (id == null || !id.startsWith(PREFIX)) return true;
  try {
   var owner = GracePasswordsOwner.stableSession(context);
   return owner != null && id.startsWith(ownerPrefix(owner));
  } catch (Exception denied) { return false; }
 }

 static void reconcile(Context input) {
  var context = input.getApplicationContext();
  WORK.execute(() -> {
   try { reconcileOwner(context); }
   catch (Exception unavailable) { }
   GraceRemindersPlugin.managedDueChanged();
  });
 }

 private static void reconcileOwner(Context context) throws Exception {
  var engine = GraceRemindersPlugin.reminderEngine(context);
  CloudDeviceAccount.Session owner;
  synchronized (GracePasswordsOwner.class) {
   owner = GracePasswordsOwner.stableSession(context);
   pruneOtherOwners(context, engine);
  }
  if (owner == null || !engine.notificationsAllowed()) return;
  String prefix = ownerPrefix(owner);
  var schedule = schedule(context, owner, prefix);
  schedule.sort(Comparator.comparingLong(ApprovedReminder::fireAt));
  synchronized (GracePasswordsOwner.class) {
   if (!owner.equals(GracePasswordsOwner.stableSession(context))) return;
   var entries = engine.list();
   var local = new HashMap<String, LocalReminder>();
   for (int i = 0; i < entries.length(); i++) {
    var row = entries.getJSONObject(i);
    String id = row.getString("id");
    local.put(id, new LocalReminder(id, row.getString("status"), row.optLong("at", Long.MAX_VALUE)));
   }
   var eligible = eligible(schedule, local, prefix, engine.capacity(), System.currentTimeMillis());
   for (var row : local.values()) {
    if (row.id().startsWith(prefix) && !eligible.contains(row.id()) && !row.terminal()) engine.cancel(row.id());
   }
   for (var reminder : schedule) {
    var existing = local.get(reminder.id());
    if (!eligible.contains(reminder.id()) || reminder.fireAt() <= System.currentTimeMillis() ||
        (existing != null && !"cancelled".equals(existing.status()))) continue;
    var file = bindingFile(context, reminder.id());
    GraceRecordStorePlugin.commit(file, GraceRecordStorePlugin.load(file).revision(), reminder.binding());
    var receipt = engine.schedule(reminder.id(), reminder.title(), "Open Grace to see your appointment.", reminder.fireAt(), null, null);
    if (!"scheduled".equals(receipt.optString("status"))) throw new IllegalStateException("Reminder not scheduled");
   }
  }
 }

 static HashSet<String> eligible(ArrayList<ApprovedReminder> schedule, HashMap<String, LocalReminder> local, String prefix, int free, long now) {
  var expected = new HashSet<String>();
  for (var reminder : schedule) if (!expected.add(reminder.id())) throw new IllegalStateException();
  var result = new HashSet<String>();
  for (var row : local.values()) {
   if (row.terminal()) continue;
   if (!row.id().startsWith(prefix)) free--;
   else if (expected.contains(row.id()) && (row.alarmAt() <= now || "posted".equals(row.status()))) {
    result.add(row.id());
    free--;
   }
  }
  for (var reminder : schedule) {
   if (free <= 0) break;
   var row = local.get(reminder.id());
   if (reminder.fireAt() > now && (row == null || !"completed".equals(row.status())) && result.add(reminder.id())) free--;
  }
  return result;
 }

 private static ArrayList<ApprovedReminder> schedule(Context context, CloudDeviceAccount.Session owner, String prefix) throws Exception {
  var reminders = new ArrayList<ApprovedReminder>();
  String cursor = null;
  String stamp = null;
  do {
   if (!owner.equals(GracePasswordsOwner.stableSession(context))) throw new IllegalStateException();
   var page = GraceOwnerRead.read(GraceOwnerRead.Endpoint.REMINDERS, cursor == null ? "" : "?page=" + Uri.encode(cursor), owner);
   var rows = page.getJSONArray("reminders");
   if (!page.has("nextPage") || rows.length() > 64) throw new IllegalStateException();
   for (int i = 0; i < rows.length(); i++) {
    var item = rows.getJSONObject(i);
    String occurrence = item.getString("occurrenceId");
    String version = item.getString("version");
    String grant = item.getString("grantId");
    String title = item.getString("title");
    long at = item.getLong("fireAt");
    int minutes = item.getInt("minutes");
    if (!occurrence.matches("[a-zA-Z0-9_-]{1,255}") || version.isBlank() || version.length() > 255 ||
        !grant.matches("[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}") || title.isBlank() || title.length() > 160 ||
        at <= 0 || at > 8_640_000_000_000_000L || (minutes != 60 && minutes != 1440)) throw new IllegalArgumentException();
    String binding = new JSONArray().put(occurrence).put(version).put(grant).put(at).put(minutes).toString();
    reminders.add(new ApprovedReminder(prefix + hex(binding).substring(0, 48), title, at, binding));
   }
   cursor = page.isNull("nextPage") ? null : page.getString("nextPage");
   if (cursor != null) {
    if (rows.length() != 64 || !cursor.matches("[a-f0-9]{64}:[1-9][0-9]{0,8}")) throw new IllegalStateException();
    if (stamp == null) stamp = cursor.substring(0, 64);
    if (!cursor.equals(stamp + ":" + reminders.size())) throw new IllegalStateException();
   }
  } while (cursor != null);
  return reminders;
 }

 static void pruneOtherOwners(Context context, ReminderEngine engine) throws Exception {
  var entries = engine.list();
  for (int i = 0; i < entries.length(); i++) {
   var entry = entries.getJSONObject(i);
   String id = entry.getString("id");
   if (!allowed(context, id) && !entry.optString("status").equals("cancelled")) engine.cancel(id);
  }
 }

 static JSONArray due(Context context) throws Exception {
  var result = new JSONArray();
  var engine = GraceRemindersPlugin.reminderEngine(context);
  var records = engine.list();
  long now = System.currentTimeMillis();
  for (int i = 0; i < records.length(); i++) {
   var record = records.getJSONObject(i);
   String id = record.getString("id");
   String status = record.getString("status");
   if (!id.startsWith(PREFIX) || !allowed(context, id) || record.getLong("at") > now ||
       (!"scheduled".equals(status) && !"posted".equals(status))) continue;
   var binding = new JSONArray(GraceRecordStorePlugin.load(bindingFile(context, id)).value());
   long eventAt = binding.getLong(3) + binding.getInt(4) * 60_000L;
   result.put(new JSONObject().put("id", id).put("title", record.getString("title")).put("eventAt", eventAt));
  }
  return result;
 }

 static void postBackground(Context context) {
  WORK.execute(() -> {
   synchronized (GracePasswordsOwner.class) {
    try {
     if (GraceRemindersPlugin.isForeground(context)) return;
     var engine = GraceRemindersPlugin.reminderEngine(context);
     var reminders = due(context);
     for (int i = 0; i < reminders.length(); i++) engine.deliverDue(reminders.getJSONObject(i).getString("id"));
    } catch (Exception unavailable) { }
   }
  });
 }

 static Uri detail(Context context, String id) throws Exception {
  if (!id.startsWith(PREFIX) || !allowed(context, id)) throw new IllegalStateException();
  var binding = new JSONArray(GraceRecordStorePlugin.load(bindingFile(context, id)).value());
  var owner = GracePasswordsOwner.stableSession(context);
  if (owner == null || !allowed(context, id)) throw new IllegalStateException();
  var target = GraceOwnerRead.read(GraceOwnerRead.Endpoint.REMINDERS, "?verify=" + Uri.encode(binding.getString(0)), owner);
  if (!target.getString("version").equals(binding.getString(1)) ||
      !target.getString("grantId").equals(binding.getString(2)) ||
      target.getLong("fireAt") != binding.getLong(3) ||
      !owner.equals(GracePasswordsOwner.stableSession(context))) throw new IllegalStateException();
  return GraceAccount.hostedView(context, "calendar").buildUpon()
    .appendQueryParameter("occurrence", binding.getString(0)).build();
 }

 static void open(MainActivity activity) {
  WORK.execute(() -> {
   try {
    var context = activity.getApplicationContext();
    var engine = GraceRemindersPlugin.reminderEngine(context);
    var tap = engine.pendingTap();
    if (!tap.optBoolean("retained")) return;
    String id = tap.getJSONObject("target").getString("reminderId");
    if (!id.startsWith(PREFIX)) return;
    var view = detail(context, id);
    activity.runOnUiThread(() -> {
     if (!activity.hasWindowFocus() || !allowed(context, id) || activity.isFinishing()) return;
     try { activity.startActivity(new Intent(Intent.ACTION_VIEW, view)); }
     catch (android.content.ActivityNotFoundException unavailable) { return; }
     WORK.execute(() -> {
      try { engine.consumeTap(tap.getString("token")); }
      catch (Exception unavailable) { }
     });
    });
   } catch (Exception unavailable) { }
  });
 }

 private static File bindingFile(Context context, String id) {
  if (!id.matches("owned-calendar-[a-f0-9]{24}-[a-f0-9]{48}")) throw new IllegalArgumentException();
  return new File(GraceRecordStorePlugin.folder(context, "calendar-reminder-bindings"), id + ".json");
 }
}
