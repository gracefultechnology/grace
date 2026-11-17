package technology.graceful.grace;

import ai.eliza.plugins.agent.embedded.EmbeddedAgentService;
import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import org.json.JSONException;

public class GraceAgentService extends EmbeddedAgentService {
 @Override protected Notification runtimeNotification() {
  return Notification.Builder.recoverBuilder(this, super.runtimeNotification()).setSmallIcon(R.drawable.notification_icon).build();
 }

 @Override protected String cloudCredential() throws Exception { return GraceCredentials.agentKey(this); }

 static boolean stopped() throws JSONException {
  String state = statusFor(GraceAgentService.class, true, "").getString("state");
  return !state.equals("starting") && !state.equals("running");
 }

 static void start(Context context) {
  try { context.startForegroundService(new Intent(context, GraceAgentService.class)); }
  catch (IllegalStateException inBackground) { }
 }
}
