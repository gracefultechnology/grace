import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { photos } from "./FilesApp.meta.tsx";
import type { FilePhotoViewerProps } from "./FilePhotoViewer.tsx";
import { onTablet } from "./SettingsApp.meta.tsx";

const retry = fn();

export const meta: ComponentMeta<FilePhotoViewerProps> = {
  args: {
    title: "Photo 2 of 6",
    backLabel: "Files",
    src: photos.flowers,
    alt: "Photo 2 of 6",
    onBack: fn(),
    onClose: fn(),
    onPrevious: fn(),
    onNext: fn(),
    onShare: fn(),
    onDelete: fn(),
  },
  examples: {
    First: { title: "Photo 1 of 6", src: photos.stage, alt: "Photo 1 of 6", first: true },
    Last: { title: "Photo 6 of 6", src: photos.cat, alt: "Photo 6 of 6", last: true },
    "Delete failed": { deleteError: "This photo wasn’t deleted.", onRetryDelete: retry },
  },
  decorator: (story) => onTablet(story),
  play: {
    "Delete failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("img", { name: "Photo 2 of 6" })).toBeVisible();
      await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
    },
  },
};
