package technology.graceful.grace;

import ai.eliza.plugins.passwords.PasswordVaultAccess;
import android.app.Application;
import android.content.Context;
import java.nio.file.Files;
import java.nio.file.LinkOption;

public final class GraceApplication extends Application {
 @Override public void onCreate() {
  super.onCreate();
  PasswordVaultAccess.setAdmission(GraceApplication::admitsDevicePasswords);
 }

 private static boolean admitsDevicePasswords(Context context) {
  var custody = context.getNoBackupFilesDir().toPath();
  return Files.notExists(custody.resolve("grace-passwords-owner.json"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(custody.resolve("grace-passwords-owner.json.bak"), LinkOption.NOFOLLOW_LINKS)
    && Files.notExists(custody.resolve("local-runtime").resolve("verified-account"), LinkOption.NOFOLLOW_LINKS);
 }
}
