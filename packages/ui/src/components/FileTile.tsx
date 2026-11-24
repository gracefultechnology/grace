import { memo, type ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export type FileTileProps = Omit<ComponentProps<"button">, "children"> & {
  /** The photo. */
  src?: string;
  /** The tile's accessible name, such as "Photo 2" or what the photo shows. */
  label: string;
};

/**
 * A saved photo in Files' grid; tapping it opens the photo (prototype `filesView()` photo buttons).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export const FileTile = memo(function FileTile({ src, label, type = "button", className, ...props }: FileTileProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        focusRing,
        "relative block h-[150px] cursor-pointer overflow-hidden rounded-tab p-0 shadow-photo-tile",
        className,
      )}
      {...props}
    >
      {src ? <img alt="" src={src} decoding="async" loading="lazy" className="block size-full object-cover" /> : <span className="p-3">{label}</span>}
    </button>
  );
});
