import { House, Settings, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { BrowserTabStrip } from "./BrowserTabStrip.tsx";
import { BrowserToolbar } from "./BrowserToolbar.tsx";
import type { BrowserWindowProps } from "./BrowserWindow.tsx";
import { NewTabPage } from "./NewTabPage.tsx";
import { Rail, RailButton } from "./Rail.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const icon = { size: 28, strokeWidth: 1.9 };
const closeBrowser = fn();
const newTab = fn();

// Prototype `#bwin` on a new tab: Back, Forward and Go have nowhere to go.
const newTabWindow: BrowserWindowProps = {
  "aria-label": "Browser",
  tabStrip: <BrowserTabStrip tabs={[{ id: 1, title: "New tab" }]} selectedId={1} onNewTab={newTab} onCloseBrowser={closeBrowser} />,
  toolbar: (
    <BrowserToolbar>
      <AddressBar value="" />
    </BrowserToolbar>
  ),
  children: <NewTabPage />,
};

export const meta: ComponentMeta<BrowserWindowProps> = {
  args: newTabWindow,
  examples: {
    // Prototype `#bwin` on the payment page. The empty panel stands for the website, which the app's browser surface draws.
    Website: {
      tabStrip: <BrowserTabStrip tabs={[{ id: 1, title: "Pay your card · Chase", initial: "C" }]} selectedId={1} />,
      toolbar: (
        <BrowserToolbar canGoBack canGo>
          <AddressBar value="chase.com/pay" />
        </BrowserToolbar>
      ),
      children: <div role="presentation" className="size-full bg-panel" />,
    },
    "Grace typing": {
      toolbar: (
        <BrowserToolbar canGo>
          <AddressBar value="chase.com" guided />
        </BrowserToolbar>
      ),
    },
  },
  // Prototype `.screen` with the rail beside the browser, as at 8:57 PM on Friday, November 13.
  decorator: (story) => (
    <TabletScreen>
      <Rail
        battery={75}
        time="8:57"
        period="PM"
        date="Fri, Nov 13"
        aria-label="Tablet"
        status={<RailButton icon={<Wifi {...icon} />} label="Wi-Fi" />}
        footer={<RailButton icon={<Settings {...icon} />} label="Settings" />}
        ask={<AskGraceButton />}
      >
        <RailButton icon={<House {...icon} />} label="Home" />
        <RailButton icon={<Volume2 {...icon} />} label="Volume" />
      </Rail>
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("button", { name: "Back" })).toBeDisabled();
      await userEvent.click(canvas.getByRole("button", { name: "Open a new tab" }));
      await userEvent.click(canvas.getByRole("button", { name: "Close browser" }));
      await expect([newTab, closeBrowser].map((f) => f.mock.calls.length)).toEqual([1, 1]);
    },
  },
};
