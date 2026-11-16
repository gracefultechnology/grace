import type { ReactNode } from "react";
import { LogOut, RotateCw } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Avatar } from "./Avatar.tsx";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "./Dialog.tsx";
import { ListRow } from "./ListRow.tsx";
import { appButton, appProminent } from "./MailActionStatus.tsx";
import { mailIcons } from "./MailMessageRow.tsx";
import { MailNotice } from "./MailNotice.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { Spinner } from "./Spinner.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type MailConnectState = "disconnected" | "authorizing" | "connected" | "readDenied" | "expired" | "failed" | "otherAccount";

export type MailConnectLabels = {
  title: string;
  connectHeading: string;
  connect: string;
  officialPage: string;
  waiting: string;
  waitingStatus: string;
  cancel: string;
  connected: string;
  provider: string;
  readDenied: string;
  expired: string;
  reconnect: string;
  failed: string;
  retry: string;
  otherAccount: string;
  keep: string;
  disconnect: string;
  confirmTitle: (account: string) => string;
  confirmLine: string;
  confirmKeep: string;
};

const connectLabels: MailConnectLabels = {
  title: "Email",
  connectHeading: "Connect your email",
  connect: "Connect Gmail",
  officialPage: "You sign in on Google’s own page. Grace never sees your password.",
  waiting: "Finish on Google’s page",
  waitingStatus: "Waiting for Google",
  cancel: "Cancel",
  connected: "Connected to Gmail",
  provider: "Gmail",
  readDenied: "Google didn’t allow Grace to read this email. Connect again and allow reading.",
  expired: "Email access ended. Reconnect to read your email.",
  reconnect: "Reconnect",
  failed: "Your email couldn’t be checked. Try again.",
  retry: "Try again",
  otherAccount: "Is this your Gmail?",
  keep: "Keep",
  disconnect: "Disconnect",
  confirmTitle: (account) => `Disconnect ${account}?`,
  confirmLine: "Grace will stop reading this email. Your emails stay in Gmail.",
  confirmKeep: "Keep it",
};

export type MailConnectProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions" | "children" | "backLabel" | "onBack"> & {
  /** Where the connection stands. */
  state: MailConnectState;
  /** The Gmail address Google returned, once there is one. */
  account?: string;
  /** Starts signing in on Google's page; in `otherAccount`, keeps the account Google returned. */
  onConnect?: () => void;
  /** Stops waiting for Google. */
  onCancel?: () => void;
  /** Signs in again after access ended or reading was refused. */
  onReconnect?: () => void;
  /** Checks the connection again after it failed. */
  onRetry?: () => void;
  /** Disconnect was tapped: the question opens. */
  onDisconnect?: () => void;
  /** The person confirmed disconnecting. */
  onConfirmDisconnect?: () => void;
  /** Whether the disconnect question is open, when the app controls it. */
  disconnectOpen?: boolean;
  onDisconnectOpenChange?: (open: boolean) => void;
  /** The words, for another language. */
  labels?: Partial<MailConnectLabels>;
};

/**
 * Email before there is a mailbox to read, and when access fails: Connect Gmail on Google's own page, waiting for it,
 * the account connected, or what went wrong with the one action that fixes it. Disconnect asks once.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailConnect({
  state,
  account,
  onConnect,
  onCancel,
  onReconnect,
  onRetry,
  onDisconnect,
  onConfirmDisconnect,
  disconnectOpen,
  onDisconnectOpenChange,
  labels,
  ...props
}: MailConnectProps) {
  const l = { ...connectLabels, ...labels };
  const disconnect = account && (
    <Dialog open={disconnectOpen} onOpenChange={onDisconnectOpenChange}>
      <DialogTrigger asChild>
        <Button variant="warn" size="pill" className={appButton} onClick={onDisconnect}>
          <LogOut {...pill} />
          {l.disconnect}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="gap-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogTitle>{l.confirmTitle(account)}</DialogTitle>
        <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">{l.confirmLine}</p>
        <DialogActions>
          <Button variant="warn" size="pill" className={appButton} onClick={onConfirmDisconnect}>
            <LogOut {...pill} />
            {l.disconnect}
          </Button>
          <DialogClose asChild>
            <Button variant="capsule" size="pill" className={appButton}>
              {l.confirmKeep}
            </Button>
          </DialogClose>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
  const accountRow = (subtitle = l.provider, trailing?: ReactNode) =>
    account && <ListRow className="w-full max-w-[760px]" leading={<Avatar name={account} aria-hidden />} title={account} subtitle={subtitle} trailing={trailing} />;
  const page: Record<MailConnectState, ReactNode> = {
    disconnected: (
      <>
        <PageHeading>{l.connectHeading}</PageHeading>
        <PageText tone="secondary" className="mt-2">{l.officialPage}</PageText>
        <Button variant="prominent" size="pill" className={cn(appProminent, "mt-6")} onClick={onConnect}>
          <mailIcons.mail {...pill} />
          {l.connect}
        </Button>
      </>
    ),
    authorizing: (
      <>
        <div className="flex items-center gap-4">
          <Spinner size="lg" label={l.waitingStatus} />
          <PageHeading>{l.waiting}</PageHeading>
        </div>
        <PageText tone="secondary" className="mt-2">{l.officialPage}</PageText>
        <Button variant="capsule" size="pill" className={cn(appButton, "mt-6")} onClick={onCancel}>
          {l.cancel}
        </Button>
      </>
    ),
    connected: accountRow(l.connected, disconnect),
    readDenied: (
      <>
        <MailNotice className="mb-5 w-full max-w-[760px]">{l.readDenied}</MailNotice>
        {accountRow()}
        <Button variant="prominent" size="pill" className={cn(appProminent, "mt-6")} onClick={onReconnect}>
          <RotateCw {...pill} />
          {l.reconnect}
        </Button>
      </>
    ),
    expired: (
      <>
        <MailNotice actionLabel={l.reconnect} onAction={onReconnect} className="mb-5 w-full max-w-[760px]">
          {l.expired}
        </MailNotice>
        {accountRow()}
      </>
    ),
    failed: (
      <>
        <MailNotice actionLabel={l.retry} onAction={onRetry} className="mb-5 w-full max-w-[760px]">
          {l.failed}
        </MailNotice>
        {accountRow()}
      </>
    ),
    otherAccount: (
      <>
        <PageHeading className="mb-5">{l.otherAccount}</PageHeading>
        {accountRow()}
        <div className="mt-6 flex gap-3">
          <Button variant="prominent" size="pill" className={appProminent} onClick={onConnect}>
            {l.keep}
          </Button>
          {disconnect}
        </div>
      </>
    ),
  };
  return (
    <AppWindow title={l.title} icon={<mailIcons.mail size={26} strokeWidth={2} aria-hidden />} {...props}>
      <section aria-busy={state === "authorizing" || undefined} className="flex flex-col items-start font-sans">
        {page[state]}
      </section>
    </AppWindow>
  );
}
