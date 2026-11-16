import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PracticePageProps } from "./PracticePage.tsx";

const tapped = fn();

export const meta: ComponentMeta<PracticePageProps> = {
  args: { onContinue: tapped },
  decorator: (story) => <div className="h-[644px] w-[1082px]">{story()}</div>,
  examples: {
    Guided: { guided: true },
    Done: { done: true },
  },
  play: {
    Guided: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      tapped.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue" }));
      await expect(tapped).toHaveBeenCalled();
    },
  },
};
