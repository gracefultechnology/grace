import { Forward, Trash } from "lucide-react";
import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AppWindow } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { photos } from "./FilesApp.meta.tsx";
import type { FilePhotoViewerProps } from "./FilePhotoViewer.tsx";
import { onTablet } from "./SettingsApp.meta.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export const meta: ComponentMeta<FilePhotoViewerProps> = {
  // Prototype `filesView()` with `X.files.view = 1`: the second photo of six.
  args: { src: photos.flowers, alt: "Photo 2 of 6", onPrevious: fn(), onNext: fn() },
  examples: { First: { src: photos.stage, alt: "Photo 1 of 6", onPrevious: undefined } },
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
            <Button variant="plain" size="compact" className="text-grace-ink"><Trash {...pill} />Delete</Button>
          </>
        }
      >
        {story()}
      </AppWindow>
    )),
};
