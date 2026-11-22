package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import android.app.Application;

public final class GraceApplication extends Application {
 @Override public void onCreate() {
  super.onCreate();
  PasswordVaultAccess.setAdmission(GracePasswordsOwner::admitted);
  PasswordVaultAccess.installDeviceUnlockedCustody(this);
 }
}
