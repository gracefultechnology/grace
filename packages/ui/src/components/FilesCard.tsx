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
  /** The newest photos: three fit as `recent` and `pile`, four as `grid`. */
  photos: FilesCardPhoto[];
  /** The newest document, in a row at the bottom. */
  document?: FilesCardDocument;
  /** `recent`: one large photo over two; `pile`: three prints tossed on a pile; `grid`: four in two rows. */
  layout?: "recent" | "pile" | "grid";
  /** A narrow column above Grace's compact window: the large photo of `recent` keeps to 150px. */
  compact?: boolean;
};

const pile = [
  "top-24 left-1/4 h-[180px] w-1/2 -rotate-1",
  "top-4 left-[40%] h-[170px] w-[48%] rotate-6",
  "top-[30px] left-[16%] h-[170px] w-[48%] -rotate-7",
];

/**
 * Home's Files card: the newest photos, as one large over two, a pile of prints or a grid, and the newest document.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#glass
 */
export function FilesCard({ title = "Files", photos, document, layout = "recent", compact = false, size = "large", ...props }: FilesCardProps) {
  const photo = ({ src, alt }: FilesCardPhoto, className: string) => (
    <span key={src} className={cn("block min-h-0 overflow-hidden shadow-picture", className)}>
      <img src={src} alt={alt ?? ""} className="block size-full object-cover" />
    </span>
  );
  return (
    <LauncherCard title={title} size={size} compact={compact} {...props}>
      {layout === "recent" && (
        <span className="mb-3 grid min-h-0 flex-1 grid-cols-2 grid-rows-[62%_1fr] gap-3">
          {photos.slice(0, 3).map((p, i) => photo(p, i === 0 ? cn("col-span-2 rounded-photo", compact && "h-[150px]") : "rounded-xl"))}
        </span>
      )}
      {layout === "pile" && (
        <span className="relative -mx-6 mt-1 h-[300px] flex-none">
          {photos
            .slice(0, 3)
            .map((p, i) => photo(p, cn("absolute rounded-tile", i ? "shadow-print" : "shadow-print-top", pile[i])))
            .reverse()}
        </span>
      )}
      {layout === "grid" && (
        <span className="grid grid-cols-2 gap-3">{photos.slice(0, 4).map((p) => photo(p, "h-[140px] rounded-xl"))}</span>
      )}
      {document && (
        <Panel variant="white" className={cn("flex flex-none items-center gap-4 px-3.5 py-2.5", layout === "recent" ? "mt-auto" : "absolute inset-x-0 top-0")}>
          <span className="flex h-[52px] w-11 flex-none flex-col items-center justify-center gap-0.5 rounded-md bg-card text-[11px] leading-none font-extrabold text-destructive shadow-badge">
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
