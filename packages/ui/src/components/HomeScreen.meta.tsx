import { Bell, House, Settings, Volume2, Wifi, X } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { Banner } from "./Banner.tsx";
import { Button } from "./Button.tsx";
import { files } from "./FilesCard.meta.tsx";
import { calendar } from "./HomeCalendarCard.meta.tsx";
import { email } from "./HomeEmailCard.meta.tsx";
import type { HomeScreenProps } from "./HomeScreen.tsx";
import { internet } from "./InternetCard.meta.tsx";
import { Rail, RailButton, WifiSlash } from "./Rail.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const icon = { size: 28, strokeWidth: 1.9 };
const onPageChange = fn();

// Prototype `render()` at 8:56 PM on Friday, November 13: Home's first page, mode G.
const home: HomeScreenProps = { greeting: "Good evening", name: "Margaret", line: "Here’s your day", calendar, email, internet, files, onPageChange };

// Prototype `drawBanner()`, X.online = false.
const offline: HomeScreenProps = {
  ...home,
  className: "offline",
  email: { ...email, status: "Waiting for the internet", waiting: "New email will arrive when you’re back online." },
  internet: { ...internet, status: "Needs the internet", offline: true },
  banner: (
    <Banner
      icon={<WifiSlash size={30} />}
      title="Not connected to the internet"
      line="Grace can help you reconnect."
      actions={
        <Button variant="prominent" size="compact">
          <Wifi aria-hidden size={22} strokeWidth={2.2} />
          Fix Wi-Fi
        </Button>
      }
    />
  ),
};

export const meta: ComponentMeta<HomeScreenProps> = {
  args: home,
  examples: {
    // Prototype `drawBanner()`, X.banner = "rem".
    Reminder: {
      ...home,
      banner: (
        <Banner
          icon={<Bell size={30} strokeWidth={2.2} className="text-alert" />}
          title="Doctor’s appointment"
          line="Tomorrow at 10 am · Main St clinic"
          actions={
            <>
              <Button variant="prominent" size="compact">See details</Button>
              <Button variant="plain" size="compact-icon" aria-label="Dismiss">
                <X aria-hidden size={24} strokeWidth={1.75} />
              </Button>
            </>
          }
        />
      ),
    },
  },
  states: { Offline: offline },
  // Home sits on the tablet's screen under the rail (prototype `#screen`). The decorator gets no args, so the rail
  // shows Wi-Fi off when the story's Home is marked `offline` (prototype `railWifi()`).
  decorator: (story) => (
    <TabletScreen className="group/tablet">
      <Rail
        battery={75}
        time="8:56"
        period="PM"
        date="Fri, Nov 13"
        aria-label="Tablet"
        status={
          <RailButton
            icon={
              <>
                <Wifi {...icon} className="group-has-[.offline]/tablet:hidden" />
                <WifiSlash size={28} className="hidden group-has-[.offline]/tablet:block" />
              </>
            }
            label="Wi-Fi"
          />
        }
        footer={<RailButton icon={<Settings {...icon} />} label="Settings" />}
        ask={<AskGraceButton />}
      >
        <RailButton icon={<House {...icon} />} label="Home" selected />
        <RailButton icon={<Volume2 {...icon} />} label="Volume" />
      </Rail>
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const more = within(canvasElement).getByRole("button", { name: "More apps" });
      await userEvent.click(more);
      await expect(onPageChange).toHaveBeenCalledWith("files");
      more.blur();
    },
  },
};
