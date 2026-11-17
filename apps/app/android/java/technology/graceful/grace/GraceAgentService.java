package technology.graceful.grace;

import ai.eliza.plugins.agent.embedded.EmbeddedAgentService;
import android.app.Notification;

public class GraceAgentService extends EmbeddedAgentService {
 @Override protected CloudAccount cloudAccount() throws Exception {
  var session = GraceAccount.account(this).session();
  return session == null ? null : new CloudAccount(session.token(), session.accountId(), session.organizationId());
 }

 @Override protected Notification runtimeNotification() {
  return Notification.Builder.recoverBuilder(this, super.runtimeNotification()).setSmallIcon(R.drawable.notification_icon).build();
 }
}
