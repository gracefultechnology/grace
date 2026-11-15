import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type WifiSignInSheetProps = Omit<DialogPrimitive.DialogContentProps, "title"> & {
  /** The network whose sign-in page this is. */
  network: string;
  /** The line under the network's name. */
  subtitle?: string;
  /** The sheet is showing. */
  open?: boolean;
  /** Called by Cancel and Escape. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** The network's own web page, as the network serves it: its fields and branding are not the tablet's. */
  children: ReactNode;
};

/**
 * The tablet's sheet around a public network's sign-in page: Cancel and the network's name above the page the network
 * serves (prototype `.psheet` over `.a-scrim`). It covers the screen it is placed in.
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiSignInSheet({ network, subtitle = "This network’s sign-in page", open = true, onCancel, cancelLabel = "Cancel", className, children, ...props }: WifiSignInSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onCancel?.()}>
      {/* Inside the screen, not portalled: the sheet dims the tablet's screen, not the page around it. */}
      <DialogPrimitive.Overlay className="absolute inset-0 z-20 bg-scrim/32" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "absolute top-1/2 left-1/2 z-20 flex h-[min(700px,calc(100%-3rem))] w-[min(900px,calc(100%-3rem))] -translate-1/2 flex-col overflow-hidden rounded-screen bg-card font-sans shadow-dialog outline-none",
          className,
        )}
        // The sheet itself takes focus, as the prototype's does, so Cancel shows no ring until a person moves to it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        {...props}
      >
        {/* Prototype `.pshdr`. */}
        <div className="relative flex items-center justify-between border-b border-primary/8 p-4">
          <div className="flex h-16 items-center rounded-full bg-glass/62 p-1 shadow-capsule backdrop-blur-capsule backdrop-saturate-160">
            <Button variant="plain" size="compact" className="px-[22px] text-grace-ink" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
          <div className="flex flex-col items-center text-lg leading-[normal] text-muted-foreground">
            <DialogPrimitive.Title className="m-0 text-body-lg font-bold text-foreground">{network}</DialogPrimitive.Title>
            <span>{subtitle}</span>
          </div>
          <span className="w-[120px]" />
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
