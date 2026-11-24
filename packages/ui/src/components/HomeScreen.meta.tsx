import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { Banner } from "./Banner.tsx";
import { offline as offlineBanner, reminder } from "./Banner.meta.tsx";
import { Mail } from "lucide-react";
import { Button } from "./Button.tsx";
import { files, filesEmpty } from "./FilesCard.meta.tsx";
import { calendar, calendarEmpty } from "./HomeCalendarCard.meta.tsx";
import { email, emailOffline } from "./HomeEmailCard.meta.tsx";
import type { HomeScreenProps } from "./HomeScreen.tsx";
import { internet, internetOffline } from "./InternetCard.meta.tsx";
import { passwords, passwordsEmpty } from "./PasswordsCard.meta.tsx";
import { Rail } from "./Rail.tsx";
import { homeRail } from "./Rail.meta.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const onPageChange = fn();

const home: HomeScreenProps = { greeting: "Good evening", name: "Margaret", line: "Here’s your day", calendar, email, internet, files, passwords, onPageChange };

const newTablet: HomeScreenProps = { ...home, calendar: calendarEmpty, email: { ...email, notConnectedStatus: "No email added yet", notConnected: true, messages: [] }, files: filesEmpty, passwords: passwordsEmpty,
  banner: <Banner icon={<Mail aria-hidden size={30} strokeWidth={2} />} title="Add your email" line="Then your messages, appointments and photos show up here." actions={<Button variant="prominent" size="compact">Add email</Button>} />,
};

const offline: HomeScreenProps = {
  ...home,
  className: "offline",
  email: emailOffline,
  internet: internetOffline,
  banner: <Banner {...offlineBanner} />,
};

const compact: HomeScreenProps = { ...home, layout: "compact", className: "grace-compact bottom-[272px]" };

export const meta: ComponentMeta<HomeScreenProps> = {
  args: home,
  examples: {
    "Layout Compact": compact,
    "Compact Page Files": { ...compact, page: "FilesCard" },
    "Layout Greeting": { ...home, layout: "greeting", className: "grace-compact bottom-[578px]" },
    "New Tablet": newTablet,
    "New Tablet Page Passwords": { ...newTablet, page: "PasswordsCard" },
    Reminder: {
      ...home,
      banner: <Banner {...reminder} />,
    },
  },
  states: { Offline: offline },
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
    Default: tapCalls("More apps", onPageChange, { args: ["FilesCard"], rest: true }),
    "Compact Page Files": tapCalls("Previous page", onPageChange, { args: ["MainCards"], rest: true }),
  },
};
