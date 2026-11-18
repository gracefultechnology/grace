import { Trash2 } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";
import { PageText } from "./PageHeading.tsx";

export type RemoveAccountDialogProps = Omit<DialogProps, "children"> & {
  /** The email's name on the tablet: "Gmail", "Riverview". */
  name: string;
  /** Who keeps her emails: the company, or for Other email its name. */
  keeper: string;
  /** Emails still waiting in Outbox to go from this email: it cannot be removed until they have gone. */
  waiting?: number;
  /** Called by Remove from tablet; this is her approval. */
  onRemove?: () => void;
  /** Called by Keep it. */
  onKeep?: () => void;
  className?: string;
};

/**
 * The question before an email leaves the tablet: what goes and what stays safe, or why it has to wait for Outbox
 * (prototype `acDlg()`).
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function RemoveAccountDialog({ name, keeper, waiting = 0, onRemove, onKeep, className, ...props }: RemoveAccountDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className={cn("gap-0", className)}>
        <DialogTitle>Remove {name} from this tablet?</DialogTitle>
        {waiting > 0 ? (
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
          {waiting === 0 && (
            <Button variant="warn" size="pill" onClick={onRemove}>
              <Trash2 size={22} strokeWidth={2.2} aria-hidden />
              Remove from tablet
            </Button>
          )}
          <Button variant="capsule" size="pill" onClick={onKeep}>Keep it</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
