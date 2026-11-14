import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, stagePhoto, unfocus } from "./MailApp.meta.tsx";
import type { PhotoViewerProps } from "./PhotoViewer.tsx";

const next = fn();

export const meta: ComponentMeta<PhotoViewerProps> = {
  // The second of Susan's three photos.
  args: { title: "Photo 2 of 3", src: flowersPhoto, alt: "Daisies", backLabel: "Susan’s email", onBack: fn(), onPrevious: fn(), onNext: next, onSave: fn(), onForward: fn(), onClose: fn() },
  examples: { First: { title: "Photo 1 of 3", src: stagePhoto, alt: "Lily on the stage", onPrevious: undefined } },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Next photo" }));
      await expect(next).toHaveBeenCalled();
      unfocus();
    },
  },
};
