import type { ComponentProps } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { GraceOrb } from "./GraceOrb.tsx";

export type StartupScreenProps = Omit<ComponentProps<"div">, "title" | "children"> & {
  /** `starting` while the tablet gets Grace ready; `failed` when it could not, and can try again. */
  state: "starting" | "failed";
  /** What is happening: "Starting Grace…", or "Grace couldn’t start". */
  title?: string;
  /** Why it failed, in plain words; only shown once it has. */
  message?: string;
  /** Asks to start again. */
  onRetry?: () => void;
  /** The word on the retry button. */
  retryLabel?: string;
};

/**
 * The whole screen while Grace starts: her orb breathing over the wash, or, when she could not start, why and a way to
 * try again. It covers the screen until Home is ready.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#grace
 */
export function StartupScreen({ state, title, message, onRetry, retryLabel = "Try again", className, ...props }: StartupScreenProps) {
  const failed = state === "failed";
  // spec/app/shell.md, "Startup distinguishes a usable shell from a recoverable startup failure". Drawn in the
  // prototype's language: the frame wash (`.screen`), the orb (`.orb-w`), `.zz` type and one prominent pill (`.a-btn.prom`).
  return (
    <div
      role={failed ? "alert" : "status"}
      aria-busy={!failed || undefined}
      className={cn("absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-frame px-4 text-center font-sans text-foreground", className)}
      {...props}
    >
      <GraceOrb size={160} glow={failed ? "off" : "rest"} className={cn(!failed && "animate-breathe motion-reduce:animate-none")} />
      <h1 className={cn("m-0 mt-8 text-title leading-9", failed ? "font-bold" : "font-medium text-lead-ink")}>
        {title ?? (failed ? "Grace couldn’t start" : "Starting Grace…")}
      </h1>
      {failed && message && <p className="m-0 mt-3 max-w-[560px] text-body-lg leading-[30px] text-muted-foreground">{message}</p>}
      {failed && onRetry && (
        <Button variant="prominent" size="pill" onClick={onRetry} className="mt-9">
          <RotateCcw aria-hidden size={22} strokeWidth={2.2} />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
