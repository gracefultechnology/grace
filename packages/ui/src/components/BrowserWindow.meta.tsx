import type { ReactNode } from "react";
import { House, Settings, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { BrowserPageState } from "./BrowserPageState.tsx";
import { BrowserTabStrip } from "./BrowserTabStrip.tsx";
import { BrowserToolbar } from "./BrowserToolbar.tsx";
import { BrowserWindow, type BrowserWindowProps } from "./BrowserWindow.tsx";
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

const payTab = [{ id: 1, title: "Pay your card · Chase", initial: "C" }];

/** Prototype `.screen` with the rail beside the browser, as at 8:57 PM on Friday, November 13. */
const tablet = (children: ReactNode) => (
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
    {children}
  </TabletScreen>
);

/** A story over the browser on the payment page, paused behind it: for the website's requests and the browser's notices. */
export const onBrowser = (story: () => ReactNode, site = "chase.com/pay") =>
  tablet(
    <>
      <BrowserWindow
        aria-label="Browser"
        tabStrip={<BrowserTabStrip tabs={payTab} selectedId={1} />}
        toolbar={
          <BrowserToolbar canGoBack canGo onReload={() => {}}>
            <AddressBar value={site} />
          </BrowserToolbar>
        }
      />
      {story()}
    </>,
  );

export const meta: ComponentMeta<BrowserWindowProps> = {
  args: newTabWindow,
  examples: {
    // Prototype `#bwin` on the payment page, three pages on from the new tab. The website itself is the app's to draw.
    Website: {
      tabStrip: <BrowserTabStrip tabs={payTab} selectedId={1} />,
      toolbar: (
        <BrowserToolbar canGoBack canGo>
          <AddressBar value="chase.com/pay" />
        </BrowserToolbar>
      ),
      children: null,
    },
    // Prototype `.addr.typing`: Grace types the address on the new tab, so Go can go.
    "Grace typing": {
      toolbar: (
        <BrowserToolbar canGo>
          <AddressBar value="chase.com" guided />
        </BrowserToolbar>
      ),
    },
    // Go on an empty address: the notice under the field stays while the person types.
    "Empty Go": {
      toolbar: (
        <BrowserToolbar>
          <AddressBar value="" notice="Type a website or what you’re looking for." />
        </BrowserToolbar>
      ),
    },
    // A page loading in the selected tab, with tabs that do not fit behind "2 more".
    "Loading with more tabs": {
      tabStrip: (
        <BrowserTabStrip
          tabs={[{ id: 1, title: "Sign in · Chase", initial: "C" }, { id: 3, title: "Review payment · Chase", initial: "C", pageLoading: true }, { id: 5, title: "New tab" }]}
          overflow={[{ id: 2, title: "Credit card · Chase", initial: "C" }, { id: 4, title: "Payment scheduled · Chase", initial: "C" }]}
          selectedId={3}
        />
      ),
      toolbar: (
        <BrowserToolbar canGoBack canGo pageLoading onStop={() => {}}>
          <AddressBar value="chase.com/pay/review" />
        </BrowserToolbar>
      ),
      children: <BrowserPageState kind="checking" site="chase.com" />,
    },
    // The page did not open: Grace's own page stands in the website's place.
    "Page failed": {
      tabStrip: <BrowserTabStrip tabs={[{ id: 1, title: "chase.com", initial: "C" }]} selectedId={1} />,
      toolbar: (
        <BrowserToolbar canGo onReload={() => {}}>
          <AddressBar value="chase.com" />
        </BrowserToolbar>
      ),
      children: <BrowserPageState kind="failed" site="chase.com" message="The website took too long to answer." onRetry={() => {}} />,
    },
  },
  decorator: (story) => tablet(story() as ReactNode),
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
