package technology.graceful.grace;

import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

record GraceGoogleRead(String accountId, String leaseVersion, String path, JSObject query) {
 private static final ExecutorService REQUESTS = Executors.newFixedThreadPool(2);

 interface Reader {
  JSObject read(GraceGoogleRead input) throws Exception;
 }

 static void run(PluginCall call, Reader read) {
  REQUESTS.execute(() -> {
   try {
    var input = call.getData();
    var query = call.getObject("query");
    if (!(input.opt("accountId") instanceof String accountId) || accountId.isEmpty()
        || !(input.opt("leaseVersion") instanceof String leaseVersion) || leaseVersion.isEmpty()
        || !(input.opt("route") instanceof String route) || !route.matches("[a-z]+(?:/[a-z-]+)*")
        || query == null) throw new IllegalArgumentException("Invalid Google read");
    for (var keys = query.keys(); keys.hasNext();) {
     var key = keys.next();
     if (!key.matches("[A-Za-z][A-Za-z0-9_]*") || !(query.opt(key) instanceof String))
      throw new IllegalArgumentException("Invalid Google read query");
    }
    call.resolve(read.read(new GraceGoogleRead(accountId, leaseVersion, "/api/v1/eliza/google/" + route, query)));
   } catch (Exception unavailable) {
    call.reject("Connected account read is unavailable");
   }
  });
 }

 boolean matches(String person, String version) {
  return accountId.equals(person) && leaseVersion.equals(version);
 }

 String target() {
  var target = new Uri.Builder().encodedPath(path);
  for (var keys = query.keys(); keys.hasNext();) {
   var key = keys.next();
   target.appendQueryParameter(key, query.optString(key));
  }
  return target.build().toString();
 }

 static JSObject authority(String accountId, String leaseVersion) {
  return new JSObject().put("accountId", accountId).put("leaseVersion", leaseVersion);
 }
}
