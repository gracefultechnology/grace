// spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed"
import type { ConnectOptions, WiFiNetwork, WiFiPlugin } from "@elizaos/os/bridges/definitions/wifi";
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine } from "../gen/app__network.effect.vibe";
import { WifiNetworks } from "../src/Wifi.tsx";
import { wifiPage } from "../src/wifi.vibe";
import "../src/main.css";
import { actOnScreen } from "./screen.tsx";

const nearby = (ssid: string, rssi: number, security: NonNullable<WiFiNetwork["security"]>, bssid = "02:11:22:33:44:55"): WiFiNetwork =>
  ({ ssid, bssid, rssi, frequency: 2412, capabilities: "", secured: security !== "open" && security !== "owe", security });

function android() {
  const tablet = { location: "prompt" as "prompt" | "granted" | "denied", ssid: null as string | null, joins: [] as ConnectOptions[], panels: 0, delayed: false, validated: true, visible: true, currentPoint: undefined as WiFiNetwork | undefined };
  const plugin: WiFiPlugin = {
    checkPermissions: () => Promise.resolve({ location: tablet.location }),
    requestPermissions: () => { tablet.location = "granted"; return Promise.resolve({ location: "granted" }); },
    getCapabilities: () => Promise.resolve({ sdk: 34, approvedJoin: true, internetPanel: true }),
    openInternetPanel: () => { tablet.panels += 1; return Promise.resolve(); },
    getWifiState: () => Promise.resolve({ enabled: true, connected: tablet.ssid !== null, rssi: null }),
    getConnectedNetwork: () => Promise.resolve({ network: tablet.ssid === null ? null : tablet.currentPoint ?? nearby(tablet.ssid, -50, tablet.ssid === "Riverside Library Guest" ? "open" : "wpa2") }),
    listAvailableNetworks: () => tablet.location === "granted"
      ? Promise.resolve({ networks: tablet.visible ? [nearby("NETGEAR-4F2", -54, "wpa2"), nearby("NETGEAR-4F2", -50, "wpa2"), nearby("Riverside Library Guest", -60, "open"), nearby("Sunrise Community Center", -70, "eap")] : [] })
      : Promise.reject(Object.assign(new Error("location"), { code: "LOCATION_PERMISSION_REQUIRED" })),
    connectToNetwork: () => Promise.resolve({ success: false }),
    disconnectFromNetwork: () => Promise.resolve({ success: true }),
    getConnectivity: () => Promise.resolve({ online: tablet.ssid !== null, validated: tablet.ssid !== null && tablet.validated, captivePortal: false, ssid: tablet.ssid }),
    addNetworkWithApproval: (options) => {
      tablet.joins.push(options);
      if (options.password !== undefined && options.password.length < 8) return Promise.reject(Object.assign(new Error("short"), { code: "INVALID_ARGUMENT" }));
      if (options.password === "wrongpass") return Promise.resolve({ status: "wrongPassword" });
      if (tablet.delayed) return Promise.resolve({ status: "notConnected" });
      tablet.ssid = options.ssid;
      return Promise.resolve({ status: "connected" });
    },
  };
  return { tablet, plugin };
}

describe('Wi-Fi (spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed")', () => {
  actOnScreen();
  it("joins open and password networks", async () => {
    const { tablet, plugin } = android();
    const runtime = ManagedRuntime.make(wifiPage(plugin));
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    onTestFinished(async () => {
      await act(() => Promise.resolve(root.unmount()));
      await runtime.dispose();
      host.remove();
    });
    const state = () => runtime.runPromise(Effect.flatMap(Effect.service(Machine), (m) => m.get()));
    const draw = (online: boolean) => act(() => Promise.resolve(root.render(<WifiNetworks runtime={runtime} online={online} onFix={() => { fixes += 1; }} />)));
    const joinedTo = async (name: string) => {
      await expect.element(page.getByRole("button", { name, exact: true })).not.toBeInTheDocument();
      await expect.element(page.getByRole("region", { name: "Wi-Fi" }).getByText(name, { exact: true })).toBeVisible();
    };
    const button = (name: string) => page.getByRole("button", { name });
    const tap = (name: string) => act(() => userEvent.click(page.getByRole("button", { name })));
    let fixes = 0;
    await draw(false);
    await tap("Fix Wi-Fi");
    expect(fixes).toBe(1);
    await draw(true);
    await expect.element(button("Fix Wi-Fi")).not.toBeInTheDocument();
    await joinedTo("Internet connection");

    await tap("Look for networks");
    expect(tablet.location).toBe("prompt");
    await tap("Allow");
    await expect.element(page.getByRole("button", { name: "Riverside Library Guest" })).toBeVisible();

    await tap("Riverside Library Guest");
    await expect.element(button("Riverside Library Guest")).not.toBeInTheDocument();
    await joinedTo("Riverside Library Guest");

    await tap("NETGEAR-4F2");
    for (const typed of ["abc", "wrongpass"]) {
      await act(() => userEvent.type(page.getByLabelText("Password"), typed));
      await tap("Join");
      await expect.element(page.getByRole("alert")).toBeVisible();
    }
    tablet.delayed = true;
    await act(() => userEvent.type(page.getByLabelText("Password"), "garden2024{Enter}"));
    await expect.element(page.getByLabelText("Password")).not.toBeInTheDocument();
    await expect.element(button("Try again")).toBeVisible();
    const changed = () => act(() => Promise.resolve(window.dispatchEvent(new Event("android-network-changed"))));
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
    await changed();
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
    await changed();

    const shown = () => act(() => Promise.resolve(document.dispatchEvent(new Event("visibilitychange"))));
    await tap("Sunrise Community Center");
    await expect.poll(() => tablet.panels).toBe(1);
    await shown();
    await expect.element(page.getByRole("alert")).toBeVisible();
    await tap("Try again");
    await expect.poll(() => tablet.panels).toBe(2);
    tablet.ssid = "Sunrise Community Center";
    await shown();
    await joinedTo("Sunrise Community Center");
    expect(tablet.joins).toHaveLength(4);

    await tap("NETGEAR-4F2");
    await act(() => userEvent.type(page.getByLabelText("Password"), "unfinished"));
    tablet.location = "denied";
    tablet.ssid = "NETGEAR-4F2";
    await changed();
    await expect.element(page.getByLabelText("Password")).not.toBeInTheDocument();
    await expect.element(page.getByText("Sunrise Community Center")).not.toBeInTheDocument();
    await joinedTo("Internet connection");
    tablet.location = "granted";
    tablet.ssid = null;
    await shown();
    await tap("NETGEAR-4F2");
    await expect.element(page.getByLabelText("Password")).toHaveValue("");
    expect(tablet.joins).toHaveLength(4);
  });
});
