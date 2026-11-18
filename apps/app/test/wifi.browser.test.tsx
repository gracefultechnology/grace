// spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed"
import type { ConnectOptions, WiFiNetwork, WiFiPlugin } from "@elizaos/os/bridges/definitions/wifi";
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine } from "../gen/app__network.effect.vibe";
import { Wifi } from "../src/Wifi.tsx";
import { wifiPage } from "../src/wifi.vibe";
import "../src/main.css";

const nearby = (ssid: string, rssi: number, security: NonNullable<WiFiNetwork["security"]>): WiFiNetwork =>
  ({ ssid, bssid: "", rssi, frequency: 2412, capabilities: "", secured: security !== "open", security });

function android() {
  const tablet = { location: "prompt" as "prompt" | "granted", ssid: null as string | null, joins: [] as ConnectOptions[], panels: 0 };
  const plugin: WiFiPlugin = {
    checkPermissions: async () => ({ location: tablet.location }),
    requestPermissions: async () => { tablet.location = "granted"; return { location: "granted" }; },
    getCapabilities: async () => ({ sdk: 34, approvedJoin: true, internetPanel: true }),
    openInternetPanel: async () => { tablet.panels += 1; },
    getWifiState: async () => ({ enabled: true, connected: tablet.ssid !== null, rssi: null }),
    getConnectedNetwork: async () => ({ network: tablet.ssid === null ? null : nearby(tablet.ssid, -50, "wpa2") }),
    listAvailableNetworks: async () => {
      if (tablet.location !== "granted") throw Object.assign(new Error("location"), { code: "LOCATION_PERMISSION_REQUIRED" });
      return { networks: [nearby("NETGEAR-4F2", -50, "wpa2"), nearby("Riverside Library Guest", -60, "open"), nearby("Sunrise Community Center", -70, "eap")] };
    },
    connectToNetwork: async () => ({ success: false }),
    disconnectFromNetwork: async () => ({ success: true }),
    getConnectivity: async () => ({ online: tablet.ssid !== null, validated: tablet.ssid !== null, captivePortal: false, ssid: tablet.ssid }),
    addNetworkWithApproval: async (options) => {
      tablet.joins.push(options);
      if (options.password === "wrong") return { status: "wrongPassword" };
      tablet.ssid = options.ssid;
      return { status: "connected" };
    },
  };
  return { tablet, plugin };
}

describe('Join the network I choose (spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed")', () => {
  it("explains location, joins an open and a password network, and hands an account network to Android", async () => {
    const { tablet, plugin } = android();
    const runtime = ManagedRuntime.make(wifiPage(plugin));
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    onTestFinished(async () => {
      await act(() => root.unmount());
      await runtime.dispose();
      host.remove();
    });
    const state = () => runtime.runPromise(Effect.flatMap(Effect.service(Machine), (m) => m.get()));
    const tap = (name: string) => act(() => userEvent.click(page.getByRole("button", { name })));
    await act(() => root.render(<Wifi runtime={runtime} />));

    await tap("Look for networks");
    expect(tablet.location).toBe("prompt");
    await tap("Allow");
    await expect.element(page.getByRole("button", { name: "Riverside Library Guest" })).toBeVisible();

    await tap("Riverside Library Guest");
    await expect.poll(async () => (await state()).phase).toBe("JoinComplete");

    await tap("NETGEAR-4F2");
    await act(() => userEvent.type(page.getByLabelText("Password"), "wrong"));
    await tap("Join");
    await expect.element(page.getByRole("alert")).toBeVisible();
    await act(() => userEvent.type(page.getByLabelText("Password"), "garden2024{Enter}"));
    await expect.poll(async () => (await state()).phase).toBe("JoinComplete");
    expect(tablet.joins).toEqual([
      { ssid: "Riverside Library Guest", security: "open" },
      { ssid: "NETGEAR-4F2", security: "wpa2", password: "wrong" },
      { ssid: "NETGEAR-4F2", security: "wpa2", password: "garden2024" },
    ]);
    expect(JSON.stringify(await state())).not.toContain("garden2024");

    await tap("Sunrise Community Center");
    await expect.poll(() => tablet.panels).toBe(1);
    tablet.ssid = "Sunrise Community Center";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await expect.poll(async () => (await state()).phase).toBe("JoinComplete");
    expect(tablet.joins).toHaveLength(3);
  });
});
