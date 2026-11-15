import { Eye } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, type ButtonProps } from "./Button.tsx";
import { GracePill } from "./GraceHeader.tsx";

export type GuideShowButtonProps = Omit<ButtonProps, "variant" | "size" | "children" | "onSelect" | "asChild" | "loading"> & {
  /** Brings back the ring and label Margaret dismissed, on the same target with the same words. */
  onSelect?: () => void;
  /** The words on the button. */
  label?: string;
  /** `strip`: beside Show chat on the caption strip while she types; `header`: a pill in a `GraceCapsule` of Grace's compact window. */
  surface?: "strip" | "header";
};

/**
 * Show me again: after Margaret closes Grace's tip, brings back the same ring and words on the same target. The host offers it
 * only while that target is still current, never for a stale one.
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideShowButton({ onSelect, onClick, label = "Show me again", surface = "strip", className, ...props }: GuideShowButtonProps) {
  const header = surface === "header";
  const content = (
    <>
      {/* Its neighbours' icons: Show chat's on the strip (`stripBtn()`), Expand's in the header (`ICON.exp`). */}
      <Eye size={header ? 20 : 22} strokeWidth={header ? 2.2 : 2} aria-hidden />
      {label}
    </>
  );
  const select: ButtonProps["onClick"] = (event) => {
    // On the strip, a tap anywhere else opens the chat; this one only shows the tip.
    event.stopPropagation();
    onClick?.(event);
    onSelect?.();
  };
  return header ? (
    <GracePill onClick={select} className={className} {...props}>{content}</GracePill>
  ) : (
    // `.capstrip .pill`: the toolbar's tinted glass, as Show chat beside it.
    <Button
      variant="glass"
      size="pill"
      onClick={select}
      className={cn("bg-primary/8 shadow-strip-pill", className)}
      {...props}
    >
      {content}
    </Button>
  );
}
