// spec/app/index.md, "Story: Manage my saved passwords privately"
// spec/app/shell.md, "Story: Reach everyday tasks from Home"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"; spec/app/workspace.md, "Home, native controls and Close have explicit interruption semantics"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"
// The tablet: the rail, the selected surface right of it, and Grace's window over both.
import { AppWindow, AskGraceButton, besideRail, Button, HomeScreen, Rail, RailButton, RailPopover, SleepScreen, Slider, TextScale, WifiSlash, cn } from "@repo/ui";
import { Effect, Stream } from "effect";
import { CalendarDays, House, KeyRound, Mail, Settings as Gear, Volume2, VolumeX, Wifi } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type BackAction, backAction, declineChoice } from "../gen/app__deviceKeys.ts";
import { muteChoice, textScalePercent, volumeChoice } from "../gen/app__preferences.ts";
import type { Connectivity, RailPopover as Popover, Surface } from "../gen/app__shell.ts";
import { type Event as WebsiteEvent, type WebsiteRequests, presented } from "../gen/app__websiteRequests.ts";
import { canChangeLifecycle, privateSurfaceActive, type Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import { Browser } from "./Browser.tsx";
import { useMachine as useSetup } from "../gen/app__setup.react.ts";
import { ManagedReads, usesManagedSurfaces } from "./managedReads.vibe";
import { ManagedRead } from "./ManagedRead.tsx";
import { Files, useFilesHome } from "./Files.tsx";
import { mailAccounts } from "../gen/app__accounts.ts";
import { Calendar, calendarKeys, homeCalendar, nextAppointment } from "./Calendar.tsx";
import { Email, homeMail } from "./Email.tsx";
import { Grace } from "./Grace.tsx";
import { NoticeBanner, Notices } from "./Notices.tsx";
import { OverPage, PageBackdrop, PageMeasurer } from "./PageLayer.tsx";
import { PasswordsApp } from "./PasswordsApp.tsx";
import { Settings } from "./Settings.tsx";
import { RuntimeContext, type Runtime, useAccounts, useRuntime, useKeyboardHeight, useMailContent, useWebsiteRequests, useWorkspace, WithCalendars, WithMailboxes } from "./useApp.ts";

// spec/app/deviceKeys.md, "Each Back action is one event its guard allows": the two that end what websites ask,
const websiteBackEvents: Record<"CancelClearData" | "DismissWebsiteRequest", (r: WebsiteRequests) => WebsiteEvent> = {
  CancelClearData: () => ({ type: "answerClearBrowsingData", confirmed: false }),
  DismissWebsiteRequest: (r) => ({ type: "answer", id: presented(r).id, choice: declineChoice(presented(r).ask) }),
};
// and the workspace's.
const backEvents: Record<Exclude<BackAction, "Unconsumed" | keyof typeof websiteBackEvents>, WorkspaceEvent> = {
  DismissPopover: { type: "dismissPopover" },
  DismissAddress: { type: "changePage", browserInput: { tag: "DismissAddress" } },
  DismissKeyboard: { type: "interact", input: { tag: "DismissKeyboard" } },
  CollapseGrace: { type: "interact", input: { tag: "Resize", expanded: false } },
  PageBack: { type: "changePage", browserInput: { tag: "Back" } },
  GoHome: { type: "visit", destination: "Home" },
  ShowMainCards: { type: "chooseHomePage", page: "MainCards" },
};

/** A window right of the rail, 6px from the screen's edges (design.md, "Windows"); its bottom follows Grace's compact window and the keyboard (prototype `layout()`). */
const lifted = "absolute top-1.5 right-1.5 transition-[bottom] duration-window ease-standard motion-reduce:transition-none";
/** What expanded Grace covers is out of reach, for touch and for assistive technology. */
const homeUpdates = Stream.unwrap(Effect.map(ManagedReads, (managed) => managed.home));
const appointmentClock = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const appointmentDay = new Intl.DateTimeFormat(undefined, { weekday: "short" });

function useHomeCards() {
  const runtime = useRuntime();
  const account = useSetup(runtime).state;
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(homeUpdates, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  return useSyncExternalStore(subscribe, () => {
    if (account?.graceAccount.tag !== "GraceSignedIn" || account.googleLink.tag !== "GoogleLinkConnected") return undefined;
    const snapshot = runtime.runSync(Effect.flatMap(ManagedReads, (managed) => managed.homeCards()));
    return snapshot?.accountId === account.graceAccount.accountId && snapshot.grant === account.googleLink.grant ? snapshot : undefined;
  });
}

const under = (covered: boolean) => (covered ? { inert: true, "aria-hidden": true } as const : {});

/** The time now, to the minute. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setTimeout(() => setNow(new Date()), 60_000 - (Date.now() % 60_000));
    return () => clearTimeout(tick);
  }, [now]);
  return now;
}

const tile = { size: 28, strokeWidth: 1.9 };
const wifiWords: Record<Connectivity, string> = {
  Offline: "Not connected", Scanning: "Looking for networks", NoNetworks: "No networks found", Connecting: "Connecting",
  Online: "Connected", CaptivePortal: "Needs sign-in", WrongPassword: "Wrong password", ConnectionFailed: "Couldn't connect",
};

function Screen() {
  const account = useSetup(useRuntime()).state?.graceAccount;
  const cards = useHomeCards();
  const files = useFilesHome();
  const { workspace, can, send, current } = useWorkspace();
  const website = useWebsiteRequests();
  const { accounts } = useAccounts();
  const read = useMailContent();
  const now = useMinute();
  // Prototype `layout()`, kbH: the keyboard covers the screen right of the rail, which keeps its full height, and the windows rise above it.
  const keyboard = useKeyboardHeight();
  // spec/app/shell.md, "Settings and rail popovers preserve the surface underneath": each popover points at its rail button.
  const [anchor, setAnchor] = useState(0);
  const [graceHeight, setGraceHeight] = useState(260);
  // The host's Back and Home keys (MainActivity). spec/app/deviceKeys.md, "Back closes the nearest open thing first and leaves only from a resting Home":
  // an unconsumed Back leaves the standalone app, and the launcher dispatches launcher-home.
  useEffect(() => {
    const back = (event: Event) => {
      // The key is decided on the workspace as it is now, which a render may not show yet.
      const now = current(), requests = website.current();
      const action = backAction(now.device, now.assistant, now.browser, requests);
      if (action === "Unconsumed") return;
      event.preventDefault();
      if (action === "CancelClearData" || action === "DismissWebsiteRequest") return void website.send(websiteBackEvents[action](requests));
      // Back takes the address field's focus with its edit.
      if (action === "DismissAddress" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      void send(backEvents[action]);
    };
    // spec/app/deviceKeys.md, "After launcher Home only Grace's own window is left for Back"
    const home = () => { if (can({ type: "visit", destination: "Home" })) void send({ type: "visit", destination: "Home" }); };
    window.addEventListener("hardware-back", back);
    window.addEventListener("launcher-home", home);
    return () => { window.removeEventListener("hardware-back", back); window.removeEventListener("launcher-home", home); };
  });
  if (!workspace) return null;
  const { device, assistant, preferences } = workspace;
  const surface = device.surface;
  const fire = (event: WorkspaceEvent) => ({ disabled: !can(event), onClick: () => void send(event) });
  const visit = (destination: Surface) => fire({ type: "visit", destination });
  const toggle = (popover: Popover) => ({
    selected: device.railPopover === popover,
    ...fire({ type: "togglePopover", popover }),
    onClick: (event: { currentTarget: HTMLElement }) => {
      const { top, height } = event.currentTarget.getBoundingClientRect();
      setAnchor(top + height / 2);
      void send({ type: "togglePopover", popover });
    },
  });
  const useManaged = usesManagedSurfaces(account, window.location.hash);
  const online = device.connectivity === "Online";
  const volume = preferences.session;
  // spec/app/preferences.md, "Undo restores the last setting choice without changing the microphone": zero volume is muted, and Unmute at zero chooses 50.
  const choose = (settings: typeof volume) => fire({ type: "changePreferences", settings });
  // spec/app/assistant.md, "Story: Keep control of one task across windows and pauses": what Grace's window covers.
  const privateSurface = privateSurfaceActive(workspace);
  const covered = !privateSurface && assistant.presentation === "Expanded";
  const docked = !privateSurface && assistant.presentation === "Compact";
  const bottom = keyboard + (docked ? 6 + graceHeight + 6 : 6);
  const clock = Object.fromEntries(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  const hour = now.getHours();
  const sleeping = device.readiness === "Sleeping";
  const wake = () => {
    if (canChangeLifecycle(current(), "WakeDevice", "Host")) void send({ type: "changeLifecycle", lifecycle: "WakeDevice" }, "Host");
  };

  return (
    // A held tap on a control must not select its label: only text fields and messages keep text selection.
    <TextScale percent={textScalePercent(volume)}><div data-benchmark-observable={!privateSurface && !workspace.browser.tabs.some((tab) => tab.manualSignIn)} className="fixed inset-0 overflow-hidden font-sans text-foreground select-none">
      <div className="contents" {...under(sleeping)}>
      <PageBackdrop className="absolute inset-0 bg-gradient-frame-soft" />
      <Rail aria-label="Rail" time={`${clock.hour}:${clock.minute}`} period={clock.dayPeriod}
        date={now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        status={<RailButton icon={online ? <Wifi {...tile} /> : <WifiSlash />} label="Wi-Fi" aria-label={online ? "Wi-Fi" : "Wi-Fi, not connected"} {...toggle("WifiPopover")} />}
        footer={<RailButton icon={<Gear {...tile} />} label="Settings" selected={surface === "DeviceSettings"} {...visit("DeviceSettings")} />}
        ask={privateSurface ? undefined : <AskGraceButton selected={assistant.presentation !== "Closed"} glow={assistant.presentation === "Closed" ? "rest" : "off"} onClick={() => { if (can({ type: "openGrace" })) void send({ type: "openGrace" }); }} />}>
        <RailButton icon={<House {...tile} />} label="Home" selected={surface === "Home"} {...visit("Home")} />
        <RailButton icon={volume.muted ? <VolumeX {...tile} /> : <Volume2 {...tile} />} label="Volume" {...toggle("VolumePopover")} />
      </Rail>
      {surface === "Home" && (
        // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": Home covers a page still shown.
        <OverPage className={cn(lifted, "left-1.5")} style={{ bottom }}>
          {/* spec/app/shell.md, "Home cards open their named surface without activating a microphone or controller": nothing here is invented. */}
          <WithMailboxes ids={accounts?.accounts.map((a) => a.id) ?? []}>{(boxes) => (
            <WithCalendars keys={accounts ? calendarKeys(accounts) : []}>{(calendars) => (
            <HomeScreen className="inset-0" banner={<NoticeBanner />} layout={docked ? "compact" : "full"} {...under(covered)} greeting={hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}
              calendar={{ weekday: now.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(), day: now.getDate(), ...!useManaged && accounts ? homeCalendar(accounts, calendars, now.getTime(), visit("Calendar").disabled ? undefined : visit("Calendar").onClick) : { events: (cards?.events ?? []).slice(0, 3).map((event, index) => {
              const when = new Date(event.isAllDay && event.startAt.length === 10 ? event.startAt + "T12:00:00" : event.startAt);
              return { id: event.externalId, title: event.title || "Untitled appointment", detail: event.location || undefined,
                weekday: appointmentDay.format(when).toUpperCase(), time: event.isAllDay ? "All day" : appointmentClock.format(when), next: index === 0 };
            }) }, ...visit("Calendar") }}
              email={{
                messages: useManaged ? (cards?.mail ?? []).slice(0, 2).map((message) => ({ id: message.externalId,
              name: message.from || "Unknown sender", subject: message.subject || "No subject", unread: message.isUnread })) : accounts ? homeMail(accounts, boxes, read) : [], notConnected: !useManaged && accounts !== undefined && mailAccounts(accounts).length === 0,
                ...online ? {} : { status: "Waiting for the internet", waiting: "New email will arrive when you’re back online." }, ...visit("Email"),
              }}
              internet={visit("Browser")} files={{ photos: files?.photos ?? [], document: files?.document, ...visit("Files") }} passwords={visit("Passwords")}
              page={device.homePage}
              onPageChange={(page) => { const event = { type: "chooseHomePage", page } as const; if (can(event)) void send(event); }} />
            )}</WithCalendars>
          )}</WithMailboxes>
        </OverPage>
      )}
      {surface === "Browser" && <div className={cn(lifted, besideRail, "z-[1]")} style={{ bottom }}><Browser {...under(covered)} /></div>}
      {surface === "Calendar" && !useManaged && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={{ bottom }}><Calendar now={now.getTime()} {...under(covered)} /></OverPage>}
      {surface === "Email" && !useManaged && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={{ bottom }}><Email {...under(covered)} /></OverPage>}
      {surface === "DeviceSettings" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={{ bottom }}><Settings {...under(covered)} /></OverPage>}
      {surface === "Passwords" && (
        <OverPage className={cn(lifted, besideRail, "z-[2]")} style={{ bottom }}>
          <AppWindow {...under(covered)} title="Passwords" icon={<KeyRound size={26} aria-hidden />} closeLabel="Close Passwords" onClose={visit("Home").onClick}>
            <PasswordsApp />
          </AppWindow>
        </OverPage>
      )}
      {surface === "Files" && (
        <OverPage className={cn(lifted, besideRail, "z-[2]")} style={{ bottom }}>
          <Files {...under(covered)} onClose={() => { if (can({ type: "visit", destination: "Home" })) void send({ type: "visit", destination: "Home" }); }} />
        </OverPage>
      )}
      {useManaged && (surface === "Email" || surface === "Calendar") && (
        <OverPage className={cn(lifted, besideRail, "z-[2]")} style={{ bottom }}>
          <AppWindow {...under(covered)} title={surface} icon={surface === "Email" ? <Mail size={26} /> : <CalendarDays size={26} />} closeLabel={`Close ${surface}`} onClose={visit("Home").onClick}>
            <ManagedRead view={surface} />
          </AppWindow>
        </OverPage>
      )}
      {device.railPopover !== "NoPopover" && (
        // spec/app/shell.md, "Settings and rail popovers preserve the surface underneath": a tap anywhere right of the rail closes it.
        <OverPage className={cn(besideRail, "inset-y-0 right-0 z-[5]")} onPointerDown={(event) => { if (event.target === event.currentTarget && can({ type: "dismissPopover" })) void send({ type: "dismissPopover" }); }}>
          {device.railPopover === "VolumePopover" ? (
            <RailPopover className="left-3" top={Math.max(6, anchor - 58)} icon={volume.muted ? <VolumeX size={30} strokeWidth={2} /> : <Volume2 size={30} strokeWidth={2} />} title="Volume"
              value={volume.muted ? "Muted" : `${volume.volume}%`} onClose={() => void send({ type: "dismissPopover" })}
              actions={<Button variant="capsule" size="pill" {...choose(muteChoice(volume, !volume.muted))}>{volume.muted ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}{volume.muted ? "Unmute" : "Mute"}</Button>}>
              <Slider className="mt-5 gap-4" label="Volume" decreaseLabel="Quieter" increaseLabel="Louder" step={10} value={volume.muted ? 0 : volume.volume}
                onValueChange={(level) => { const { disabled, onClick } = choose(volumeChoice(volume, level)); if (!disabled) onClick(); }} />
            </RailPopover>
          ) : (
            <RailPopover className="left-3" top={Math.max(6, anchor - 58)} icon={online ? <Wifi size={30} strokeWidth={2} /> : <WifiSlash size={30} />} title="Wi-Fi"
              value={wifiWords[device.connectivity]} onClose={() => void send({ type: "dismissPopover" })}
              actions={<Button variant="capsule" size="pill" {...fire({ type: "chooseSettingsPage", page: "NetworkSettings" })}>Wi-Fi settings</Button>} />
          )}
        </OverPage>
      )}
      {!privateSurface && <Notices above={bottom - 6} />}
      {!privateSurface && <Grace onHeightChange={setGraceHeight} />}
      </div>
      {sleeping && <WithCalendars keys={accounts ? calendarKeys(accounts) : []}>{(calendars) => (
        <SleepScreen role="button" tabIndex={0} aria-label="Wake Grace"
        time={`${clock.hour}:${clock.minute}`}
        date={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        next={accounts && nextAppointment(accounts, calendars, now.getTime())}
        hint="Touch the screen to wake it" onClick={wake} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wake(); }
        }} />
      )}</WithCalendars>}
      {volume.brightness < 100 && <div aria-hidden className="pointer-events-none fixed inset-0 z-50 bg-foreground" style={{ opacity: (100 - volume.brightness) / 100 }} />}
    </div></TextScale>
  );
}

/** The application over `runtime`, from `application` of app.vibe. */
export function App({ runtime }: { runtime: Runtime }) {
  const screen = useMemo(() => runtime.context().then(() => <Screen />), [runtime]);
  return (
    <RuntimeContext value={runtime}>
      <PageMeasurer runtime={runtime}><Suspense>{screen}</Suspense></PageMeasurer>
    </RuntimeContext>
  );
}
