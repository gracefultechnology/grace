import { Trash2 } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";
import { PageText } from "./PageHeading.tsx";

export type RemoveAccountDialogProps = Omit<DialogProps, "children"> & {
  /** The email's name on the tablet: "Gmail", "Riverview". */
  name: string;
  /** Who keeps her emails: the company, or for Other email its name. */
  keeper: string;
  /** Emails still waiting in Outbox to go from this email: Remove from tablet waits until they have gone. */
  waiting?: number;
  /** How many waiting emails she is asked to discard, after Remove anyway; 0 while she is not asked. */
  discarding?: number;
  /** Called by Remove from tablet; this is her approval. Without it Remove from tablet is shown disabled. */
  onRemove?: () => void;
  /** Called by Remove anyway while email waits; without it Remove anyway is not offered. */
  onRemoveAnyway?: () => void;
  /** Called by Discard and remove; this is her approval to discard the waiting email. Without it the button is shown disabled. */
  onDiscard?: () => void;
  /** Called by Keep it, which also closes the dialog through `onOpenChange`. */
  onKeep?: () => void;
  className?: string;
};

/**
 * The question before an email leaves the tablet: what goes and what stays safe, or why it has to wait for Outbox and,
 * after Remove anyway, how much waiting email would be discarded (prototype `acDlg()`).
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function RemoveAccountDialog({ name, keeper, waiting = 0, discarding = 0, onRemove, onRemoveAnyway, onDiscard, onKeep, className, ...props }: RemoveAccountDialogProps) {
  const counted = discarding === 1 ? "1 email" : `${discarding} emails`;
  return (
    <Dialog {...props}>
      <DialogContent className={cn("gap-0", className)}>
        <DialogTitle>Remove {name} from this tablet?</DialogTitle>
        {discarding > 0 ? (
          <>
            <PageText className="mt-3.5">
              {discarding === 1 ? "The pending email" : `The ${discarding} pending emails`} will be removed from this tablet. This can’t be undone.
            </PageText>
            <PageText tone="secondary" className="mt-3">An email {keeper} has already received to send can still arrive.</PageText>
          </>
        ) : waiting > 0 ? (
          <PageText className="mt-3.5">
            {waiting === 1 ? "An email is" : `${waiting} emails are`} waiting in Outbox to go from {name}. You can remove {name} once {waiting === 1 ? "it has" : "they have"} gone.
          </PageText>
        ) : (
          <>
            <PageText className="mt-3.5">
              Your emails stay safe with {keeper}. Only the tablet’s copy goes, so its emails, appointments and contacts leave Email and Calendar here.
            </PageText>
            <PageText tone="secondary" className="mt-3">You can connect it again any time.</PageText>
          </>
        )}
        <DialogActions>
          {discarding > 0 && (
            <Button variant="warn" size="pill" disabled={!onDiscard} onClick={onDiscard}>
              <Trash2 size={22} strokeWidth={2.2} aria-hidden />
              Discard {counted} and remove
            </Button>
          )}
          {discarding === 0 && waiting > 0 && onRemoveAnyway && (
            <Button variant="warn" size="pill" onClick={onRemoveAnyway}>Remove anyway</Button>
          )}
          {discarding === 0 && waiting === 0 && (
            <Button variant="warn" size="pill" disabled={!onRemove} onClick={onRemove}>
              <Trash2 size={22} strokeWidth={2.2} aria-hidden />
              Remove from tablet
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="capsule" size="pill" onClick={onKeep}>Keep it</Button>
          </DialogClose>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
