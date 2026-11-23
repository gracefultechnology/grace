import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { CalendarIcon } from "./CalendarIcon.tsx";
import type { LauncherCardProps } from "./LauncherCard.tsx";

const onClick = fn();

export const meta: ComponentMeta<LauncherCardProps> = {
  args: { title: "Calendar", status: "Nothing else today", art: <CalendarIcon weekday="FRI" day={13} aria-hidden />, children: undefined, onClick },
  examples: {
    Medium: { title: "Email", status: "2 new", size: "medium" },
  },
  decorator: (story) => (
    <div className="bg-gradient-frame-soft p-12">
      <div className="h-[300px] w-[480px] *:size-full">{story()}</div>
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const card = within(canvasElement).getByRole("button", { name: "Calendar Nothing else today" });
      await userEvent.click(card);
      await expect(onClick).toHaveBeenCalled();
      card.blur();
    },
  },
};
