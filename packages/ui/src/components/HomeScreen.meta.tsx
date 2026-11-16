import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { Banner } from "./Banner.tsx";
import { offline as offlineBanner, reminder } from "./Banner.meta.tsx";
import { files } from "./FilesCard.meta.tsx";
import { calendar } from "./HomeCalendarCard.meta.tsx";
import { email, emailOffline } from "./HomeEmailCard.meta.tsx";
import type { HomeScreenProps } from "./HomeScreen.tsx";
import { internet, internetOffline } from "./InternetCard.meta.tsx";
import { Rail } from "./Rail.tsx";
import { homeRail } from "./Rail.meta.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const onPageChange = fn();

// Prototype `render()` at 8:56 PM on Friday, November 13: Home's first page, mode G.
const home: HomeScreenProps = { greeting: "Good evening", name: "Margaret", line: "Here’s your day", calendar, email, internet, files, onPageChange };

// Prototype `render()` with X.online = false: the banner, and the cards that wait.
const offline: HomeScreenProps = {
  ...home,
  className: "offline",
  email: emailOffline,
  internet: internetOffline,
  banner: <Banner {...offlineBanner} />,
};

// Prototype `layout()` with Grace compact (`.home.cmp`): Home ends 6px above her 260px window. `grace-compact` marks it
// for the decorator's rail.
const compact: HomeScreenProps = { ...home, layout: "compact", className: "grace-compact bottom-[272px]" };

export const meta: ComponentMeta<HomeScreenProps> = {
  args: home,
  examples: {
    "Layout Compact": compact,
    // Prototype `hmGo(1)` while compact: the columns slide 354px.
    "Compact Page Files": { ...compact, page: "files" },
    // Prototype `.home.tight`: Grace compact and the keyboard up, 306px more.
    "Layout Greeting": { ...home, layout: "greeting", className: "grace-compact bottom-[578px]" },
    // Prototype `drawBanner()`, X.banner = "rem".
    Reminder: {
      ...home,
      banner: <Banner {...reminder} />,
    },
  },
  states: { Offline: offline },
  // Home sits on the tablet's screen under the rail (prototype `#screen`). The decorator gets no args, so the rail
  // shows Wi-Fi off when the story's Home is marked `offline` (prototype `railWifi()`), and Ask Grace raised beside
  // Home when it is marked `grace-compact` (prototype `railSel()`).
  decorator: (story) => (
    <TabletScreen className="group/tablet">
      <Rail
        {...homeRail("Home", { offline: { wifi: "group-has-[.offline]/tablet:hidden", slash: "hidden group-has-[.offline]/tablet:block" },
          grace: { rest: "group-has-[.grace-compact]/tablet:hidden", compact: "hidden group-has-[.grace-compact]/tablet:flex" },
        })}
      />
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: tapCalls("More apps", onPageChange, { args: ["files"], rest: true }),
    "Compact Page Files": tapCalls("Back to the first page", onPageChange, { args: ["main"], rest: true }),
  },
};
