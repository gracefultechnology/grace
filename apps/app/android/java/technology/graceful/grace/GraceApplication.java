package technology.graceful.grace;

import ai.eliza.plugins.browsersurface.InboxAutofillWebView;
import ai.eliza.plugins.passwords.InboxAutofill;
import ai.eliza.plugins.passwords.PasswordVaultAccess;
import android.app.Application;

public final class GraceApplication extends Application {
 @Override public void onCreate() {
  super.onCreate();
  if (GraceInboxAutofill.enabled()) {
   InboxAutofill.install(GraceInboxAutofill::offer, InboxAutofillWebView::isFieldCurrent);
   InboxAutofillWebView.setDeliveryGate(InboxAutofill::claimDelivery);
  }
  PasswordVaultAccess.setAdmission(GracePasswordsOwner::admitted);
  PasswordVaultAccess.installDeviceUnlockedCustody(this);
 }
}
