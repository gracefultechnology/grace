import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { flowersPhoto, mailScreen, programPhoto, stagePhoto, retriesUnshown } from "./MailApp.meta.tsx";
import type { PhotoViewerProps } from "./PhotoViewer.tsx";

const next = fn();
const retry = fn();

export const meta: ComponentMeta<PhotoViewerProps> = {
  // The second of Susan's three photos.
  args: { title: "Photo 2 of 3", src: flowersPhoto, alt: "Daisies", backLabel: "Susan’s email", onBack: fn(), onPrevious: fn(), onNext: next, onSave: fn(), onForward: fn(), onClose: fn() },
  examples: {
    First: { title: "Photo 1 of 3", src: stagePhoto, alt: "Lily on the stage", first: true },
    Last: { title: "Photo 3 of 3", src: programPhoto, alt: "The recital program", last: true },
    Loading: { status: "loading" },
    "Couldn’t show": { status: "failed", onRetry: retry },
    Saved: { saveStatus: "saved" },
    "Save failed": { saveStatus: "failed", onRetrySave: fn() },
  },
  decorator: mailScreen,
  play: {
    Default: tapCalls("Next photo", next, { rest: true }),
    "Couldn’t show": retriesUnshown("Save to Files", retry),
  },
};
