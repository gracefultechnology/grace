import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Avatar } from "./Avatar.tsx";
import { susan } from "./Avatar.meta.tsx";
import type { ListRowProps } from "./ListRow.tsx";

const open = fn();

export const meta: ComponentMeta<ListRowProps> = {
  // The first row of the Email inbox.
  args: { title: "Susan", subtitle: "Photos from Lily’s recital", time: "2:15 PM", unread: true, leading: <Avatar name="Susan" src={susan} aria-hidden /> },
  examples: {
    Read: { title: "Riverside Book Club", subtitle: "Our book for December", time: "Yesterday", unread: false, leading: <Avatar name="Riverside Book Club" tone={3} aria-hidden /> },
    // A Calendar row: the time and a colored bar lead, a chevron opens it.
    Appointment: {
      title: "Lunch with Susan",
      subtitle: "She’ll pick you up",
      time: undefined,
      unread: false,
      chevron: true,
      onClick: open,
      leading: (
        <>
          <div className="w-[92px] flex-none text-center">
            <b className="block text-lg leading-[22px] font-bold tracking-[.06em] text-muted-foreground uppercase">Mon</b>
            <span className="block text-body-lg leading-7 font-bold text-chrome">12 pm</span>
          </div>
          <span className="w-[3px] flex-none self-stretch rounded-full bg-lavender" />
        </>
      ),
    },
  },
  decorator: (story) => <div className="w-[840px] bg-background p-6">{story()}</div>,
  play: {
    Appointment: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Lunch with Susan/ }));
      await expect(open).toHaveBeenCalled();
    },
  },
};
