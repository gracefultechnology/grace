// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/shell.md, "Story: Reach everyday tasks from Home"
// The Capacitor bindings of the plugins MainActivity registers. Their types are the plugins' own
// (definitions.ts); none of their runtime code is bundled. Beside them, what the WebView itself knows of the network.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Effect } from "effect";
import type { ElizaSurfaceManagerPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/browser-surface.ts";
import type { WiFiPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/wifi.ts";
import { createPasswordsClient } from "../../../vendor/eliza/packages/os/src/bridges/passwords-client.ts";
import type { ElizaPasswordsPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/passwords.ts";

export type { ElizaSurfaceManagerPlugin as SurfacePlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/browser-surface.ts";
export type { WiFiPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/wifi.ts";

/** The plugin on Android; elsewhere (Vite in a browser) there is no native page under the interface. */
export const devicePlugin = Capacitor.isNativePlatform() ? registerPlugin<ElizaSurfaceManagerPlugin>("ElizaSurfaceManager") : undefined;

export const passwordClient = Capacitor.isPluginAvailable("ElizaPasswords")
  ? createPasswordsClient(registerPlugin<ElizaPasswordsPlugin>("ElizaPasswords")) : undefined;

type PrivateViewPlugin = {
  protect(input: { view: "vault" | "browser"; active: boolean }): Promise<void>;
  openLockSettings(): Promise<void>;
  readHelp(): Promise<void>;
  stopHelp(): Promise<void>;
};

export const androidHost = Capacitor.isNativePlatform();
export const privateViewPlugin = androidHost ? registerPlugin<PrivateViewPlugin>("GracePrivateView") : undefined;

export type GuideSpeechResult =
  | { status: "complete"; text: string }
  | { status: "cancelled" | "unavailable" | "no-match" };

export type GuideSpeechPlugin = {
  listen(input: { id: string }): Promise<GuideSpeechResult>;
  cancel(input: { id: string }): Promise<void>;
};

export const guideSpeechPlugin = Capacitor.isPluginAvailable("GraceGuideSpeech")
  ? registerPlugin<GuideSpeechPlugin>("GraceGuideSpeech") : undefined;

/** The Wi-Fi plugin, which only the launcher registers; elsewhere the WebView's own online state is all there is. */
export const wifiPlugin = Capacitor.isPluginAvailable("ElizaWiFi") ? registerPlugin<WiFiPlugin>("ElizaWiFi") : undefined;

/** This renderer's identity. Native refuses commands from an older epoch, so a reloaded renderer, whose
 * time origin is later, claims a newer one. */
export const identity = { owner: "grace-browser", session: crypto.randomUUID(), epoch: Math.floor(performance.timeOrigin * 1000) };

/** The WebView's own view of the network (app.vibe, connectivity): whether it has one, whether the interface is hidden, and
 * the targets of their change events. */
export const webView = { online: Effect.sync(() => navigator.onLine), hidden: () => document.hidden, window, document };
