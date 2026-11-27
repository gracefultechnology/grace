package technology.graceful.grace;

import ai.eliza.plugins.securestore.google.NativeGoogleAuthorization;
import android.app.Activity;
import android.os.CancellationSignal;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.regex.Pattern;

final class GraceGoogleConsent {
 private static final String SCOPE = "https://www.googleapis.com/auth/";
 private static final Pattern EMAIL = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
 private static final Pattern CLIENT_ID = Pattern.compile("[0-9]+-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com");
 private static final Pattern SERVER_CODE = Pattern.compile("[A-Za-z0-9/_.~-]{10,2048}");

 record Capabilities(boolean mail, boolean calendar, boolean sendMail, boolean trashMail, boolean writeCalendar) {
  Capabilities {
   if ((!mail && !calendar) || ((sendMail || trashMail) && !mail) || (writeCalendar && !calendar))
    throw new IllegalArgumentException("Invalid Google permissions");
  }

  private List<String> scopes() {
   List<String> selected = new ArrayList<>();
   if (mail) selected.add(SCOPE + "gmail.readonly");
   if (sendMail) selected.add(SCOPE + "gmail.send");
   if (trashMail) selected.add(SCOPE + "gmail.modify");
   if (calendar) selected.add(SCOPE + "calendar.events.readonly");
   if (writeCalendar) selected.add(SCOPE + "calendar.events.owned");
   return selected;
  }
 }

 record Request(String verifiedEmail, String serverClientId, Capabilities capabilities) {
  Request {
   if (verifiedEmail == null || verifiedEmail.length() > 254 || !EMAIL.matcher(verifiedEmail).matches()
       || serverClientId == null || !CLIENT_ID.matcher(serverClientId).matches() || capabilities == null)
    throw new IllegalArgumentException("Invalid Google consent request");
  }
 }

 sealed interface Result permits Code, Canceled, Unavailable {}

 record Code(String value) implements Result {
  @Override public String toString() { return "GraceGoogleConsent.Code"; }
 }

 record Canceled() implements Result {}
 record Unavailable() implements Result {}

 private GraceGoogleConsent() {}

 static void start(Activity activity, Request request, CancellationSignal cancellation, Consumer<Result> reply) {
  activity.runOnUiThread(() -> {
   if (cancellation.isCanceled()) reply.accept(new Canceled());
   else if (!(activity instanceof ComponentActivity host) || host.isFinishing() || host.isDestroyed())
    reply.accept(new Unavailable());
   else new Consent(host, request, cancellation, reply).start();
  });
 }

 private static final class Consent implements DefaultLifecycleObserver {
  private final ComponentActivity host;
  private final Request request;
  private final CancellationSignal cancellation;
  private final Consumer<Result> reply;
  private final List<String> selectedScopes;
  private ActivityResultLauncher<IntentSenderRequest> launcher;
  private boolean finished;

  Consent(ComponentActivity host, Request request, CancellationSignal cancellation, Consumer<Result> reply) {
   this.host = host;
   this.request = request;
   this.cancellation = cancellation;
   this.reply = reply;
   selectedScopes = request.capabilities().scopes();
  }

  void start() {
   host.getLifecycle().addObserver(this);
   cancellation.setOnCancelListener(() -> host.getMainExecutor().execute(() -> finish(new Canceled())));
   if (cancellation.isCanceled()) { finish(new Canceled()); return; }
   List<String> scopes = new ArrayList<>();
   scopes.add("openid");
   scopes.add("email");
   scopes.addAll(selectedScopes);
   try {
    var client = Identity.getAuthorizationClient(host);
    var authorization = NativeGoogleAuthorization.request(request.serverClientId(), request.verifiedEmail(), scopes);
    client.authorize(authorization).addOnCompleteListener(host.getMainExecutor(), task -> {
     if (finished) return;
     if (task.isCanceled()) finish(new Canceled());
     else if (!task.isSuccessful()) fail(task.getException());
     else authorized(client, task.getResult());
    });
   } catch (RuntimeException unavailable) {
    finish(new Unavailable());
   }
  }

  private void authorized(AuthorizationClient client, AuthorizationResult result) {
   if (cancellation.isCanceled()) { finish(new Canceled()); return; }
   if (result == null || host.isDestroyed() || host.isFinishing()) { finish(new Unavailable()); return; }
   if (!result.hasResolution()) { issued(result); return; }
   var pending = result.getPendingIntent();
   if (pending == null) { finish(new Unavailable()); return; }
   try {
    launcher = host.getActivityResultRegistry().register("grace-google-consent-" + UUID.randomUUID(),
      new ActivityResultContracts.StartIntentSenderForResult(), answer -> returned(client, answer));
    launcher.launch(new IntentSenderRequest.Builder(pending.getIntentSender()).build());
   } catch (RuntimeException unavailable) {
    finish(new Unavailable());
   }
  }

  private void returned(AuthorizationClient client, ActivityResult answer) {
   if (finished) return;
   var data = answer.getData();
   if (answer.getResultCode() == Activity.RESULT_CANCELED) {
    var launchFailed = data != null && data.hasExtra(ActivityResultContracts.StartIntentSenderForResult.EXTRA_SEND_INTENT_EXCEPTION);
    finish(launchFailed ? new Unavailable() : new Canceled());
    return;
   }
   if (answer.getResultCode() != Activity.RESULT_OK || data == null) { finish(new Unavailable()); return; }
   try { issued(client.getAuthorizationResultFromIntent(data)); }
   catch (ApiException failure) { fail(failure); }
   catch (RuntimeException unavailable) { finish(new Unavailable()); }
  }

  private void issued(AuthorizationResult result) {
   var granted = result.getGrantedScopes();
   String code = result.getServerAuthCode();
   if (granted == null || selectedScopes.stream().noneMatch(granted::contains)) finish(new Canceled());
   else finish(code != null && SERVER_CODE.matcher(code).matches() ? new Code(code) : new Unavailable());
  }

  private void fail(Exception failure) {
   finish(failure instanceof ApiException rejected && rejected.getStatusCode() == CommonStatusCodes.CANCELED
     ? new Canceled() : new Unavailable());
  }

  @Override public void onDestroy(LifecycleOwner owner) {
   finish(new Canceled());
  }

  private void finish(Result result) {
   if (finished) return;
   finished = true;
   cancellation.setOnCancelListener(null);
   host.getLifecycle().removeObserver(this);
   if (launcher != null) launcher.unregister();
   reply.accept(cancellation.isCanceled() ? new Canceled() : result);
  }
 }
}
