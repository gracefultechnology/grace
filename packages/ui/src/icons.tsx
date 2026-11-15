import type { ComponentProps, ReactNode } from "react";
import { cn } from "./lib/cn.ts";

export type IconProps = ComponentProps<"svg">;

// Prototype `AXP` and `axi()` (prototype/Grace Prototype.html): 24-unit outlines in the current color, 24px and stroke
// 2.2 unless told otherwise. Decorative; name the action on what they sit in. Size with a class: `size-7`.
const outline = (paths: ReactNode) =>
  function Icon({ className, ...props }: IconProps) {
    return (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={cn("size-6 shrink-0", className)} {...props}>
        {paths}
      </svg>
    );
  };

/** `AXP.bell`: a reminder. */
export const BellIcon = outline(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>,
);

/** `AXP.file`: a document. */
export const FileIcon = outline(
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 13h4M10 17h4" />
  </>,
);

/** `AXP.gear`: Settings. */
export const GearIcon = outline(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>,
);

/** `AXP.play`: play a sound. */
export const PlayIcon = outline(<path d="M7 5v14l12-7z" />);

/** `AXP.spk`: the volume, sounding. */
export const SpeakerIcon = outline(
  <>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 5a10 10 0 0 1 0 14" />
  </>,
);

/** `AXP.spk0`: the volume, muted. */
export const SpeakerOffIcon = outline(
  <>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m22 9-6 6" />
    <path d="m16 9 6 6" />
  </>,
);
