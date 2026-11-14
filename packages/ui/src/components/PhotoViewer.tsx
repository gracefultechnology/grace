import { ArrowDownToLine, Forward } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { FilePhotoViewer } from "./FilePhotoViewer.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

/** The viewer's words, for another language. */
export type PhotoViewerLabels = {
  save: string;
  forward: string;
  previous: string;
  next: string;
};

const viewerLabels: PhotoViewerLabels = { save: "Save to Files", forward: "Forward", previous: "Previous photo", next: "Next photo" };

export type PhotoViewerProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children"> & {
  /** Which photo this is among them: "Photo 2 of 3". */
  title: string;
  /** The photo. */
  src: string;
  /** What it shows, for a screen reader. */
  alt: string;
  /** Shows the photo before; without it the arrow is hidden. */
  onPrevious?: () => void;
  /** Shows the photo after; without it the arrow is hidden. */
  onNext?: () => void;
  /** Saves it to Files, the one next step. */
  onSave?: () => void;
  /** Forwards it in a new email. */
  onForward?: () => void;
  /** The viewer's words, for another language. */
  labels?: Partial<PhotoViewerLabels>;
};

/**
 * A photo from an email, large, with arrows to the others and Save to Files as the one next step
 * (prototype `mailView()`, viewer, `.a-view`); the photo and arrows are the Files viewer's.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function PhotoViewer({ src, alt, onPrevious, onNext, onSave, onForward, labels, ...props }: PhotoViewerProps) {
  const l = { ...viewerLabels, ...labels };
  return (
    <AppWindow
      actions={
        <>
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px]" onClick={onSave}>
            <ArrowDownToLine {...pill} />
            {l.save}
          </Button>
          <Button variant="plain" size="compact" className="pr-5 pl-4 text-grace-ink" onClick={onForward}>
            <Forward {...pill} />
            {l.forward}
          </Button>
        </>
      }
      {...props}
    >
      <FilePhotoViewer src={src} alt={alt} onPrevious={onPrevious} onNext={onNext} previousLabel={l.previous} nextLabel={l.next} />
    </AppWindow>
  );
}
