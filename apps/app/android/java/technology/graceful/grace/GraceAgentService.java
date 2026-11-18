package technology.graceful.grace;

import ai.eliza.plugins.agent.embedded.EmbeddedAgentService;
import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class GraceAgentService extends EmbeddedAgentService {
 @Override protected CloudAccount cloudAccount() throws Exception {
  var session = GracePasswordsOwner.stableSession(this);
  return session == null ? null : new CloudAccount(session.token(), session.accountId(), session.organizationId());
 }

 private static volatile boolean alive, restartOwed;

 @Override public void onCreate() { super.onCreate(); alive = true; }
 @Override public void onDestroy() {
  try { super.onDestroy(); } finally { alive = false; }
 }

 @Override protected Notification runtimeNotification() {
  return Notification.Builder.recoverBuilder(this, super.runtimeNotification()).setSmallIcon(R.drawable.notification_icon).build();
 }

 static void resume(Context context) {
  if (GracePasswordsOwner.accountChanging()) return;
  if (restartOwed) restart(context);
  else if (!alive) start(context, null);
 }

 static void retire() {
  restartOwed = true;
  prepareRestartFor(GraceAgentService.class);
 }

 static void finishAccountChange(Context context) {
  try {
   if (GracePasswordsOwner.stableSession(context) != null) {
    restart(context);
    return;
   }
  } catch (Exception unconfirmed) { }
  restartOwed = false;
  context.stopService(new Intent(context, GraceAgentService.class));
 }

 static void restart(Context context) {
  restartOwed = true;
  if (start(context, "restart")) restartOwed = false;
  else prepareRestartFor(GraceAgentService.class);
 }

 private static boolean start(Context context, String action) {
  try {
   context.startForegroundService(new Intent(context, GraceAgentService.class).setAction(action));
   return true;
  } catch (IllegalStateException refused) {
   Log.w("GraceAgent", "Android refused to start the agent while Grace is in the background; it starts when Grace is next opened", refused);
   return false;
  }
 }
}
