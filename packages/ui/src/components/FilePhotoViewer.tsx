import type { ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type FilePhotoViewerProps = Omit<ComponentProps<"div">, "children"> & {
  /** The photo. */
  src: string;
  /** What the photo shows, for a screen reader. */
  alt: string;
  /** Called by the previous arrow; without it the arrow is hidden (the first photo). */
  onPrevious?: () => void;
  /** Called by the next arrow; without it the arrow is hidden (the last photo). */
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
};

/**
 * One saved photo, large, between previous and next arrows: the page of the Files window that a photo opens
 * (prototype `.a-view`).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function FilePhotoViewer({ src, alt, onPrevious, onNext, previousLabel = "Previous photo", nextLabel = "Next photo", className, ...props }: FilePhotoViewerProps) {
  return (
    <div className={cn("flex h-full items-center justify-center gap-5", className)} {...props}>
      <Button variant="capsule" size="pill-icon" aria-label={previousLabel} onClick={onPrevious} className={cn("text-chrome", !onPrevious && "invisible")}>
        <ChevronLeft size={30} strokeWidth={2.4} aria-hidden />
      </Button>
      <img alt={alt} src={src} className="h-[520px] w-[780px] flex-none rounded-day object-cover shadow-photo" />
      <Button variant="capsule" size="pill-icon" aria-label={nextLabel} onClick={onNext} className={cn("text-chrome", !onNext && "invisible")}>
        <ChevronRight size={30} strokeWidth={2.4} aria-hidden />
      </Button>
    </div>
  );
}
