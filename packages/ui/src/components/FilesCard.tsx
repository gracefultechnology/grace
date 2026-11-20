import { FileIcon } from "../icons.tsx";
import { cn } from "../lib/cn.ts";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";
import { Panel } from "./Panel.tsx";

export type FilesCardPhoto = { src: string; alt?: string };

export type FilesCardDocument = {
  name: string;
  from?: string;
  kind?: string;
};

export type FilesCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** The newest photos: three fit, one large over two. */
  photos: FilesCardPhoto[];
  /** The newest document, in a row at the bottom. */
  document?: FilesCardDocument;
  /** A narrow column above Grace's compact window: the large photo keeps to 150px. */
  compact?: boolean;
};

/**
 * Home's Files card: the newest photos, one large over two, and the newest document.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#glass
 */
export function FilesCard({ title = "Files", photos, document, compact = false, size = "large", ...props }: FilesCardProps) {
  const photo = ({ src, alt }: FilesCardPhoto, className: string) => (
    <span key={src} className={cn("block min-h-0 overflow-hidden shadow-picture", className)}>
      <img src={src} alt={alt ?? ""} className="block size-full object-cover" />
    </span>
  );
  return (
    <LauncherCard title={title} size={size} compact={compact} {...props}>
      <span className="mb-3 grid min-h-0 flex-1 grid-cols-2 grid-rows-[62%_1fr] gap-3">
        {photos.slice(0, 3).map((p, i) => photo(p, i === 0 ? cn("col-span-2 rounded-photo", compact && "h-[150px]") : "rounded-xl"))}
      </span>
      {document && (
        <Panel variant="white" className="mt-auto flex flex-none items-center gap-4 px-3.5 py-2.5">
          <span className="flex h-[52px] w-11 flex-none flex-col items-center justify-center gap-0.5 rounded-md bg-card text-mark leading-none font-extrabold text-destructive shadow-badge">
            <FileIcon strokeWidth={2} className="size-5.5" />
            {document.kind ?? "PDF"}
          </span>
          <span className="min-w-0 [overflow-wrap:break-word] hyphens-auto">
            <b className="block text-body-lg leading-7">{document.name}</b>
            {document.from && <span className="block text-body leading-[26px] text-muted-foreground">{document.from}</span>}
          </span>
        </Panel>
      )}
    </LauncherCard>
  );
}
