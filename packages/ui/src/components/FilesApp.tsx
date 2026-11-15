import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { FileDocumentRow } from "./FileDocumentRow.tsx";
import { FileTile } from "./FileTile.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

/** A saved photo. */
export interface FilesPhoto {
  id: string;
  src: string;
  /** Its accessible name. */
  label: string;
}

/** Photos saved at one time, such as "This week", with where they came from. */
export interface FilesPhotoGroup {
  title: string;
  /** Where they came from, such as "From Susan · Lily’s recital". */
  from?: string;
  photos: FilesPhoto[];
}

/** A saved document. */
export interface FilesDocument {
  id: string;
  name: string;
  /** Where it came from and when it was saved. */
  detail?: string;
}

export type FilesTab = "photos" | "documents";

export type FilesAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "headerMode" | "children"> & {
  /** Which list shows. */
  tab: FilesTab;
  onTabChange?: (tab: FilesTab) => void;
  /** The photos, newest group first. */
  photoGroups: FilesPhotoGroup[];
  /** The documents, newest first. */
  documents: FilesDocument[];
  /** Called with the photo a person taps. */
  onOpenPhoto?: (id: string) => void;
  /** Called with the document whose Open a person taps. */
  onOpenDocument?: (id: string) => void;
  /** Called with the document whose Print a person taps. */
  onPrintDocument?: (id: string) => void;
  title?: string;
  photosLabel?: string;
  documentsLabel?: string;
  /** The hint beside the tabs. */
  hint?: string;
};

/**
 * The Files window: saved photos in groups by when they came, or saved documents with Open and Print
 * (prototype `filesView()`).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function FilesApp({
  tab,
  onTabChange,
  photoGroups,
  documents,
  onOpenPhoto,
  onOpenDocument,
  onPrintDocument,
  title = "Files",
  photosLabel = "Photos",
  documentsLabel = "Documents",
  hint = "Ask Grace to find anything",
  ...props
}: FilesAppProps) {
  return (
    <AppWindow
      title={title}
      icon={
        // Prototype `AXP.folder`: flatter than Lucide's Folder.
        <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      }
      {...props}
    >
      <div className="mb-[18px] flex items-center gap-4">
        {/* Prototype `.a-seg` 420px wide plus its 6px padding (content-box). */}
        <SegmentedControl
          aria-label={title}
          className="w-[432px] p-1.5 [&>button]:h-13"
          options={[
            { value: "photos", label: photosLabel },
            { value: "documents", label: documentsLabel },
          ]}
          value={tab}
          onValueChange={(next) => next && onTabChange?.(next as FilesTab)}
        />
        <PageText tone="secondary" className="ml-auto">{hint}</PageText>
      </div>
      {tab === "photos"
        ? photoGroups.map((group, index) => (
            <section key={group.title} aria-label={group.title} className={index ? "mt-[22px]" : undefined}>
              <PageHeading level="title" className={group.from ? "mb-1" : "mb-3"}>{group.title}</PageHeading>
              {group.from ? <PageText tone="secondary" className="mb-3">{group.from}</PageText> : null}
              <div className="grid grid-cols-4 gap-3.5">
                {group.photos.map((photo) => (
                  <FileTile key={photo.id} src={photo.src} label={photo.label} onClick={() => onOpenPhoto?.(photo.id)} />
                ))}
              </div>
            </section>
          ))
        : (
            <div className="flex flex-col gap-3">
              {documents.map((document) => (
                <FileDocumentRow
                  key={document.id}
                  name={document.name}
                  detail={document.detail}
                  onOpen={() => onOpenDocument?.(document.id)}
                  onPrint={() => onPrintDocument?.(document.id)}
                />
              ))}
            </div>
          )}
    </AppWindow>
  );
}
