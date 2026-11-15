import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, stagePhoto, unfocus } from "./MailApp.meta.tsx";
import type { PhotoViewerProps } from "./PhotoViewer.tsx";

const next = fn();
const retry = fn();

export const meta: ComponentMeta<PhotoViewerProps> = {
  // The second of Susan's three photos.
  args: { title: "Photo 2 of 3", src: flowersPhoto, alt: "Daisies", backLabel: "Susan’s email", onBack: fn(), onPrevious: fn(), onNext: next, onSave: fn(), onForward: fn(), onClose: fn() },
  examples: {
    First: { title: "Photo 1 of 3", src: stagePhoto, alt: "Lily on the stage", onPrevious: undefined },
    Loading: { status: "loading" },
    "Couldn’t show": { status: "failed", onRetry: retry },
    Saved: { saveStatus: "saved" },
    "Save failed": { saveStatus: "failed", onRetrySave: fn() },
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Next photo" }));
      await expect(next).toHaveBeenCalled();
      unfocus();
    },
    "Couldn’t show": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Save to Files" }).disabled).toBe(true);
      await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
      unfocus();
    },
  },
};
