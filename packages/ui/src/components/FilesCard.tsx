import { Download, ImageIcon } from "lucide-react";
import { FileIcon } from "../icons.tsx";
import { cn, withKeys } from "../lib/cn.ts";
import { HomeWaiting } from "./HomeWaiting.tsx";
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
  /** The newest photos: three fit, one large over two; one fills the space and two share it. */
  photos: FilesCardPhoto[];
  /** The newest document, in a row at the bottom. */
  document?: FilesCardDocument;
  /** With no photos and no document, how files arrive: "Photos you save from email will appear here." */
  hint?: string;
  /** A narrow column above Grace's compact window: the large photo keeps to 150px. */
  compact?: boolean;
};

/**
 * Home's Files card: the newest photos, one large over two, and the newest document. With no photos, dashed frames
 * keep the photos' places, and an empty library says how files arrive.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#glass
 * @design packages/design-system/design.md#empty-states
 */
export function FilesCard({ title = "Files", photos, document, hint, compact = false, size = "large", ...props }: FilesCardProps) {
  const shown = withKeys(photos.slice(0, 3), (p) => p.src);
  const photo = ({ item: { src, alt }, key }: { item: FilesCardPhoto; key: string }, i: number) => (
    <span key={key} className={cn("block min-h-0 overflow-hidden shadow-picture", i === 0 || shown.length === 2 ? "col-span-2 rounded-photo" : "rounded-xl", i === 0 && compact && "h-[150px]")}>
      <img src={src} alt={alt ?? ""} decoding="async" loading="lazy" className="block size-full object-cover" />
    </span>
  );
  const frame = "border-2 border-dashed border-border bg-glass/35";
  return (
    <LauncherCard title={title} size={size} compact={compact} {...props}>
      <span className={cn("mb-3 grid min-h-0 flex-1 grid-cols-2 gap-3", shown.length === 1 ? "grid-rows-1" : "grid-rows-[62%_1fr]")}>
        {shown.length ? (
          shown.map(photo)
        ) : (
          <>
            <span className={cn("col-span-2 flex items-center justify-center rounded-photo text-pale", frame)}>
              <ImageIcon aria-hidden size={44} strokeWidth={1.6} />
            </span>
            <span className={cn("rounded-xl", frame)} />
            <span className={cn("rounded-xl", frame)} />
          </>
        )}
      </span>
      {hint && !shown.length && !document && <HomeWaiting message={hint} icon={<Download aria-hidden size={26} strokeWidth={2} />} className="mt-auto" />}
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
