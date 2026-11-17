import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { FileDocumentRow } from "./FileDocumentRow.tsx";
import { FileTile } from "./FileTile.tsx";
import { GuideRing } from "./GuideRing.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { Skeleton } from "./Skeleton.tsx";

export interface FilesPhoto {
  id: string;
  src: string;
  label: string;
}

export interface FilesPhotoGroup {
  title: string;
  from?: string;
  photos: FilesPhoto[];
}

export interface FilesDocument {
  id: string;
  name: string;
  detail?: string;
}

export type FilesTab = "photos" | "documents";

export interface FilesMatch {
  id: string;
  label: string;
}

export type FilesAppLabels = {
  photos: string;
  documents: string;
  hint: string;
  loadFailed: string;
  retry: string;
  whichOne: string;
  noMatch: string;
  loading: string;
};

const filesAppLabels: FilesAppLabels = {
  photos: "Photos",
  documents: "Documents",
  hint: "Ask Grace to find anything",
  loadFailed: "Your files couldn’t be loaded.",
  retry: "Try again",
  whichOne: "Which one?",
  noMatch: "Nothing matched ‘{query}’.",
  loading: "Loading your files",
};

export type FilesAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "children"> & {
  /** Which list shows. */
  tab: FilesTab;
  /** `loading` the library is being read; `failed` it could not be, and Try again reads it again; `ready` it shows. */
  status?: "loading" | "failed" | "ready";
  /** Called by Try again after the library failed to load. */
  onRetry?: () => void;
  /** The one file a find matched: Grace's ring marks it on its tab. */
  highlightId?: string;
  /** The files a find matched, when more than one: Files asks which. */
  matches?: FilesMatch[];
  /** Called with the match a person picks. */
  onPickMatch?: (id: string) => void;
  /** What a find that matched nothing asked for. */
  noMatch?: string;
  onTabChange?: (tab: FilesTab) => void;
  /** The photos, newest group first. */
  photoGroups: FilesPhotoGroup[];
  /** The documents, newest first. */
  documents: FilesDocument[];
  /** Called with the photo a person taps. */
  onOpenPhoto?: (id: string) => void;
  /** Called with the document whose Open a person taps. */
  onOpenDocument?: (id: string) => void;
  title?: string;
  /** The words of Files, for another language. */
  labels?: Partial<FilesAppLabels>;
};

/**
 * The Files window: saved photos in groups by when they came, or saved documents with Open
 * (prototype `filesView()`); a find's answer over them, and Try again when the library could not be read.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function FilesApp({
  tab,
  onTabChange,
  photoGroups,
  documents,
  onOpenPhoto,
  onOpenDocument,
  status = "ready",
  onRetry,
  highlightId,
  matches,
  onPickMatch,
  noMatch,
  title = "Files",
  labels,
  ...props
}: FilesAppProps) {
  const l = { ...filesAppLabels, ...labels };
  const ring = (id: string, radius: number) =>
    id === highlightId && <GuideRing gap={8} radius={radius + 8} motion="pulse" />;
  return (
    <AppWindow
      title={title}
      icon={
        <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      }
      {...props}
    >
      <div className="mb-[18px] flex items-center gap-4">
        <SegmentedControl
          aria-label={title}
          className="w-[432px] p-1.5 [&>button]:h-13"
          options={[
            { value: "photos", label: l.photos },
            { value: "documents", label: l.documents },
          ]}
          value={tab}
          onValueChange={(next) => next && onTabChange?.(next as FilesTab)}
        />
        <PageText tone="secondary" className="ml-auto">{l.hint}</PageText>
      </div>
      {noMatch != null && <PageText tone="secondary" className="mb-[18px]">{l.noMatch.replace("{query}", noMatch)}</PageText>}
      {matches && matches.length > 1 && (
        <section aria-label={l.whichOne} className="mb-[22px]">
          <PageHeading level="section" className="mb-2.5">{l.whichOne}</PageHeading>
          <div className="flex flex-col gap-2.5">
            {matches.map((match) => (
              <ListRow key={match.id} className="min-h-[76px]" title={match.label} chevron onClick={() => onPickMatch?.(match.id)} />
            ))}
          </div>
        </section>
      )}
      {status === "failed" ? (
        <RetryNotice onRetry={onRetry} retryLabel={l.retry}>{l.loadFailed}</RetryNotice>
      ) : status === "loading" ? (
        <div role="status" aria-label={l.loading} className={tab === "photos" ? "grid grid-cols-4 gap-3.5" : "flex flex-col gap-3"}>
          {Array.from({ length: tab === "photos" ? 8 : 3 }, (_, index) => (
            <Skeleton key={index} className={tab === "photos" ? "h-[150px] rounded-tab" : "h-[92px]"} />
          ))}
        </div>
      ) : tab === "photos"
        ? photoGroups.map((group, index) => (
            <section key={group.title} aria-label={group.title} className={index ? "mt-[22px]" : undefined}>
              <PageHeading level="title" className={group.from ? "mb-1" : "mb-3"}>{group.title}</PageHeading>
              {group.from ? <PageText tone="secondary" className="mb-3">{group.from}</PageText> : null}
              <div className="grid grid-cols-4 gap-3.5">
                {group.photos.map((photo) => (
                  <div key={photo.id} className="relative">
                    <FileTile src={photo.src} label={photo.label} aria-current={photo.id === highlightId || undefined} className="w-full" onClick={() => onOpenPhoto?.(photo.id)} />
                    {ring(photo.id, 18)}
                  </div>
                ))}
              </div>
            </section>
          ))
        : (
            <div className="flex flex-col gap-3">
              {documents.map((document) => (
                <div key={document.id} className="relative">
                  <FileDocumentRow
                    name={document.name}
                    detail={document.detail}
                    aria-current={document.id === highlightId || undefined}
                    onOpen={() => onOpenDocument?.(document.id)}
                  />
                  {ring(document.id, 22)}
                </div>
              ))}
            </div>
          )}
    </AppWindow>
  );
}
