import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PracticePageProps } from "./PracticePage.tsx";

const tapped = fn();

// Set-up step 16 in the browser's content area (senior-care Onboarding §01 frame 16 "Websites").
export const meta: ComponentMeta<PracticePageProps> = {
  args: { onContinue: tapped },
  decorator: (story) => <div className="h-[644px] w-[1082px]">{story()}</div>,
  examples: {
    // `ringPractice`: "Try it — tap the button I'm pointing at."
    Guided: { guided: true },
    // After "You tapped Continue."
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
