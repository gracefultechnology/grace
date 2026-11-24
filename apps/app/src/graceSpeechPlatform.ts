// spec/app/conversation.md, "Story: Talk or type without losing the conversation"
import { Capacitor, registerPlugin } from "@capacitor/core";
import { webView } from "./surfacePlugin.ts";

export interface WakePort {
  status(): Promise<unknown>;
  requestPermission(): Promise<unknown>;
  configure(input: { generation: number | null }): Promise<void>;
  chime(): Promise<void>;
  addListener(event: "wakeDetected" | "wakeStatus", callback: (value: unknown) => void): Promise<{ remove(): Promise<void> }>;
}

export const wakePlugin = Capacitor.isPluginAvailable("GraceWake")
  ? registerPlugin<WakePort>("GraceWake") : undefined;

const utf8 = new TextDecoder();

const micWorkletSource = `
class GraceMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(1024);
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i += 1) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      this.buffer[this.offset++] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      if (this.offset === this.buffer.length) {
        const out = this.buffer;
        this.buffer = new Int16Array(1024);
        this.offset = 0;
        this.port.postMessage(out.buffer, [out.buffer]);
      }
    }
    return true;
  }
}
registerProcessor("grace-mic-processor", GraceMicProcessor);
`;

export type Microphone = {
  attach: (send: (pcm: ArrayBuffer) => void) => void;
  close: () => Promise<void>;
};

async function createWorkletTap(audio: AudioContext): Promise<AudioWorkletNode | undefined> {
  if (!audio.audioWorklet || typeof webView.window.AudioWorkletNode !== "function" ||
      typeof webView.window.Blob !== "function" || typeof webView.window.URL?.createObjectURL !== "function") {
    return undefined;
  }
  const url = webView.window.URL.createObjectURL(new webView.window.Blob([micWorkletSource], { type: "application/javascript" }));
  try {
    await audio.audioWorklet.addModule(url);
    return new webView.window.AudioWorkletNode(audio, "grace-mic-processor", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
  } catch {
    return undefined;
  } finally {
    webView.window.URL.revokeObjectURL(url);
  }
}

export async function openMicrophone(signal: AbortSignal): Promise<Microphone> {
  const audio = new webView.window.AudioContext({ sampleRate: 16_000 });
  if (audio.sampleRate !== 16_000) {
    await audio.close();
    throw new Error("Unsupported microphone sample rate");
  }
  let media: MediaStream;
  try {
    await audio.resume();
    media = await webView.window.navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (signal.aborted) {
      for (const track of media.getTracks()) track.stop();
      throw new Error("Microphone request canceled");
    }
  } catch (failure) {
    await audio.close();
    throw failure;
  }
  const input = audio.createMediaStreamSource(media);
  const worklet = await createWorkletTap(audio);
  const script = worklet ? undefined : audio.createScriptProcessor(1024, 1, 1);
  const tap: AudioNode = worklet ?? script ?? audio.createGain();
  const silence = audio.createGain();
  silence.gain.value = 0;
  let attached = false;
  let closed = false;
  return {
    attach(send) {
      if (closed || attached) return;
      attached = true;
      if (worklet) {
        worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (event.data instanceof ArrayBuffer) send(event.data);
        };
      } else if (script) {
        script.onaudioprocess = (event) => {
          const samples = event.inputBuffer.getChannelData(0);
          const pcm = new ArrayBuffer(samples.length * 2);
          const data = new DataView(pcm);
          for (let index = 0; index < samples.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, samples[index]));
            data.setInt16(index * 2, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
          }
          for (let offset = 0; offset < pcm.byteLength; offset += 3200) {
            send(pcm.slice(offset, Math.min(offset + 3200, pcm.byteLength)));
          }
        };
      }
      input.connect(tap);
      tap.connect(silence);
      silence.connect(audio.destination);
    },
    async close() {
      if (closed) return;
      closed = true;
      if (worklet) {
        worklet.port.onmessage = null;
        worklet.port.close();
      } else if (script) {
        script.onaudioprocess = null;
      }
      input.disconnect();
      tap.disconnect();
      silence.disconnect();
      for (const track of media.getTracks()) track.stop();
      await audio.close();
    },
  };
}

export function gracePlayback() {
  const audio = new webView.window.AudioContext();
  const level = audio.createGain();
  level.connect(audio.destination);
  const sources = new Set<AudioBufferSourceNode>();
  let tail = 0;
  let finished: (() => void) | undefined;

  const cancel = () => {
    finished = undefined;
    for (const source of sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    sources.clear();
    tail = 0;
  };

  return {
    volume(value: number) { level.gain.value = value; },
    play(pcm: Uint8Array, volume: number, speed: number) {
      if (pcm.byteLength < 2 || pcm.byteLength % 2 !== 0) return;
      const buffer = audio.createBuffer(1, pcm.byteLength / 2, 16_000);
      const samples = buffer.getChannelData(0);
      const data = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      for (let index = 0; index < samples.length; index += 1) samples[index] = data.getInt16(index * 2, true) / 32768;
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(level);
      level.gain.value = volume;
      const start = Math.max(audio.currentTime, tail);
      tail = start + buffer.duration / speed;
      sources.add(source);
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
        if (sources.size === 0 && finished) {
          const complete = finished;
          finished = undefined;
          complete();
        }
      };
      source.start(start);
    },
    whenDrained(complete: () => void) {
      if (sources.size === 0) complete();
      else finished = complete;
    },
    paused(value: boolean) {
      return value ? audio.suspend() : audio.resume();
    },
    cancel,
    async close() {
      cancel();
      level.disconnect();
      await audio.close();
    },
  };
}

export function openSpeechSocket(url: string) {
  const socket = new webView.window.WebSocket(url);
  socket.binaryType = "arraybuffer";
  return socket;
}

export function speechFrame(value: ArrayBuffer) {
  const frame = new Uint8Array(value);
  const length = frame[1] ?? 0;
  if (frame[0] !== 1 || frame.length > 65_602 || length < 1 || length > 64 || frame.length <= length + 2 ||
      (frame.length - length - 2) % 2 !== 0) return null;
  const context = utf8.decode(frame.subarray(2, length + 2));
  return /^[A-Za-z0-9_-]{1,64}$/.test(context) ? { context, pcm: frame.subarray(length + 2) } : null;
}

export function releaseSpeechSocket(socket: WebSocket, signal: AbortSignal): Promise<void> {
  if (socket.readyState !== 1) {
    if (socket.readyState < 2) socket.close();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      socket.removeEventListener("close", finish);
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      if (socket.readyState < 2) socket.close(1000, "Speech ended");
      finish();
    };
    socket.addEventListener("close", finish, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else {
      try {
        socket.send(JSON.stringify({ t: "stop" }));
      } catch {
        abort();
      }
    }
  });
}
