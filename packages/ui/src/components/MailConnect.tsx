import { AccountSignIn, type AccountSignInProps } from "./AccountSignIn.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { mailIcons } from "./MailMessageRow.tsx";

export type MailConnectProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions" | "children" | "backLabel" | "onBack"> &
  Pick<AccountSignInProps, "state" | "onContinue" | "onCancel" | "onCheckAgain">;

/**
 * Email before there is a mailbox to read, or when reading it fails: the same Google sign-in that creates the Grace
 * account, in the Email window.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function MailConnect({ state, onContinue, onCancel, onCheckAgain, ...props }: MailConnectProps) {
  return (
    <AppWindow title="Email" icon={<mailIcons.mail size={26} strokeWidth={2} aria-hidden />} {...props}>
      <AccountSignIn state={state} onContinue={onContinue} onCancel={onCancel} onCheckAgain={onCheckAgain} />
    </AppWindow>
  );
}
