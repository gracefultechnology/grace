# Grace device and Home

Home uses the progressive-blur carousel from `prototype/Grace Prototype.html`.
Calendar, Email and Internet share the main page. Files comes next, then
Passwords. The person can move through these pages with arrows or horizontal
swipes, and with page dots when Home fills the screen. The rail keeps Ask
Grace available and provides separate Home and Close browser controls. Apps
use icon headers. Settings contains Text size, Brightness, Grace's voice, Wi-Fi,
Account, Email & calendar and About this tablet; Volume and Wi-Fi also open rail
popovers over the current app.

This module owns device readiness and the selected surface. The assistant
owns its conversation, task and microphone. `contextVersion` changes when
the visible device context changes so a controller cannot reuse an action
prepared for a previous surface. Opening a surface never starts assistance.
The new Settings presentation is Grace UI over actual operating-system
capabilities. Permission, network authentication and certificate decisions
retain their real OS semantics. [Network joining](./network.md) owns the
private join workflow; this shell alone owns observed connectivity.
[Email accounts](./accounts.md) owns what the Email & calendar page lists and
its sign-in flows; this shell owns only that the page is the one shown.
References: PRD MVP01–06, ANDROID01–10, ENG02–03; prototype 1847–1882, 2038–2053,
2247–2268 and 2278–2365.

## Story: Reach everyday tasks from Home

> As a person using Grace, I can open Calendar, Email or Internet from the
> main Home cards. I can use the next arrow or swipe left to reach Files,
> then Passwords, and use the previous arrow or swipe right to go back.
> Returning Home preserves my conversation and provider data.
> With Grace open at the bottom, I can use every page of Home. The cards fill
> the pane above Grace, aligned to her window, with the same gap above chat as
> between chat and the rail. The greeting and bottom page dots yield that space
> to the cards. In Settings, I can scroll the list to About this tablet and
> scroll the selected page to its last control while Grace stays open.

### Startup distinguishes a usable shell from a recoverable startup failure

```quint
type Readiness = Starting | Ready | StartupFailed | Sleeping
type Surface = Home | Calendar | Email | Browser | Files | Passwords | DeviceSettings
type Connectivity = Offline | Scanning | NoNetworks | Connecting | Online | CaptivePortal | WrongPassword | ConnectionFailed
type HomePage = MainCards | FilesCard | PasswordsCard
type RailPopover = NoPopover | WifiPopover | VolumePopover
type SettingsPage = TextSizeSettings | BrightnessSettings | VoiceSettings | NetworkSettings | EmailCalendarSettings | AccountSettings | AboutSettings
type Shell = {
  readiness: Readiness,
  surface: Surface,
  returnSurface: Surface,
  connectivity: Connectivity,
  reasoningAvailable: bool,
  microphoneAllowed: bool,
  observationAllowed: bool,
  homePage: HomePage, railPopover: RailPopover, settingsPage: SettingsPage,
  contextVersion: int
}

pure val initial: Shell = {
  readiness: Starting, surface: Home, returnSurface: Home,
  connectivity: Offline, reasoningAvailable: false,
  microphoneAllowed: false, observationAllowed: false, homePage: MainCards,
  railPopover: NoPopover, settingsPage: TextSizeSettings, contextVersion: 0
}

pure def canFinishStartup(s: Shell): bool = s.readiness == Starting
pure def finishStartup(s: Shell, succeeded: bool): Shell = {
  ...s, readiness: if (succeeded) Ready else StartupFailed,
  contextVersion: s.contextVersion + 1
}
pure def canRetryStartup(s: Shell): bool = s.readiness == StartupFailed
pure def retryStartup(s: Shell): Shell = {
  ...s, readiness: Starting, contextVersion: s.contextVersion + 1
}
pure def alwaysContextVersionIsNonnegative(s: Shell): bool = s.contextVersion >= 0
pure def sometimesReadyAtHome(s: Shell): bool = s.readiness == Ready and s.surface == Home
pure def sometimesStartupCanFail(s: Shell): bool = s.readiness == StartupFailed
```

### Home cards open their named surface without activating a microphone or controller

Calendar displays real upcoming occurrences, Email displays real unread
messages, and Internet previews the retained browser state. Sample names,
dates, messages and balances from the prototype are not product defaults.
The Files and Passwords cards open from their own Home pages. Paging keeps
the person on Home. Opening a card changes the navigation context and
preserves permissions.

```quint
pure def isTaskSurface(destination: Surface): bool =
  destination == Home or destination == Calendar or destination == Email or destination == Browser or destination == Files or destination == Passwords
pure def canOpenSurface(s: Shell, destination: Surface): bool =
  s.readiness == Ready and isTaskSurface(destination)
pure def openSurface(s: Shell, destination: Surface): Shell = {
  ...s, surface: destination, returnSurface: destination,
  homePage: if (destination == Home) MainCards else s.homePage, railPopover: NoPopover,
  contextVersion: s.contextVersion + 1
}
pure def sometimesCalendarIsReachable(s: Shell): bool = s.surface == Calendar
pure def sometimesEmailIsReachable(s: Shell): bool = s.surface == Email
pure def sometimesBrowserIsReachable(s: Shell): bool = s.surface == Browser
pure def sometimesFilesIsReachable(s: Shell): bool = s.surface == Files
pure def sometimesPasswordsIsReachable(s: Shell): bool = s.surface == Passwords
pure def canChooseHomePage(s: Shell, page: HomePage): bool = s.readiness == Ready and s.surface == Home
pure def chooseHomePage(s: Shell, page: HomePage): Shell = {
  ...s, homePage: page, contextVersion: s.contextVersion + 1
}
pure def sometimesFilesCardIsReachable(s: Shell): bool = s.surface == Home and s.homePage == FilesCard
pure def sometimesPasswordsCardIsReachable(s: Shell): bool = s.surface == Home and s.homePage == PasswordsCard
```

### Settings and rail popovers preserve the surface underneath

Leaving a task surface invalidates its browser context. Returning does not
itself authorize a new action. Home hides an existing browser; the browser's
separate Close command clears its tabs. No connectivity check gates opening Settings, Home, Calendar or Files.
Offline Email may show retained mail with an unavailable-refresh notice;
the prototype's disabled launch is not permission to discard retained content.
Wi-Fi and Volume popovers close on a second tap, outside tap or Close.

```quint
pure def isNativeSurface(destination: Surface): bool =
  destination == DeviceSettings
pure def canOpenNative(s: Shell, destination: Surface): bool =
  s.readiness == Ready and isNativeSurface(destination)
pure def openNative(s: Shell, destination: Surface): Shell = {
  ...s, surface: destination, railPopover: NoPopover,
  returnSurface: if (isTaskSurface(s.surface)) s.surface else s.returnSurface,
  contextVersion: s.contextVersion + 1
}
pure def canReturnFromNative(s: Shell): bool = s.readiness == Ready and isNativeSurface(s.surface)
pure def returnFromNative(s: Shell): Shell = {
  ...s, surface: s.returnSurface, railPopover: NoPopover, contextVersion: s.contextVersion + 1
}
pure def canChooseSettingsPage(s: Shell, page: SettingsPage): bool = s.readiness == Ready
pure def chooseSettingsPage(s: Shell, page: SettingsPage): Shell = {
  ...s, surface: DeviceSettings, settingsPage: page, railPopover: NoPopover,
  returnSurface: if (isTaskSurface(s.surface)) s.surface else s.returnSurface,
  contextVersion: s.contextVersion + 1
}
pure def canTogglePopover(s: Shell, popover: RailPopover): bool =
  s.readiness == Ready and popover != NoPopover
pure def togglePopover(s: Shell, popover: RailPopover): Shell = {
  ...s, railPopover: if (s.railPopover == popover) NoPopover else popover,
  contextVersion: s.contextVersion + 1
}
pure def canDismissPopover(s: Shell): bool = s.railPopover != NoPopover
pure def dismissPopover(s: Shell): Shell = {
  ...s, railPopover: NoPopover, contextVersion: s.contextVersion + 1
}
pure def alwaysReturnDestinationIsAnApplication(s: Shell): bool = isTaskSurface(s.returnSurface)
pure def sometimesSettingsWorkOffline(s: Shell): bool =
  s.surface == DeviceSettings and s.settingsPage == NetworkSettings and s.connectivity == Offline
pure def sometimesEmailCalendarSettingsIsReachable(s: Shell): bool =
  s.surface == DeviceSettings and s.settingsPage == EmailCalendarSettings
```

## Story: Keep control through interruptions

> As a person using Grace, I can stop, leave, sleep or lose a connection
> without hidden assistance continuing, and still use the device itself.

### Sleep and restart invalidate the prior device context

The owning application pauses assistance on a changed context and needs an
explicit Resume plus fresh observation before continuing. Sleep preserves
the selected surface. Restart returns to startup/Home; durable personal
memory and unresolved payment evidence are owned by their own modules.

```quint
pure def canSleep(s: Shell): bool = s.readiness == Ready
pure def sleep(s: Shell): Shell = {
  ...s, readiness: Sleeping, railPopover: NoPopover, contextVersion: s.contextVersion + 1
}
pure def canWake(s: Shell): bool = s.readiness == Sleeping
pure def wake(s: Shell): Shell = {
  ...s, readiness: Ready, contextVersion: s.contextVersion + 1
}
pure def restart(s: Shell): Shell = {
  ...s, readiness: Starting, surface: Home, returnSurface: Home,
  reasoningAvailable: false, observationAllowed: false, railPopover: NoPopover, homePage: MainCards,
  contextVersion: s.contextVersion + 1
}
pure def sometimesSleepingKeepsTheSurface(s: Shell): bool =
  s.readiness == Sleeping and s.surface == Browser
```

### Network and service failures remain distinct from a failed device shell

Wi-Fi may be off, scanning, find no networks, connecting, connected, captive,
reject a password or fail. The system owns network selection, saved-network
forgetting and secure password entry. Reasoning can be unavailable while
the network and device work. Reasoning availability reports an actually supported host route; it does not
claim a local model exists. It may be available while offline, for example
through supported on-device help. Typed assistance is only a fallback when
reasoning works; manual navigation remains available.

```quint
pure def setConnectivity(s: Shell, connectivity: Connectivity): Shell = {
  ...s, connectivity: connectivity, contextVersion: s.contextVersion + 1
}
pure def setReasoningAvailability(s: Shell, available: bool): Shell = {
  ...s, reasoningAvailable: available, contextVersion: s.contextVersion + 1
}
pure def mayRequestReasoning(s: Shell): bool =
  s.readiness == Ready and s.reasoningAvailable
pure def sometimesShellWorksWithoutReasoning(s: Shell): bool =
  s.readiness == Ready and not(s.reasoningAvailable) and s.surface == Browser
```

### Permission availability is separate from active recording or observation

Granting access is not a command to use it. Revocation invalidates dependent
work immediately. The shell never stores passwords, codes or microphone
audio. Native permission prompts preserve the operating system's choices.

```quint
pure def setMicrophonePermission(s: Shell, allowed: bool): Shell = {
  ...s, microphoneAllowed: allowed, contextVersion: s.contextVersion + 1
}
pure def setObservationPermission(s: Shell, allowed: bool): Shell = {
  ...s, observationAllowed: allowed, contextVersion: s.contextVersion + 1
}
pure def mayObserveBrowser(s: Shell): bool =
  s.readiness == Ready and s.surface == Browser and s.railPopover == NoPopover and s.observationAllowed
pure def stepContextNeverMovesBack(before: Shell, after: Shell): bool =
  after.contextVersion > before.contextVersion
pure def lawBackgroundBrowserIsNotObservable(s: Shell): bool =
  s.surface != Browser implies not(mayObserveBrowser(s))
pure def lawSleepingDeviceIsNotObservable(s: Shell): bool =
  s.readiness != Ready implies not(mayObserveBrowser(s))
```
