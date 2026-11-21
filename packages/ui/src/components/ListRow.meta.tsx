import { Paperclip } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Avatar } from "./Avatar.tsx";
import { susan } from "./Avatar.meta.tsx";
import type { ListRowProps } from "./ListRow.tsx";
import { WifiSignal } from "./WifiSignal.tsx";

const open = fn();

export const meta: ComponentMeta<ListRowProps> = {
  args: { title: "Susan", subtitle: <>Photos from Lily’s recital · <Paperclip size={18} strokeWidth={2.2} aria-hidden className="inline align-[-3px]" /></>, time: "2:15 PM", unread: true, truncate: true, leading: <Avatar name="Susan" src={susan} aria-hidden /> },
  examples: {
    Read: { title: "Riverside Book Club", subtitle: "Our book for December", time: "Yesterday", unread: false, leading: <Avatar name="Riverside Book Club" tone={3} aria-hidden /> },
    Appointment: {
      title: "Lunch with Susan",
      subtitle: "She’ll pick you up",
      time: undefined,
      unread: false,
      truncate: false,
      chevron: true,
      onClick: open,
      leading: (
        <>
          <div className="w-[92px] flex-none text-center">
            <b className="block text-control leading-[22px] font-bold tracking-[.06em] text-muted-foreground uppercase">Mon</b>
            <span className="block text-body-lg leading-7 font-bold text-chrome">12 pm</span>
          </div>
          <span className="w-[3px] flex-none self-stretch rounded-full bg-lavender" />
        </>
      ),
    },
    Network: {
      title: "Smith Guest",
      subtitle: undefined,
      time: undefined,
      unread: false,
      truncate: false,
      chevron: true,
      onClick: open,
      className: "min-h-[76px]",
      leading: <WifiSignal strength={2} />,
      trailing: (
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <rect x="5" y="11" width="14" height="10" rx="2" />
        </svg>
      ),
    },
  },
  decorator: (story) => <div className="w-[852px] bg-background p-6">{story()}</div>,
  play: {
    Appointment: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Lunch with Susan/ }));
      await expect(open).toHaveBeenCalled();
    },
  },
};
