package technology.graceful.grace;

import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import android.app.Activity;
import android.os.CancellationSignal;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

final class GraceGoogleConnection {
 private static final ExecutorService REQUESTS = Executors.newSingleThreadExecutor();
 private static Pending pending;

 private record Owner(CloudDeviceAccount.Session session, long generation) {
  static Owner capture(Activity activity, String accountId) throws Exception {
   long generation = GracePasswordsOwner.generation();
   var session = GracePasswordsOwner.stableSession(activity);
   if (session == null || !session.accountId().equals(accountId)) throw new IllegalStateException("Grace account changed");
   var owner = new Owner(session, generation);
   owner.requireCurrent(activity);
   return owner;
  }

  void requireCurrent(Activity activity) throws Exception {
   if (activity.isFinishing() || activity.isDestroyed() || !session.equals(GracePasswordsOwner.stableSession(activity))
       || generation != GracePasswordsOwner.generation()) throw new IllegalStateException("Grace account changed");
  }
 }

 private record Pending(Owner owner, GraceGoogleConsent.Request request, PluginCall call, Activity activity) {}

 private GraceGoogleConnection() {}

 static void connect(PluginCall call, Activity activity) {
  REQUESTS.execute(() -> {
   if (pending != null) { call.reject("Google connection is in progress"); return; }
   try {
    var input = call.getData();
    if (input.length() != 6) throw new IllegalArgumentException("Invalid Google permissions");
    var capabilities = new GraceGoogleConsent.Capabilities(
      choice(input, "mail"), choice(input, "calendar"), choice(input, "sendMail"), choice(input, "trashMail"), choice(input, "writeCalendar"));
    var owner = Owner.capture(activity, accountId(input));
    var request = new GraceGoogleConsent.Request(email(owner), serverClientId(), capabilities);
    owner.requireCurrent(activity);
    var consent = new Pending(owner, request, call, activity);
    pending = consent;
    GraceGoogleConsent.start(activity, request, new CancellationSignal(), result -> REQUESTS.execute(() -> finish(consent, result)));
   } catch (Exception unavailable) {
    pending = null;
    call.reject("Couldn’t connect Google");
   }
  });
 }

 static void disconnect(PluginCall call, Activity activity) {
  REQUESTS.execute(() -> {
   if (pending != null) { call.reject("Google connection is in progress"); return; }
   try {
    var input = call.getData();
    if (input.length() != 1) throw new IllegalArgumentException("Invalid Grace account");
    var owner = Owner.capture(activity, accountId(input));
    var answer = GraceOwnerRead.post(GraceOwnerRead.Endpoint.DISCONNECT_GOOGLE, null, owner.session());
    owner.requireCurrent(activity);
    if (answer.status() != 200 || !Boolean.TRUE.equals(new JSONObject(answer.body()).opt("disconnected")))
     throw new IllegalStateException("Google disconnect was not confirmed");
    call.resolve();
   } catch (Exception unavailable) {
    call.reject("Couldn’t disconnect Google");
   }
  });
 }

 private static void finish(Pending consent, GraceGoogleConsent.Result result) {
  if (pending != consent) return;
  pending = null;
  try {
   consent.owner().requireCurrent(consent.activity());
   if (result instanceof GraceGoogleConsent.Canceled) {
    consent.call().resolve(new JSObject().put("kind", "cancelled"));
    return;
   }
   if (!(result instanceof GraceGoogleConsent.Code code)) throw new IllegalStateException("Google consent unavailable");
   var choices = consent.request().capabilities();
   var payload = new JSONObject().put("serverAuthCode", code.value()).put("mail", choices.mail()).put("calendar", choices.calendar())
     .put("sendMail", choices.sendMail()).put("trashMail", choices.trashMail()).put("writeCalendar", choices.writeCalendar());
   var answer = GraceOwnerRead.post(GraceOwnerRead.Endpoint.CONNECT_GOOGLE, payload, consent.owner().session());
   consent.owner().requireCurrent(consent.activity());
   if (answer.status() != 200) throw new IllegalStateException("Google connection was not confirmed");
   var status = new JSONObject(answer.body());
   if (!consent.owner().session().accountId().equals(status.getString("accountId"))
       || !Boolean.TRUE.equals(status.opt("configured")) || !Boolean.TRUE.equals(status.opt("connected"))
       || status.getString("connectionId").trim().isEmpty()
       || !consent.request().verifiedEmail().equalsIgnoreCase(status.getJSONObject("identity").getString("email")))
    throw new IllegalStateException("Google connection was not confirmed");
   consent.call().resolve(new JSObject().put("kind", "connected"));
  } catch (Exception unavailable) {
   consent.call().reject("Couldn’t connect Google");
  }
 }

 private static String accountId(JSONObject input) {
  if (!(input.opt("accountId") instanceof String accountId) || accountId.trim().isEmpty())
   throw new IllegalArgumentException("Invalid Grace account");
  return accountId;
 }

 private static boolean choice(JSONObject input, String name) {
  if (!(input.opt(name) instanceof Boolean selected)) throw new IllegalArgumentException("Invalid Google permission");
  return selected;
 }

 private static String email(Owner owner) throws Exception {
  var response = GraceOwnerRead.read(GraceOwnerRead.Endpoint.PROFILE, "", owner.session());
  var profile = response.getJSONObject("data");
  if (!Boolean.TRUE.equals(response.opt("success")) || !owner.session().accountId().equals(profile.getString("id"))
      || !owner.session().organizationId().equals(profile.getString("organization_id")))
   throw new IllegalStateException("Grace account changed");
  return profile.getString("email");
 }

 private static String serverClientId() throws Exception {
  var google = GraceOwnerRead.mobileConfiguration().getJSONObject("google");
  if (!Boolean.TRUE.equals(google.opt("nativeSignIn"))) throw new IllegalStateException("Google consent unavailable");
  return google.getString("serverClientId");
 }
}
