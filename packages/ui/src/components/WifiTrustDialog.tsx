import { Check, Wifi } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogContentProps } from "./Dialog.tsx";
import { Panel } from "./Panel.tsx";
import { PageText } from "./PageHeading.tsx";

export type WifiTrustDialogProps = Omit<DialogContentProps, "title"> & {
  /** The network asking to be trusted. */
  network: string;
  /** Who issued the network's security certificate, such as "wifi.sunrisecommunity.org". */
  issuer: string;
  /** The dialog is showing. */
  open?: boolean;
  /** Called by "Trust and join". */
  onTrust?: () => void;
  /** Called by "Ask Grace". */
  onAskGrace?: () => void;
  /** Called by Cancel, ✕ and Escape. */
  onCancel?: () => void;
  title?: string;
  /** Why it asks, under the title. */
  description?: string;
  issuerLabel?: string;
  /** The advice before the buttons. */
  advice?: string;
  trustLabel?: string;
  askGraceLabel?: string;
  cancelLabel?: string;
};

/**
 * Asks before the tablet trusts a network's security certificate; nothing is trusted until a person says so
 * (prototype `trustDlg()`).
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiTrustDialog({
  network,
  issuer,
  open = true,
  onTrust,
  onAskGrace,
  onCancel,
  title = "Trust this network?",
  description = `${network} is asking the tablet to trust its security certificate. This keeps your password private on this network.`,
  issuerLabel = "Certificate from",
  advice = `Only trust it if you are at ${network} now. If you’re not sure, ask Grace.`,
  trustLabel = "Trust and join",
  askGraceLabel = "Ask Grace",
  cancelLabel = "Cancel",
  className,
  ...props
}: WifiTrustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel?.()}>
      <DialogContent className={cn("gap-0", className)} {...props}>
        <div className="flex items-center gap-3.5">
          <span className="flex size-14 flex-none items-center justify-center rounded-xl bg-panel text-primary">
            <Wifi size={28} strokeWidth={2} aria-hidden />
          </span>
          <DialogTitle className="text-title leading-[34px]">{title}</DialogTitle>
        </div>
        <PageText className="mt-3.5">{description}</PageText>
        <Panel className="mt-3.5 px-5 py-4">
          <PageText tone="secondary">{issuerLabel}</PageText>
          <div className="text-body-lg leading-[30px] font-bold text-chrome">{issuer}</div>
        </Panel>
        <PageText tone="secondary" className="mt-3.5">{advice}</PageText>
        <DialogActions>
          <Button variant="prominent" size="pill" onClick={onTrust}>
            <Check size={22} strokeWidth={2.4} aria-hidden />
            {trustLabel}
          </Button>
          <Button variant="capsule" size="pill" onClick={onAskGrace}>{askGraceLabel}</Button>
          <Button variant="capsule" size="pill" onClick={onCancel}>{cancelLabel}</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
