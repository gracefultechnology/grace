import { Calendar, Inbox, Info, Mail, Pencil, PencilLine, Plus, Send, Settings, Sun, Trash, Type, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Avatar } from "./Avatar.tsx";
import { susan } from "./Avatar.meta.tsx";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { SideNav, SideNavItem } from "./SplitView.tsx";
import type { AppWindowProps } from "./AppWindow.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const icon = { size: 26, strokeWidth: 2, "aria-hidden": true } as const;
const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

// The prototype's Email folders, Inbox open with two unread.
export const emailNav = (
  <SideNav aria-label="Folders">
    <SideNavItem icon={<Inbox {...icon} />} count={2} selected>Inbox</SideNavItem>
    <SideNavItem icon={<Send {...icon} />}>Sent</SideNavItem>
    <SideNavItem icon={<PencilLine {...icon} />}>Drafts</SideNavItem>
    <SideNavItem icon={<Trash {...icon} />}>Trash</SideNavItem>
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

export const inbox = (
  <div className="flex flex-col gap-3">
    <ListRow title="Susan" subtitle="Photos from Lily’s recital" time="2:15 PM" unread leading={<Avatar name="Susan" src={susan} aria-hidden />} />
    <ListRow title="Main St Clinic" subtitle="Reminder: your appointment tomorrow at 10 am" time="11:02 AM" unread leading={<Avatar name="Main St Clinic" tone={1} aria-hidden />} />
    <ListRow title="Riverside Book Club" subtitle="Our book for December" time="Yesterday" leading={<Avatar name="Riverside Book Club" tone={3} aria-hidden />} />
    <ListRow title="Account Security" subtitle="Urgent: confirm your password" time="Yesterday" leading={<Avatar name="Account Security" tone={4} aria-hidden />} />
  </div>
);

const textSize = (
  <PageText tone="secondary">Changes the size of words everywhere on the tablet: Home, every app, websites, the left side and Grace’s messages.</PageText>
);

const comingUp = (
  <>
    <PageHeading level="title" className="mb-3.5">Coming up</PageHeading>
    <div className="flex flex-col gap-3">
      <ListRow title="Doctor’s appointment" subtitle="Dr. Patel · Main St clinic · 214 Main Street" chevron />
      <ListRow title="Lunch with Susan" subtitle="She’ll pick you up" chevron />
      <ListRow title="Hair appointment" subtitle="Linda’s salon" chevron />
    </div>
  </>
);

const close = fn();
const back = fn();

export const meta: ComponentMeta<AppWindowProps> = {
  // Email's inbox: the split window, with Write as the one next step.
  args: {
    title: "Email",
    icon: <Mail {...icon} />,
    nav: emailNav,
    actions: (
      <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px]">
        <Pencil {...pill} />
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
      actions: (
        <>
          <Button variant="plain" size="compact" className="text-grace-ink">Today</Button>
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px]">
            <Plus {...pill} />
            Add
          </Button>
        </>
      ),
      children: comingUp,
    },
    "With Back": { title: "Doctor’s appointment", backLabel: "Calendar", onBack: back, nav: undefined, actions: undefined, children: comingUp },
    Settings: {
      title: "Settings",
      icon: <Settings {...icon} />,
      nav: settingsNav,
      actions: undefined,
      children: (
        <>
          <PageHeading>Text size</PageHeading>
          {textSize}
        </>
      ),
    },
    "Large title": { headerMode: "large", title: "Text size", nav: settingsNav, actions: undefined, children: textSize },
    "Large title, no list": { headerMode: "large", title: "Calendar", nav: undefined, actions: undefined, children: comingUp },
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
