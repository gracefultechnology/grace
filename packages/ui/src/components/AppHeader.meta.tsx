import { Calendar, Plus } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { cn } from "../lib/cn.ts";
import type { AppHeaderProps } from "./AppHeader.tsx";
import { Button, press } from "./Button.tsx";

const close = fn();
const back = fn();

const calendarActions = (
  <>
    <Button variant="plain" size="compact" className={cn(press, "text-grace-ink active:scale-97 active:bg-transparent")}>Today</Button>
    <Button variant="prominent" size="compact">
      <Plus size={22} strokeWidth={2.2} aria-hidden />
      Add
    </Button>
  </>
);

export const meta: ComponentMeta<AppHeaderProps> = {
  args: { title: "Calendar", icon: <Calendar size={26} strokeWidth={2} aria-hidden />, actions: calendarActions, onClose: close },
  examples: {
    "With Back": { title: "Doctor’s appointment", backLabel: "Calendar", onBack: back, actions: undefined },
  },
  decorator: (story) => (
    <div className="bg-gradient-frame-soft p-1.5">
      <div className="h-[180px] w-[1130px] overflow-hidden rounded-window bg-background shadow-float">{story()}</div>
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const button = within(canvasElement).getByRole("button", { name: "Close Calendar" });
      await userEvent.click(button);
      await expect(close).toHaveBeenCalled();
      button.blur();
    },
    "With Back": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const button = within(canvasElement).getByRole("button", { name: "Back to Calendar" });
      await userEvent.click(button);
      await expect(back).toHaveBeenCalled();
      button.blur();
    },
  },
};
