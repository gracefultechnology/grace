import { Calendar, Inbox, Info, Mail, Paperclip, Pen, PenLine, Plus, Send, Settings, Sun, Type, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { cn } from "../lib/cn.ts";
import { Avatar } from "./Avatar.tsx";
import { susan } from "./Avatar.meta.tsx";
import { Button, press } from "./Button.tsx";
import { detail, upcoming } from "./CalendarApp.meta.tsx";
import { CalendarEventDetail } from "./CalendarEventDetail.tsx";
import { CalendarEventRow } from "./CalendarEventRow.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { textSizePreview, textSizes } from "./SettingsApp.meta.tsx";
import { SettingsTextSize } from "./SettingsTextSize.tsx";
import { SearchField } from "./TextField.tsx";
import { SideNav, SideNavItem } from "./SplitView.tsx";
import type { AppWindowProps } from "./AppWindow.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const icon = { size: 26, strokeWidth: 2, "aria-hidden": true } as const;
const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;
// The prototype's trash can, without the two lines Lucide's has now.
const trash = <svg aria-hidden width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
// The clinic's white cross (prototype `av('clinic')`).
const cross = <svg aria-hidden width={30} height={30} viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" /></svg>;
// An email with a file: " · " and a paperclip after the subject (prototype `mrow`).
const attached = (subject: string) => <>{subject} · <Paperclip size={18} strokeWidth={2.2} aria-hidden className="inline align-[-3px]" /></>;

// The prototype's Email folders, Inbox open with two unread.
export const emailNav = (
  <SideNav aria-label="Folders">
    <SideNavItem icon={<Inbox {...icon} />} count={2} selected>Inbox</SideNavItem>
    <SideNavItem icon={<Send {...icon} />}>Sent</SideNavItem>
    <SideNavItem icon={<PenLine {...icon} />}>Drafts</SideNavItem>
    <SideNavItem icon={trash}>Trash</SideNavItem>
  </SideNav>
);

// The prototype's Settings pages, Text size open.
export const settingsNav = (
  <SideNav aria-label="Settings">
    <SideNavItem icon={<Type {...icon} />} selected>Text size</SideNavItem>
    <SideNavItem icon={<Sun {...icon} />}>Brightness</SideNavItem>
    <SideNavItem icon={<Volume2 {...icon} />}>Grace’s voice</SideNavItem>
    <SideNavItem icon={<Wifi {...icon} />}>Wi-Fi</SideNavItem>
    <SideNavItem icon={<Info {...icon} />}>About this tablet</SideNavItem>
  </SideNav>
);

// The prototype's inbox: the search capsule, then X.mail.items.
export const inbox = (
  <>
    <SearchField label="Search email" />
    <div className="mt-[18px] flex flex-col gap-3">
      <ListRow title="Susan" subtitle={attached("Photos from Lily’s recital")} time="2:15 PM" unread leading={<Avatar name="Susan" src={susan} aria-hidden />} />
      <ListRow title="Main St Clinic" subtitle={attached("Reminder: your appointment tomorrow at 10 am")} time="11:02 AM" unread leading={<Avatar name="Main St Clinic" tone={1} aria-hidden>{cross}</Avatar>} />
      <ListRow title="Riverside Book Club" subtitle="Our book for December" time="Yesterday" leading={<Avatar name="Riverside Book Club" tone={3} aria-hidden />} />
      <ListRow title="Account Security" subtitle="Urgent: confirm your password" time="Yesterday" leading={<Avatar name="Account Security" tone={4} aria-hidden />} />
    </div>
  </>
);

const textSize = (
  <PageText tone="secondary">Changes the size of words everywhere on the tablet: Home, every app, websites, the left side and Grace’s messages.</PageText>
);

// The prototype's Calendar week: its "Coming up" list.
const comingUp = (
  <>
    <PageHeading level="title" className="mb-3.5">Coming up</PageHeading>
    <div className="flex flex-col gap-3">
      {upcoming.map(({ id, ...event }) => <CalendarEventRow key={id} {...event} />)}
    </div>
  </>
);

// Calendar's header: Today, and Add as the one next step; Today presses as CalendarApp's does.
const calendarActions = (
  <>
    <Button variant="plain" size="compact" className={cn(press, "text-grace-ink active:scale-97 active:bg-transparent")}>Today</Button>
    <Button variant="prominent" size="compact">
      <Plus {...pill} />
      Add
    </Button>
  </>
);

const { title: detailTitle, ...eventDetail } = detail;

const close = fn();
const back = fn();

export const meta: ComponentMeta<AppWindowProps> = {
  // Email's inbox: the split window, with Write as the one next step.
  args: {
    title: "Email",
    icon: <Mail {...icon} />,
    nav: emailNav,
    actions: (
      <Button variant="prominent" size="compact">
        <Pen {...pill} />
        Write
      </Button>
    ),
    onClose: close,
    children: inbox,
  },
  examples: {
    Calendar: {
      title: "Calendar",
      icon: <Calendar {...icon} />,
      nav: undefined,
      actions: calendarActions,
      children: comingUp,
    },
    // The prototype's appointment page, opened from Calendar.
    "With Back": { title: detailTitle, backLabel: "Calendar", onBack: back, nav: undefined, actions: undefined, children: <CalendarEventDetail {...eventDetail} /> },
    Settings: {
      title: "Settings",
      icon: <Settings {...icon} />,
      nav: settingsNav,
      actions: undefined,
      children: <SettingsTextSize sizes={textSizes} value="Normal" {...textSizePreview} />,
    },
    "Large title": { headerMode: "large", title: "Text size", nav: settingsNav, actions: undefined, children: textSize },
    "Large title, no list": { headerMode: "large", title: "Calendar", nav: undefined, actions: calendarActions, children: comingUp },
    // Prototype `data-hdr="none"`: Email with no title, its page column 18px under the window's top.
    "No title": { headerMode: "none" },
    "Large title with Back": { headerMode: "large", title: detailTitle, backLabel: "Calendar", onBack: back, nav: undefined, actions: undefined, children: <CalendarEventDetail {...eventDetail} /> },
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("button", { name: /Inbox/ }).getAttribute("aria-current")).toBe("page");
      await userEvent.click(canvas.getByRole("button", { name: "Close Email" }));
      await expect(close).toHaveBeenCalled();
    },
    "With Back": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Back to Calendar" }));
      await expect(back).toHaveBeenCalled();
    },
  },
};
