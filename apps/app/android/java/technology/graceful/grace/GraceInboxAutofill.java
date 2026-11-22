package technology.graceful.grace;

import ai.eliza.plugins.passwords.InboxAutofill;
import ai.eliza.plugins.securestore.nativeonly.CloudDeviceAccount;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import android.content.Context;
import android.net.Uri;
import android.os.CancellationSignal;
import android.util.Base64;
import android.view.autofill.AutofillValue;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import org.json.JSONObject;

final class GraceInboxAutofill {
  private static final String SITE = "https://westvaleelectric.com";
  private static final String API = "https://api.graceforseniors.com";
  private static final String PATH = "/api/product/email/westvale/";
  private enum Operation {
    ENROLL("enroll"),
    OFFER("offer"),
    FILL("fill");
    final String path;
    Operation(String path) {
      this.path = path;
    }
  }
  private static final ExecutorService IO = Executors.newSingleThreadExecutor();
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final int ENCODING = Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING;
  private static final OkHttpClient HTTP = new OkHttpClient.Builder()
                                               .cookieJar(CookieJar.NO_COOKIES)
                                               .followRedirects(false)
                                               .followSslRedirects(false)
                                               .retryOnConnectionFailure(false)
                                               .connectTimeout(8, TimeUnit.SECONDS)
                                               .callTimeout(12, TimeUnit.SECONDS)
                                               .build();
  private static final MediaType JSON = MediaType.get("application/json");
  private GraceInboxAutofill() {}

  static boolean enabled() {
    return "standalone-production".equals(BuildConfig.CLOUD_PROFILE)
        && API.equals(BuildConfig.CLOUD_API_ORIGIN);
  }
  private static final class Authority {
    final CloudDeviceAccount.Session owner;
    final long generation;
    final String proof;
    Authority(CloudDeviceAccount.Session owner, long generation, String proof) {
      this.owner = owner;
      this.generation = generation;
      this.proof = proof;
    }
    boolean current() {
      return !GracePasswordsOwner.accountChanging() && generation == GracePasswordsOwner.generation();
    }
    boolean matches(Context context) throws Exception {
      return current() && owner.equals(GracePasswordsOwner.stableSession(context)) && current();
    }
  }
  private static String hash(String value) throws Exception {
    return Base64.encodeToString(
        MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)), ENCODING);
  }
  private static synchronized Authority authority(Context context, boolean enroll) throws Exception {
    if (!enabled())
      return null;
    long generation = GracePasswordsOwner.generation();
    CloudDeviceAccount.Session owner = GracePasswordsOwner.stableSession(context);
    if (owner == null || GracePasswordsOwner.accountChanging()
        || generation != GracePasswordsOwner.generation())
      return null;
    String session = hash(BuildConfig.CLOUD_PROFILE + "\0" + owner.organizationId() + "\0" + owner.accountId()
        + "\0" + owner.token());
    var store = new JsonCredentialSlots(new File(context.getNoBackupFilesDir(), "inbox-autofill"),
        "technology.graceful.grace.inbox-autofill.v1", slot -> "device".equals(slot) ? 768 : 0);
    String saved = store.read("device");
    if (saved != null) {
      var previous = new JSONObject(saved);
      if (session.equals(previous.optString("session"))
          && previous.optString("proof").matches("[0-9A-Za-z_-]{43}"))
        return new Authority(owner, generation, previous.getString("proof"));
    }
    if (!enroll)
      return null;
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    String proof = Base64.encodeToString(bytes, ENCODING);
    store.write("device", new JSONObject().put("session", session).put("proof", proof).toString());
    return new Authority(owner, generation, proof);
  }
  static Uri hostedEmail(Context context, String view, Uri destination) {
    if (!"email".equals(view) || !enabled()
        || !BuildConfig.CLOUD_WEB_ORIGIN.equals(
            destination.getScheme() + "://" + destination.getEncodedAuthority())
        || !"/".equals(destination.getEncodedPath()) || !"email".equals(destination.getEncodedFragment()))
      return destination;
    try {
      Authority authority = authority(context, true);
      if (authority == null)
        return destination;
      JSONObject response =
          post(context, authority, Operation.ENROLL, new JSONObject(), new CancellationSignal());
      String request = response.getString("request");
      if (!(response.get("approved") instanceof Boolean) || !hash(authority.proof).equals(request)
          || !authority.matches(context))
        return destination;
      return destination.buildUpon().appendQueryParameter("emailDevice", request).build();
    } catch (Exception unavailable) {
      return destination;
    }
  }
  static void offer(Context context, String origin, String challenge, CancellationSignal cancel,
      Consumer<InboxAutofill.Offer> completed) {
    if (!SITE.equals(origin) || challenge == null || !challenge.matches("[0-9a-f]{32}") || cancel.isCanceled()
        || !enabled()) {
      completed.accept(null);
      return;
    }
    IO.execute(() -> {
      InboxAutofill.Offer result = null;
      try {
        Authority authority = authority(context, false);
        if (authority != null) {
          JSONObject response =
              post(context, authority, Operation.OFFER, new JSONObject().put("challenge", challenge), cancel);
          Object available = response.get("available"), message = response.opt("message");
          if (Boolean.TRUE.equals(available) && message instanceof String handle && handle.matches("[0-9a-f]{64}")
              && authority.matches(context)) {
            result = new InboxAutofill.Offer() {
              public boolean current() {
                return authority.current();
              }
              public void redeem(CancellationSignal selected, Consumer<AutofillValue> done) {
                IO.execute(() -> {
                  AutofillValue value = null;
                  try {
                    JSONObject item = post(context, authority, Operation.FILL,
                        new JSONObject().put("challenge", challenge).put("message", handle), selected);
                    if (item.get("code") instanceof String code && code.matches("[0-9]{6}")
                        && !selected.isCanceled() && authority.matches(context))
                      value = AutofillValue.forText(code);
                  } catch (Exception unavailable) {
                    value = null;
                  }
                  done.accept(value);
                });
              }
            };
          }
        }
      } catch (Exception unavailable) {
        result = null;
      }
      completed.accept(cancel.isCanceled() ? null : result);
    });
  }
  private static JSONObject post(Context context, Authority authority, Operation operation, JSONObject body,
      CancellationSignal cancel) throws Exception {
    cancel.throwIfCanceled();
    if (!enabled() || !authority.matches(context))
      throw new IllegalStateException();
    Request request = new Request.Builder()
                          .url(BuildConfig.CLOUD_API_ORIGIN + PATH + operation.path)
                          .header("Authorization", "Bearer " + authority.owner.token())
                          .header("Cache-Control", "no-store")
                          .header("Accept", "application/json")
                          .post(RequestBody.create(body.put("proof", authority.proof).toString(), JSON))
                          .build();
    var call = HTTP.newCall(request);
    cancel.setOnCancelListener(call::cancel);
    try (var response = call.execute()) {
      cancel.throwIfCanceled();
      if (response.code() != 200 || response.body() == null)
        throw new IllegalStateException();
      try (var input = response.body().byteStream(); var bytes = new ByteArrayOutputStream()) {
        byte[] part = new byte[1024];
        for (int count; (count = input.read(part)) != -1;) {
          cancel.throwIfCanceled();
          if (bytes.size() + count > 4096)
            throw new IllegalStateException();
          bytes.write(part, 0, count);
        }
        if (!authority.matches(context))
          throw new IllegalStateException();
        return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
      }
    } finally {
      cancel.setOnCancelListener(null);
    }
  }
}
