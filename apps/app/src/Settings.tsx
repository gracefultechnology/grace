// spec/app/shell.md, "Settings and rail popovers preserve the surface underneath"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation"; spec/app/accounts.md, "Story: Connect the email I already use"
import { Alert, Button, Dialog, DialogContent, DialogTitle, EmptyState, ListRow, PageHeading, PageText, RetryNotice, SettingsApp, type SettingsAppProps, SettingsBrightness, SettingsTextSize, SettingsVoice, Spinner, type SettingsPage as PageName } from "@repo/ui";
import { CircleAlert, Trash, X } from "lucide-react";
import type { ComponentProps } from "react";
import { voiceDisclosure } from "../gen/app__conversation.ts";
import { brightnessChoice, type DisplayPreferences, type Pace, type TextSize } from "../gen/app__preferences.ts";
import type { Setup } from "../gen/app__setup.ts";
import type { SettingsPage } from "../gen/app__shell.ts";
import { EmailAccounts } from "./EmailAccounts.tsx";
import { GraceAccountSettings } from "./GraceAccountSettings.tsx";
import { surfaceOwner } from "./managedReads.vibe";
import { retryPreferences } from "./preferences.vibe";
import { shallowEqual, useRuntime, useSetupSelector, useWebsiteRequests, useWorkspace } from "./useApp.ts";
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
const speedOptions = paceOptions.map((pace) => ({ value: pace, label: pace }));

const selectEmailCalendarSetup = (setup: Setup | undefined) => ({
  owner: surfaceOwner(setup, window.location.hash),
  connectedEmail: setup?.graceAccount.tag === "GraceSignedIn" && setup.googleLink.tag === "GoogleLinkConnected"
    ? setup.googleLink.email : undefined,
});

function EmailCalendarSettingsPage({ frame, choose }: { frame: Omit<SettingsAppProps, "children">; choose: (name: PageName) => void }) {
  const { owner, connectedEmail } = useSetupSelector(selectEmailCalendarSetup, shallowEqual);
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

function AboutSettingsPage() {
  const website = useWebsiteRequests();
  const clear = (confirmed: boolean) => {
    const event = { type: "answerClearBrowsingData", confirmed } as const;
    if (website.can(event)) void website.send(event);
  };
  return (
    <>
      <PageHeading>About this tablet</PageHeading>
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

/** @model spec/app/websiteRequests.md
 * @model spec/app/accounts.md */
export function Settings(props: Pick<ComponentProps<"div">, "inert" | "aria-hidden">) {
  const { workspace, can, send, guide } = useWorkspace();
  const runtime = useRuntime();
  if (!workspace) return null;
  const page = workspace.device.settingsPage;
  const preferences = workspace.preferences.session;
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
        <SettingsTextSize sizes={textSizeOptions} value={textSizes[preferences.textSize]}
          greeting="Good morning" eventWhen="SAT 10 am" eventTitle="Your appointment" graceMessage="Your appointment is tomorrow at 10 am."
          onValueChange={(value) => {
            const found = textSizeEntries.find((entry) => entry[1] === value);
            if (found) preview({ ...preferences, textSize: found[0] });
          }} />
      ) : page === "BrightnessSettings" ? (
        <SettingsBrightness brightness={preferences.brightness} onBrightnessChange={(value) => preview(brightnessChoice(preferences, value))}
          onBrightnessStep={(amount) => void send({ type: "adjustPreferenceLevel", levelStep: { tag: "BrightnessBy", amount } })}
          nightDim={preferences.nightDimming} nightDimHint="From 9 pm to 7 am, easier on the eyes"
          onNightDimChange={(nightDimming) => preview({ ...preferences, nightDimming })} />
      ) : page === "VoiceSettings" ? (
        <><SettingsVoice speeds={speedOptions} speed={preferences.pace}
          onSpeedChange={(value) => {
            if (value === "Slower" || value === "Normal" || value === "Faster") preview({ ...preferences, pace: value });
          }} speaks={preferences.voiceOutput} onSpeaksChange={(value) => preview({ ...preferences, voiceOutput: value })} wake="unavailable" />
          <PageText>{voiceDisclosure}</PageText></>
      ) : page === "NetworkSettings" ? (
        <Wifi />
      ) : page === "AboutSettings" ? (
        <AboutSettingsPage />
      ) : <EmptyState title="Nothing here yet." />}
    </SettingsApp>
  );
}
