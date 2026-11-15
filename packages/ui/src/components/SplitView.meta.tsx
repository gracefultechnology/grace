import { Settings } from "lucide-react";
import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { emailNav, inbox, settingsNav } from "./AppWindow.meta.tsx";
import { AppHeader } from "./AppWindow.tsx";
import type { SplitViewProps } from "./SplitView.tsx";

export const meta: ComponentMeta<SplitViewProps> = {
  // Email's inbox inside a window, without the header's row.
  args: { nav: emailNav, children: inbox },
  examples: {
    "With header": { nav: settingsNav, header: <AppHeader title="Settings" icon={<Settings size={26} strokeWidth={2} aria-hidden />} onClose={() => {}} />, children: undefined },
  },
  decorator: (story) => <div className="relative h-[788px] w-[1130px] overflow-hidden rounded-window bg-background font-sans text-foreground">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("button", { name: /Inbox/ }).getAttribute("aria-current")).toBe("page"),
  },
};
