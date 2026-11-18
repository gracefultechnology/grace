# Android Back and Home keys

Android's hardware Back and the launcher's Home key reach Grace as window
events (`apps/app/README.md`, "Android"). Back is a cancelable
`hardware-back`: the interface consumes it by cancelling it, and when it does
not, the launcher flavor dispatches `launcher-home` instead of leaving while
the standalone app leaves. Home pressed while the launcher is already in front
dispatches `launcher-home`. This library decides what each key means for the
current [shell](./shell.md), [assistant](./assistant.md),
[browser](./browser.md) and [what websites ask](./websiteRequests.md); each
decision is one existing [workspace](./workspace.md) or website requests
event, whose own rules say what else it changes.
Reference: the previous application's HardwareBack (NA-1).

## Story: Step back inside Grace before leaving

> As an older adult, I can press Back to undo the last thing that opened,
> one step at a time, and only leave Grace once I am on Home with nothing open.

### Back closes the nearest open thing first and leaves only from a resting Home

In order: Clear browsing data's confirmation is cancelled; the question a
website asked that Grace shows over the page is closed the way its own
decline button closes it (next rule); an open rail popover closes; the
browser's address editor is
dismissed; Grace's own keyboard (chat or website typing) is dismissed;
expanded Grace collapses to compact, never closing it; the selected tab goes
back in its history while the browser is shown; any other surface, Settings
included, goes Home, which hides the browser and keeps its tabs; Back from
either the Files or Passwords launcher page returns to the main Home cards. Going Home or
returning to the main cards always lands on a resting Home, so the Back after
it leaves. The address editor counts only while the Browser surface is shown:
on any other surface it is hidden and Back passes over it. A website's
question counts only while it is presented, which is only while the browser
is shown.

A device that is not ready has nothing of Grace to step back through. While
it is Sleeping, its sleep screen is woken by a tap, and Back leaves nothing
there to step through, so it stays unconsumed rather than waking or changing
the surface hidden beneath. The unconsumed Back then does what it does
anywhere: the standalone app leaves, and the launcher dispatches
`launcher-home`, which a device that is not ready ignores, so the sleep
screen stays. Back is left unconsumed only while the device is not ready,
or on the main Home cards with nothing to dismiss.

```quint
import shell as S from "./shell"
import browser as B from "./browser"
import assistant as A from "./assistant"
import conversation as C from "./conversation"
import interaction as I from "./interaction"
import browserControls as BC from "./browserControls"
import execution as X from "./execution"
import commitment as CM from "./commitment"
import task as T from "./task"
import preferences as R from "./preferences"
import wake as W from "./wake"
import workspace as WS from "./workspace"
import websiteRequests as WR from "./websiteRequests"
type BackAction = CancelClearData | DismissWebsiteRequest | DismissPopover | DismissAddress | DismissKeyboard
  | CollapseGrace | PageBack | GoHome | ShowMainCards | Unconsumed
pure def addressKeyboardOpen(shell: S::Shell, b: B::Browser): bool =
  shell.surface == S::Browser and BC::canControl(b, BC::DismissAddress, BC::BrowserControlUser)
pure def restingAtHome(shell: S::Shell, a: A::Assistant, r: WR::WebsiteRequests): bool =
  shell.surface == S::Home and shell.homePage == S::MainCards and shell.railPopover == S::NoPopover and
  a.keyboard == A::NoKeyboard and a.presentation != A::Expanded and
  r.clearing != WR::ConfirmingClear and not(WR::presented(r).id > 0)
pure def backAction(shell: S::Shell, a: A::Assistant, b: B::Browser, r: WR::WebsiteRequests): BackAction =
  if (shell.readiness != S::Ready) Unconsumed
  else if (r.clearing == WR::ConfirmingClear) CancelClearData
  else if (WR::presented(r).id > 0) DismissWebsiteRequest
  else if (shell.railPopover != S::NoPopover) DismissPopover
  else if (addressKeyboardOpen(shell, b)) DismissAddress
  else if (a.keyboard != A::NoKeyboard) DismissKeyboard
  else if (a.presentation == A::Expanded) CollapseGrace
  else if (shell.surface == S::Browser and B::canGoBack(b)) PageBack
  else if (shell.surface != S::Home) GoHome
  else if (shell.homePage != S::MainCards) ShowMainCards
  else Unconsumed
pure def lawBackLeavesOnlyFromARestingHome(shell: S::Shell, a: A::Assistant, b: B::Browser, r: WR::WebsiteRequests): bool =
  backAction(shell, a, b, r) == Unconsumed iff (shell.readiness != S::Ready or restingAtHome(shell, a, r))
pure def lawShellBackRestsAtHome(shell: S::Shell, a: A::Assistant, b: B::Browser, r: WR::WebsiteRequests): bool =
  (backAction(shell, a, b, r) == GoHome implies backAction(S::openSurface(shell, S::Home), a, b, r) == Unconsumed) and
  (backAction(shell, a, b, r) == ShowMainCards implies
    backAction(S::chooseHomePage(shell, S::MainCards), a, b, r) == Unconsumed)
pure val shellValues = Set(S::initial, S::finishStartup(S::initial, false), S::finishStartup(S::initial, true),
  S::chooseHomePage(S::finishStartup(S::initial, true), S::FilesCard),
  S::chooseHomePage(S::finishStartup(S::initial, true), S::PasswordsCard),
  S::togglePopover(S::chooseHomePage(S::finishStartup(S::initial, true), S::FilesCard), S::VolumePopover),
  S::togglePopover(S::finishStartup(S::initial, true), S::VolumePopover),
  S::openSurface(S::finishStartup(S::initial, true), S::Browser),
  S::openSurface(S::chooseHomePage(S::finishStartup(S::initial, true), S::FilesCard), S::Browser),
  S::openSurface(S::finishStartup(S::initial, true), S::Calendar),
  S::togglePopover(S::openSurface(S::finishStartup(S::initial, true), S::Browser), S::WifiPopover),
  S::chooseSettingsPage(S::openSurface(S::finishStartup(S::initial, true), S::Browser), S::NetworkSettings),
  S::sleep(S::finishStartup(S::initial, true)),
  S::sleep(S::openSurface(S::finishStartup(S::initial, true), S::Browser)))
pure val aValues = Set(A::initial, A::open(A::initial, C::ConversationUser),
  A::resize(A::open(A::initial, C::ConversationUser), false, C::ConversationUser),
  A::chooseType(A::open(A::initial, C::ConversationUser), C::ConversationUser),
  A::focusWebsite(A::open(A::initial, C::ConversationUser), C::ConversationUser),
  A::focusWebsite(A::resize(A::open(A::initial, C::ConversationUser), false, C::ConversationUser), C::ConversationUser))
pure val bValues = Set(B::initial, B::navigate(B::initial, "page"),
  B::editAddress(B::initial, ""), B::editAddress(B::navigate(B::initial, "page"), "next"),
  B::goBack(B::navigate(B::initial, "page")), B::openTab(B::navigate(B::initial, "page")))
pure def askedOnTab1(ask: WR::Ask): WR::WebsiteRequests =
  { ...WR::exampleShown, nextId: 2, requests: List({ id: 1, tab: 1, ask: ask }) }
pure val purgingRequests: WR::WebsiteRequests = WR::answerClearBrowsingData(
  WR::requestClearBrowsingData(WR::exampleTwoAsk, WR::WebsitePerson), true, WR::WebsitePerson).state
pure val rValues = Set(WR::initial, WR::exampleShown, WR::exampleTwoAsk, WR::exampleAsking,
  purgingRequests, WR::purgeFinished(purgingRequests, false, WR::WebsiteHost),
  askedOnTab1(WR::SitePermission({ origin: "https://clinic.example", kinds: WR::clinicCamera })),
  askedOnTab1(WR::WebsiteMessage({ dialog: WR::ConfirmMessage })),
  askedOnTab1(WR::WebsiteMessage({ dialog: WR::LeavePageMessage })),
  WR::requestClearBrowsingData(WR::initial, WR::WebsitePerson),
  WR::requestClearBrowsingData(WR::exampleTwoAsk, WR::WebsitePerson),
  askedOnTab1(WR::WebsiteMessage({ dialog: WR::AlertMessage })),
  askedOnTab1(WR::WebsiteMessage({ dialog: WR::PromptMessage })),
  askedOnTab1(WR::DownloadOffer({ fileName: "form.pdf" })), askedOnTab1(WR::FileChoice),
  askedOnTab1(WR::OtherApp({ handoff: WR::RefusedLink })), askedOnTab1(WR::BlockedSignIn({ provider: "Google" })),
  { ...askedOnTab1(WR::BlockedSignIn({ provider: "Google" })), shown: false })
```

### Each Back action is one event its guard allows

| Back action | Event | What else that event does |
|---|---|---|
| CancelClearData | website requests `answerClearBrowsingData`, not confirmed | nothing: browsing data, sign-ins and site decisions are kept |
| DismissWebsiteRequest | website requests `answer` to the presented request, with the choice its decline button makes | the website is told what that button tells it: an alert, whose only button is OK, OK; a question, leave-page warning or prompt Cancel; an offered download declined and recorded as not saved; a file request no file; a site permission Don't allow, remembered for that website and set of devices; another app, a link that cannot open, or a refused sign-in closed without opening anything |
| DismissPopover | `dismissPopover` | pauses unfinished work, stops speech |
| DismissAddress | `changePage` with the browser control DismissAddress | changes the page, so it pauses unfinished work and stops speech; Grace's website keyboard closes with it |
| DismissKeyboard | `interact` with the interaction DismissKeyboard | a geometry change: the page's revision advances and a hidden address editor is dismissed; active work rechecks, work already paused or waiting for the person stays so |
| CollapseGrace | `interact` with the interaction Resize to compact | a geometry change, as above; Grace is never closed |
| PageBack | `changePage` with the browser control Back | changes the page, so it pauses unfinished work and stops speech |
| GoHome | `visit` Home | pauses unfinished work, stops speech, dismisses keyboards; tabs kept |
| ShowMainCards | `chooseHomePage` with the main cards | pauses unfinished work, stops speech |

Each workspace event cancels a pending wake timer and keeps the transcript,
the task and the draft; the two website requests events change nothing
outside what websites ask. Back never accepts what a website asks: the only
OK it gives closes an alert, which has no other button. Going back in a page
happens only in the shown browser's selected tab, and every action is taken
by the person, through the guard of its event.

```quint
pure val alertMessage: WR::Ask = WR::WebsiteMessage({ dialog: WR::AlertMessage })
pure def declineChoice(ask: WR::Ask): WR::Choice = { accept: ask == alertMessage, text: "" }
pure def workspaceOf(shell: S::Shell, a: A::Assistant, b: B::Browser): WS::Workspace =
  { ...WS::initial, device: shell, assistant: a, browser: b }
pure def lawBackActionIsAllowed(shell: S::Shell, a: A::Assistant, b: B::Browser, r: WR::WebsiteRequests): bool =
  val w = workspaceOf(shell, a, b)
  val chosen = backAction(shell, a, b, r)
  val shown = WR::presented(r)
  match chosen {
    | CancelClearData => WR::canAnswerClearBrowsingData(r, false, WR::WebsitePerson)
    | DismissWebsiteRequest => WR::canAnswer(r, shown.id, declineChoice(shown.ask), WR::WebsitePerson)
    | DismissPopover => WS::canDismissPopover(w, WS::Person)
    | DismissAddress => WS::canChangePage(w, BC::DismissAddress, WS::Person)
    | DismissKeyboard => WS::canInteract(w, I::DismissKeyboard, WS::Person)
    | CollapseGrace => WS::canInteract(w, I::Resize({ expanded: false }), WS::Person)
    | PageBack => WS::canChangePage(w, BC::Back, WS::Person)
    | GoHome => shell.surface != S::Home and WS::canVisit(w, S::Home, WS::Person)
    | ShowMainCards => WS::canChooseHomePage(w, S::MainCards, WS::Person)
    | Unconsumed => true
  }
pure def lawBackNeverAcceptsWhatAWebsiteAsks(ask: WR::Ask): bool =
  WR::fits(ask, declineChoice(ask)) and (WR::grants(WR::answerFor(ask, declineChoice(ask))) implies ask == alertMessage)
pure val askValues = Set(alertMessage, WR::WebsiteMessage({ dialog: WR::ConfirmMessage }),
  WR::WebsiteMessage({ dialog: WR::PromptMessage }), WR::WebsiteMessage({ dialog: WR::LeavePageMessage }),
  WR::DownloadOffer({ fileName: "form.pdf" }), WR::FileChoice,
  WR::SitePermission({ origin: "https://clinic.example", kinds: WR::clinicCamera }),
  WR::OtherApp({ handoff: WR::DialApp }), WR::OtherApp({ handoff: WR::RefusedLink }),
  WR::BlockedSignIn({ provider: "Google" }))
```

## Story: Return to Home from the launcher

> As an older adult using the tablet's Home, I can press Home from anywhere in
> Grace and see the Home cards, with my pages and conversation kept.

### After launcher Home only Grace's own window is left for Back

Launcher Home is `visit` Home, the same event as Home in the rail: it opens
the main Home cards and closes any rail popover; the browser is hidden with
its tabs kept; Grace keeps its transcript, task and draft, while unfinished
work pauses and speech stops. Leaving another surface also dismisses the
keyboards and the address editor, so a keyboard survives only when Home is
pressed while already on Home. Hiding the browser ends the website's question
over the page, and closing Settings cancels Clear browsing data's
confirmation (`settingsClosed`). A device that is not ready ignores it.
Home moves an expanded conversation into the lower pane. Afterwards Back
dismisses a surviving keyboard. When the keyboard is already closed, the
next Back leaves.

```quint
pure def homeRequests(r: WR::WebsiteRequests): WR::WebsiteRequests = {
  val hidden = if (WR::canHideBrowser(r, WR::WebsiteHost)) WR::hideBrowser(r, WR::WebsiteHost).state else r
  if (WR::canSettingsClosed(hidden, WR::WebsiteHost)) WR::settingsClosed(hidden, WR::WebsiteHost) else hidden
}
pure def lawLauncherHomeLeavesOnlyGraceToStepBack(shell: S::Shell, a: A::Assistant, b: B::Browser, r: WR::WebsiteRequests): bool =
  val w = workspaceOf(shell, a, b)
  val home = WS::visit(w, S::Home, WS::Person)
  val afterHome = backAction(home.device, home.assistant, home.browser, homeRequests(r))
  WS::canVisit(w, S::Home, WS::Person) implies
    (afterHome == DismissKeyboard or afterHome == Unconsumed) and
    (afterHome == Unconsumed iff (a.keyboard == A::NoKeyboard or shell.surface != S::Home))
```
