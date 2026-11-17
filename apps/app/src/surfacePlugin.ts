// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/shell.md, "Story: Reach everyday tasks from Home"
// The Capacitor bindings of the plugins MainActivity registers. Their types are the plugins' own
// (definitions.ts); none of their runtime code is bundled. Beside them, what the WebView itself knows of the network.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Effect } from "effect";
import type { ElizaSurfaceManagerPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/browser-surface.ts";
import type { WiFiPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/wifi.ts";

export type { ElizaSurfaceManagerPlugin as SurfacePlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/browser-surface.ts";
export type { WiFiPlugin } from "../../../vendor/eliza/packages/os/src/bridges/definitions/wifi.ts";

/** The plugin on Android; elsewhere (Vite in a browser) there is no native page under the interface. */
export const devicePlugin = Capacitor.isNativePlatform() ? registerPlugin<ElizaSurfaceManagerPlugin>("ElizaSurfaceManager") : undefined;

/** The Wi-Fi plugin, which only the launcher registers; elsewhere the WebView's own online state is all there is. */
export const wifiPlugin = Capacitor.isPluginAvailable("ElizaWiFi") ? registerPlugin<WiFiPlugin>("ElizaWiFi") : undefined;

/** This renderer's identity. Native refuses commands from an older epoch, so a reloaded renderer, whose
 * time origin is later, claims a newer one. */
export const identity = { owner: "grace-browser", session: crypto.randomUUID(), epoch: Math.floor(performance.timeOrigin * 1000) };

/** The WebView's own view of the network (app.vibe, connectivity): whether it has one, whether the interface is hidden, and
 * the targets of their change events. */
export const webView = { online: Effect.sync(() => navigator.onLine), hidden: () => document.hidden, window, document };
