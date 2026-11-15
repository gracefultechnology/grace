import type { ComponentProps, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.ts";

const tones = cva("", {
  variants: { tone: { 1: "bg-avatar-1", 2: "bg-avatar-2", 3: "bg-avatar-3", 4: "bg-avatar-4", 5: "bg-avatar-5", 6: "bg-avatar-6" } },
  defaultVariants: { tone: 4 },
});

export type AvatarProps = Omit<ComponentProps<"span">, "children"> & {
  /** Who it is: the accessible name, and the initial shown when there is no photo. */
  name: string;
  /** A photo of them. */
  src?: string;
  /** The color behind the initial or icon, 1 to 6. */
  tone?: 1 | 2 | 3 | 4 | 5 | 6;
  /** The diameter in pixels. */
  size?: number;
  /** An icon in place of the initial, such as a clinic's cross. */
  children?: ReactNode;
};

/**
 * A round photo of a person, or their initial on a tone (prototype `.a-av`).
 * @design packages/design-system/design.md#windows
 */
export function Avatar({ name, src, tone, size = 64, className, style, children, ...props }: AvatarProps) {
  // Prototype `av()` sets the initial at 0.4 × the size, but `.a-person .a-av` (88px) sets it at 36px; never under 19px bold, the
  // smallest large text that AA allows at 3:1.
  const initial = size === 88 ? 36 : Math.max(19, Math.round(size * 0.4));
  return (
    <span
      role="img"
      aria-label={name}
      className={cn("flex flex-none items-center justify-center overflow-hidden rounded-full leading-none font-bold text-primary-foreground", !src && tones({ tone }), className)}
      style={{ width: size, height: size, fontSize: initial, ...style }}
      {...props}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : (children ?? name.charAt(0).toUpperCase())}
    </span>
  );
}
