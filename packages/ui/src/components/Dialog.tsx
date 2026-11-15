import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type DialogProps = ComponentProps<typeof DialogPrimitive.Root>;
export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /** The accessible name of a ✕ close button; without it there is none, as on the prototype's dialogs, and a `DialogClose` in the content dismisses it. */
  closeLabel?: string;
};
export type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title>;

/** A modal task: holds a `DialogTrigger` and a `DialogContent`. */
export function Dialog(props: DialogProps) {
  return <DialogPrimitive.Root {...props} />;
}

/** Opens the dialog; pass `asChild` to use a `Button`. */
export const DialogTrigger = DialogPrimitive.Trigger;

/** Closes the dialog; pass `asChild` to use a `Button`. */
export const DialogClose = DialogPrimitive.Close;

/**
 * The white panel over a dimmed screen (prototype `.a-dlg` over `.a-scrim`: 560px of content and 32px padding). Needs a `DialogTitle`; Escape dismisses it.
 * @design packages/design-system/design.md#windows
 */
export function DialogContent({ closeLabel, className, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-scrim/32" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn("fixed top-1/2 left-1/2 box-border flex w-[calc(100%-2rem)] max-w-[624px] -translate-1/2 flex-col gap-2 rounded-screen bg-card p-8 text-foreground shadow-dialog outline-none", className)}
        {...props}
      >
        {children}
        {closeLabel && <DialogPrimitive.Close aria-label={closeLabel} className={cn(focusRing, "absolute top-5 right-5 flex size-12 cursor-pointer items-center justify-center rounded-full text-chrome hover:bg-primary/8")}>
          <X aria-hidden size={24} strokeWidth={1.75} />
        </DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** The dialog's heading and accessible name (prototype `.a-h`). */
export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <DialogPrimitive.Title className={cn("text-title-lg leading-[38px] font-bold text-chrome", className)} {...props} />;
}
