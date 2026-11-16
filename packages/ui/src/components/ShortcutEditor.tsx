import type { FormEvent } from "react";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";
import { TextField } from "./TextField.tsx";

export type ShortcutEditorLabels = {
  name: string;
  address: string;
  addressNote: string;
  needsRepair: string;
  save: string;
  cancel: string;
  remove: string;
  removeNote: string;
  confirmRemove: string;
  keep: string;
};

export const shortcutEditorLabels: ShortcutEditorLabels = {
  name: "Shortcut name",
  address: "Website address",
  addressNote: "Only the website’s main address is saved, without private page details.",
  needsRepair: "This shortcut can’t open until its address is fixed.",
  save: "Save changes",
  cancel: "Cancel",
  remove: "Remove",
  removeNote: "Removing a shortcut does not disconnect an account or delete a receipt.",
  confirmRemove: "Yes, remove shortcut",
  keep: "Keep shortcut",
};

export type ShortcutEditorProps = Omit<DialogProps, "children"> & {
  /** The shortcut's name, as its heading. */
  title: string;
  name: string;
  onNameChange?: (name: string) => void;
  address: string;
  onAddressChange?: (address: string) => void;
  /** Its address no longer opens: it must be fixed. */
  needsRepair?: boolean;
  /** Why the last save was refused. */
  notice?: string;
  /** Asking before removing it. */
  removing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
  onConfirmRemove?: () => void;
  onKeep?: () => void;
  labels?: Partial<ShortcutEditorLabels>;
};

/**
 * Changing, fixing or removing a Home shortcut, opened by holding its tile, in the prototype's dialog.
 * @design packages/design-system/design.md#windows
 */
export function ShortcutEditor({ title, name, onNameChange, address, onAddressChange, needsRepair = false, notice, removing = false, onSave, onCancel, onRemove, onConfirmRemove, onKeep, labels, ...props }: ShortcutEditorProps) {
  const l = { ...shortcutEditorLabels, ...labels };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave?.();
  };
  return (
    <Dialog {...props}>
      <DialogContent className="gap-0">
        <DialogTitle>{title}</DialogTitle>
        {needsRepair && <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">{l.needsRepair}</p>}
        {removing ? (
          <>
            <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">{l.removeNote}</p>
            <DialogActions>
              <Button variant="warn" size="pill" onClick={onConfirmRemove}>
                {l.confirmRemove}
              </Button>
              <Button variant="capsule" size="pill" onClick={onKeep}>
                {l.keep}
              </Button>
            </DialogActions>
          </>
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
            <TextField label={l.name} value={name} maxLength={80} required onChange={(event) => onNameChange?.(event.target.value)} />
            <TextField label={l.address} value={address} required autoCapitalize="none" autoCorrect="off" onChange={(event) => onAddressChange?.(event.target.value)} />
            <p className="m-0 pl-[26px] text-body leading-[26px] font-medium text-muted-foreground">{l.addressNote}</p>
            {notice && <Alert variant="caution">{notice}</Alert>}
            <DialogActions className="mt-1">
              <Button type="submit" variant="prominent" size="pill">
                {l.save}
              </Button>
              <Button type="button" variant="capsule" size="pill" onClick={onCancel}>
                {l.cancel}
              </Button>
              <Button type="button" variant="plain" size="compact" onClick={onRemove}>
                {l.remove}
              </Button>
            </DialogActions>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
