import type { ComponentProps, CSSProperties } from "react";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };
import { cn } from "../lib/cn.ts";

export type TextScaleProps = ComponentProps<"div"> & {
  /** Every word's size, in percent of its type token: 90 Smaller, 100 Normal, 115 Larger, 130 Largest. */
  percent: number;
};

const sizes = Object.entries(tokens.text);

/**
 * Scales every word inside it by the Text size setting: it sets each type token (`text-body`, `text-title` …) to its
 * size times `percent` on its own style, so Home, the rail, apps and Grace's messages all follow, while their boxes keep
 * their size. Wraps a `TabletScreen`'s content without a box of its own.
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md
 */
export function TextScale({ percent, className, style, children, ...props }: TextScaleProps) {
  const scaled: CSSProperties = Object.fromEntries(sizes.map(([name, size]) => [`--text-${name}`, `calc(${size} * ${percent / 100})`]));
  return (
    <div className={cn("contents", className)} style={{ ...scaled, ...style }} {...props}>
      {children}
    </div>
  );
}
