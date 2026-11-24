package technology.graceful.grace;

import android.annotation.SuppressLint;
import android.content.res.AssetManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import com.k2fsa.sherpa.onnx.FeatureConfig;
import com.k2fsa.sherpa.onnx.KeywordSpotter;
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import java.util.function.BooleanSupplier;

final class GraceWakeDetector implements AutoCloseable {
 private static final String ASSETS = "grace-wake/";
 private static final int RATE = 16_000;
 private static final int FRAMES = RATE / 20;
 private static final int MONO = AudioFormat.CHANNEL_IN_MONO;
 private static final int PCM16 = AudioFormat.ENCODING_PCM_16BIT;

 static final class Capture {
  final long generation;
  volatile boolean cancelled;

  Capture(long generation) { this.generation = generation; }
 }

 private final KeywordSpotter spotter;

 GraceWakeDetector(AssetManager assets) {
  var model = new OnlineModelConfig();
  model.getTransducer().setEncoder(ASSETS + "encoder.onnx");
  model.getTransducer().setDecoder(ASSETS + "decoder.onnx");
  model.getTransducer().setJoiner(ASSETS + "joiner.onnx");
  model.setTokens(ASSETS + "tokens.txt");
  model.setNumThreads(1);
  model.setProvider("cpu");
  model.setModelType("zipformer2");
  spotter = new KeywordSpotter(assets, new KeywordSpotterConfig(
   new FeatureConfig(RATE, 80, 0), model, 4, ASSETS + "keywords.txt", 1.5f, 0.25f, 4));
  var probe = spotter.createStream("");
  if (probe.getPtr() == 0L) {
   spotter.release();
   throw new IllegalStateException("Wake keyword configuration is unavailable");
  }
  probe.release();
 }

 @SuppressLint("MissingPermission")
 boolean listen(Capture capture, BooleanSupplier playback) {
  if (capture.cancelled) return false;
  var stream = spotter.createStream("");
  if (stream.getPtr() == 0L) throw new IllegalStateException("Wake stream unavailable");
  AudioRecord recorder = null;
  try {
   int minimum = AudioRecord.getMinBufferSize(RATE, MONO, PCM16);
   if (minimum <= 0) throw new IllegalStateException("Wake audio format unavailable");
   recorder = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, MONO, PCM16, Math.max(minimum, FRAMES * 4));
   if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("Wake microphone unavailable");
   if (capture.cancelled) return false;
   recorder.startRecording();
   if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("Wake microphone could not start");
   var pcm = new short[FRAMES];
   var waveform = new float[FRAMES];
   boolean interrupted = false;
   while (!capture.cancelled) {
    int count = recorder.read(pcm, 0, pcm.length);
    if (count < 0) throw new IllegalStateException("Wake microphone read failed: " + count);
    if (count == 0 || capture.cancelled) continue;
    if (playback.getAsBoolean()) {
     if (!interrupted) spotter.reset(stream);
     interrupted = true;
     continue;
    }
    interrupted = false;
    for (int i = 0; i < count; i++) waveform[i] = pcm[i] / 32768f;
    stream.acceptWaveform(count == FRAMES ? waveform : java.util.Arrays.copyOf(waveform, count), RATE);
    while (spotter.isReady(stream) && !capture.cancelled) {
     spotter.decode(stream);
     if ("HEY_GRACE".equals(spotter.getResult(stream).getKeyword())) return true;
    }
   }
   return false;
  } finally {
   try {
    if (recorder != null) {
     try {
      if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
     } finally {
      recorder.release();
     }
    }
   } finally {
    stream.release();
   }
  }
 }

 @Override public void close() { spotter.release(); }
}
