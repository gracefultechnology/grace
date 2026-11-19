# What a website asks of the person

A complete browser answers more than page loads. A website can show a
message, offer a file, ask for a file, ask for the camera, microphone or
location, link to another app, or send a sign-in that refuses to run inside
Grace. This module holds each such request for the person until it is
answered, cancelled or refused, and says what the page is told.

Each request names the tab that raised it, as the [browser](./browser.md)
numbers tabs. Each Grace tab has its own native browser surface, and the
shell presents the selected tab's surface while the browser is shown. A
request belongs to the page its tab's surface started last. Whatever starts
a surface's next page, the page's own navigation or Grace's navigation, Back,
Forward or reload, the surface first ends what the page held, each ended site
permission's `sitePermissionWithdrawn` included, and then sends its
`pageStarted` event; the host reports each such event here as that tab's
page start, and reports no page start of its own. The adapter also reports
each tab close and Close browser, and what the person now sees whenever it
changes: whether the browser is shown, which tab is selected and whether the
shown page is paused (the view, next rule). Tab ids are plain numbers, so
this machine needs nothing else of the browser, and none of Grace's own load
counters.

The website never acts here. The native browser surface reports each request
it raises, with the facts that decide it measured by the surface, not taken
from the page: the tab it belongs to, whether the person's tap started it,
whether it came from the top frame, the frame's origin, and the kinds of
device it asks for. The surface reports in order on one thread, and the
shell passes the reports on in that order, so a request reported after a
page start belongs to the new page. What the page wrote, such as a message
or a file name, is only shown, as the website's. `by` separates what the
person does from what the host reports, and the shell authenticates it. Each
`WebsiteReply` names the request and what it asked; it is what the shell
sends back to the surface or acts on, or, after Android answered, what the
surface already told the page.
Reference: `vendor/eliza/plugins/plugin-native-browser-surface/src/definitions.ts`
and `android/.../BrowserSurfacePlugin.kt`. Every tab's surface is created
with isolated storage, with one `profileKey` shared by every tab, so all tabs
use one browsing profile, and with `answersRequests: true`, so its requests
wait for Grace. The surface reports with the events `dialogRequested`,
`downloadRequested`, `downloadFinished`, `fileChooserRequested`,
`sitePermissionRequested`, `sitePermissionWithdrawn`,
`externalLinkRequested`, `identityProviderRequested` and `pageStarted`, and
Grace answers with the calls `answerDialog`, `saveDownload`,
`answerFileChooser`, `answerSitePermission`, `openExternalLink`,
`openIdentityProvider` and `purgeProfiles`. Presenting another surface or
none (`presentSurface`) ends everything a surface holds except a held
external link and sign-in page; destroying a surface (`destroySurface`),
purging the profile (`purgeProfiles`) and a page start end all of it; pausing
it (`pauseSurface`) ends only its messages. The surface remembers no
site permission; Grace's remembered decisions are kept here.

## Story: Answer what a website asks of me

> As an older adult using a website inside Grace, when the website shows a
> message or asks me for something, I see one clear question at a time on the
> page I am using, and nothing is answered for me.

### A website's request is held only for the current page of the tab I am looking at

A tab is open here from its surface's first page start until the tab is
closed, Close browser, or clearing browsing data closes its surface. A
request from a tab that is not open is refused, as a stale load result is in
the browser. Each request gets the next number, which is never reused, so an
answered request cannot come back. Only the selected tab's page, while the
browser is shown, can hold a request. A request raised by another tab or
while the browser is hidden is cancelled at once, as the surface does with a
hidden page's dialogs, file inputs and site permissions; so are a message,
file request or site permission raised while the shown page is paused. A
download a background tab offers is recorded as not saved, and Grace never
asks the surface to save it. A refused sign-in is the one exception: it waits
on its own tab.

```quint
type WebsiteActor = WebsitePerson | WebsiteHost
type MessageKind = AlertMessage | ConfirmMessage | PromptMessage | LeavePageMessage
type Kinds = { camera: bool, microphone: bool, location: bool }
type AppHandoff = SendToApp | DialApp | ViewInApp | ComposeEmail | RefusedLink
type Ask = WebsiteMessage({ dialog: MessageKind }) | DownloadOffer({ fileName: str })
  | FileChoice | SitePermission({ origin: str, kinds: Kinds })
  | OtherApp({ handoff: AppHandoff }) | BlockedSignIn({ provider: str })
type WebsiteRequest = { id: int, tab: int, ask: Ask }
type HostReport = { tab: int, ask: Ask, fromTap: bool, topFrame: bool }
type DownloadStatus = Saving | Saved | SaveFailed | NotSaved
type DownloadRecord = { id: int, fileName: str, status: DownloadStatus }
type Opening = { id: int, ask: Ask, failed: bool }
type SiteDecision = { origin: str, kinds: Kinds, allowed: bool }
type Clearing = NotClearing | ConfirmingClear | Purging | ClearFailed
type WebsiteRequests = {
  tabs: Set[int], selected: int, shown: bool, paused: bool, nextId: int,
  requests: List[WebsiteRequest], asking: List[WebsiteRequest], downloads: List[DownloadRecord],
  openings: List[Opening], decisions: List[SiteDecision], signedIn: Set[str], clearing: Clearing
}
type Answer = Ok | Declined | Cancelled | Refused | OpenFilePicker | AskAndroid | Allowed | Denied
  | SaveDownload | OpenOtherApp | OpenSystemBrowser
type WebsiteReply = { request: int, ask: Ask, answer: Answer, text: str }
type WebsiteResult = { state: WebsiteRequests, out: List[WebsiteReply] }
pure val initial: WebsiteRequests = {
  tabs: Set(), selected: 1, shown: false, paused: false, nextId: 1, requests: List(), asking: List(),
  downloads: List(), openings: List(), decisions: List(), signedIn: Set(), clearing: NotClearing
}
pure def tabIsOpen(s: WebsiteRequests, tab: int): bool = s.tabs.contains(tab)
pure def hasKind(kinds: Kinds): bool = kinds.camera or kinds.microphone or kinds.location
pure def askIsWellFormed(ask: Ask): bool = match ask {
  | DownloadOffer(d) => d.fileName != ""
  | SitePermission(p) => p.origin != "" and hasKind(p.kinds)
  | BlockedSignIn(b) => b.provider != ""
  | _ => true
}
pure def heldBack(s: WebsiteRequests, report: HostReport): bool =
  not(s.shown) or report.tab != s.selected or (s.paused and stopsWhilePaused(report.ask))
pure def waits(s: WebsiteRequests, report: HostReport): bool = {
  val ask = report.ask
  not(needsTap(ask) and not(report.fromTap)) and match ask {
    | SitePermission(p) => not(heldBack(s, report)) and report.topFrame and not(decided(s, p.origin, p.kinds))
        and not(waitingOnAndroid(s, ask))
    | BlockedSignIn(b) => true
    | _ => not(heldBack(s, report))
  }
}
pure def immediateAnswer(s: WebsiteRequests, report: HostReport): Answer = {
  val ask = report.ask
  if (heldBack(s, report)) Cancelled else match ask {
    | SitePermission(p) => if (report.topFrame and decided(s, p.origin, p.kinds)) Denied else Refused
    | _ => Refused
  }
}
pure def replyOf(r: WebsiteRequest, answer: Answer): WebsiteReply =
  { request: r.id, ask: r.ask, answer: answer, text: "" }
pure def newRequest(s: WebsiteRequests, report: HostReport): WebsiteRequest =
  { id: s.nextId, tab: report.tab, ask: report.ask }
pure def opensElsewhere(answer: Answer): bool =
  answer == OpenFilePicker or answer == OpenOtherApp or answer == OpenSystemBrowser
pure def conclude(r: WebsiteRequest, reply: WebsiteReply, s: WebsiteRequests): WebsiteResult = {
  val ask = r.ask
  val answer = reply.answer
  {
    state: { ...s,
      downloads: match ask {
        | DownloadOffer(d) => s.downloads.append({ id: r.id, fileName: d.fileName,
            status: if (answer == SaveDownload) Saving else NotSaved })
        | _ => s.downloads
      },
      openings: if (opensElsewhere(answer)) s.openings.append({ id: r.id, ask: ask, failed: false }) else s.openings,
      decisions: match ask {
        | SitePermission(p) => if (answer == Denied and not(decided(s, p.origin, p.kinds)))
            s.decisions.append({ origin: p.origin, kinds: p.kinds, allowed: false })
            else s.decisions
        | _ => s.decisions
      }
    },
    out: List(reply)
  }
}
pure def canRaise(s: WebsiteRequests, report: HostReport, by: WebsiteActor): bool =
  by == WebsiteHost and tabIsOpen(s, report.tab) and askIsWellFormed(report.ask)
pure def raise(s: WebsiteRequests, report: HostReport, by: WebsiteActor): WebsiteResult = {
  val r = newRequest(s, report)
  val counted = { ...s, nextId: s.nextId + 1 }
  if (toAndroid(s, report)) { state: { ...counted, asking: s.asking.append(r) },
    out: if (waitingOnAndroid(s, report.ask)) List() else List(replyOf(r, AskAndroid)) }
  else if (waits(s, report)) hold(r, counted) else conclude(r, replyOf(r, immediateAnswer(s, report)), counted)
}
pure def hold(r: WebsiteRequest, s: WebsiteRequests): WebsiteResult = {
  val left = withdraw(s.requests.select(q => q.tab == r.tab and sameSlot(q.ask, r.ask)),
    s.requests.select(q => not(q.tab == r.tab and sameSlot(q.ask, r.ask))), s)
  { state: { ...left.state, requests: left.state.requests.append(r) }, out: left.out }
}
pure def alwaysRequestsBelongToTheirPage(s: WebsiteRequests): bool =
  s.nextId > 0 and s.requests.every(r =>
    r.id > 0 and r.id < s.nextId and askIsWellFormed(r.ask) and tabIsOpen(s, r.tab)) and
  s.asking.every(r =>
    r.id > 0 and r.id < s.nextId and askIsWellFormed(r.ask) and isPermission(r.ask) and tabIsOpen(s, r.tab))
pure def alwaysPagesAreValid(s: WebsiteRequests): bool = s.tabs.forall(t => t > 0)
pure def alwaysOnlyTheShownTabHoldsRequests(s: WebsiteRequests): bool =
  s.requests.every(r => isBlockedSignIn(r.ask) or (s.shown and r.tab == s.selected)) and
  s.asking.every(r => s.shown and r.tab == s.selected)
pure def stepAnsweredRequestsNeverReturn(before: WebsiteRequests, after: WebsiteRequests): bool =
  after.nextId >= before.nextId and
  after.requests.every(r => r.id >= before.nextId or before.requests.some(q => q.id == r.id)) and
  after.asking.every(r => r.id >= before.nextId or before.requests.some(q => q.id == r.id) or
    before.asking.some(q => q.id == r.id))
pure val clinicCamera: Kinds = { camera: true, microphone: false, location: false }
pure val clinicCall: Kinds = { camera: true, microphone: true, location: false }
pure val whereIAm: Kinds = { camera: false, microphone: false, location: true }
pure val noKinds: Kinds = { camera: false, microphone: false, location: false }
pure val reportedOnFirstPage: HostReport = { tab: 1, ask: FileChoice, fromTap: true, topFrame: true }
pure val clinicAsks: HostReport = { ...reportedOnFirstPage, ask: SitePermission({ origin: "https://clinic.example", kinds: clinicCamera }) }
pure val allow: Choice = { accept: true, text: "" }
pure val exampleShown: WebsiteRequests =
  followView(pageStarted(initial, 1, WebsiteHost).state, { shown: true, selected: 1, paused: false }, WebsiteHost).state
pure val exampleDecided: WebsiteRequests = androidAnswered(
  answer(raise(exampleShown, clinicAsks, WebsiteHost).state, 1, allow, WebsitePerson).state, 1, AndroidGranted, WebsiteHost).state
pure val exampleTwoAsk: WebsiteRequests = raise(raise(raise(pageStarted(exampleShown, 2, WebsiteHost).state,
  clinicAsks, WebsiteHost).state, clinicAsks, WebsiteHost).state,
  { ...reportedOnFirstPage, tab: 2, ask: BlockedSignIn({ provider: "Google" }) }, WebsiteHost).state
pure val exampleAsking: WebsiteRequests = answer(exampleTwoAsk, 1, allow, WebsitePerson).state
pure val examplePaused: WebsiteRequests = followView(exampleShown, { shown: true, selected: 1, paused: true }, WebsiteHost).state
pure val sValues = Set(initial, exampleShown, exampleDecided, exampleTwoAsk, exampleAsking, examplePaused)
pure val reportValues = Set(
  { ...reportedOnFirstPage, ask: WebsiteMessage({ dialog: AlertMessage }) },
  { ...reportedOnFirstPage, ask: WebsiteMessage({ dialog: ConfirmMessage }), fromTap: false },
  { ...reportedOnFirstPage, ask: WebsiteMessage({ dialog: PromptMessage }) },
  { ...reportedOnFirstPage, ask: WebsiteMessage({ dialog: LeavePageMessage }) },
  { ...reportedOnFirstPage, ask: DownloadOffer({ fileName: "statement.pdf" }), fromTap: false },
  { ...reportedOnFirstPage, ask: DownloadOffer({ fileName: "form.pdf" }) },
  { ...reportedOnFirstPage, ask: DownloadOffer({ fileName: "" }) },
  reportedOnFirstPage,
  { ...reportedOnFirstPage, fromTap: false },
  { ...reportedOnFirstPage, ask: SitePermission({ origin: "https://clinic.example", kinds: clinicCamera }) },
  { ...reportedOnFirstPage, ask: SitePermission({ origin: "https://clinic.example", kinds: clinicCall }) },
  { ...reportedOnFirstPage, ask: SitePermission({ origin: "https://clinic.example", kinds: clinicCall }), topFrame: false },
  { ...reportedOnFirstPage, ask: SitePermission({ origin: "https://maps.example", kinds: whereIAm }) },
  { ...reportedOnFirstPage, ask: SitePermission({ origin: "https://maps.example", kinds: noKinds }) },
  { ...reportedOnFirstPage, ask: OtherApp({ handoff: DialApp }) },
  { ...reportedOnFirstPage, ask: OtherApp({ handoff: SendToApp }), fromTap: false },
  { ...reportedOnFirstPage, ask: OtherApp({ handoff: ViewInApp }) },
  { ...reportedOnFirstPage, ask: OtherApp({ handoff: ComposeEmail }) },
  { ...reportedOnFirstPage, ask: OtherApp({ handoff: RefusedLink }) },
  { ...reportedOnFirstPage, ask: BlockedSignIn({ provider: "Google" }) },
  { ...reportedOnFirstPage, ask: BlockedSignIn({ provider: "Facebook" }) },
  { ...reportedOnFirstPage, tab: 2, ask: WebsiteMessage({ dialog: AlertMessage }) },
  { ...reportedOnFirstPage, tab: 2, ask: DownloadOffer({ fileName: "receipt.pdf" }) },
  { ...reportedOnFirstPage, tab: 2, ask: SitePermission({ origin: "https://clinic.example", kinds: clinicCamera }) },
  { ...reportedOnFirstPage, tab: 2, ask: BlockedSignIn({ provider: "Facebook" }) },
  { ...reportedOnFirstPage, tab: 3, ask: WebsiteMessage({ dialog: ConfirmMessage }) })
pure val weight_raise = 4
```

### Only the first request of the selected tab is presented, while the browser is shown

Requests of the selected tab queue in the order they arrived; the person sees
one question at a time. Only the person answers, and only the request in
front of them, with a choice that fits it. Nothing else tells a page OK,
opens the file picker for it, asks Android to let it use a device, saves its
download or opens another app, except that Android is asked for a site
permission for a website and set of devices the person already allowed, or
allowed while Android is still being asked ("Allow asks Android"). A request waiting
for the same website and devices as the one the person allows is not asked
about separately: it waits for Android with it. A page is told Allowed only
once Android allowed what the person allowed.

```quint
type Choice = { accept: bool, text: str }
pure val noRequest: WebsiteRequest = { id: 0, tab: 0, ask: FileChoice }
pure def presented(s: WebsiteRequests): WebsiteRequest =
  if (s.shown) s.requests.select(r => r.tab == s.selected).nthOr(0, noRequest) else noRequest
pure def fits(ask: Ask, choice: Choice): bool = match ask {
  | WebsiteMessage(m) => messageFits(m.dialog, choice)
  | OtherApp(o) => choice.text == "" and (opensApp(o.handoff) or not(choice.accept))
  | _ => choice.text == ""
}
pure def answerFor(ask: Ask, choice: Choice): Answer = match ask {
  | WebsiteMessage(m) => if (choice.accept) Ok else Declined
  | DownloadOffer(d) => if (choice.accept) SaveDownload else Declined
  | FileChoice => if (choice.accept) OpenFilePicker else Cancelled
  | SitePermission(p) => if (choice.accept) AskAndroid else Denied
  | OtherApp(o) => if (choice.accept and opensApp(o.handoff)) OpenOtherApp else Declined
  | BlockedSignIn(b) => if (choice.accept) OpenSystemBrowser else Declined
}
pure def replyFor(r: WebsiteRequest, choice: Choice): WebsiteReply = {
  request: r.id, ask: r.ask, answer: answerFor(r.ask, choice), text: if (choice.accept) choice.text else ""
}
pure def canAnswer(s: WebsiteRequests, id: int, choice: Choice, by: WebsiteActor): bool =
  by == WebsitePerson and id > 0 and presented(s).id == id and fits(presented(s).ask, choice)
pure def answer(s: WebsiteRequests, id: int, choice: Choice, by: WebsiteActor): WebsiteResult = {
  val r = presented(s)
  val reply = replyFor(r, choice)
  val alongside = s.requests.select(q => q.id != id and sameSite(q.ask, r.ask))
  val rest = { ...s, requests: s.requests.select(q => q.id != id and not(sameSite(q.ask, r.ask))) }
  val shared = alongside.listMap(q => { ...reply, request: q.id, ask: q.ask })
  val done = conclude(r, reply, rest)
  if (reply.answer == AskAndroid) { state: { ...rest, asking: s.asking.append(r).concat(alongside) }, out: List(reply) }
  else { state: done.state, out: done.out.concat(shared) }
}
pure def grants(a: Answer): bool = match a {
  | Ok => true | OpenFilePicker => true | AskAndroid => true | Allowed => true
  | SaveDownload => true | OpenOtherApp => true | OpenSystemBrowser => true | _ => false
}
pure def grantedBefore(s: WebsiteRequests, reply: WebsiteReply): bool =
  reply.answer == AskAndroid and isPermission(reply.ask) and
    (allowedBefore(s, originOf(reply.ask), kindsOf(reply.ask)) or waitingOnAndroid(s, reply.ask))
pure def toldWhatAndroidAllowed(s: WebsiteRequests, reply: WebsiteReply): bool =
  reply.answer == Allowed and s.asking.some(q => q.id == reply.request)
pure def stepOnlyThePersonGrants(before: WebsiteRequests, after: WebsiteRequests, out: List[WebsiteReply]): bool =
  out.every(reply => not(grants(reply.answer)) or reply.request == presented(before).id or
    grantedBefore(before, reply) or toldWhatAndroidAllowed(before, reply))
pure def sometimesRequestsQueueOnOneTab(s: WebsiteRequests): bool =
  s.requests.select(r => r.tab == s.selected).length() >= 2
pure val idValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val choiceValues = Set({ accept: true, text: "" }, { accept: false, text: "" },
  { accept: true, text: "Ada" }, { accept: false, text: "Ada" })
pure val weight_answer = 3
```

### Looking away from a page ends what it asked, and never accepts it

The shell reports the view as one event, from the
[browser](./browser.md)'s selected tab and the [page layer](./surface.md)'s
`pageShows` and `pageRuns`, each time any of the three changes, so the view
kept here is always the one reported last: selecting another tab, hiding or
showing the browser, and pausing or resuming the shown page are each a new
view, and a new view that changes several at once ends what each change
would end, in one step. Hiding the browser on its own (`hideBrowser`) is the
same as a view that differs only in being hidden.

Selecting another tab, hiding the browser, the tab's surface starting a new
page, closing the tab, Close browser and clearing browsing data each end what
that page was asking, as the surface ends the same requests when Grace
presents another surface or none, when its page starts the next one, and when
its surface is destroyed or its profile purged. A page start ends them
whatever started it: the page's own navigation, or Grace's navigation, Back,
Forward or reload. A message is cancelled, a file request gets no file, a
site permission, waiting for the person or for Android, is denied without
being remembered, an offered download is dropped and recorded as not saved,
and Grace's question about another app is closed without opening it: each is
told Cancelled, never OK. Selecting another tab or hiding the browser closes
Grace's question about another app, while the surface, which keeps a held
external link when another surface or none is presented, still holds the
link; nothing opens it but Grace's own call after the person's Continue. When
the request Android is being asked about ends, the earliest one still waiting
for the same website and devices is asked about next ("Allow asks Android").
A refused sign-in outlasts selecting another tab
and hiding the browser, as the surface keeps it; its own tab's page start or
close, Close browser and clearing browsing data end it. When the shell pauses
the shown page, as it does while Grace's window is in the background, the
surface cancels its messages and refuses new messages, file requests and site
permissions at once, and keeps a file request or site permission already
waiting, since the system picker or Android's permission prompt may be what
covers the page. Closing a tab, the last one included, forgets no site
decision: only Close browser and a clean clearing of browsing data do. No page starts
here while clearing browsing data purges the profile (last rule).

```quint
pure def isDownload(ask: Ask): bool = match ask { | DownloadOffer(d) => true | _ => false }
pure def fileNameOf(ask: Ask): str = match ask { | DownloadOffer(d) => d.fileName | _ => "" }
pure def notSaved(r: WebsiteRequest): DownloadRecord = { id: r.id, fileName: fileNameOf(r.ask), status: NotSaved }
pure def withdraw(gone: List[WebsiteRequest], kept: List[WebsiteRequest], s: WebsiteRequests): WebsiteResult = {
  state: { ...s, requests: kept,
    downloads: s.downloads.concat(gone.select(r => isDownload(r.ask)).listMap(r => notSaved(r))) },
  out: gone.listMap(r => replyOf(r, Cancelled))
}
pure def stopAsking(gone: List[WebsiteRequest], kept: List[WebsiteRequest], left: WebsiteResult): WebsiteResult = {
  // left.state.asking is still the list before; the earliest of a website's that was not first before is called next.
  val called = kept.select(q =>
    firstWaiting(kept, q.ask).id == q.id and firstWaiting(left.state.asking, q.ask).id != q.id)
  { state: { ...left.state, asking: kept },
    out: left.out.concat(gone.listMap(r => replyOf(r, Cancelled))).concat(called.listMap(q => replyOf(q, AskAndroid))) }
}
pure def stopsWhilePaused(ask: Ask): bool = isMessage(ask) or isFileChoice(ask) or isPermission(ask)
type PageView = { shown: bool, selected: int, paused: bool }
pure def viewOf(s: WebsiteRequests): PageView = { shown: s.shown, selected: s.selected, paused: s.paused }
pure def heldInView(view: PageView, r: WebsiteRequest): bool =
  isBlockedSignIn(r.ask) or (view.shown and r.tab == view.selected and not(view.paused and isMessage(r.ask)))
pure def askingInView(view: PageView, r: WebsiteRequest): bool = view.shown and r.tab == view.selected
pure def canFollowView(s: WebsiteRequests, view: PageView, by: WebsiteActor): bool =
  by == WebsiteHost and view.selected > 0 and viewOf(s) != view
pure def followView(s: WebsiteRequests, view: PageView, by: WebsiteActor): WebsiteResult = {
  val left = stopAsking(s.asking.select(r => not(askingInView(view, r))), s.asking.select(r => askingInView(view, r)),
    withdraw(s.requests.select(r => not(heldInView(view, r))), s.requests.select(r => heldInView(view, r)), s))
  { state: { ...left.state, shown: view.shown, selected: view.selected, paused: view.paused }, out: left.out }
}
pure def canHideBrowser(s: WebsiteRequests, by: WebsiteActor): bool = by == WebsiteHost and s.shown
pure def hideBrowser(s: WebsiteRequests, by: WebsiteActor): WebsiteResult = followView(s, { ...viewOf(s), shown: false }, by)
pure def lawFollowingTheViewKeepsIt(s: WebsiteRequests, view: PageView, by: WebsiteActor): bool =
  canFollowView(s, view, by) implies viewOf(followView(s, view, by).state) == view
pure val viewValues = Set({ shown: true, selected: 1, paused: false }, { shown: true, selected: 2, paused: false },
  { shown: false, selected: 1, paused: false }, { shown: true, selected: 1, paused: true },
  { shown: false, selected: 2, paused: true }, { shown: true, selected: 0, paused: false })
pure def canPageStarted(s: WebsiteRequests, tab: int, by: WebsiteActor): bool =
  by == WebsiteHost and tab > 0 and s.clearing != Purging
pure def pageStarted(s: WebsiteRequests, tab: int, by: WebsiteActor): WebsiteResult = {
  val left = stopAsking(s.asking.select(r => r.tab == tab), s.asking.select(r => r.tab != tab),
    withdraw(s.requests.select(r => r.tab == tab), s.requests.select(r => r.tab != tab), s))
  { state: { ...left.state, tabs: s.tabs.union(Set(tab)) }, out: left.out }
}
pure def canCloseTab(s: WebsiteRequests, tab: int, by: WebsiteActor): bool = by == WebsiteHost and tabIsOpen(s, tab)
pure def closeTab(s: WebsiteRequests, tab: int, by: WebsiteActor): WebsiteResult = {
  val left = stopAsking(s.asking.select(r => r.tab == tab), s.asking.select(r => r.tab != tab),
    withdraw(s.requests.select(r => r.tab == tab), s.requests.select(r => r.tab != tab), s))
  { state: { ...left.state, tabs: s.tabs.exclude(Set(tab)) }, out: left.out }
}
pure def canCloseBrowser(s: WebsiteRequests, by: WebsiteActor): bool = by == WebsiteHost
pure def closeBrowser(s: WebsiteRequests, by: WebsiteActor): WebsiteResult = {
  val left = stopAsking(s.asking, List(), withdraw(s.requests, List(), s))
  { state: { ...left.state, shown: false, tabs: Set(), decisions: List() }, out: left.out }
}
pure def alwaysNoMessageWaitsWhilePaused(s: WebsiteRequests): bool =
  s.paused implies s.requests.every(r => not(isMessage(r.ask)))
pure def sometimesAPausedPageKeepsItsQuestion(s: WebsiteRequests): bool =
  s.paused and presented(s).id > 0
pure def sometimesADecisionOutlastsTheLastTab(s: WebsiteRequests): bool =
  s.tabs.size() == 0 and s.decisions.length() > 0
pure val tabValues = Set(0, 1, 2, 3)
```

### A website message is answered once with OK, Cancel or typed text

The page is paused while its message waits. The website's words are shown as
the website's, never as Grace's. An alert has only OK; a question or a
leave-page warning has OK and Cancel; a prompt takes the person's text or
Cancel. A leave-page warning is the surface's `beforeunload` dialog, raised
when the page is about to be left by its own navigation or by Grace's
navigation, Back, Forward or reload: Grace's own navigation waits on it like
the page's. OK (Leave) lets that navigation go on, and the page start that
follows ends the tab's other requests. Cancel (Stay) keeps the page, and the
surface drops the navigation: no page start and no finished load follow. This
module changes no tab record: Grace's load for that navigation never ends, so
the [browser](./browser.md) shows it as a page that did not open, with
Reload, once its wait has passed ("A load that never starts or never ends
becomes the failure view with Reload").

```quint
pure def messageFits(dialog: MessageKind, choice: Choice): bool =
  (choice.accept or dialog != AlertMessage) and
  (choice.text == "" or (choice.accept and dialog == PromptMessage))
pure def isMessage(ask: Ask): bool = match ask { | WebsiteMessage(m) => true | _ => false }
pure def isLeavePage(ask: Ask): bool = match ask { | WebsiteMessage(m) => m.dialog == LeavePageMessage | _ => false }
pure def sometimesAWebsiteMessageIsHeld(s: WebsiteRequests): bool = isMessage(presented(s).ask)
pure def sometimesALeavePageWarningIsAsked(s: WebsiteRequests): bool = isLeavePage(presented(s).ask)
```

### What a website asks during a task is mine to answer, and the task waits for it

A website can ask in the middle of Grace's work on it: a confirm box such as
"Submit this request?" at the point of commitment, a file to upload, the
camera, microphone or location, or another app. While the page in view holds
such a question for the person (`holdsThePerson`: one is presented, or a
site permission she allowed is waiting for Android), it is hers alone to
answer, as every rule above says, and Grace answers none of it. Holding the
task while the page holds the person, so that nothing is prepared or done on
that page until she has answered, is the [workspace](./workspace.md)'s to
do. Answering a website message that was the only thing the page held
releases it; an allowed permission still holds her until Android answers.

```quint
pure def holdsThePerson(s: WebsiteRequests): bool = presented(s).id > 0 or s.asking.length() > 0
pure def lawAnsweringTheOnlyMessageReleasesThePage(s: WebsiteRequests, id: int, choice: Choice, by: WebsiteActor): bool =
  canAnswer(s, id, choice, by) and isMessage(presented(s).ask) and s.requests.length() == 1 and s.asking.length() == 0
    implies not(holdsThePerson(answer(s, id, choice, by).state))
pure def sometimesAWebsiteQuestionHoldsThePerson(s: WebsiteRequests): bool = holdsThePerson(s) and isMessage(presented(s).ask)
```

## Story: Save a file a website offers

> As an older adult, when a website offers me a statement or a form, I can
> save it to my tablet and see whether it was saved, or decline it.

### A download is saved with a visible status or visibly not saved

Nothing is downloaded until the person chooses to save. A tab offers one
file at a time: a later offer replaces an earlier one still waiting, which is
recorded as not saved, as the surface keeps only the last. Every offer ends
in the downloads list as saving, saved, failed or not saved, including an
offer cancelled by leaving the page; it is never dropped silently. A save the
surface refuses or that fails is reported as failed. The person can dismiss a
finished entry. The download address can carry access tokens: it stays with
the browser adapter under the request's number and is never stored here, so
neither the assistant nor the conversation ever receives it.

```quint
pure def slotOf(ask: Ask): int = match ask {
  | DownloadOffer(d) => 1
  | FileChoice => 2
  | OtherApp(o) => 3
  | BlockedSignIn(b) => 4
  | _ => 0
}
pure def sameSlot(a: Ask, b: Ask): bool = slotOf(a) > 0 and slotOf(a) == slotOf(b)
pure def alwaysATabHoldsOneOfEach(s: WebsiteRequests): bool =
  s.requests.every(r => s.requests.every(q => q.id == r.id or q.tab != r.tab or not(sameSlot(q.ask, r.ask))))
pure def canFinishDownload(s: WebsiteRequests, id: int, saved: bool, by: WebsiteActor): bool =
  by == WebsiteHost and s.downloads.some(d => d.id == id and d.status == Saving)
pure def finishDownload(s: WebsiteRequests, id: int, saved: bool, by: WebsiteActor): WebsiteRequests = {
  ...s, downloads: s.downloads.listMap(d =>
    if (d.id == id and d.status == Saving) { ...d, status: if (saved) Saved else SaveFailed } else d)
}
pure def canDismissDownload(s: WebsiteRequests, id: int, by: WebsiteActor): bool =
  by == WebsitePerson and s.downloads.some(d => d.id == id and d.status != Saving)
pure def dismissDownload(s: WebsiteRequests, id: int, by: WebsiteActor): WebsiteRequests = {
  ...s, downloads: s.downloads.select(d => d.id != id)
}
pure def alwaysDownloadsAreRecorded(s: WebsiteRequests): bool =
  s.downloads.every(d => d.id > 0 and d.id < s.nextId and d.fileName != "")
pure def lawADownloadIsNeverDropped(s: WebsiteRequests, report: HostReport, by: WebsiteActor): bool =
  canRaise(s, report, by) and isDownload(report.ask) implies
    (raise(s, report, by).state.requests.some(r => r.id == s.nextId) or
     raise(s, report, by).state.downloads.some(d => d.id == s.nextId and d.status == NotSaved))
pure def sometimesADownloadIsOffered(s: WebsiteRequests): bool = isDownload(presented(s).ask)
pure def sometimesADownloadIsSaved(s: WebsiteRequests): bool = s.downloads.some(d => d.status == Saved)
pure def sometimesADownloadFails(s: WebsiteRequests): bool = s.downloads.some(d => d.status == SaveFailed)
pure def sometimesADownloadIsDeclined(s: WebsiteRequests): bool = s.downloads.some(d => d.status == NotSaved)
```

## Story: Choose a file to send to a website

> As an older adult, when I tap a website's upload button, I can pick a photo
> or document from my tablet, or change my mind.

### The file picker opens only after my tap and my choice to choose a file

A request for a file that the person's tap did not start is refused. The
surface reports a file request only from WebView's file chooser, which a
page reaches only from the person's activation, so the shell reports it as
from a tap. A later file request of the tab replaces an earlier one still
waiting, which gets no file. Choose opens the system picker, where the person
picks files or backs out; the files go to the page and never through Grace.
Opening the picker is Grace's own call, which can fail; the person is then
told, as when another app does not open, and the page gets no file. Cancel
gives the page no file.

```quint
pure def needsTap(ask: Ask): bool = match ask {
  | FileChoice => true
  | OtherApp(o) => true
  | _ => false
}
pure def isFileChoice(ask: Ask): bool = match ask { | FileChoice => true | _ => false }
pure def lawScriptCannotOpenAPickerOrApp(s: WebsiteRequests, report: HostReport, by: WebsiteActor): bool =
  canRaise(s, report, by) and needsTap(report.ask) and not(report.fromTap) implies
    (raise(s, report, by).state.requests == s.requests and
     raise(s, report, by).out == List(replyOf(newRequest(s, report), if (heldBack(s, report)) Cancelled else Refused)))
pure def sometimesAFileChoiceIsAsked(s: WebsiteRequests): bool = presented(s).id > 0 and isFileChoice(presented(s).ask)
```

## Story: Decide what a website may use

> As an older adult, when the website I am on asks for my camera, microphone
> or location, I decide once, and other websites hidden inside it cannot ask.

### Only the website I am on can ask, and my answer holds for that website and those devices until Close browser

Only the top-frame origin may ask, as the surface measured it; a request from
an embedded frame of another origin is already denied by the surface and is
refused here without asking. A request names a set of devices, such as
camera and microphone together, and one answer allows or denies them all, as
the surface grants or denies the whole set. The person is asked once per
website and set of devices: their Don't allow, and their Allow once Android
allowed it (next rule), is remembered for that origin and that exact set for
this browsing session; every request for the same website and set already
waiting shares the answer, Don't allow at once and Allow by waiting for
Android with it, and a later request for the same
website and set is answered from the stored decision. A request for a
different set, even one that overlaps, is asked anew. A page is never told
the opposite of what is stored. A request the page withdraws, or that leaving
the page ends, is dismissed without remembering anything. Close browser and
a clean clearing of browsing data forget every decision; closing tabs does
not. Grace's
own microphone ([conversation](./conversation.md), [wake](./wake.md)) is
governed by Android's permission for Grace and never reads these decisions:
allowing a website grants Grace nothing.

```quint
pure def decided(s: WebsiteRequests, origin: str, kinds: Kinds): bool =
  s.decisions.some(d => d.origin == origin and d.kinds == kinds)
pure def allowedBefore(s: WebsiteRequests, origin: str, kinds: Kinds): bool =
  s.decisions.some(d => d.origin == origin and d.kinds == kinds and d.allowed)
pure def isPermission(ask: Ask): bool = match ask { | SitePermission(p) => true | _ => false }
pure def originOf(ask: Ask): str = match ask { | SitePermission(p) => p.origin | _ => "" }
pure def kindsOf(ask: Ask): Kinds = match ask { | SitePermission(p) => p.kinds | _ => noKinds }
pure def sameSite(a: Ask, b: Ask): bool =
  isPermission(a) and isPermission(b) and originOf(a) == originOf(b) and kindsOf(a) == kindsOf(b)
pure def undecided(s: WebsiteRequests, ask: Ask): bool =
  not(isPermission(ask)) or not(decided(s, originOf(ask), kindsOf(ask)))
pure def matchesStoredDecision(s: WebsiteRequests, reply: WebsiteReply): bool =
  not(isPermission(reply.ask)) or
    ((reply.answer == Allowed implies allowedBefore(s, originOf(reply.ask), kindsOf(reply.ask))) and
     (reply.answer == Denied implies not(allowedBefore(s, originOf(reply.ask), kindsOf(reply.ask)))))
pure def canWithdrawPermission(s: WebsiteRequests, id: int, by: WebsiteActor): bool =
  by == WebsiteHost and (s.requests.some(r => r.id == id and isPermission(r.ask)) or s.asking.some(r => r.id == id))
pure def withdrawPermission(s: WebsiteRequests, id: int, by: WebsiteActor): WebsiteResult =
  stopAsking(s.asking.select(r => r.id == id), s.asking.select(r => r.id != id),
    withdraw(s.requests.select(r => r.id == id), s.requests.select(r => r.id != id), s))
pure def alwaysDecisionsNameAWebsite(s: WebsiteRequests): bool =
  s.decisions.every(d => d.origin != "" and hasKind(d.kinds))
pure def alwaysAWebsiteIsAskedOnce(s: WebsiteRequests): bool =
  s.requests.every(r => undecided(s, r.ask) and not(waitingOnAndroid(s, r.ask))) and
  s.asking.every(r => undecided(s, r.ask) or allowedBefore(s, originOf(r.ask), kindsOf(r.ask)))
pure def stepPagesAreToldTheStoredDecision(before: WebsiteRequests, after: WebsiteRequests, out: List[WebsiteReply]): bool =
  out.every(reply => matchesStoredDecision(after, reply))
pure def stepDecisionsStandUntilCleared(before: WebsiteRequests, via: str, after: WebsiteRequests): bool =
  via == "closeBrowser" or (via == "purgeFinished" and after.clearing == NotClearing) or
    before.decisions.every(d => after.decisions.includes(d) or (via == "androidAnswered" and d.allowed))
pure def lawEmbeddedFramesAreRefused(s: WebsiteRequests, report: HostReport, by: WebsiteActor): bool =
  canRaise(s, report, by) and not(heldBack(s, report)) and isPermission(report.ask) and not(report.topFrame) implies
    (raise(s, report, by).out == List(replyOf(newRequest(s, report), Refused)) and
     raise(s, report, by).state.decisions == s.decisions)
pure def lawADecisionIsAskedOnce(s: WebsiteRequests, report: HostReport, by: WebsiteActor): bool = {
  val ask = report.ask
  match ask {
    | SitePermission(p) => canRaise(s, report, by) and not(heldBack(s, report)) and report.topFrame and decided(s, p.origin, p.kinds) implies
        (raise(s, report, by).state.requests == s.requests and raise(s, report, by).out ==
          (if (not(allowedBefore(s, p.origin, p.kinds))) List(replyOf(newRequest(s, report), Denied))
           else if (waitingOnAndroid(s, ask)) List() else List(replyOf(newRequest(s, report), AskAndroid))))
    | _ => true
  }
}
pure def lawWaitingRequestsShareTheAnswer(s: WebsiteRequests, id: int, choice: Choice, by: WebsiteActor): bool = {
  val r = presented(s)
  val answered = answer(s, id, choice, by)
  canAnswer(s, id, choice, by) and isPermission(r.ask) implies
    (answered.state.requests.every(q => not(sameSite(q.ask, r.ask))) and
     s.requests.every(q => not(sameSite(q.ask, r.ask)) or
       (if (choice.accept) answered.state.asking.some(a => a.id == q.id)
        else answered.out.includes({ ...replyFor(r, choice), request: q.id, ask: q.ask }))))
}
pure def sometimesAWebsiteAsksPermission(s: WebsiteRequests): bool = isPermission(presented(s).ask)
pure def sometimesAPermissionIsRemembered(s: WebsiteRequests): bool = s.decisions.some(d => d.allowed)
pure def sometimesAPermissionIsDeclined(s: WebsiteRequests): bool = s.decisions.some(d => not(d.allowed))
pure def sometimesTwoRequestsWaitForOneWebsite(s: WebsiteRequests): bool =
  s.requests.some(r => s.requests.some(q => q.id != r.id and sameSite(q.ask, r.ask)))
```

### Allow asks Android, and a website gets a device only when Android allows it too

A website can use the camera, microphone or location only through Grace,
so Allow is a call Grace makes: the surface asks Android for any permission
Grace lacks for those devices, showing Android's own prompt when it must,
then grants or denies the page. A request the person's stored Allow answers
goes the same way, since the person may have taken Android's permission back
since. Until Android answers, the request waits for Android, and a new
request for the same website and set of devices joins it rather than asking
the person again.

Grace makes one such call at a time for each website and set of devices, for
the earliest request waiting for them: the reply AskAndroid is that call,
`answerSitePermission` with `grant: true`, and goes to that request alone. A
request that joins, or that waited for the person alongside the one they
allowed, is told nothing yet. When the request being called for ends without
Android's verdict, the earliest one still waiting for that website and set is
told AskAndroid next, so every request waiting for Android has a call
outstanding for it or for one ahead of it, and Grace counts one call at a
time for each website and set. That one is Grace's count, not Android's: a
call for a request that already ended may still be resolving behind
Android's prompt when the next is made, its outcome is refused because its
request is no longer called for, and Android runs the next call after it.
The call resolves with its `outcome`, which the host reports for that
request. When Android rejects the call itself instead of resolving it, as
`SITE_PERMISSION_CLOSED` or `INVALID_REQUEST`, the shell must report it as
`ended` for that request, since nothing else would end it and the requests
waiting behind it would never be called:

- `granted`: the page got the devices. The Allow is stored and every request
  waiting for that website and set is told Allowed.
- `android-refused`: Android did not allow them. Every such request is told
  Denied, nothing is stored and an earlier Allow for that website and set is
  forgotten, so the person is asked again next time, and the person sees a
  plain notice that Android did not allow it until they close it.
- `ended`: the request ended without a verdict: it was no longer held (the
  page withdrew it, or anything in "Looking away from a page ends what it
  asked, and never accepts it" ended it), the page had left the requesting
  website, Android could not ask (no prompt could open, or it gave no answer
  because another permission prompt was showing), or Android rejected the
  call. Only that request is done, told Cancelled as when leaving the page
  ends it. Nothing is stored or forgotten and no notice is shown; the others
  stay waiting for Android, and the earliest of them is called next.
- `denied` is what `grant: false` returns, so Grace never gets it for the
  request it called; were it reported, the shell reports it as `ended`.

The page withdrawing it and everything that ends a page's requests in
"Looking away from a page ends what it asked, and never accepts it"
(selecting another tab, hiding the browser, a page start, closing the tab,
Close browser and confirmed clearing of browsing data) end a request waiting
for Android as any other request, the one being called for included, and
the earliest one still waiting for that website and set is called next. The
surface then ends that call itself; an outcome reported for it after is
refused, as its request is no longer called for. A stored Allow therefore always means Android allowed
it. The shell makes no second call for the request whose call resolved: the
surface already told its page. It sends Allowed or Denied to each of the
others with `answerSitePermission`, with `grant: true` or `false`.

```quint
type AndroidOutcome = AndroidGranted | AndroidRefused | AndroidEnded
pure def waitingOnAndroid(s: WebsiteRequests, ask: Ask): bool = s.asking.some(q => sameSite(q.ask, ask))
pure def toAndroid(s: WebsiteRequests, report: HostReport): bool = {
  val ask = report.ask
  match ask {
    | SitePermission(p) => not(heldBack(s, report)) and report.topFrame and
        (if (decided(s, p.origin, p.kinds)) allowedBefore(s, p.origin, p.kinds) else waitingOnAndroid(s, ask))
    | _ => false
  }
}
pure def askedOf(s: WebsiteRequests, id: int): WebsiteRequest = s.asking.select(r => r.id == id).nthOr(0, noRequest)
pure def firstWaiting(asking: List[WebsiteRequest], ask: Ask): WebsiteRequest =
  asking.select(q => sameSite(q.ask, ask)).nthOr(0, noRequest)
pure def calledFor(s: WebsiteRequests, ask: Ask): WebsiteRequest = firstWaiting(s.asking, ask)
pure def androidDecides(verdict: AndroidOutcome): bool = verdict == AndroidGranted or verdict == AndroidRefused
pure def toldOf(verdict: AndroidOutcome): Answer =
  if (verdict == AndroidGranted) Allowed else if (verdict == AndroidRefused) Denied else Cancelled
pure def canAndroidAnswered(s: WebsiteRequests, id: int, verdict: AndroidOutcome, by: WebsiteActor): bool =
  by == WebsiteHost and s.asking.some(r => r.id == id) and calledFor(s, askedOf(s, id).ask).id == id
pure def androidAnswered(s: WebsiteRequests, id: int, verdict: AndroidOutcome, by: WebsiteActor): WebsiteResult =
  if (androidDecides(verdict)) androidSettled(id, verdict == AndroidGranted, s)
  else withdrawPermission(s, id, WebsiteHost)
pure def androidSettled(id: int, granted: bool, s: WebsiteRequests): WebsiteResult = {
  val r = askedOf(s, id)
  val origin = originOf(r.ask)
  val kinds = kindsOf(r.ask)
  {
    state: { ...s,
      asking: s.asking.select(q => not(sameSite(q.ask, r.ask))),
      decisions: if (not(granted)) s.decisions.select(d => not(d.origin == origin and d.kinds == kinds and d.allowed))
        else if (allowedBefore(s, origin, kinds)) s.decisions
        else s.decisions.append({ origin: origin, kinds: kinds, allowed: true }),
      openings: if (granted) s.openings else s.openings.append({ id: id, ask: r.ask, failed: true })
    },
    out: s.asking.select(q => sameSite(q.ask, r.ask)).listMap(q => replyOf(q, if (granted) Allowed else Denied))
  }
}
pure def stepOnlyAndroidStoresAnAllow(before: WebsiteRequests, via: str, after: WebsiteRequests): bool =
  via == "androidAnswered" or after.decisions.every(d => not(d.allowed) or before.decisions.includes(d))
pure def lawAWebsiteGetsADeviceOnlyWhenAndroidAllows(s: WebsiteRequests, id: int, verdict: AndroidOutcome, by: WebsiteActor): bool = {
  val r = askedOf(s, id)
  val after = androidAnswered(s, id, verdict, by)
  canAndroidAnswered(s, id, verdict, by) and androidDecides(verdict) and isPermission(r.ask) implies
    ((allowedBefore(after.state, originOf(r.ask), kindsOf(r.ask)) iff verdict == AndroidGranted) and
     after.out.every(reply => reply.answer == toldOf(verdict)) and
     after.out.includes(replyOf(r, toldOf(verdict))))
}
pure def lawAnUnsettledCallEndsOnlyItsRequest(s: WebsiteRequests, id: int, verdict: AndroidOutcome, by: WebsiteActor): bool = {
  val after = androidAnswered(s, id, verdict, by)
  canAndroidAnswered(s, id, verdict, by) and not(androidDecides(verdict)) implies
    (after.state.asking == s.asking.select(q => q.id != id) and after.state.decisions == s.decisions and
     after.state.openings == s.openings and after.out.every(reply => (reply.request == id and reply.answer == Cancelled) or
       (reply.answer == AskAndroid and reply.request == calledFor(after.state, reply.ask).id)))
}
pure def stepOneAndroidCallPerWebsite(before: WebsiteRequests, after: WebsiteRequests, out: List[WebsiteReply]): bool =
  out.every(reply => reply.answer != AskAndroid or
    (calledFor(after, reply.ask).id == reply.request and not(after.asking.includes(calledFor(before, reply.ask)))))
pure def stepEveryAndroidWaitHasACall(before: WebsiteRequests, after: WebsiteRequests, out: List[WebsiteReply]): bool =
  after.asking.every(q => calledFor(after, q.ask).id != q.id or calledFor(before, q.ask).id == q.id or
    out.includes(replyOf(q, AskAndroid)))
pure def sometimesAndroidIsAsked(s: WebsiteRequests): bool = s.asking.length() > 0
pure def sometimesARequestWaitsBehindAnotherCall(s: WebsiteRequests): bool =
  s.asking.some(r => calledFor(s, r.ask).id != r.id)
pure def sometimesAndroidRefuses(s: WebsiteRequests): bool = s.openings.some(o => o.failed and isPermission(o.ask))
```

## Story: Call, email or find a place from a website

> As an older adult, when I tap a phone number, email address or map link on
> a website, Grace asks before opening another app.

### Another app opens only after my tap and my confirmation

The surface reports a `tel:`, `mailto:`, `sms:`, `smsto:`, `geo:`, `market:`
or `intent:` link only when the person's tap started it; a script's is
dropped by the surface without a word, and one reported as not tapped is
refused here. A tapped one that can open waits for the person to confirm;
Cancel leaves them on the page. A tapped one that can never open, such as an
`intent:` link aimed at Grace itself, is explained plainly with only a button
to close the notice, never a Continue that would fail. A tab holds one such
link at a time: a later one replaces an earlier one still waiting, which is
closed, as the surface keeps only the last. On the tablet Grace's own Email
is the mail app: while a mailbox is connected, the host reports a tapped
`mailto:` link as one that writes an email in Grace (`ComposeEmail`), and
Continue opens Grace's Email with a new, unsent draft to that address, the
website kept in its tab; with no mailbox connected it is an ordinary link to
another app.

```quint
pure def isOtherApp(ask: Ask): bool = match ask { | OtherApp(o) => true | _ => false }
pure def opensApp(handoff: AppHandoff): bool = handoff != RefusedLink
pure def appOpens(ask: Ask): bool = match ask { | OtherApp(o) => opensApp(o.handoff) | _ => false }
pure def lawALinkThatCannotOpenOffersNoContinue(ask: Ask, choice: Choice): bool =
  isOtherApp(ask) and not(appOpens(ask)) and fits(ask, choice) implies
    (not(choice.accept) and answerFor(ask, choice) == Declined)
pure val askValues = Set(OtherApp({ handoff: DialApp }), OtherApp({ handoff: RefusedLink }), FileChoice)
pure def sometimesAnotherAppIsConfirmed(s: WebsiteRequests): bool = appOpens(presented(s).ask)
pure def sometimesAnEmailLinkIsConfirmed(s: WebsiteRequests): bool = presented(s).ask == OtherApp({ handoff: ComposeEmail })
pure def sometimesALinkThatCannotOpenIsExplained(s: WebsiteRequests): bool =
  isOtherApp(presented(s).ask) and not(appOpens(presented(s).ask))
```

### When the app or browser I confirmed does not open, I am told

Choose for a file request, and Continue for another app or for a refused
sign-in, is a call Grace makes, which Android can still fail: another file
picker is already open (`FILE_CHOOSER_BUSY`) or none is available
(`FILE_CHOOSER_UNAVAILABLE`), no app on the tablet opens the link, no other
browser is installed, Android refuses the launch, or the page moved on first.
The host reports how that call ended for the request it answered. An
`intent:` link can name a secure web page to show when no app opens it,
which the surface checks is an `https://` address: when no app on the tablet
opens such a link, the host shows that page in the same tab, as a link the
website followed by itself, and the call counts as opened. When it
opened, nothing more is said; when it did not, the person is told plainly
what did not open until they close the notice, and a file request that got
no picker gets no file. Leaving the page, hiding the browser and Close
browser do not dismiss the notice, since the call is Grace's own.

```quint
pure def canFinishOpening(s: WebsiteRequests, id: int, opened: bool, by: WebsiteActor): bool =
  by == WebsiteHost and s.openings.some(o => o.id == id and not(o.failed))
pure def finishOpening(s: WebsiteRequests, id: int, opened: bool, by: WebsiteActor): WebsiteRequests = {
  ...s, openings: if (opened) s.openings.select(o => o.id != id)
    else s.openings.listMap(o => if (o.id == id) { ...o, failed: true } else o)
}
pure def canDismissOpening(s: WebsiteRequests, id: int, by: WebsiteActor): bool =
  by == WebsitePerson and s.openings.some(o => o.id == id and o.failed)
pure def dismissOpening(s: WebsiteRequests, id: int, by: WebsiteActor): WebsiteRequests = {
  ...s, openings: s.openings.select(o => o.id != id)
}
pure def alwaysOpeningsAreRecorded(s: WebsiteRequests): bool =
  s.openings.every(o => o.id > 0 and o.id < s.nextId)
pure def sometimesAnAppDoesNotOpen(s: WebsiteRequests): bool = s.openings.some(o => o.failed and isOtherApp(o.ask))
pure def sometimesAFilePickerDoesNotOpen(s: WebsiteRequests): bool = s.openings.some(o => o.failed and isFileChoice(o.ask))
pure val weight_dismissOpening = 3
pure val weight_finishOpening = 2
```

## Story: Sign in with Google or Facebook on a website

> As an older adult, when a website's "Sign in with Google" will not work
> inside Grace, I am told why and can continue in my tablet's browser.

### A refused sign-in is explained with the option to continue in the tablet's browser

The sign-in page is not loaded inside Grace. The request always waits for the
person, on its own tab, and is never refused for them: Continue hands it to
the tablet's own browser (Chrome on the tablet user QA runs on), where she
signs in; Cancel keeps the person on the website. Continue is offered only
when the tablet has such a browser: without one the host reports the sign-in
as a link that cannot open (`RefusedLink`), explained with only a button to
close the notice. This is a website's own sign-in, separate from Grace's
Google sign-in for her mail and her Eliza Cloud account, which never goes
through a website. Selecting another
tab or hiding the browser keeps it, as the surface does: no new view ends
it. Only a page start or
close of its tab, a later sign-in on the same tab (which replaces it, as the
surface keeps only the last), Close browser or clearing browsing data ends
it.

```quint
pure def isBlockedSignIn(ask: Ask): bool = match ask { | BlockedSignIn(b) => true | _ => false }
pure def lawABlockedSignInIsExplained(s: WebsiteRequests, report: HostReport, by: WebsiteActor): bool =
  canRaise(s, report, by) and isBlockedSignIn(report.ask) implies
    (raise(s, report, by).state.requests.includes(newRequest(s, report)) and
     raise(s, report, by).out.every(o => o.answer == Cancelled))
pure def lawHidingKeepsASignIn(s: WebsiteRequests, by: WebsiteActor): bool =
  canHideBrowser(s, by) implies
    s.requests.every(r => not(isBlockedSignIn(r.ask)) or hideBrowser(s, by).state.requests.includes(r))
pure def lawANewViewKeepsASignIn(s: WebsiteRequests, view: PageView, by: WebsiteActor): bool =
  canFollowView(s, view, by) implies
    s.requests.every(r => not(isBlockedSignIn(r.ask)) or followView(s, view, by).state.requests.includes(r))
pure def sometimesASignInIsExplained(s: WebsiteRequests): bool = isBlockedSignIn(presented(s).ask)
pure def sometimesASignInWaitsWhileHidden(s: WebsiteRequests): bool = not(s.shown) and s.requests.length() > 0
pure def sometimesASignInWaitsOnAnotherTab(s: WebsiteRequests): bool =
  s.shown and s.requests.some(r => r.tab != s.selected)
```

## Story: Stay signed in to my websites

> As an older adult, once I sign in to my bank or clinic website, I stay
> signed in when I open another tab, close the browser or restart my tablet,
> until I choose to clear my browsing data.

### Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation

Grace keeps one browsing profile: every tab's surface uses the same
`profileKey`, so its cookies belong to no tab. Closing tabs, the last one
included, Close browser and restarting Grace close pages, not sign-ins. Clear
browsing data, in Settings, asks once for confirmation; cancelling it, or
leaving Settings while it asks, changes nothing. The shell reports Settings
closing (`settingsClosed`). Confirming purges the profile (`purgeProfiles`
with that `profileKey`), which closes every tab's surface at once: as when a
page starts, every request the pages held ends, each told Cancelled
(messages cancelled, file requests given no file, site permissions denied,
whether waiting for the person or for Android, offered downloads recorded as
not saved, questions about another app and refused sign-ins closed), and no
tab is open here until its new surface starts a page. While the purge runs,
no page starts: the shell creates no surface until the host reports how the
purge ended. The purge resolves once the cookies are removed, and says
whether the profile is left clean (`clean`). Only a clean purge signs every
website out and forgets every site decision. A purge that is not clean, or
that fails, forgets nothing here, and the person sees a plain notice that
their browsing data was not cleared until they close it or ask to clear
again. It is a separate action from Clear recent websites in the
[browser](./browser.md): that one empties the recent websites list and keeps
sign-ins, and this one keeps that list.

```quint
pure def canSiteSignedIn(s: WebsiteRequests, origin: str, by: WebsiteActor): bool =
  by == WebsiteHost and origin != "" and not(s.signedIn.contains(origin))
pure def siteSignedIn(s: WebsiteRequests, origin: str, by: WebsiteActor): WebsiteRequests = {
  ...s, signedIn: s.signedIn.union(Set(origin))
}
pure def canRequestClearBrowsingData(s: WebsiteRequests, by: WebsiteActor): bool =
  by == WebsitePerson and (s.clearing == NotClearing or s.clearing == ClearFailed)
pure def requestClearBrowsingData(s: WebsiteRequests, by: WebsiteActor): WebsiteRequests = { ...s, clearing: ConfirmingClear }
pure def canAnswerClearBrowsingData(s: WebsiteRequests, confirmed: bool, by: WebsiteActor): bool =
  by == WebsitePerson and s.clearing == ConfirmingClear
pure def answerClearBrowsingData(s: WebsiteRequests, confirmed: bool, by: WebsiteActor): WebsiteResult = {
  val left = stopAsking(if (confirmed) s.asking else List(), if (confirmed) List() else s.asking,
    withdraw(if (confirmed) s.requests else List(), if (confirmed) List() else s.requests, s))
  { state: { ...left.state, clearing: if (confirmed) Purging else NotClearing, tabs: if (confirmed) Set() else s.tabs },
    out: left.out }
}
pure def canSettingsClosed(s: WebsiteRequests, by: WebsiteActor): bool = by == WebsiteHost and s.clearing == ConfirmingClear
pure def settingsClosed(s: WebsiteRequests, by: WebsiteActor): WebsiteRequests = { ...s, clearing: NotClearing }
pure def canPurgeFinished(s: WebsiteRequests, clean: bool, by: WebsiteActor): bool = by == WebsiteHost and s.clearing == Purging
pure def purgeFinished(s: WebsiteRequests, clean: bool, by: WebsiteActor): WebsiteRequests =
  if (clean) { ...s, clearing: NotClearing, signedIn: Set(), decisions: List() } else { ...s, clearing: ClearFailed }
pure def canDismissClearFailed(s: WebsiteRequests, by: WebsiteActor): bool = by == WebsitePerson and s.clearing == ClearFailed
pure def dismissClearFailed(s: WebsiteRequests, by: WebsiteActor): WebsiteRequests = { ...s, clearing: NotClearing }
pure def alwaysNoPageIsOpenWhilePurging(s: WebsiteRequests): bool = s.clearing == Purging implies s.tabs.size() == 0
pure def stepSignInsLastUntilCleared(before: WebsiteRequests, via: str, after: WebsiteRequests): bool =
  (via == "purgeFinished" and after.clearing == NotClearing) or before.signedIn.subseteq(after.signedIn)
pure def sometimesSignedInAfterClosing(s: WebsiteRequests): bool = s.signedIn.size() > 0 and s.tabs.size() == 0
pure def sometimesClearingWaitsForConfirmation(s: WebsiteRequests): bool =
  s.clearing == ConfirmingClear and s.signedIn.size() > 0
pure def sometimesClearingPurges(s: WebsiteRequests): bool = s.clearing == Purging and s.signedIn.size() > 0
pure def sometimesClearingFails(s: WebsiteRequests): bool = s.clearing == ClearFailed and s.signedIn.size() > 0
pure val originValues = Set("", "https://clinic.example", "https://bank.example")
```
