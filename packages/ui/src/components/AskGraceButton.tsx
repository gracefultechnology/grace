import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";
import { GraceOrb, type GraceOrbProps } from "./GraceOrb.tsx";

export type AskGraceButtonProps = ComponentProps<"button"> & {
  /** The words under the orb. */
  label?: string;
  /** Grace is open: the button sits on the raised white platter. */
  selected?: boolean;
  /** The orb's glow: `welcome` pulses at start-up, `rest` while Grace is closed, `off` while she is open. */
  glow?: GraceOrbProps["glow"];
};

/**
 * The rail's Ask Grace button: her orb with its label, which opens Grace.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#selected
 */
export function AskGraceButton({ label = "Ask Grace", selected = false, glow = "rest", type = "button", className, ...props }: AskGraceButtonProps) {
  // Prototype `.rail .ask`, `.rail .ask.on`.
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        focusRing,
        "flex w-[116px] cursor-pointer flex-col items-center gap-2 rounded-row pt-3 pb-2.5 text-body leading-6 font-bold text-chrome transition-[background-color,box-shadow] duration-press ease-css-default",
        selected && "bg-card text-primary shadow-raised",
        className,
      )}
      {...props}
    >
      <GraceOrb glow={glow} />
      {label}
    </button>
  );
}
