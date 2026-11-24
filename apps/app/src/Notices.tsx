// spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "Story: See what needs me on Home"; spec/app/notices.md, "Home shows one banner, for the first cause: no Wi-Fi, a signed-out account, no email, then a reminder"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"
import { Banner, BellIcon, Button, MailIcon, Toast, WifiSlash } from "@repo/ui";
import { Effect, Exit } from "effect";
import { CircleAlert, Wifi, X } from "lucide-react";
import { type Notice, bannerOf, isBackOnline } from "../gen/app__notices.ts";
import { useMachine } from "../gen/app__notices.react.ts";
import type { Setup } from "../gen/app__setup.ts";
import { enabled, type Workspace } from "../gen/app__workspace.ts";
import { surfaceOwner } from "./managedReads.vibe";
import { NoticeHost, Reply } from "./notices.vibe";
import { OverPage } from "./PageLayer.tsx";
import { type HomeReminderNotice, type HomeReminders, reminderNotice, useAccounts, useCalendarActions, useCalendarKeys, useMinute, useRuntime, useSetupSelector, useWorkspaceActions, useWorkspaceSelector, WithCalendars } from "./useApp.ts";

export type ReminderNotice = HomeReminderNotice;
export type Reminders = HomeReminders;

const words = (notice: Notice, told?: ReminderNotice) => (isBackOnline(notice) ? "Back online" : notice.offer === "SeeDetails" ? `Reminder: ${told?.toast ?? notice.subject}` : notice.subject);
const toastButton = "h-11 px-3.5 text-body font-bold text-frame-lilac bg-glass/14 active:bg-glass/24";
const wifiSettings = { type: "chooseSettingsPage", page: "NetworkSettings" } as const;
const emailSettings = { type: "chooseSettingsPage", page: "EmailCalendarSettings" } as const;
const visitCalendar = { type: "visit", destination: "Calendar" } as const;

const selectCanOpenWifi = (workspace: Workspace | undefined) => workspace !== undefined && enabled(workspace, wifiSettings, "Person");
const selectCanOpenEmailSettings = (workspace: Workspace | undefined) => workspace !== undefined && enabled(workspace, emailSettings, "Person");
const selectReminderVisit = (workspace: Workspace | undefined) =>
  workspace !== undefined && (workspace.device.surface === "Calendar" || enabled(workspace, visitCalendar, "Person"));
const selectOurs = (setup: Setup | undefined) => surfaceOwner(setup, window.location.hash) === "Ours";

function useNotices() {
  const runtime = useRuntime();
  const { state, can } = useMachine(runtime);
  const host = (use: (host: NoticeHost["Service"]) => Effect.Effect<void>) => () => void runtime.runPromise(Effect.flatMap(Effect.service(NoticeHost), use));
  return { state, can, host };
}

type ToastViewProps = {
  above: number;
  toast: Notice;
  canAct: boolean;
  canClose: boolean;
  told?: ReminderNotice;
  onAct: () => void;
  onClose: () => void;
};

function ToastView({ above, toast, canAct, canClose, told, onAct, onClose }: ToastViewProps) {
  const actable = canAct && (told?.seeDetails ?? true);
  return (
    <OverPage className="absolute left-1/2 z-[45] -translate-x-1/2" style={{ bottom: above + 24 }}>
      <Toast key={toast.id} onUndo={toast.offer === "Undo" && actable ? onAct : undefined}>
        {words(toast, told)}
        {toast.offer === "SeeDetails" && actable && (
          <Button variant="plain" size="compact" className={toastButton} onClick={onAct}>
            See details
          </Button>
        )}
        {canClose && (told?.dismiss ?? true) && (
          <Button variant="plain" size="compact" aria-label="Close" className={toastButton} onClick={onClose}>
            <X aria-hidden size={20} strokeWidth={2.4} />
          </Button>
        )}
      </Toast>
    </OverPage>
  );
}

function ReminderToast(props: Omit<ToastViewProps, "told">) {
  const { accounts } = useAccounts();
  const keys = useCalendarKeys();
  const ours = useSetupSelector(selectOurs);
  const visiting = useWorkspaceSelector(selectReminderVisit);
  const calendarActions = useCalendarActions();
  const now = useMinute();
  if (!accounts || !ours) return <ToastView {...props} />;
  return (
    <WithCalendars keys={keys}>
      {(calendars) => <ToastView {...props} told={reminderNotice(accounts, calendars, now.getTime(), calendarActions, visiting)(props.toast.subject)} />}
    </WithCalendars>
  );
}

export function Notices({ above }: { above: number }) {
  const { state, can, host } = useNotices();
  const toast = state?.shown.at(0);
  if (toast === undefined) return null;
  const canAct = can({ type: "act", id: toast.id }, "Person");
  const canClose = can({ type: "closeToast", id: toast.id }, "Person");
  const onAct = host((h) => h.act(toast.id));
  const onClose = host((h) => h.close(toast.id));
  if (toast.offer === "SeeDetails") {
    return <ReminderToast above={above} toast={toast} canAct={canAct} canClose={canClose} onAct={onAct} onClose={onClose} />;
  }
  return <ToastView above={above} toast={toast} canAct={canAct} canClose={canClose} onAct={onAct} onClose={onClose} />;
}

function OfflineBanner() {
  const canFixWifi = useWorkspaceSelector(selectCanOpenWifi);
  const { send } = useWorkspaceActions();
  return (
    <Banner icon={<WifiSlash size={30} />} title="Not connected to the internet" line="Grace can help you reconnect."
      actions={<Button variant="prominent" size="compact" disabled={!canFixWifi} onClick={() => void send(wifiSettings)}><Wifi aria-hidden size={22} strokeWidth={2.2} />Fix Wi-Fi</Button>} />
  );
}

function SignInBanner({ name }: { name: string }) {
  const { accounts, can, send } = useAccounts();
  const canOpen = useWorkspaceSelector(selectCanOpenEmailSettings);
  const workspace = useWorkspaceActions();
  const account = accounts?.accounts.find((a) => (a.name || a.address) === name);
  const signIn = account === undefined ? undefined : ({ type: "signInAgain", id: account.id } as const);
  const ready = signIn !== undefined && can(signIn) && canOpen;
  return (
    <Banner icon={<CircleAlert aria-hidden size={30} strokeWidth={2.2} className="text-warn" />} title={`${name} needs you to sign in`} line="Until you do, new email and appointments won’t come in."
      actions={<Button variant="prominent" size="compact" disabled={!ready}
        onClick={() => { if (signIn !== undefined) void send(signIn).then((exit) => { if (Exit.isSuccess(exit)) void workspace.send(emailSettings); }); }}>Sign in</Button>} />
  );
}

function AddEmailBanner() {
  const canOpen = useWorkspaceSelector(selectCanOpenEmailSettings);
  const { send } = useWorkspaceActions();
  return (
    <Banner icon={<MailIcon size={30} strokeWidth={2} />} title="Add your email" line="Then your messages, appointments and photos show up here."
      actions={<Button variant="prominent" size="compact" disabled={!canOpen} onClick={() => void send(emailSettings)}>Add email</Button>} />
  );
}

export function NoticeBanner({ reminders }: { reminders?: Reminders }) {
  const { state, host } = useNotices();
  if (state === undefined) return null;
  const banner = bannerOf(state);
  switch (banner.kind) {
    case "NoBanner":
      return null;
    case "OfflineBanner":
      return <OfflineBanner />;
    case "SignInBanner":
      return <SignInBanner name={banner.subject} />;
    case "AddEmailBanner":
      return <AddEmailBanner />;
    case "ReminderBanner": {
      const told = reminders?.(banner.subject);
      return (
        <Banner icon={<span className="flex text-alert"><BellIcon className="size-7.5" /></span>} title={told?.title ?? banner.subject} line={told?.line}
          actions={<>
            {(told?.seeDetails ?? true) && <Button variant="prominent" size="compact" onClick={host((h) => h.reply(Reply.SeeDetails({ reminder: banner.subject })))}>See details</Button>}
            <Button variant="plain" size="compact-icon" aria-label="Dismiss" disabled={!(told?.dismiss ?? true)} onClick={host((h) => h.reply(Reply.Dismiss({ reminder: banner.subject })))}><X aria-hidden size={24} strokeWidth={1.75} /></Button>
          </>} />
      );
    }
  }
}
