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

type Rect = { x: int, y: int, width: int, height: int }
type Point = { x: int, y: int }
type PageLayer = {
  shown: bool, hostVisible: bool, page: Rect, drawn: List[Rect],
  routed: List[Rect], requested: List[Rect],
  routingReady: bool, pending: bool, version: int,
  keyboard: int, reclaimed: Set[int]
}
pure val noRect: Rect = { x: 0, y: 0, width: 0, height: 0 }
pure val initial: PageLayer = {
  shown: false, hostVisible: true, page: noRect, drawn: List(), routed: List(), requested: List(),
  routingReady: false, pending: false, version: 0,
  keyboard: 0, reclaimed: Set()
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

### A touch reaches the website only on the shown page and outside every routed control

The page takes a gesture that starts inside its rect while it is shown and
Grace's window is in the foreground, after routing is ready, and outside every rect the host routes to Grace.
Every other gesture stays with Grace for its whole length.

```quint
pure def pageTakes(l: PageLayer, p: Point): bool =
  l.shown and l.hostVisible and l.routingReady and covers(l.page, p) and not(l.routed.some(r => covers(r, p)))
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
keeps the page, its history and its scroll. `pageShows` is the one
definition of the page being shown, and the layer's `shown` is the one copy
of it: each `show` takes it from `pageShows` of the shell and assistant the
interface reports, so the layer is only as current as the last `show`. The
interface therefore sends `show` whenever the device or the assistant
changes so that `pageShows` differs from what the layer holds (`reconcile`
in `apps/app/src/page.vibe`, run after every workspace change). Everything
else that asks whether the page is shown, the native pages and the website
requests among them, reads it from the layer through `shown` or `pageRuns`
and never derives it again. A page shown for a covered shell or assistant
takes no touch.

```quint
pure def pageShows(s: S::Shell, a: A::Assistant): bool =
  s.readiness == S::Ready and s.surface == S::Browser and a.presentation != A::Expanded
pure def canShow(l: PageLayer, s: S::Shell, a: A::Assistant): bool = pageShows(s, a) != l.shown
pure def show(l: PageLayer, s: S::Shell, a: A::Assistant): PageLayer = { ...l, shown: pageShows(s, a) }
pure def lawShowingACoveredPageTakesNoTouch(l: PageLayer, s: S::Shell, a: A::Assistant, p: Point): bool =
  (s.readiness != S::Ready or s.surface != S::Browser or a.presentation == A::Expanded) implies
    not(pageTakes(show(l, s, a), p))
pure def sometimesPageIsShown(l: PageLayer): bool = l.shown and l.routingReady
pure val sValues = Set(S::initial, S::openSurface(S::finishStartup(S::initial, true), S::Browser))
pure val aValues = Set(A::initial, { ...A::initial, presentation: A::Compact }, { ...A::initial, presentation: A::Expanded })
```

### The page is paused while Grace's window is in the background

Switching apps, turning the screen off or another window covering Grace
pauses the page; it resumes when Grace's window is visible again and the
page is still shown. The native page is paused exactly when `pageRuns` is
false.

```quint
pure def pageRuns(l: PageLayer): bool = l.shown and l.hostVisible
pure def canSetHostVisible(l: PageLayer, visible: bool): bool = visible != l.hostVisible
pure def setHostVisible(l: PageLayer, visible: bool): PageLayer = { ...l, hostVisible: visible }
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
old acknowledgement cannot let touches through to the new page. The
interface keeps drawing its controls; the next request routes them again.

```quint
pure def canRecreate(l: PageLayer): bool = l.routingReady or l.pending
pure def recreate(l: PageLayer): PageLayer = {
  ...l, routed: List(), requested: List(),
  routingReady: false, pending: false, version: l.version + 1
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
