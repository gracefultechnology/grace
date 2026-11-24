// spec/app/shell.md, "Settings and rail popovers preserve the surface underneath"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation"; spec/app/accounts.md, "Story: Connect the email I already use"
// spec/app/wake.md, "Settings and the sleep screen say when wake detection is unavailable"
import { Alert, Button, Dialog, DialogContent, DialogTitle, EmptyState, ListRow, PageHeading, PageText, RetryNotice, SettingsAbout, SettingsApp, type SettingsAppProps, SettingsBrightness, SettingsTextSize, SettingsVoice, Spinner, type SettingsPage as PageName, type WakeState } from "@repo/ui";
import { Effect } from "effect";
import { CircleAlert, Trash, X } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { voiceDisclosure } from "../gen/app__conversation.ts";
import { brightnessChoice, type DisplayPreferences, type Pace, type TextSize } from "../gen/app__preferences.ts";
import type { Setup } from "../gen/app__setup.ts";
import type { SettingsPage } from "../gen/app__shell.ts";
import { appointmentWeekday, type HostedAppointment, hostedAppointmentDisplay } from "./Calendar.tsx";
import { dayOf, relative } from "./calendar.vibe";
import { EmailAccounts } from "./EmailAccounts.tsx";
import { GraceAccountSettings } from "./GraceAccountSettings.tsx";
import { SpeechActions, type VoiceNotice } from "./graceSpeech.vibe";
import { surfaceOwner } from "./managedReads.vibe";
import { retryPreferences, sampleVoice } from "./preferences.vibe";
import { homeCalendar, shallowEqual, useAccounts, useCalendarKeys, useRuntime, useSetupSelector, useWakeStatus, useWebsiteRequests, useWorkspace, WithCalendars } from "./useApp.ts";
import { VoiceNoticeDialog } from "./VoiceNoticeDialog.tsx";
import { Wifi } from "./Wifi.tsx";

const names: Record<SettingsPage, PageName> = {
  TextSizeSettings: "text-size", BrightnessSettings: "brightness", VoiceSettings: "voice", NetworkSettings: "wifi", AccountSettings: "account", EmailCalendarSettings: "email-calendar", AboutSettings: "about",
};
const pages = Object.values(names);
const pageEntries = Object.entries(names) as [SettingsPage, PageName][];
const navTargets = new Map(pageEntries.map(([p, name]) => [`nav-${p}`, name]));

const textSizes: Readonly<Record<TextSize, string>> = { Smaller: "Smaller", StandardText: "Normal", Larger: "Larger", Largest: "Largest" };
const textSizeEntries = Object.entries(textSizes) as [TextSize, string][];
const textSizeOptions = Object.values(textSizes);
const paceOptions: readonly Pace[] = ["Slower", "Normal", "Faster"];
const sleepDevice = { type: "changeLifecycle", lifecycle: "SleepDevice" } as const;
const speedOptions = paceOptions.map((pace) => ({ value: pace, label: pace }));
const genericLocal = /^(?:owner|user|admin|test|info|mail|hello|support|noreply)$/i;

function firstNameFromEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const head = email.split("@")[0]?.split(/[._+-]/)[0]?.trim() ?? "";
  if (!/^[A-Za-z]{2,}$/.test(head) || genericLocal.test(head)) return undefined;
  return head[0].toUpperCase() + head.slice(1).toLowerCase();
}

const selectSettingsSetup = (setup: Setup | undefined) => ({
  owner: surfaceOwner(setup, window.location.hash),
  connectedEmail: setup?.graceAccount.tag === "GraceSignedIn" && setup.googleLink.tag === "GoogleLinkConnected"
    ? setup.googleLink.email : undefined,
  accountEmail: setup?.graceAccount.tag === "GraceSignedIn" && setup.graceAccount.email
    ? setup.graceAccount.email
    : setup?.googleLink.tag === "GoogleLinkConnected" && setup.googleLink.email
      ? setup.googleLink.email
      : undefined,
});

function EmailCalendarSettingsPage({ frame, choose }: { frame: Omit<SettingsAppProps, "children">; choose: (name: PageName) => void }) {
  const { owner, connectedEmail } = useSetupSelector(selectSettingsSetup, shallowEqual);
  if (owner === "Ours") return <EmailAccounts {...frame} />;
  return (
    <SettingsApp {...frame}>
      <PageHeading>Email &amp; calendar</PageHeading>
      {owner === "Undecided" ? <ListRow role="status" className="mt-6" leading={<Spinner size="lg" aria-hidden />} title="Getting your email and calendar…" /> : <>
        {connectedEmail && <PageText>{connectedEmail}</PageText>}
        <Button variant="prominent" size="pill" onClick={() => choose("account")}>Manage connections in Grace account</Button>
      </>}
    </SettingsApp>
  );
}

function TextSizePanel({ personName, owner, hostedAppointment, value, onChange }: { personName?: string; owner: ReturnType<typeof surfaceOwner>; hostedAppointment?: HostedAppointment; value: string; onChange: (value: string) => void }) {
  const { accounts } = useAccounts();
  const calKeys = useCalendarKeys();
  const [now] = useState(() => Date.now());
  const hour = new Date(now).getHours();
  const baseGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greeting = personName ? `${baseGreeting}, ${personName}` : baseGreeting;
  const fallback = { eventWhen: "SAT 10 am", eventTitle: "Your appointment", graceMessage: "Your appointment is tomorrow at 10 am." };
  if (owner === "Ours" && accounts) {
    return (
      <WithCalendars keys={calKeys}>{(calendars) => {
        const first = homeCalendar(accounts, calendars, now, undefined).events[0];
        const preview = first ? {
          eventWhen: `${first.weekday} ${first.time}`,
          eventTitle: first.title,
          graceMessage: first.weekday === "TODAY" ? `${first.title} is today at ${first.time}.` : `${first.title} is coming up at ${first.time}.`,
        } : fallback;
        return <SettingsTextSize sizes={textSizeOptions} value={value} greeting={greeting} {...preview} onValueChange={onChange} />;
      }}</WithCalendars>
    );
  }
  const hostedPreview = hostedAppointment ? (() => {
    const { date, time } = hostedAppointmentDisplay(hostedAppointment);
    const today = dayOf(now);
    const day = dayOf(date.getTime());
    const dayText = relative(day, today);
    const dayLabel = day === today ? "TODAY" : appointmentWeekday(date);
    const title = hostedAppointment.title || "Your appointment";
    return {
      eventWhen: `${dayLabel} ${time}`,
      eventTitle: title,
      graceMessage: hostedAppointment.isAllDay ? `${title} is ${dayText.toLowerCase()}.` : `${title} is ${dayText.toLowerCase()} at ${time}.`,
    };
  })() : fallback;
  return <SettingsTextSize sizes={textSizeOptions} value={value} greeting={greeting} {...hostedPreview} onValueChange={onChange} />;
}

function AboutSettingsPage() {
  const website = useWebsiteRequests();
  const clear = (confirmed: boolean) => {
    const event = { type: "answerClearBrowsingData", confirmed } as const;
    if (website.can(event)) void website.send(event);
  };
  return (
    <>
      <SettingsAbout device="Grace tablet · 0.1" status="Everything is up to date." />
      <ListRow className="mt-6" title="Clear browsing data" leading={<Trash size={26} strokeWidth={2} aria-hidden />}
        onClick={() => { if (website.can({ type: "requestClearBrowsingData" })) void website.send({ type: "requestClearBrowsingData" }); }} />
      {website.requests?.clearing === "ClearFailed" && (
        <Alert variant="destructive" icon={<CircleAlert />} className="mt-4 flex items-center gap-4 text-body font-bold">
          <span className="flex-1">Your browsing data wasn't cleared.</span>
          <Button variant="plain" size="compact-icon" aria-label="Close" onClick={() => { if (website.can({ type: "dismissClearFailed" })) void website.send({ type: "dismissClearFailed" }); }}><X aria-hidden /></Button>
        </Alert>
      )}
      <Dialog open={website.requests?.clearing === "ConfirmingClear"} onOpenChange={(open) => { if (!open) clear(false); }}>
        <DialogContent className="gap-0">
          <DialogTitle>Clear browsing data?</DialogTitle>
          <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">You will be signed out of every website.</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="warn" size="pill" className="w-full" onClick={() => clear(true)}>Clear</Button>
            <Button variant="capsule" size="pill" className="w-full" onClick={() => clear(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VoiceSettings({ preferences, preview, personName, sampleAllowed }: {
  preferences: DisplayPreferences;
  preview: (settings: DisplayPreferences) => void;
  personName?: string;
  sampleAllowed: boolean;
}) {
  const runtime = useRuntime();
  const status = useWakeStatus();
  const [notice, setNotice] = useState<VoiceNotice>();
  const wake: WakeState = !status.available ? "unavailable" : !preferences.wakeEnabled ? "off" :
    !status.disclosed ? "needsSetup" : !status.permitted ? "noMicrophone" : "on";
  const setUp = (acknowledged?: VoiceNotice) => {
    if (acknowledged) setNotice(undefined);
    runtime.runFork(Effect.flatMap(SpeechActions, (speech) =>
      Effect.tap(speech.setUpWake(acknowledged), (pending) => Effect.sync(() => setNotice(pending)))));
  };
  return <>
    <SettingsVoice speeds={speedOptions} speed={preferences.pace}
      onPlaySample={sampleAllowed ? () => void runtime.runPromise(sampleVoice(personName)) : undefined}
      onSpeedChange={(pace) => {
        if (pace === "Slower" || pace === "Normal" || pace === "Faster") preview({ ...preferences, pace });
      }}
      speaks={preferences.voiceOutput} onSpeaksChange={(voiceOutput) => preview({ ...preferences, voiceOutput })}
      wake={wake} onWakeChange={(wakeEnabled) => preview({ ...preferences, wakeEnabled })} onFixWake={() => setUp()} />
    <PageText className="mt-4">{voiceDisclosure}</PageText>
    <VoiceNoticeDialog notice={notice} continueWith={setUp} cancel={() => setNotice(undefined)} />
  </>;
}

/** @model spec/app/websiteRequests.md
 * @model spec/app/accounts.md */
export function Settings({ hostedAppointment, ...props }: Pick<ComponentProps<"div">, "inert" | "aria-hidden"> & { hostedAppointment?: HostedAppointment }) {
  const { workspace, can, send, guide } = useWorkspace();
  const runtime = useRuntime();
  const { owner, accountEmail } = useSetupSelector(selectSettingsSetup, shallowEqual);
  const { accounts } = useAccounts();
  if (!workspace) return null;
  const page = workspace.device.settingsPage;
  const preferences = workspace.preferences.session;
  const personName = firstNameFromEmail(accountEmail ?? accounts?.accounts[0]?.address);
  const preview = (settings: DisplayPreferences) => {
    const event = { type: "changePreferences", settings } as const;
    if (can(event)) void send(event);
  };
  const choose = (name: PageName) => {
    const found = pageEntries.find(([, pageName]) => pageName === name);
    if (!found) return;
    const event = { type: "chooseSettingsPage", page: found[0] } as const;
    if (can(event)) void send(event);
  };

  const frame: Omit<SettingsAppProps, "children"> = {
    pages,
    page: names[page],
    onPageChange: choose,
    guide: guide((target) => navTargets.get(target)),
    onClose: () => { if (can({ type: "returnToApplication" })) void send({ type: "returnToApplication" }); },
    ...props,
  };
  if (page === "EmailCalendarSettings") {
    return <EmailCalendarSettingsPage frame={frame} choose={choose} />;
  }

  return (
    <SettingsApp {...frame}>
      {workspace.preferences.saving === "SaveFailed" && <RetryNotice onRetry={() => void runtime.runPromise(retryPreferences())}>Your settings weren’t saved.</RetryNotice>}
      {page === "AccountSettings" ? <GraceAccountSettings /> : page === "TextSizeSettings" ? (
        <TextSizePanel personName={personName} owner={owner} hostedAppointment={hostedAppointment} value={textSizes[preferences.textSize]}
          onChange={(value) => {
            const found = textSizeEntries.find((entry) => entry[1] === value);
            if (found) preview({ ...preferences, textSize: found[0] });
          }} />
      ) : page === "BrightnessSettings" ? (
        <SettingsBrightness brightness={preferences.brightness} onBrightnessChange={(value) => preview(brightnessChoice(preferences, value))}
          onBrightnessStep={(amount) => void send({ type: "adjustPreferenceLevel", levelStep: { tag: "BrightnessBy", amount } })}
          nightDim={preferences.nightDimming} nightDimHint="From 9 pm to 7 am, easier on the eyes"
          onNightDimChange={(nightDimming) => preview({ ...preferences, nightDimming })} />
      ) : page === "VoiceSettings" ? (
        <>
          <VoiceSettings preferences={preferences} preview={preview} personName={personName} sampleAllowed={can({ type: "samplePreferences" })} />
          {can(sleepDevice) && <Button variant="capsule" size="pill" className="mt-4" onClick={() => void send(sleepDevice)}>Show sleep screen</Button>}
        </>
      ) : page === "NetworkSettings" ? (
        <Wifi />
      ) : page === "AboutSettings" ? (
        <AboutSettingsPage />
      ) : <EmptyState title="Nothing here yet." />}
    </SettingsApp>
  );
}
