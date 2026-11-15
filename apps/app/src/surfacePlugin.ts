// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/shell.md, "Story: Reach everyday tasks from Home"
// The Capacitor bindings of the plugins MainActivity registers. Their types are the plugins' own
// (definitions.ts); none of their runtime code is bundled.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ElizaSurfaceManagerPlugin } from "../../../vendor/eliza/plugins/plugin-native-browser-surface/src/definitions.ts";
import type { WiFiPlugin } from "../../../vendor/eliza/plugins/plugin-native-wifi/src/definitions.ts";

export type { ElizaSurfaceManagerPlugin as SurfacePlugin } from "../../../vendor/eliza/plugins/plugin-native-browser-surface/src/definitions.ts";
export type { WiFiPlugin } from "../../../vendor/eliza/plugins/plugin-native-wifi/src/definitions.ts";

/** The plugin on Android; elsewhere (Vite in a browser) there is no native page under the interface. */
export const devicePlugin = Capacitor.isNativePlatform() ? registerPlugin<ElizaSurfaceManagerPlugin>("ElizaSurfaceManager") : undefined;

/** The Wi-Fi plugin, which only the launcher registers; elsewhere the WebView's own online state is all there is. */
export const wifiPlugin = Capacitor.isPluginAvailable("ElizaWiFi") ? registerPlugin<WiFiPlugin>("ElizaWiFi") : undefined;

/** This renderer's identity. Native refuses commands from an older epoch, so a reloaded renderer, whose
 * time origin is later, claims a newer one. */
export const identity = { owner: "grace-browser", session: crypto.randomUUID(), epoch: Math.floor(performance.timeOrigin * 1000) };

/** Calls `changed` whenever the WebView goes online or offline, or the interface is shown again; returns how to stop. */
export function onNetworkChange(changed: () => void): () => void {
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  document.addEventListener("visibilitychange", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
    document.removeEventListener("visibilitychange", changed);
  };
}

/** Whether the WebView has a network at all. */
export const browserOnline = () => navigator.onLine;
