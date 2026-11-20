import type { ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import type { WifiNetwork, WifiNetworkListProps } from "./WifiNetworkList.tsx";

export const current: WifiNetwork = { name: "Home Network", signal: 3, locked: true };
export const nearby: WifiNetwork[] = [
  { name: "Riverside Library Guest", signal: 2 },
  { name: "Sunrise Community Center", signal: 2, locked: true },
  { name: "NETGEAR-4F2", signal: 2, locked: true },
  { name: "Smith family", signal: 2, locked: true },
  { name: "Xfinity WiFi", signal: 1 },
  ...["DIRECT-printer", "Apartment 2B", "Garcia home", "TP-Link_7A31", "Apartment 3C", "Linksys-guest", "Ring Setup", "ATT-2849", "Verizon_X9K4", "CenturyLink5512"].map((name) => ({ name, signal: 1, locked: true })),
];

export const settingsPage = (story: () => ReactNode) => <div className="w-[852px] bg-background p-6 font-sans">{story()}</div>;

const select = fn();
const more = fn();
const fix = fn();
const retry = fn();
const turnOn = fn();

export const meta: ComponentMeta<WifiNetworkListProps> = {
  args: { current, networks: nearby, onSelect: select, onExpandedChange: more, onTurnOn: turnOn },
  examples: {
    Expanded: { expanded: true },
    Connecting: { connecting: "NETGEAR-4F2" },
    Offline: { current: undefined, onFix: fix },
    "Join failed": { failed: "NETGEAR-4F2", onRetry: retry },
    "Nothing nearby": { status: "none", current: undefined, networks: [], action: <Button variant="prominent" size="pill">Look again</Button> },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "NETGEAR-4F2" }));
      await expect(select).toHaveBeenCalledWith("NETGEAR-4F2");
      await userEvent.click(canvas.getByRole("button", { name: "Show 11 more networks" }));
      await expect(more).toHaveBeenCalledWith(true);
    },
    Offline: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Fix Wi-Fi" }));
      await expect(fix).toHaveBeenCalled();
    },
    "Join failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
    },
    "Status Off": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.queryByRole("button", { name: "NETGEAR-4F2" })).toBeNull();
      await userEvent.click(canvas.getByRole("button", { name: "Turn on" }));
      await expect(turnOn).toHaveBeenCalled();
    },
  },
};
