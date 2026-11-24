# The page under Grace

On the tablet the website is a native page drawn one layer below Grace's
transparent interface. Nothing is cut out of the page: browser chrome,
Grace's compact and expanded windows, rail popovers, guidance and toasts are
painted over it by the interface, which owns their corners and shadows. The
interface measures the rect the page fills and the rects of every Grace
control drawn over the page, and the native host routes each touch by those
rects alone; TalkBack reaches the website's own nodes because the interface
marks its page area `aria-hidden`. This module owns that layering contract; the
[browser](./browser.md) owns tabs and loads, the [shell](./shell.md) the
selected surface and the [assistant](./assistant.md) its presentation.

The host learns new control rects asynchronously. `routed` is the set the
native input router last acknowledged; `requested` is the set sent and not
yet acknowledged. Rects are whole CSS pixels in the interface's coordinates.

## Story: Use the website under Grace's controls

> As a person using Grace, I see the website fill the browser window under
> Grace's controls; my taps on the page reach the website and my taps on
> Grace's controls never do.

### The page layer holds its rect, the controls drawn over it and the rects the host routes by

A new page takes no input until the host has acknowledged its first set of
control rects, even an empty one.

```quint
import shell as S from "./shell"
import assistant as A from "./assistant"
import conversation as C from "./conversation"

type Rect = { x: int, y: int, width: int, height: int }
type Point = { x: int, y: int }
type PageLayer = {
  shown: bool, hostVisible: bool, page: Rect, drawn: List[Rect],
  routed: List[Rect], requested: List[Rect],
  routingReady: bool, pending: bool, version: int,
  keyboard: int, reclaimed: Set[int], privateBack: Set[int], privateForward: Set[int],
  fullscreen: bool
}
pure val noRect: Rect = { x: 0, y: 0, width: 0, height: 0 }
pure val initial: PageLayer = {
  shown: false, hostVisible: true, page: noRect, drawn: List(), routed: List(), requested: List(),
  routingReady: false, pending: false, version: 0,
  keyboard: 0, reclaimed: Set(), privateBack: Set(), privateForward: Set(),
  fullscreen: false
}
pure def covers(r: Rect, p: Point): bool =
  p.x >= r.x and p.y >= r.y and p.x < r.x + r.width and p.y < r.y + r.height
pure def within(rects: List[Rect], outer: List[Rect]): bool = rects.every(r => outer.includes(r))
pure def wellFormed(r: Rect): bool = r.width >= 0 and r.height >= 0
pure def alwaysRectsAreWellFormed(l: PageLayer): bool =
  wellFormed(l.page) and l.drawn.every(r => wellFormed(r)) and
  l.routed.every(r => wellFormed(r)) and l.requested.every(r => wellFormed(r))
pure def alwaysVersionIsNonnegative(l: PageLayer): bool = l.version >= 0
```

### A private page reports which history directions are available

Each live private tab reports whether Android can go Back or Forward. Only
these two permissions are kept for the lifetime of its native surface. Going
back or forward runs in that surface, including between pages at one origin.

```quint
type PrivateHistory = { tab: int, back: bool, forward: bool }
pure def historyFor(l: PageLayer, tab: int): PrivateHistory =
  { tab: tab, back: l.privateBack.contains(tab), forward: l.privateForward.contains(tab) }
pure def withTab(tabs: Set[int], tab: int, present: bool): Set[int] =
  if (present) tabs.union(Set(tab)) else tabs.exclude(Set(tab))
pure def canReportHistory(l: PageLayer, history: PrivateHistory): bool =
  history.tab > 0 and historyFor(l, history.tab) != history
pure def reportHistory(l: PageLayer, history: PrivateHistory): PageLayer = {
  ...l, privateBack: withTab(l.privateBack, history.tab, history.back),
  privateForward: withTab(l.privateForward, history.tab, history.forward)
}
pure def lawHistoryAppliesOnlyToItsTab(l: PageLayer, history: PrivateHistory, tab: int): bool =
  historyFor(reportHistory(l, history), tab) == (if (tab == history.tab) history else historyFor(l, tab))
pure val historyValues = Set({ tab: 2, back: false, forward: false }, { tab: 2, back: true, forward: false },
  { tab: 2, back: false, forward: true }, { tab: 2, back: true, forward: true })
```

### A touch reaches the website only on the shown page and outside every routed control

The page takes a gesture that starts inside its rect while it is shown and
Grace's window is in the foreground, after routing is ready, and outside every rect the host routes to Grace,
while no video of the page is fullscreen; a fullscreen video takes every
gesture itself. Every other gesture stays with Grace for its whole length.

```quint
pure def pageTakes(l: PageLayer, p: Point): bool =
  l.shown and l.hostVisible and l.routingReady and not(l.fullscreen) and covers(l.page, p) and
    not(l.routed.some(r => covers(r, p)))
pure def lawHiddenPageTakesNoTouch(l: PageLayer, p: Point): bool =
  not(l.shown) implies not(pageTakes(l, p))
pure def lawTouchOutsideThePageStaysWithGrace(l: PageLayer, p: Point): bool =
  not(covers(l.page, p)) implies not(pageTakes(l, p))
pure val pValues = Set({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 50, y: 70 }, { x: 99, y: 99 }, { x: 120, y: 40 })
```

### A Grace control is drawn over the page only after the host routes its rect to Grace

Discovered by the ordering of the native bridge: the router learns new
rects after a round trip, so a control painted first could pass its first
tap to the website. Drawing therefore waits for the acknowledgement, and
removing a control stops drawing it before its rect is withdrawn. Once
routing is ready the interface draws only rects the router holds, and while
a request is outstanding only rects that request holds too. One request is
in flight at a time: the native router applies requests in order, so a
second one sent before the first is acknowledged could leave it holding
rects the model no longer tracks. The interface keeps only the latest rects
while waiting and sends them once the acknowledgement arrives. While
routing is not ready the page takes no touch at all, so with no request
outstanding, before the first one or after the page is recreated, the
interface may draw freely; the next request must cover everything drawn.

```quint
pure def canRequestRouting(l: PageLayer, rects: List[Rect]): bool =
  not(l.pending) and within(l.drawn, rects) and rects.every(r => wellFormed(r))
pure def requestRouting(l: PageLayer, rects: List[Rect]): PageLayer = {
  ...l, requested: rects, pending: true, version: l.version + 1
}
pure def canAcknowledgeRouting(l: PageLayer, version: int): bool = l.pending and version == l.version
pure def acknowledgeRouting(l: PageLayer, version: int): PageLayer = {
  ...l, routed: l.requested, pending: false, routingReady: true
}
pure def canDraw(l: PageLayer, rects: List[Rect]): bool =
  rects != l.drawn and rects.every(r => wellFormed(r)) and
  (l.routingReady implies within(rects, l.routed)) and (l.pending implies within(rects, l.requested))
pure def draw(l: PageLayer, rects: List[Rect]): PageLayer = { ...l, drawn: rects }
pure def alwaysDrawnControlsAreRouted(l: PageLayer): bool = l.routingReady implies within(l.drawn, l.routed)
pure def alwaysPendingRequestKeepsDrawnControls(l: PageLayer): bool =
  l.pending implies within(l.drawn, l.requested)
pure def lawNoTapOnADrawnControlReachesThePage(l: PageLayer, p: Point): bool =
  alwaysDrawnControlsAreRouted(l) and l.drawn.some(r => covers(r, p)) implies not(pageTakes(l, p))
pure def sometimesControlDrawnOverThePage(l: PageLayer): bool = l.shown and l.drawn.length() > 0
pure def sometimesRequestIsOutstanding(l: PageLayer): bool = l.pending and l.drawn.length() > 0
pure val stripRect: Rect = { x: 0, y: 0, width: 100, height: 20 }
pure val graceRect: Rect = { x: 0, y: 60, width: 100, height: 40 }
pure val rectsValues = Set(List(), List(stripRect), List(graceRect), List(stripRect, graceRect))
pure val versionValues = Set(0, 1, 2, 3, 4, 5, 6)
```

## Story: Keep the page still while Grace covers it

> As a person using Grace, when Grace's expanded window, Home or Settings
> covers the website, nothing I do there touches the page, and the page is
> where I left it when I come back.

### The page shows only on the ready browser surface while Grace is not expanded

Expanded Grace covers the page, so the page is paused rather than drawn
beneath it; compact Grace and popovers are drawn over a shown page. Hiding
keeps the page, its history and its scroll, and ends a fullscreen video.
While the device sleeps, `pageShows` is false, so the page is hidden and
paused under the sleep screen. `pageShows` is the one definition of the
page being shown, and the layer's `shown` is the one state set from it:
each `show` takes it from `pageShows` of the shell and assistant the
interface reports, so the layer is only as current as the
last `show`. The interface therefore sends `show` whenever the device or
the assistant changes so that `pageShows` differs from what the layer holds
(`reconcile` in `apps/app/src/page.vibe`, run after every workspace change).
Everything else that asks whether the page is shown, the native pages and
the website requests among them, is told it from the layer's `shown` and
`pageRuns` and never derives it again. A page shown for a covered shell or
assistant takes no touch.

```quint
pure def pageShows(s: S::Shell, a: A::Assistant): bool =
  s.readiness == S::Ready and s.surface == S::Browser and a.presentation != A::Expanded
pure def canShow(l: PageLayer, s: S::Shell, a: A::Assistant): bool = pageShows(s, a) != l.shown
pure def show(l: PageLayer, s: S::Shell, a: A::Assistant): PageLayer =
  { ...l, shown: pageShows(s, a), fullscreen: l.fullscreen and pageShows(s, a) }
pure def lawShowingACoveredPageTakesNoTouch(l: PageLayer, s: S::Shell, a: A::Assistant, p: Point): bool =
  (s.readiness != S::Ready or s.surface != S::Browser or a.presentation == A::Expanded) implies
    not(pageTakes(show(l, s, a), p))
pure def sometimesPageIsShown(l: PageLayer): bool = l.shown and l.routingReady
pure val sValues = Set(S::initial, S::openSurface(S::finishStartup(S::initial, true), S::Browser),
  S::sleep(S::openSurface(S::finishStartup(S::initial, true), S::Browser)))
pure val aValues = Set(A::initial, { ...A::initial, presentation: A::Compact }, { ...A::initial, presentation: A::Expanded })
```

### The sleep screen covers the page, which is hidden and paused while the device sleeps

The sleep screen is a covering control, as expanded Grace is: the page is
hidden beneath it rather than routed around it, so the sleep screen has no
rect for the host to route. Once the interface reports the sleeping shell,
the page neither runs nor takes a touch, wherever the touch lands, and it
keeps its tabs, history and scroll for when the device wakes. The rule holds
from that `show` on: between the interface painting the sleep screen and
the native host applying the hidden layer, a touch could still reach the
page, and this rule does not rule that window out.

```quint
pure def lawSleepingPageIsHiddenAndPaused(l: PageLayer, s: S::Shell, a: A::Assistant, p: Point): bool =
  s.readiness == S::Sleeping implies
    not(show(l, s, a).shown) and not(pageRuns(show(l, s, a))) and not(pageTakes(show(l, s, a), p))
```

### The page is paused while Grace's window is in the background

Switching apps, turning the screen off or another window covering Grace
pauses the page and ends a fullscreen video; it resumes when Grace's window
is visible again and the page is still shown. The native page is paused
exactly when `pageRuns` is false.

```quint
pure def pageRuns(l: PageLayer): bool = l.shown and l.hostVisible
pure def canSetHostVisible(l: PageLayer, visible: bool): bool = visible != l.hostVisible
pure def setHostVisible(l: PageLayer, visible: bool): PageLayer =
  { ...l, hostVisible: visible, fullscreen: l.fullscreen and visible }
pure def lawBackgroundPageTakesNoTouch(l: PageLayer, p: Point): bool =
  not(l.hostVisible) implies not(pageTakes(l, p))
pure def sometimesShownPageInBackground(l: PageLayer): bool = l.shown and not(l.hostVisible)
pure val visibleValues = Set(true, false)
```

### The page fills the rect the interface measured for it

The interface reports the page rect when the browser window, compact Grace
or the keyboard changes its size. Moving the page does not change which
controls are routed.

```quint
pure def canPlace(l: PageLayer, page: Rect): bool = wellFormed(page) and page != l.page
pure def place(l: PageLayer, page: Rect): PageLayer = { ...l, page: page }
pure def stepRoutingFollowsAcknowledgement(before: PageLayer, via: str, after: PageLayer): bool =
  after.routed != before.routed implies (via == "acknowledgeRouting" or via == "recreate")
pure val pageValues = Set({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 20, width: 100, height: 40 })
```

### The wallpaper is clear exactly over the page rect the layer holds

On the tablet Grace's wallpaper is painted over the whole screen with one
clear area, through which the page below shows. The clear area is the page
rect that `place` stored in the layer, so the wallpaper's opening and the
rect the native page is placed at come from one state and never from two
measurements. Nothing is clear while the page is not shown or the selected
tab has no address, as a new tab has, since no native page is there.

```quint
pure def clearArea(l: PageLayer, address: str): Rect = if (l.shown and address != "") l.page else noRect
pure def lawClearAreaIsThePlacedPage(l: PageLayer, page: Rect, address: str): bool =
  clearArea(place(l, page), address) == (if (l.shown and address != "") page else noRect)
```

### The keyboard's height is the host's report, held by the layer

Android's keyboard, whether for Grace's composer or a website's field,
covers the bottom of the screen. The host reports its height in whole CSS
pixels each time it changes, zero when it closes; the interface lifts
Grace's windows and measures the page rect from this value alone, never
from a copy of its own. Opening or closing the keyboard changes no routing.

```quint
pure def canReportKeyboard(l: PageLayer, height: int): bool = height >= 0 and height != l.keyboard
pure def reportKeyboard(l: PageLayer, height: int): PageLayer = { ...l, keyboard: height }
pure def alwaysKeyboardHeightIsNonnegative(l: PageLayer): bool = l.keyboard >= 0
pure def sometimesKeyboardOverTheShownPage(l: PageLayer): bool = l.shown and l.keyboard > 0
pure val heightValues = Set(0, 280, 320)
```

### A new page waits for its first routing before it takes any touch

A renderer crash or a recreated surface starts again from no routing, so an
old acknowledgement cannot let touches through to the new page, and a
fullscreen video ends. The interface keeps drawing its controls; the next
request routes them again.

```quint
pure def canRecreate(l: PageLayer): bool = l.routingReady or l.pending
pure def recreate(l: PageLayer): PageLayer = {
  ...l, routed: List(), requested: List(),
  routingReady: false, pending: false, version: l.version + 1, fullscreen: false
}
pure def sometimesRecreatedPageWaits(l: PageLayer): bool = l.shown and not(l.routingReady) and l.version > 0
```

### A page Android reclaims behind another tab waits until its tab is selected

Every tab with an address keeps a native page of its own, paused while it
is not selected, so a tab Grace opens in the background loads at once.
When Android takes back the page of a tab that is not selected, to free
memory, the tab stays without a page until the person selects it, and then
loads again at its address: reloading it at once would ask for the same
memory, spend her connection on a page she is not looking at and repeat
what the page did when it loaded. A closed tab is forgotten. When Android
rebuilds Grace's own interface every page is closed and the layer starts
again from `initial`: that is a restart, which the shell tells her in one
plain sentence, and no page is reopened behind her.

```quint
pure def canReclaim(l: PageLayer, tab: int, selected: int): bool =
  tab >= 0 and tab != selected and not(l.reclaimed.contains(tab))
pure def reclaim(l: PageLayer, tab: int, selected: int): PageLayer = {
  ...l, reclaimed: l.reclaimed.union(Set(tab))
}
pure def canReopen(l: PageLayer, tab: int, selected: int): bool = l.reclaimed.contains(tab) and tab == selected
pure def reopen(l: PageLayer, tab: int, selected: int): PageLayer = {
  ...l, reclaimed: l.reclaimed.exclude(Set(tab))
}
pure def canForget(l: PageLayer, tab: int): bool = l.reclaimed.contains(tab)
pure def forget(l: PageLayer, tab: int): PageLayer = { ...l, reclaimed: l.reclaimed.exclude(Set(tab)) }
pure def pageWanted(l: PageLayer, tab: int, selected: int, address: str): bool =
  address != "" and (tab == selected or not(l.reclaimed.contains(tab)))
pure def lawReclaimedPageWaitsForItsTab(l: PageLayer, tab: int, selected: int, address: str): bool =
  (l.reclaimed.contains(tab) and tab != selected) implies not(pageWanted(l, tab, selected, address))
pure def lawSelectedTabWithAnAddressHasAPage(l: PageLayer, tab: int, address: str): bool =
  address != "" implies pageWanted(l, tab, tab, address)
pure def alwaysReclaimedTabsAreTabs(l: PageLayer): bool = l.reclaimed.forall(t => t >= 0)
pure def sometimesBackgroundPageReclaimed(l: PageLayer): bool = l.reclaimed.size() > 0
pure val tabValues = Set(0, 1, 2)
pure val selectedValues = Set(0, 1)
pure val addressValues = Set("", "https://example.org/")
```

## Story: Watch a website's video fullscreen

> As a person using Grace, I can make a website's video fill the screen,
> even over Grace. Back brings me out of it, and when Grace speaks or I call
> her, the video leaves fullscreen first so I see her.

### Only a running page's video fills the screen over Grace

A website asks for fullscreen from its own page, which must be shown and
running. Android then draws the video over Grace's whole window, and the
video takes every touch: neither the page under it nor any Grace control
takes one, so Ask Grace cannot be tapped until the video leaves. Each touch
has exactly one taker: the video, the page or Grace. Grace's controls stay
drawn and routed beneath the video and are there again when it ends, unless
the page was recreated, after which the next request routes them again.
Fullscreen ends whenever the page stops running: hidden, in the background,
asleep or recreated.

```quint
pure def canEnterFullscreen(l: PageLayer): bool = pageRuns(l) and not(l.fullscreen)
pure def enterFullscreen(l: PageLayer): PageLayer = { ...l, fullscreen: true }
pure def alwaysFullscreenOnlyOnARunningPage(l: PageLayer): bool = l.fullscreen implies pageRuns(l)
pure def sometimesVideoCoversGrace(l: PageLayer): bool = l.fullscreen and l.drawn.length() > 0
pure def graceTakes(l: PageLayer, p: Point): bool = not(l.fullscreen) and not(pageTakes(l, p))
pure def lawFullscreenVideoTakesEveryTouch(l: PageLayer, p: Point): bool =
  l.fullscreen implies not(pageTakes(l, p)) and not(graceTakes(l, p))
pure def lawEachTouchHasOneTaker(l: PageLayer, p: Point): bool =
  (if (l.fullscreen) 1 else 0) + (if (pageTakes(l, p)) 1 else 0) + (if (graceTakes(l, p)) 1 else 0) == 1
```

### Leaving fullscreen returns the video to the page and Grace to view

The website leaving fullscreen, Back and Grace herself all leave by the
same event, which changes nothing but the video's size. Grace appears when
an assistant change opens her window or starts her listening or speaking,
whether "Hey Grace", Ask Grace or her own reply caused it. The interface applies
each assistant change to the layer through `appearGrace`, which leaves
fullscreen first whenever Grace appears, so she never appears under a
fullscreen video, and leaves the layer as it was otherwise.

```quint
pure def canLeaveFullscreen(l: PageLayer): bool = l.fullscreen
pure def leaveFullscreen(l: PageLayer): PageLayer = { ...l, fullscreen: false }
pure def heard(a: A::Assistant): bool = a.conversation.turn == C::Speaking or a.conversation.turn == C::Listening
pure def graceAppears(a: A::Assistant, later: A::Assistant): bool =
  (A::isVisible(later) and not(A::isVisible(a))) or (heard(later) and later.conversation.turn != a.conversation.turn)
pure def appearGrace(l: PageLayer, a: A::Assistant, later: A::Assistant): PageLayer =
  if (graceAppears(a, later) and canLeaveFullscreen(l)) leaveFullscreen(l) else l
pure def lawGraceNeverAppearsUnderAFullscreenVideo(l: PageLayer, a: A::Assistant, later: A::Assistant): bool =
  graceAppears(a, later) implies not(appearGrace(l, a, later).fullscreen)
pure def sameTabs(x: Set[int], y: Set[int]): bool = x.subseteq(y) and y.subseteq(x)
pure def lawAppearingChangesOnlyTheVideosSize(l: PageLayer, a: A::Assistant, later: A::Assistant): bool =
  val m = appearGrace(l, a, later)
  m.shown == l.shown and m.hostVisible == l.hostVisible and m.page == l.page and m.drawn == l.drawn and
    m.routed == l.routed and m.requested == l.requested and m.routingReady == l.routingReady and
    m.pending == l.pending and m.version == l.version and m.keyboard == l.keyboard and
    sameTabs(m.reclaimed, l.reclaimed) and sameTabs(m.privateBack, l.privateBack) and
    sameTabs(m.privateForward, l.privateForward)
pure def lawAskGraceMakesHerAppear(a: A::Assistant): bool =
  A::canOpen(a, C::ConversationUser) implies graceAppears(a, A::open(a, C::ConversationUser))
pure val speakingAssistant: A::Assistant =
  { ...A::initial, presentation: A::Compact, conversation: { ...C::initial, turn: C::Speaking } }
pure val laterValues = Set(A::initial, { ...A::initial, presentation: A::Compact }, speakingAssistant,
  { ...A::initial, presentation: A::Expanded })
```
