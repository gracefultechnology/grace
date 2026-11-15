import { Calendar, Plus } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AppHeaderProps } from "./AppHeader.tsx";
import { Button } from "./Button.tsx";

const close = fn();
const back = fn();

// Calendar's header actions: Today, and Add as the one next step (prototype `#awin .aphdr`).
const calendarActions = (
  <>
    <Button variant="plain" size="compact" className="text-grace-ink">Today</Button>
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
    "Large title": { mode: "large" },
    // Prototype `lgtScroll()` past the large title, X.hdrMode = "large": the frosted bar with the title centred.
    "Large title, collapsed": { mode: "large", collapsed: true },
    // The same over a split window's page column (prototype `#awin.splitw .aphdr.bar`), Settings › Wi-Fi.
    "Split, collapsed": { mode: "large", collapsed: true, split: true, title: "Wi-Fi", actions: undefined, className: "ml-[310px]" },
  },
  // The top of an app window (prototype `#awin`), 1130 wide on the tablet's wash.
  decorator: (story) => (
    <div className="bg-gradient-frame-soft p-1.5">
      <div className="h-[180px] w-[1130px] overflow-hidden rounded-window bg-background shadow-float">{story()}</div>
    </div>
  ),
  play: {
    "Large title, collapsed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
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
