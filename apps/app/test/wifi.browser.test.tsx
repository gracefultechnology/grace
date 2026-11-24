// spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed"
import type { JoinableWiFiSecurity, WiFiNetwork, WiFiPlugin } from "@elizaos/os/bridges/definitions/wifi";
import { Deferred, Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine } from "../gen/app__network.effect.vibe";
import { WifiNetworks } from "../src/Wifi.tsx";
import type { GraceWifi } from "../src/preferencesPlugin.ts";
import { wifiPage } from "../src/wifi.vibe";
import "../src/main.css";
import { actOnScreen } from "./screen.tsx";

const nearby = (ssid: string, rssi: number, security: NonNullable<WiFiNetwork["security"]>, bssid = "02:11:22:33:44:55"): WiFiNetwork =>
  ({ ssid, bssid, rssi, frequency: 2412, capabilities: "", secured: security !== "open" && security !== "owe", security });

const guest = nearby("WeWorkGuest", -66, "open");

function android() {
  const tablet = {
    location: "granted" as "granted" | "denied", radio: true, ssid: null as string | null,
    joins: [] as { ssid: string; security: JoinableWiFiSecurity; password?: string }[],
    panels: 0, signIns: 0, turnOns: 0, delayed: false, captiveOnJoin: false, captivePortal: false, otherDefault: false, validated: true,
    visible: true, hideAccess: false, scan: undefined as WiFiNetwork[] | undefined, currentPoint: undefined as WiFiNetwork | undefined,
    holdScan: undefined as (() => Promise<void>) | undefined,
  };
  const plugin: WiFiPlugin = {
    checkPermissions: () => Promise.resolve({ location: tablet.location }),
    requestPermissions: () => { tablet.location = "granted"; return Promise.resolve({ location: "granted" }); },
    getCapabilities: () => Promise.resolve({ sdk: 34, approvedJoin: true, internetPanel: true }),
    openInternetPanel: () => { tablet.panels += 1; return Promise.resolve(); },
    getWifiState: () => Promise.resolve({ enabled: tablet.radio, connected: tablet.ssid !== null, rssi: null }),
    getConnectedNetwork: () => Promise.resolve({
      network: tablet.ssid === null ? null : tablet.currentPoint ?? (tablet.ssid === guest.ssid ? guest : nearby(tablet.ssid, -50, tablet.ssid === "Riverside Library Guest" ? "open" : "wpa2")),
    }),
    listAvailableNetworks: async (options) => {
      if (tablet.location !== "granted") throw Object.assign(new Error("location"), { code: "LOCATION_PERMISSION_REQUIRED" });
      const hold = tablet.holdScan;
      tablet.holdScan = undefined;
      if (hold) await hold();
      const found = tablet.visible ? tablet.scan ?? [nearby("NETGEAR-4F2", -54, "wpa2"), nearby("NETGEAR-4F2", -50, "wpa2"), nearby("Riverside Library Guest", -60, "open"), nearby("Sunrise Community Center", -70, "eap"), guest] : [];
      return { networks: options?.joinable ? found.filter((network) => network.security !== "eap" && network.security !== "wep") : found };
    },
    connectToNetwork: () => Promise.resolve({ success: false }),
    disconnectFromNetwork: () => Promise.resolve({ success: true }),
    getConnectivity: () => Promise.resolve(tablet.otherDefault ? { online: true, validated: true, captivePortal: false, ssid: null } : {
      online: tablet.ssid !== null, validated: tablet.ssid !== null && tablet.validated && !tablet.captivePortal,
      captivePortal: tablet.captivePortal, ssid: tablet.location === "granted" ? tablet.ssid : null,
    }),
    addNetworkWithApproval: () => Promise.reject(new Error("Grace joins networks herself")),
  };
  const device: GraceWifi = {
    getWifiSignIn: async () => {
      const validated = tablet.ssid !== null && tablet.validated && !tablet.captivePortal;
      const { network } = await plugin.getConnectedNetwork();
      return {
        required: tablet.captivePortal,
        validated,
        access: validated && !tablet.hideAccess && tablet.location === "granted" && network !== null ? [network] : [],
      };
    },
    turnOnWifi: () => { tablet.turnOns += 1; tablet.radio = true; return Promise.resolve(); },
    joinWifi: (options) => {
      tablet.joins.push(options);
      if (options.password !== undefined && options.password.length < 8) return Promise.reject(Object.assign(new Error("short"), { code: "INVALID_ARGUMENT" }));
      if (options.password === "wrongpass") return Promise.resolve({ status: "wrongPassword" });
      if (tablet.delayed) return Promise.resolve({ status: "notConnected" });
      tablet.ssid = options.ssid;
      tablet.captivePortal = tablet.captiveOnJoin;
      return Promise.resolve({ status: tablet.captivePortal ? "captivePortal" : "connected" });
    },
  };
  return { tablet, plugin, device };
}

describe('Wi-Fi (spec/app/network.md, "Story: Join the network I choose")', () => {
  // spec/app/network.md, "Story: See why no networks are listed"
  actOnScreen();
  it("joins open, password and sign-in networks", async () => {
    const { tablet, plugin, device } = android();
    const runtime = ManagedRuntime.make(wifiPage(plugin, device));
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    onTestFinished(async () => {
      await act(() => Promise.resolve(root.unmount()));
      await runtime.dispose();
      host.remove();
    });
    const state = () => runtime.runPromise(Effect.flatMap(Effect.service(Machine), (m) => m.get()));
    const draw = (online: boolean) => act(() => Promise.resolve(root.render(<WifiNetworks runtime={runtime} online={online} onFix={() => { fixes += 1; }} onSignIn={() => { tablet.signIns += 1; }} />)));
    const joinedTo = async (name: string) => {
      await expect.element(page.getByRole("button", { name, exact: true })).not.toBeInTheDocument();
      await expect.element(page.getByRole("region", { name: "Wi-Fi" }).getByText(name, { exact: true })).toBeVisible();
    };
    const button = (name: string | RegExp) => page.getByRole("button", { name });
    const tap = (name: string) => act(() => userEvent.click(page.getByRole("button", { name })));
    const changed = () => act(() => Promise.resolve(window.dispatchEvent(new Event("android-network-changed"))));
    const shown = () => act(() => Promise.resolve(document.dispatchEvent(new Event("visibilitychange"))));
    const signInLabel = "Sign in to this network";
    const signIn = button(signInLabel);
    let fixes = 0;
    tablet.ssid = guest.ssid;
    tablet.captivePortal = true;
    tablet.otherDefault = true;
    await draw(true);
    await expect.element(signIn).toBeVisible();
    expect(tablet.signIns).toBe(0);
    await tap(signInLabel);
    await expect.poll(() => tablet.signIns).toBe(1);
    expect(tablet.panels).toBe(0);
    tablet.ssid = null;
    tablet.captivePortal = false;
    tablet.otherDefault = false;
    await draw(false);
    await shown();
    await expect.element(signIn).not.toBeInTheDocument();

    await tap("Fix Wi-Fi");
    expect(fixes).toBe(1);
    await draw(true);
    await expect.element(button("Fix Wi-Fi")).not.toBeInTheDocument();
    await joinedTo("Internet connection");

    await expect.element(page.getByRole("button", { name: "Riverside Library Guest" })).toBeVisible();
    await expect.element(button("Sunrise Community Center")).not.toBeInTheDocument();

    await tap("Riverside Library Guest");
    await expect.element(button("Riverside Library Guest")).not.toBeInTheDocument();
    await joinedTo("Riverside Library Guest");

    await tap("NETGEAR-4F2");
    await act(() => userEvent.type(page.getByLabelText("Password"), "abandoned"));
    await tap("Cancel");
    await expect.element(button("NETGEAR-4F2")).toBeVisible();
    await tap("NETGEAR-4F2");
    await expect.element(page.getByLabelText("Password")).toHaveValue("");
    for (const typed of ["abc", "wrongpass"]) {
      await act(() => userEvent.type(page.getByLabelText("Password"), typed));
      await tap("Join");
      await expect.element(page.getByRole("alert")).toBeVisible();
    }
    tablet.delayed = true;
    await act(() => userEvent.type(page.getByLabelText("Password"), "garden2024{Enter}"));
    await expect.element(page.getByLabelText("Password")).not.toBeInTheDocument();
    await expect.element(button("Try again")).toBeVisible();
    tablet.visible = false;
    await changed();
    await expect.element(page.getByRole("button", { name: "Look again" })).toBeVisible();
    tablet.visible = true;
    tablet.ssid = "Sunrise Community Center";
    await changed();
    await joinedTo("Sunrise Community Center");
    await expect.element(button("Try again")).toBeVisible();
    tablet.ssid = "NETGEAR-4F2";
    tablet.validated = false;
    await changed();
    await joinedTo("Internet connection");
    await expect.element(button("Try again")).toBeVisible();
    tablet.validated = true;
    tablet.visible = false;
    tablet.currentPoint = nearby("NETGEAR-4F2", -40, "open", "02:11:22:33:44:99");
    await changed();
    await expect.element(button("Look again")).toBeVisible();
    await expect.element(page.getByRole("alert")).toBeVisible();
    tablet.currentPoint = nearby("NETGEAR-4F2", -40, "wpa2", "02:00:00:00:00:00");
    tablet.scan = [tablet.currentPoint];
    tablet.visible = true;
    await changed();
    await expect.element(button("Look again")).not.toBeInTheDocument();
    tablet.visible = false;
    await changed();
    await expect.element(button("Look again")).toBeVisible();
    await expect.element(page.getByRole("alert")).toBeVisible();
    tablet.scan = undefined;
    tablet.currentPoint = undefined;
    await changed();
    await expect.element(button("Try again")).not.toBeInTheDocument();
    await joinedTo("NETGEAR-4F2");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    expect(tablet.joins).toEqual([
      { ssid: "Riverside Library Guest", security: "open" },
      { ssid: "NETGEAR-4F2", security: "wpa2", password: "abc" },
      { ssid: "NETGEAR-4F2", security: "wpa2", password: "wrongpass" },
      { ssid: "NETGEAR-4F2", security: "wpa2", password: "garden2024" },
    ]);
    expect(JSON.stringify(await state())).not.toContain("garden2024");
    tablet.visible = true;
    tablet.ssid = "Riverside Library Guest";
    await changed();
    await joinedTo("Riverside Library Guest");
    expect(tablet.joins).toHaveLength(4);

    await tap("NETGEAR-4F2");
    await act(() => userEvent.type(page.getByLabelText("Password"), "unfinished"));
    tablet.location = "denied";
    tablet.ssid = "NETGEAR-4F2";
    await changed();
    await expect.element(page.getByLabelText("Password")).not.toBeInTheDocument();
    await joinedTo("Internet connection");
    await tap("Open Android’s Wi-Fi");
    await expect.poll(() => tablet.panels).toBe(1);
    tablet.location = "granted";
    tablet.ssid = null;
    await shown();

    tablet.radio = false;
    await changed();
    await expect.element(button("NETGEAR-4F2")).not.toBeInTheDocument();
    await tap("Turn on");
    expect(tablet.turnOns).toBe(1);
    await tap("NETGEAR-4F2");
    await expect.element(page.getByLabelText("Password")).toHaveValue("");
    expect(tablet.joins).toHaveLength(4);

    tablet.delayed = true;
    await act(() => userEvent.type(page.getByLabelText("Password"), "garden2024{Enter}"));
    await expect.element(button("Try again")).toBeVisible();
    tablet.ssid = "NETGEAR-4F2";
    tablet.validated = false;
    await changed();
    await joinedTo("Internet connection");
    await expect.element(button("Try again")).toBeVisible();
    tablet.validated = true;
    const legacyObservation = vi.spyOn(device, "getWifiSignIn").mockResolvedValue({ required: false, validated: true });
    await changed();
    await joinedTo("NETGEAR-4F2");
    await expect.element(button("Try again")).not.toBeInTheDocument();
    legacyObservation.mockRestore();
    expect(tablet.joins).toHaveLength(5);

    tablet.delayed = false;
    tablet.captiveOnJoin = true;
    await draw(false);
    await tap(guest.ssid);
    await expect.element(signIn).toBeVisible();
    expect(tablet.signIns).toBe(1);
    await tap(signInLabel);
    await expect.poll(() => tablet.signIns).toBe(2);
    await shown();
    await expect.element(signIn).toBeVisible();

    tablet.captivePortal = false;
    tablet.validated = false;
    tablet.visible = false;
    await changed();
    await expect.element(button("Look again")).toBeVisible();
    await expect.element(signIn).toBeVisible();
    await expect.element(page.getByText("Connected", { exact: true })).not.toBeInTheDocument();

    tablet.visible = true;
    tablet.ssid = "Sunrise Community Center";
    tablet.validated = true;
    await draw(true);
    await changed();
    await joinedTo("Sunrise Community Center");
    await expect.element(button(/WeWorkGuest.*Connecting/)).toBeVisible();
    await expect.element(signIn).not.toBeInTheDocument();

    const scanStarted = await Effect.runPromise(Deferred.make<void>());
    const releaseScan = await Effect.runPromise(Deferred.make<void>());
    const finishScan = async () => { await Effect.runPromise(Deferred.succeed(releaseScan, undefined)); };
    onTestFinished(finishScan);
    tablet.holdScan = async () => {
      await Effect.runPromise(Deferred.succeed(scanStarted, undefined));
      await Effect.runPromise(Deferred.await(releaseScan));
    };
    tablet.ssid = guest.ssid;
    tablet.otherDefault = true;
    await changed();
    await Effect.runPromise(Deferred.await(scanStarted));
    tablet.ssid = "NETGEAR-4F2";
    await act(finishScan);
    await joinedTo("NETGEAR-4F2");
    await expect.element(button(/WeWorkGuest.*Connecting/)).toBeVisible();

    tablet.ssid = guest.ssid;
    tablet.otherDefault = false;
    tablet.hideAccess = true;
    await changed();
    await joinedTo("Internet connection");
    await expect.element(button(/WeWorkGuest.*Connecting/)).toBeVisible();

    const previousScan = tablet.scan;
    const pendingAfterRefresh = async (observedNetwork: string) => {
      tablet.scan = [guest, nearby(observedNetwork, -65, "open")];
      await changed();
      await expect.element(button(observedNetwork)).toBeVisible();
      await expect.element(button(/WeWorkGuest.*Connecting/)).toBeVisible();
    };
    const observation = vi.spyOn(device, "getWifiSignIn");
    observation.mockRejectedValue(new Error("Android Wi-Fi status unavailable"));
    await pendingAfterRefresh("Library Guest");
    observation.mockResolvedValue({ required: false, validated: true, access: null });
    await pendingAfterRefresh("Community Guest");
    observation.mockRestore();
    tablet.scan = previousScan;

    tablet.otherDefault = true;
    tablet.hideAccess = false;
    await changed();
    await joinedTo(guest.ssid);
    await expect.element(signIn).not.toBeInTheDocument();

    tablet.ssid = null;
    tablet.otherDefault = false;
    await draw(false);
    await changed();
    await expect.element(page.getByRole("button", { name: guest.ssid, exact: true })).toBeVisible();
    await expect.element(signIn).not.toBeInTheDocument();
    expect({ panels: tablet.panels, signIns: tablet.signIns, lastJoin: tablet.joins.at(-1) }).toEqual({
      panels: 1, signIns: 2, lastJoin: { ssid: guest.ssid, security: "open" },
    });
  });
});
