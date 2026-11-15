// spec/app/shell.md, "Story: Reach everyday tasks from Home"; spec/app/workspace.md, "Home, native controls and Close have explicit interruption semantics"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"
// The tablet: the rail, the selected surface right of it, and Grace's window over both.
import { AppWindow, AskGraceButton, Button, EmptyState, HomeScreen, Rail, RailButton, RailPopover, Slider, WifiSlash, cn } from "@repo/ui";
import { CalendarDays, Folder, House, Mail, Settings as Gear, Volume2, VolumeX, Wifi } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { type BackAction, backAction, declineChoice } from "../gen/app__deviceKeys.ts";
import { muteChoice, volumeChoice } from "../gen/app__preferences.ts";
import type { Connectivity, RailPopover as Popover, Surface } from "../gen/app__shell.ts";
import { type Event as WebsiteEvent, type WebsiteRequests, presented } from "../gen/app__websiteRequests.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import { Browser } from "./Browser.tsx";
import { Grace } from "./Grace.tsx";
import { OverPage, PageBackdrop, PageMeasurer } from "./PageLayer.tsx";
import { Settings } from "./Settings.tsx";
import { RuntimeContext, type Runtime, useKeyboardHeight, useWebsiteRequests, useWorkspace } from "./useApp.ts";

/** The surfaces that open in an app window, with nothing in them yet. */
const apps: Partial<Record<Surface, { name: string; icon: ReactNode }>> = {
  Calendar: { name: "Calendar", icon: <CalendarDays size={26} /> },
  Email: { name: "Email", icon: <Mail size={26} /> },
  Files: { name: "Files", icon: <Folder size={26} /> },
};

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
  const { workspace, can, send, current } = useWorkspace();
  const website = useWebsiteRequests();
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
  const app = apps[surface];
  const online = device.connectivity === "Online";
  const volume = preferences.session;
  // spec/app/preferences.md, "Undo restores the last setting choice without changing the microphone": zero volume is muted, and Unmute at zero chooses 50.
  const choose = (settings: typeof volume) => fire({ type: "changePreferences", settings });
  // spec/app/assistant.md, "Story: Keep control of one task across windows and pauses": what Grace's window covers.
  const covered = assistant.presentation === "Expanded";
  const bottom = keyboard + (assistant.presentation === "Compact" ? 6 + graceHeight + 6 : 6);
  const clock = Object.fromEntries(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  const hour = now.getHours();

  return (
    // A held tap on a control must not select its label: only text fields and messages keep text selection.
    <div className="fixed inset-0 overflow-hidden font-sans text-foreground select-none">
      <PageBackdrop className="absolute inset-0 bg-gradient-frame-soft" />
      <Rail aria-label="Rail" time={`${clock.hour}:${clock.minute}`} period={clock.dayPeriod}
        date={now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        status={<RailButton icon={online ? <Wifi {...tile} /> : <WifiSlash />} label="Wi-Fi" aria-label={online ? "Wi-Fi" : "Wi-Fi, not connected"} {...toggle("WifiPopover")} />}
        footer={<RailButton icon={<Gear {...tile} />} label="Settings" selected={surface === "DeviceSettings"} {...visit("DeviceSettings")} />}
        ask={<AskGraceButton selected={assistant.presentation !== "Closed"} glow={assistant.presentation === "Closed" ? "rest" : "off"} onClick={() => { if (can({ type: "openGrace" })) void send({ type: "openGrace" }); }} />}>
        <RailButton icon={<House {...tile} />} label="Home" selected={surface === "Home"} {...visit("Home")} />
        <RailButton icon={volume.muted ? <VolumeX {...tile} /> : <Volume2 {...tile} />} label="Volume" {...toggle("VolumePopover")} />
      </Rail>
      {surface === "Home" && (
        // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": Home covers a page still shown.
        <OverPage className={cn(lifted, "left-1.5")} style={{ bottom }}>
          {/* spec/app/shell.md, "Home cards open their named surface without activating a microphone or controller": nothing here is invented. */}
          <HomeScreen className="inset-0" {...under(covered)} greeting={hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}
            calendar={{ weekday: now.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(), day: now.getDate(), events: [], ...visit("Calendar") }}
            email={{ messages: [], ...visit("Email") }} internet={visit("Browser")} files={{ photos: [], ...visit("Files") }}
            page={device.homePage === "FilesCard" ? "files" : "main"}
            onPageChange={(page) => { const event = { type: "chooseHomePage", page: page === "files" ? "FilesCard" : "MainCards" } as const; if (can(event)) void send(event); }} />
        </OverPage>
      )}
      {surface === "Browser" && <Browser style={{ bottom }} {...under(covered)} />}
      {surface === "DeviceSettings" && <OverPage className={cn(lifted, "left-[144px] z-[2]")} style={{ bottom }}><Settings {...under(covered)} /></OverPage>}
      {app && (
        <OverPage className={cn(lifted, "left-[144px] z-[2]")} style={{ bottom }}>
          <AppWindow placement="inline" {...under(covered)} title={app.name} icon={app.icon} closeLabel={`Close ${app.name}`} onClose={visit("Home").onClick}>
            <EmptyState title={`Nothing in ${app.name} yet.`} />
          </AppWindow>
        </OverPage>
      )}
      {device.railPopover !== "NoPopover" && (
        // spec/app/shell.md, "Settings and rail popovers preserve the surface underneath": a tap anywhere right of the rail closes it.
        <OverPage className="absolute inset-y-0 right-0 left-[144px] z-[5]" onPointerDown={(event) => { if (event.target === event.currentTarget && can({ type: "dismissPopover" })) void send({ type: "dismissPopover" }); }}>
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
      <Grace onHeightChange={setGraceHeight} />
    </div>
  );
}

/** The application over `runtime`, from `application` of app.vibe. */
export function App({ runtime }: { runtime: Runtime }) {
  return (
    <RuntimeContext value={runtime}>
      <PageMeasurer runtime={runtime}><Screen /></PageMeasurer>
    </RuntimeContext>
  );
}
