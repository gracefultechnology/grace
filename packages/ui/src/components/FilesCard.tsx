import { cn } from "../lib/cn.ts";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";
import { Panel } from "./Panel.tsx";

/** A photo on the Files card. */
export type FilesCardPhoto = { src: string; alt?: string };

/** A document on the Files card. */
export type FilesCardDocument = {
  /** Its name: "Visit form". */
  name: string;
  /** Who sent it: "From Main St Clinic". */
  from?: string;
  /** The short word on its badge: "PDF". */
  kind?: string;
};

export type FilesCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** The newest photos, the first one large. Three fit. */
  photos: FilesCardPhoto[];
  /** The newest document, in a row under the photos. */
  document?: FilesCardDocument;
};

/**
 * Home's Files card, "Recent photos": the newest photos, one large over two, and the newest document.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#glass
 */
export function FilesCard({ title = "Files", photos, document, size = "large", ...props }: FilesCardProps) {
  // Prototype `hmFilesInner('A')`: a grid of 62% and the rest, 12px apart, over the document row.
  return (
    <LauncherCard title={title} size={size} {...props}>
      <span className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[62%_1fr] gap-3">
        {photos.slice(0, 3).map((photo, i) => (
          <span key={photo.src} className={cn("min-h-0 overflow-hidden shadow-picture", i === 0 ? "col-span-2 rounded-photo" : "rounded-xl")}>
            <img src={photo.src} alt={photo.alt ?? ""} className="block size-full object-cover" />
          </span>
        ))}
      </span>
      {document && (
        // Prototype `hmDoc()`, `#home .hfdoc .lpanel`.
        <Panel variant="white" className="mt-3 flex flex-none items-center gap-4 px-3.5 py-2.5">
          <span className="flex h-[52px] w-11 flex-none flex-col items-center justify-center gap-0.5 rounded-md bg-card text-[11px] leading-none font-extrabold text-destructive shadow-badge">
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 13h4M10 17h4" />
            </svg>
            {document.kind ?? "PDF"}
          </span>
          <span className="min-w-0">
            <b className="block text-body-lg leading-7">{document.name}</b>
            {document.from && <span className="block truncate text-body leading-[26px] text-muted-foreground">{document.from}</span>}
          </span>
        </Panel>
      )}
    </LauncherCard>
  );
}
