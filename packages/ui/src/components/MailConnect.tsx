import { AccountSignIn, type AccountSignInProps } from "./AccountSignIn.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { mailIcons } from "./MailMessageRow.tsx";

export type MailConnectProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions" | "children" | "backLabel" | "onBack"> &
  Pick<AccountSignInProps, "state" | "onContinue" | "onCancel" | "onCheckAgain">;

/**
 * Email with no mailbox to read: the same Google sign-in, in the Email window. A connection that is Expired or Revoked
 * shows as ended, and one Google refused as mailDenied, so either reads as allowing email again; one that is Unavailable
 * or ConnectionFailed shows as failed, with Check again.
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
