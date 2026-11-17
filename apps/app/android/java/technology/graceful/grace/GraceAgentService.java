package technology.graceful.grace;

import ai.eliza.plugins.agent.embedded.EmbeddedAgentService;
import android.app.Notification;

public class GraceAgentService extends EmbeddedAgentService {
 @Override protected Notification runtimeNotification() {
  return Notification.Builder.recoverBuilder(this, super.runtimeNotification()).setSmallIcon(R.drawable.notification_icon).build();
 }
}
