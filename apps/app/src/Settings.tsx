// spec/app/shell.md, "Settings and rail popovers preserve the surface underneath"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation"; spec/app/accounts.md, "Story: Connect the email I already use"
import { Alert, Button, Dialog, DialogContent, DialogTitle, EmptyState, ListRow, PageHeading, PageText, RetryNotice, SettingsAbout, SettingsApp, SettingsBrightness, SettingsTextSize, SettingsVoice, Spinner, type SettingsPage as PageName } from "@repo/ui";
import { CircleAlert, Trash, X } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { voiceDisclosure } from "../gen/app__conversation.ts";
import { brightnessChoice, type DisplayPreferences, type Pace, type TextSize } from "../gen/app__preferences.ts";
import { useMachine as useSetup } from "../gen/app__setup.react.ts";
import type { SettingsPage } from "../gen/app__shell.ts";
import { calendarKeys, homeCalendar } from "./Calendar.tsx";
import { dayOf, relative } from "./calendar.vibe";
import { EmailAccounts } from "./EmailAccounts.tsx";
import { GraceAccountSettings } from "./GraceAccountSettings.tsx";
import { surfaceOwner } from "./managedReads.vibe";
import { retryPreferences, sampleVoice } from "./preferences.vibe";
import { startOf, useAccounts, useHomeCards, useRuntime, useWebsiteRequests, useWorkspace, WithCalendars } from "./useApp.ts";
import { Wifi } from "./Wifi.tsx";

const names: Record<SettingsPage, PageName> = {
  TextSizeSettings: "text-size", BrightnessSettings: "brightness", VoiceSettings: "voice", NetworkSettings: "wifi", AccountSettings: "account", EmailCalendarSettings: "email-calendar", AboutSettings: "about",
};
const pages = Object.values(names);
const navTargets = new Map((Object.keys(names) as SettingsPage[]).map((p) => [`nav-${p}`, names[p]]));

const textSizes: Readonly<Record<TextSize, string>> = { Smaller: "Smaller", StandardText: "Normal", Larger: "Larger", Largest: "Largest" };
const paceOptions: readonly Pace[] = ["Slower", "Normal", "Faster"];
const appointmentClock = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const appointmentDay = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const genericLocal = /^(?:owner|user|admin|test|info|mail|hello|support|noreply)$/i;

function firstNameFromEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const head = email.split("@")[0]?.split(/[._+-]/)[0]?.trim() ?? "";
  if (!/^[A-Za-z]{2,}$/.test(head) || genericLocal.test(head)) return undefined;
  return head[0].toUpperCase() + head.slice(1).toLowerCase();
}

function TextSizePanel({ personName, owner, value, onChange }: { personName?: string; owner: ReturnType<typeof surfaceOwner>; value: string; onChange: (value: string) => void }) {
  const { accounts } = useAccounts();
  const [now] = useState(() => Date.now());
  const cards = useHomeCards();
  const hour = new Date(now).getHours();
  const baseGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greeting = personName ? `${baseGreeting}, ${personName}` : baseGreeting;
  const fallback = { eventWhen: "SAT 10 am", eventTitle: "Your appointment", graceMessage: "Your appointment is tomorrow at 10 am." };
  if (owner === "Ours" && accounts) {
    return (
      <WithCalendars keys={calendarKeys(accounts)}>{(calendars) => {
        const first = homeCalendar(accounts, calendars, now, undefined).events[0];
        const preview = first ? {
          eventWhen: `${first.weekday} ${first.time}`,
          eventTitle: first.title,
          graceMessage: first.weekday === "TODAY" ? `${first.title} is today at ${first.time}.` : `${first.title} is coming up at ${first.time}.`,
        } : fallback;
        return <SettingsTextSize sizes={Object.values(textSizes)} value={value} greeting={greeting} {...preview} onValueChange={onChange} />;
      }}</WithCalendars>
    );
  }
  const hosted = cards?.events[0];
  const hostedPreview = hosted ? (() => {
    const when = startOf(hosted);
    const dayText = relative(dayOf(when.getTime()), dayOf(now));
    const dayLabel = dayOf(when.getTime()) === dayOf(now) ? "TODAY" : appointmentDay.format(when).toUpperCase();
    const timeText = hosted.isAllDay ? "All day" : appointmentClock.format(when);
    const title = hosted.title || "Your appointment";
    return {
      eventWhen: `${dayLabel} ${timeText}`,
      eventTitle: title,
      graceMessage: hosted.isAllDay ? `${title} is ${dayText.toLowerCase()}.` : `${title} is ${dayText.toLowerCase()} at ${timeText}.`,
    };
  })() : fallback;
  return <SettingsTextSize sizes={Object.values(textSizes)} value={value} greeting={greeting} {...hostedPreview} onValueChange={onChange} />;
}

/** @model spec/app/websiteRequests.md
 * @model spec/app/accounts.md */
export function Settings(props: Pick<ComponentProps<"div">, "inert" | "aria-hidden">) {
  const { workspace, can, send, guide } = useWorkspace();
  const website = useWebsiteRequests();
  const runtime = useRuntime();
  const setup = useSetup(runtime).state;
  const { accounts } = useAccounts();
  const page = workspace!.device.settingsPage;
  const preferences = workspace!.preferences.session;
  const owner = surfaceOwner(setup, window.location.hash);
  const accountEmail = setup?.graceAccount.tag === "GraceSignedIn" && setup.graceAccount.email
    ? setup.graceAccount.email
    : setup?.googleLink.tag === "GoogleLinkConnected" && setup.googleLink.email
      ? setup.googleLink.email
      : accounts?.accounts[0]?.address;
  const personName = firstNameFromEmail(accountEmail);
  const preview = (settings: DisplayPreferences) => {
    const event = { type: "changePreferences", settings } as const;
    if (can(event)) void send(event);
  };
  const choose = (name: PageName) => {
    const event = { type: "chooseSettingsPage", page: (Object.keys(names) as SettingsPage[]).find((p) => names[p] === name)! } as const;
    if (can(event)) void send(event);
  };
  const clear = (confirmed: boolean) => {
    const event = { type: "answerClearBrowsingData", confirmed } as const;
    if (website.can(event)) void website.send(event);
  };

  const frame = {
    pages, page: names[page], onPageChange: choose, guide: guide((target) => navTargets.get(target)),
    onClose: () => { if (can({ type: "returnToApplication" })) void send({ type: "returnToApplication" }); }, ...props,
  };
  if (page === "EmailCalendarSettings") {
    if (owner === "Ours") return <EmailAccounts {...frame} />;
    return <SettingsApp {...frame}>
      <PageHeading>Email &amp; calendar</PageHeading>
      {owner === "Undecided" ? <ListRow role="status" className="mt-6" leading={<Spinner size="lg" aria-hidden />} title="Getting your email and calendar…" /> : <>
        {setup?.graceAccount.tag === "GraceSignedIn" && setup.googleLink.tag === "GoogleLinkConnected" && <PageText>{setup.googleLink.email}</PageText>}
        <Button variant="prominent" size="pill" onClick={() => choose("account")}>Manage connections in Grace account</Button>
      </>}
    </SettingsApp>;
  }

  return (
    <SettingsApp {...frame}>
      {workspace!.preferences.saving === "SaveFailed" && <RetryNotice onRetry={() => void runtime.runPromise(retryPreferences())}>Your settings weren’t saved.</RetryNotice>}
      {page === "AccountSettings" ? <GraceAccountSettings /> : page === "TextSizeSettings" ? (
        <TextSizePanel personName={personName} owner={owner} value={textSizes[preferences.textSize]}
          onChange={(value) => {
            const found = Object.entries(textSizes).find((entry) => entry[1] === value);
            if (found && (found[0] === "Smaller" || found[0] === "StandardText" || found[0] === "Larger" || found[0] === "Largest"))
              preview({ ...preferences, textSize: found[0] });
          }} />
      ) : page === "BrightnessSettings" ? (
        <SettingsBrightness brightness={preferences.brightness} onBrightnessChange={(value) => preview(brightnessChoice(preferences, value))}
          onBrightnessStep={(amount) => void send({ type: "adjustPreferenceLevel", levelStep: { tag: "BrightnessBy", amount } })}
          nightDim={preferences.nightDimming} nightDimHint="From 9 pm to 7 am, easier on the eyes"
          onNightDimChange={(nightDimming) => preview({ ...preferences, nightDimming })} />
      ) : page === "VoiceSettings" ? (
        <><SettingsVoice speeds={paceOptions.map((pace) => ({ value: pace, label: pace }))} speed={preferences.pace}
          onPlaySample={can({ type: "samplePreferences" }) ? () => void runtime.runPromise(sampleVoice(personName)) : undefined}
          onSpeedChange={(value) => {
            if (value === "Slower" || value === "Normal" || value === "Faster") preview({ ...preferences, pace: value });
          }} speaks={preferences.voiceOutput} onSpeaksChange={(value) => preview({ ...preferences, voiceOutput: value })} wake="unavailable" />
          <PageText className="mt-4">{voiceDisclosure}</PageText></>
      ) : page === "NetworkSettings" ? (
        <Wifi />
      ) : page === "AboutSettings" ? (
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
      ) : <EmptyState title="Nothing here yet." />}
    </SettingsApp>
  );
}
