package technology.graceful.grace;

import ai.eliza.plugins.agent.embedded.EmbeddedAgentService;
import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class GraceAgentService extends EmbeddedAgentService {
 private static volatile boolean alive, restartOwed;

 @Override public void onCreate() { super.onCreate(); alive = true; }
 @Override public void onDestroy() { alive = false; super.onDestroy(); }

 @Override protected Notification runtimeNotification() {
  return Notification.Builder.recoverBuilder(this, super.runtimeNotification()).setSmallIcon(R.drawable.notification_icon).build();
 }

 @Override protected String cloudCredential() throws Exception { return GraceCredentials.cloudKey(this); }

 static void resume(Context context) {
  if (restartOwed) restart(context);
  else if (!alive) start(context, null);
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
