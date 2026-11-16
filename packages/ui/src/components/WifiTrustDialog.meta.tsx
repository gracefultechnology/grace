import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { overWifiPage } from "./SettingsApp.meta.tsx";
import type { WifiTrustDialogProps } from "./WifiTrustDialog.tsx";

const trust = fn();

export const meta: ComponentMeta<WifiTrustDialogProps> = {
  args: { network: "Sunrise Community Center", issuer: "wifi.sunrisecommunity.org", onTrust: trust, onAskGrace: fn(), onCancel: fn() },
  decorator: overWifiPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("button", { name: "Trust and join" }));
      await expect(trust).toHaveBeenCalled();
    },
  },
};
