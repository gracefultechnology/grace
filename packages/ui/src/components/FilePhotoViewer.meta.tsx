import { Forward } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AppWindow } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { photos } from "./FilesApp.meta.tsx";
import type { FilePhotoViewerProps } from "./FilePhotoViewer.tsx";
import { onTablet } from "./SettingsApp.meta.tsx";

const retry = fn();
const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export const meta: ComponentMeta<FilePhotoViewerProps> = {
  // Prototype `filesView()` with `X.files.view = 1`: the second photo of six.
  args: { src: photos.flowers, alt: "Photo 2 of 6", onPrevious: fn(), onNext: fn() },
  examples: {
    First: { src: photos.stage, alt: "Photo 1 of 6", onPrevious: undefined },
    "Delete failed": { deleteError: "This photo wasn’t deleted.", onRetryDelete: retry },
  },
  decorator: (story) =>
    onTablet(() => (
      <AppWindow
        title="Photo 2 of 6"
        backLabel="Files"
        onBack={fn()}
        onClose={fn()}
        actions={
          <>
            <Button variant="plain" size="compact" className="text-grace-ink"><Forward {...pill} />Share</Button>
            <Button variant="plain" size="compact" className="text-grace-ink">
              {/* Prototype `axi('trash')`: no lines on the bin, unlike Lucide's Trash. */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </Button>
          </>
        }
      >
        {story()}
      </AppWindow>
    )),
  play: {
    "Delete failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("img", { name: "Photo 2 of 6" })).toBeVisible();
      await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
    },
  },
};
