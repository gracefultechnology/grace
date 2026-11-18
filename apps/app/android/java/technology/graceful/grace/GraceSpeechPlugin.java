package technology.graceful.grace;

import ai.eliza.voice.SpeechStreamBridgePlugin;
import android.Manifest;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(name = "GraceSpeech", permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }))
public class GraceSpeechPlugin extends SpeechStreamBridgePlugin {
 private static final String ELIZA_CLOUD = "https://api.eliza.app";

 @Override protected String cloudOrigin(String environment) { return ELIZA_CLOUD; }

 @Override protected Credential readCredential(String environment, String expectedId, long epoch) { throw signedOut(); }

 @Override protected long authorityEpoch() { throw signedOut(); }

 private static IllegalStateException signedOut() { return new IllegalStateException("No Eliza Cloud account is signed in"); }
}
