import type { ComponentProps, ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "./Dialog.tsx";
import { PageText } from "./PageHeading.tsx";

export type BrowserDialogProps = {
  /** The question or notice, the dialog's accessible name. */
  title: string;
  /** A Lucide icon (28px) on a tile before the title. */
  icon?: ReactNode;
  /** `caution` puts the icon on the caution tile, for what did not happen or was stopped. */
  tone?: "plain" | "caution";
  /** Called by Escape. A tap outside never answers. */
  onEscape?: () => void;
  /** The dialog is showing. */
  open?: boolean;
  /** What is said between the title and the buttons. */
  children?: ReactNode;
  /** The buttons, the one next step first, each the dialog's full width. */
  actions: ReactNode;
  className?: string;
};

/**
 * The frame of the browser's questions and notices: the prototype's `.a-dlg` over `.a-scrim`, an icon tile
 * beside the title, the words, then a column of buttons. A part of `BrowserNoticeDialog`, shared by the
 * website's requests.
 * @design packages/design-system/design.md#windows
 */
export function BrowserDialog({ title, icon, tone = "plain", onEscape, open = true, children, actions, className }: BrowserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onEscape?.()}>
      {/* Prototype `.a-dlg` with the icon tile and 28/34 title of `trustDlg()`: 560px plus its 32px padding; a tap on the scrim answers nothing. */}
      <DialogContent className={cn("gap-0", className)} onPointerDownOutside={(event) => event.preventDefault()}>
        <div className="flex items-center gap-3.5">
          {icon ? (
            <span aria-hidden className={cn("flex size-14 flex-none items-center justify-center rounded-xl", tone === "caution" ? "bg-caution text-destructive" : "bg-panel text-primary")}>
              {icon}
            </span>
          ) : null}
          <DialogTitle className="text-title leading-[34px]">{title}</DialogTitle>
        </div>
        {children}
        <DialogActions>{actions}</DialogActions>
      </DialogContent>
    </Dialog>
  );
}

export type BrowserDialogTextProps = ComponentProps<"p">;

/** The description under a dialog's plain title (prototype `calDlg()`: `.a-b` at 22/30 in the secondary ink). */
export function BrowserDialogText({ className, ...props }: BrowserDialogTextProps) {
  return <p className={cn("m-0 mt-3.5 text-body-lg leading-[30px] text-muted-foreground", className)} {...props} />;
}

export type BrowserNoticeDialogProps = {
  /** What did not happen: "Android didn’t allow the camera", "Maps didn’t open". */
  title: string;
  /** A plain explanation of it. */
  message?: string;
  /** Called by the notice's button and by Escape; the notice stays until then. */
  onClose: () => void;
  /** The words on the close button. */
  closeLabel?: string;
  /** The words on a second, prominent button that tries again, such as "Try again". */
  actionLabel?: string;
  /** Called by the second button. */
  onAction?: () => void;
  /** The notice is showing. */
  open?: boolean;
  className?: string;
};

/**
 * A notice that stays until it is closed: what the browser could not do, such as Android not allowing the
 * camera, an app or picker that did not open, a link this tablet cannot open, or browsing data not cleared.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function BrowserNoticeDialog({ title, message, onClose, closeLabel = "Close", actionLabel, onAction, open = true, className }: BrowserNoticeDialogProps) {
  const retry = actionLabel && onAction;
  return (
    <BrowserDialog
      open={open}
      title={title}
      tone="caution"
      icon={<TriangleAlert size={28} strokeWidth={2} />}
      onEscape={onClose}
      className={className}
      actions={
        <>
          {retry && (
            <Button variant="prominent" size="pill" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          <Button variant={retry ? "capsule" : "prominent"} size="pill" onClick={onClose}>
            {closeLabel}
          </Button>
        </>
      }
    >
      {message && <PageText className="mt-3.5">{message}</PageText>}
    </BrowserDialog>
  );
}
