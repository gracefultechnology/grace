import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export type FileTileProps = Omit<ComponentProps<"button">, "children"> & {
  /** The photo. */
  src: string;
  /** The tile's accessible name, such as "Photo 2" or what the photo shows. */
  label: string;
};

/**
 * A saved photo in Files' grid; tapping it opens the photo (prototype `filesView()` photo buttons).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function FileTile({ src, label, type = "button", className, ...props }: FileTileProps) {
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
      <img alt="" src={src} className="block size-full object-cover" />
    </button>
  );
}
