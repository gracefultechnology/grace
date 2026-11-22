// spec/app/setup.md, "A backup belongs to the signed-in owner and has its own approval"
package technology.graceful.grace;

import ai.eliza.plugins.signin.CodeSignIn;
import ai.eliza.plugins.signin.GoogleSignIn;
import ai.eliza.plugins.signin.SignInPolicy;
import ai.eliza.plugins.signin.SignInRegistration;

import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval;
import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval.Grant;
import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval.Owner;
import ai.eliza.plugins.securestore.nativeonly.PasswordBackupApproval.Purpose;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import org.json.JSONObject;

final class GraceLegacyPasswordBackup {
  private static final String BACKUP = "/api/v1/app-auth/mobile/password-backup";
  private static final String NATIVE_GOOGLE = "/steward/auth/oauth/google/native/";
  private static final String PROVIDERS = "/steward/auth/providers";
  private static final String LOGOUT = "/steward/auth/logout";

  interface Readiness {
    boolean advertisesV2(URI endpoint) throws IOException;
  }

  private final CodeSignIn.Http http;
  private final Readiness readiness;
  private final String appClientId;
  private final SignInRegistration.Environment environment;
  private final String tenantId;
  private final String googleClientId;
  private final URI endpoint;

  GraceLegacyPasswordBackup(SignInRegistration registration, SignInRegistration.Environment environment,
      String tenantId, String googleClientId) {
    this(CodeSignIn.CONNECTION, endpoint -> PasswordBackupApproval.advertisesNative(endpoint, "2"), registration, environment, tenantId, googleClientId);
  }

  GraceLegacyPasswordBackup(CodeSignIn.Http http, Readiness readiness, SignInRegistration registration, SignInRegistration.Environment environment,
      String tenantId, String googleClientId) {
    if (environment != registration.environment(environment.name)
        || !tenantId.matches("[A-Za-z0-9_-]{1,128}") || !googleClientId.matches("[A-Za-z0-9_-]{1,128}")) {
      throw new IllegalArgumentException("Invalid shared password backup registration");
    }
    this.http = http;
    this.readiness = readiness;
    this.appClientId = registration.clientId;
    this.environment = environment;
    this.tenantId = tenantId;
    this.googleClientId = googleClientId;
    this.endpoint = URI.create(environment.apiOrigin + BACKUP);
  }

  boolean available() {
    try {
      URI check = URI.create(endpoint + "/readiness?clientId=" + encode(appClientId));
      if (!readiness.advertisesV2(check)) return false;
      CodeSignIn.Answer discovery = http.send("GET", environment.apiOrigin + PROVIDERS
        + "?tenantId=" + encode(tenantId) + "&clientId=" + encode(googleClientId), null, null);
      JSONObject app = discovery.body().optJSONObject("nativeGoogleApp");
      return discovery.status() == 200 && app != null && googleClientId.equals(app.opt("clientId"))
        && Boolean.TRUE.equals(app.opt("ready"));
    } catch (IOException | RuntimeException unavailable) {
      return false;
    }
  }

  Attempt begin(Purpose purpose, Owner owner, BooleanSupplier active) throws IOException {
    Objects.requireNonNull(purpose);
    if (owner == null || !SignInPolicy.validUuid(owner.accountId()) || !SignInPolicy.validUuid(owner.organizationId())) {
      throw new IOException("A verified account is required");
    }
    requireActive(active);
    if (!available()) throw new IOException("Native password backup verification is unavailable");
    requireActive(active);
    String verifier = SignInPolicy.newVerifier();
    CodeSignIn.Answer reply = post(NATIVE_GOOGLE + "challenge", new JSONObject(Map.of(
      "tenantId", tenantId, "clientId", googleClientId, "codeChallenge", SignInPolicy.s256(verifier),
      "codeChallengeMethod", "S256")), null);
    JSONObject body = reply.body();
    String id = body.optString("challengeId", "");
    String nonce = body.optString("nonce", "");
    String audience = body.optString("serverClientId", "");
    long now = System.currentTimeMillis();
    long expires = SignInPolicy.instant(body.opt("expiresAt"));
    if (reply.status() != 200 || !Boolean.TRUE.equals(body.opt("ok")) || id.isEmpty() || id.length() > 256
        || !SignInPolicy.validNonce(nonce) || !SignInPolicy.validServerClientId(audience)
        || expires <= now || expires - now > SignInPolicy.MAX_CHALLENGE_LIFETIME_MS) {
      throw new IOException("Native password backup verification is unavailable");
    }
    requireActive(active);
    return new Attempt(new GoogleSignIn.Challenge(id, nonce, audience, expires, verifier), purpose, owner, active);
  }

  final class Attempt {
    private final GoogleSignIn.Challenge challenge;
    private final Purpose purpose;
    private final Owner owner;
    private final BooleanSupplier active;
    private boolean used;

    private Attempt(GoogleSignIn.Challenge challenge, Purpose purpose, Owner owner, BooleanSupplier active) {
      this.challenge = challenge;
      this.purpose = purpose;
      this.owner = owner;
      this.active = active;
    }

    GoogleSignIn.Challenge challenge() { return challenge; }

    PasswordBackupApproval approve(GoogleSignIn.Picked.Token picked, BooleanSupplier confirm) throws IOException {
      claim();
      if (picked == null || !SignInPolicy.validIdToken(picked.idToken())) throw new IOException("Native Google verification is required");
      requireCurrent();
      CodeSignIn.Answer reply = post(NATIVE_GOOGLE + "verify", new JSONObject(Map.of(
        "tenantId", tenantId, "clientId", googleClientId, "challengeId", challenge.challengeId(),
        "idToken", picked.idToken(), "codeVerifier", challenge.verifier())), null);
      if (reply.status() != 200) throw new IOException("Native Google verification was refused");
      JSONObject response = reply.body();
      JSONObject nested = response.optJSONObject("data");
      JSONObject session = nested != null && !response.has("token") ? nested : response;
      String token = session.optString("token", "");
      if (!SignInPolicy.validBearer(token) || token.startsWith("eliza_") || token.startsWith("pbackup_")) {
        throw new IOException("A fresh Steward session is required");
      }
      try {
        Object mfa = session.opt("mfaRequired");
        if (mfa != null && !Boolean.FALSE.equals(mfa)) throw new IOException("Native Google verification requires another factor");
        requireCurrent();
        if (!confirm.getAsBoolean()) throw new IOException("Password backup consent was declined");
        requireCurrent();
        return grant(token);
      } finally {
        revoke(token, session.optString("refreshToken", ""));
      }
    }

    private synchronized void claim() throws IOException {
      if (used) throw new IOException("Native password backup was already attempted");
      used = true;
    }

    private void requireCurrent() throws IOException {
      requireActive(active);
      if (System.currentTimeMillis() >= challenge.expiresAt()) throw new IOException("Native password backup verification expired");
    }

    private PasswordBackupApproval grant(String shortLivedSession) throws IOException {
      String state = SignInPolicy.newState();
      String verifier = SignInPolicy.newVerifier();
      CodeSignIn.Answer answer = post(BACKUP, new JSONObject(Map.of(
        "clientId", appClientId, "environment", environment.name, "redirectUri", environment.redirectUri,
        "purpose", purpose.value(), "state", state, "codeChallenge", SignInPolicy.s256(verifier),
        "codeChallengeMethod", "S256")), shortLivedSession);
      if (answer.status() != 200) throw new IOException("Password backup approval was refused");
      requireCurrent();
      JSONObject body = answer.body();
      if (!body.has("revision")) throw new IOException("Missing password backup revision");
      if (!(body.opt("code") instanceof String code) || !code.matches("pbackup_[A-Za-z0-9_-]{43}")) {
        throw new IOException("Invalid native password backup approval");
      }
      Grant grant = new Grant(purpose == Purpose.VERIFY ? null : code, body.optString("scope", null), body.optString("ownerId", null),
        body.opt("organizationId"), body.isNull("revision") ? null : body.opt("revision"), body.opt("present"));
      return PasswordBackupApproval.admit(endpoint, purpose, state, verifier, owner, grant, active);
    }
  }

  private void revoke(String token, String refreshToken) {
    try {
      JSONObject body = SignInPolicy.validBearer(refreshToken) ? new JSONObject(Map.of("refreshToken", refreshToken)) : new JSONObject();
      post(LOGOUT, body, token);
    } catch (IOException | RuntimeException unavailable) {
      return;
    }
  }

  private CodeSignIn.Answer post(String path, JSONObject body, String token) throws IOException {
    return http.post(environment.apiOrigin + path, body, token);
  }

  private static void requireActive(BooleanSupplier active) throws IOException {
    if (!active.getAsBoolean()) throw new IOException("Password backup account changed");
  }

  private static String encode(String value) throws IOException {
    return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
  }
}
