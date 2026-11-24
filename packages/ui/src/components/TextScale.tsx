import { useMemo, type ReactNode } from "react";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };

export type TextScaleProps = {
  /** Every word's size, in percent of its type token: 90 Smaller, 100 Normal, 115 Larger, 130 Largest. */
  percent: number;
  children?: ReactNode;
};

const text: Record<string, string | { size: string }> = tokens.text;
const sizes = Object.entries(text).map(([name, token]) => [name, typeof token === "string" ? token : token.size] as const);

/**
 * Scales every word on the screen by the Text size setting: it sets each type token (`text-body`, `text-title` …) on the
 * document's root to its size times `percent`, so Home, the rail, apps, Grace's messages and the dialogs and menus drawn
 * outside the screen all follow, while their boxes keep their size. Wraps a `TabletScreen`'s content without a box of its own.
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md
 */
export function TextScale({ percent, children }: TextScaleProps) {
  const css = useMemo(
    () => (percent === 100 ? null : `:root:root{${sizes.map(([name, size]) => `--text-${name}:calc(${size} * ${percent / 100})`).join(";")}}`),
    [percent],
  );
  return (
    <>
      {css && <style>{css}</style>}
      {children}
    </>
  );
}
