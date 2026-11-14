import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { SettingsApp } from "./SettingsApp.tsx";
import { onTablet } from "./SettingsApp.meta.tsx";
import { WifiNetworkList } from "./WifiNetworkList.tsx";
import { current, nearby } from "./WifiNetworkList.meta.tsx";
import type { WifiTrustDialogProps } from "./WifiTrustDialog.tsx";

const trust = fn();

export const meta: ComponentMeta<WifiTrustDialogProps> = {
  // Prototype `trustDlg()`: the community center's network asks to be trusted.
  args: { network: "Sunrise Community Center", issuer: "wifi.sunrisecommunity.org", onTrust: trust, onAskGrace: fn(), onCancel: fn() },
  // Over the Wi-Fi page it was opened from.
  decorator: (story) =>
    onTablet(
      () => (
        <>
          <SettingsApp page="wifi" onClose={() => {}}>
            <WifiNetworkList current={current} networks={nearby} />
          </SettingsApp>
          {story()}
        </>
      ),
      "Settings",
    ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("button", { name: "Trust and join" }));
      await expect(trust).toHaveBeenCalled();
    },
  },
};
