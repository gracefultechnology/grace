# The browser

Ordinary browsing works independently of Grace assistance. The current
`prototype/Grace Prototype.html` sets the glass browser and bottom-docked
Grace appearance; it still mocks one provider and leaves address entry and
additional tabs unimplemented (lines 1032–1066). This module adds real tab,
address, loading, history and security behavior. References: PRD BROWSER01–02,
INT06, INT12–14 and DEC16/20.

There is no configured biller or domain in this model. A URL is input data;
the future browser adapter parses it, preserves Chromium security checks and
reports the actual origin. An origin string is never itself proof that a
website is safe. `revision` changes whenever a previously observed target
may have changed. A later controller must match that revision before acting.

## Story: Browse and return to the page I left

> As a person using Grace, I can open websites, switch among tabs, go back or
> forward and return Home without losing the page I was reading.

### A browser starts with one empty tab and retains each tab's independent page

The history cursor is a zero-based position. A fresh tab's only history entry
is empty. IDs and recency numbers have no product-imposed upper bound. Scroll
and open page-panel state belong to the tab rather than to its position in
the tab strip. `capacity` is supplied from measured readable tab width, never
used to cap the number of tabs. `secure` records whether the tab's last load
ended on a connection the adapter reported secure; a fresh tab's is not.

```quint
type Load = Blank | Loading | Loaded | LoadFailed | SecurityBlocked
type Tab = {
  id: int, history: List[str], cursor: int, scroll: int,
  pagePanel: str, load: Load, recency: int, loadVersion: int, zoomPercent: int, secure: bool
}
type Browser = {
  tabs: List[Tab], selected: int, serial: int, nextId: int,
  capacity: int, revision: int, addressDraft: str,
  editingAddress: bool, emptyAddressNotice: bool,
  recent: List[str], clearRequested: bool
}
pure def blankTab(id: int, recency: int): Tab = {
  id: id, history: List(""), cursor: 0, scroll: 0,
  pagePanel: "", load: Blank, recency: recency, loadVersion: 0, zoomPercent: 100, secure: false
}
pure val initial: Browser = {
  tabs: List(blankTab(1, 0)), selected: 1, serial: 0, nextId: 2,
  capacity: 1, revision: 0, addressDraft: "", editingAddress: false,
  emptyAddressNotice: false, recent: List(), clearRequested: false
}
pure def hasTab(b: Browser, id: int): bool = b.tabs.some(t => t.id == id)
pure def activeTab(b: Browser): Tab = tabById(b, b.selected)
pure def tabUrl(t: Tab): str = t.history.nthOr(t.cursor, "")
pure def alwaysTabsAreWellFormed(b: Browser): bool =
  b.tabs.length() > 0 and b.tabs.every(t =>
    t.id > 0 and t.id < b.nextId and t.recency >= 0 and t.recency <= b.serial
    and t.history.length() > 0 and t.cursor >= 0 and t.cursor < t.history.length()
    and t.scroll >= 0 and t.loadVersion >= 0 and t.loadVersion <= b.revision
    and t.zoomPercent > 0)
pure def alwaysTabIdentifiersAreUnique(b: Browser): bool =
  b.tabs.every(t => b.tabs.select(other => other.id == t.id).length() == 1)
pure def alwaysSelectedTabExists(b: Browser): bool = hasTab(b, b.selected)
pure def alwaysBrowserCountersAreValid(b: Browser): bool =
  b.serial >= 0 and b.nextId > 1 and b.capacity > 0 and b.revision >= 0
```

### Opening and selecting tabs preserves opening order and retained page state

Selecting a loaded tab does not create a load or reset its scroll or panels.
Opening a tab appends it, selects it and records recency. Repeated selection
changes recency only; it does not reorder the stored list.
These controls accept any browser with valid counters; the explicit input
guards also reject malformed state at the model boundary. Opening, selecting
and closing tabs, Close browser and Go each give the browser its new tabs and
revision and close the address editor, dropping its draft and any
empty-address notice (`addressClosed`).

```quint
pure def addressClosed(tabs: List[Tab], b: Browser): Browser = {
  ...b, tabs: tabs, revision: b.revision + 1, editingAddress: false, addressDraft: "", emptyAddressNotice: false
}
pure def canOpenTab(b: Browser): bool = alwaysBrowserCountersAreValid(b)
pure def openTab(b: Browser): Browser = {
  ...addressClosed(b.tabs.append(blankTab(b.nextId, b.serial + 1)), b),
  selected: b.nextId, nextId: b.nextId + 1, serial: b.serial + 1
}
pure def canSelectTab(b: Browser, id: int): bool = hasTab(b, id)
pure def selectTab(b: Browser, id: int): Browser = {
  ...addressClosed(b.tabs.listMap(t => if (t.id == id) { ...t, recency: b.serial + 1 } else t), b),
  selected: id, serial: b.serial + 1
}
pure def sometimesSeveralTabsAreOpen(b: Browser): bool = b.tabs.length() >= 3
pure def sometimesAnOlderTabIsSelected(b: Browser): bool = b.tabs.length() >= 2 and b.selected == 1
```

### Closing the last tab creates a fresh blank tab and Close browser clears every tab

An unrelated tab close leaves the selected tab in place. Closing the selected
tab chooses the last remaining tab in opening order. Closing the browser
resets its pages; the owning shell returns Home. This does not delete recent
websites, personal memory, the conversation or unresolved payment evidence.

```quint
pure def canCloseTab(b: Browser, id: int): bool = hasTab(b, id)
pure def closeTab(b: Browser, id: int): Browser = {
  val remaining = b.tabs.select(t => t.id != id)
  val replacement = remaining.nthOr(remaining.length() - 1, blankTab(b.nextId, b.serial + 1))
  {
    ...addressClosed(if (remaining.length() == 0) List(replacement) else
      remaining.listMap(t => if (b.selected == id and t.id == replacement.id)
        { ...t, recency: b.serial + 1 } else t), b),
    selected: if (b.selected == id) replacement.id else b.selected,
    nextId: if (remaining.length() == 0) b.nextId + 1 else b.nextId,
    serial: b.serial + 1
  }
}
pure def canCloseBrowser(b: Browser): bool = alwaysBrowserCountersAreValid(b)
pure def closeBrowser(b: Browser): Browser = {
  ...addressClosed(List(blankTab(b.nextId, b.serial + 1)), b), selected: b.nextId,
  nextId: b.nextId + 1, serial: b.serial + 1
}
```

## Story: Keep every tab reachable when the window changes

> As a person using Grace, I can still find all my tabs when Grace is open
> or the screen becomes narrower, without pages closing or moving around.

### Overflow retains the selected tab and the most recently used other tabs in opening order

The selected tab takes one position. Remaining positions go to the most
recently used others, breaking equal recency by newer ID. Both visible and
overflow lists preserve opening order. A width change never closes a tab.

```quint
pure def moreRecent(tab: Tab, candidate: Tab): bool =
  tab.recency > candidate.recency or (tab.recency == candidate.recency and tab.id > candidate.id)
pure def tabVisible(b: Browser, candidate: Tab): bool =
  candidate.id == b.selected or
    b.tabs.select(t => t.id != b.selected and moreRecent(t, candidate)).length() < b.capacity - 1
pure def visibleTabs(b: Browser): List[Tab] = b.tabs.select(t => tabVisible(b, t))
pure def overflowTabs(b: Browser): List[Tab] = b.tabs.select(t => not(tabVisible(b, t)))
pure def hiddenCount(b: Browser): int = overflowTabs(b).length()
pure def canResize(b: Browser, capacity: int): bool = capacity > 0
pure def resize(b: Browser, capacity: int): Browser = {
  ...b, capacity: capacity, revision: b.revision + 1
}
pure def lawSelectedTabIsVisible(b: Browser, candidate: Tab): bool =
  candidate.id == b.selected implies tabVisible(b, candidate)
pure def sometimesOverflowIsNeeded(b: Browser): bool = b.tabs.length() > b.capacity
pure val candidateValues = Set(blankTab(1, 0), blankTab(2, 1))
pure val tValues = candidateValues
pure val tabValues = candidateValues
pure val capacityValues = Set(-1, 0, 1, 2, 3)
```

## Story: Enter a website and understand loading or failure

> As a person using Grace, I can type an address, use browser navigation and
> tell a new page load from a retained page, an error or a security block.

### Address entry preserves a draft and empty Go gives a visible explanation

Go and the keyboard's Enter dispatch the same navigation event. The adapter
resolves a nonempty address or search expression, rather than this model
guessing a domain. Address typing never starts the Grace microphone. Browser
toolbar and tabs retain their size when the native keyboard opens.

```quint
pure def canEditAddress(b: Browser): bool = alwaysBrowserCountersAreValid(b)
pure def editAddress(b: Browser, text: str): Browser = {
  ...b, addressDraft: text, editingAddress: true, emptyAddressNotice: false
}
pure def canExplainEmptyAddress(b: Browser): bool = b.addressDraft == ""
pure def explainEmptyAddress(b: Browser): Browser = { ...b, emptyAddressNotice: true }
pure def canDismissAddress(b: Browser): bool = alwaysBrowserCountersAreValid(b)
pure def dismissAddress(b: Browser): Browser = { ...b, editingAddress: false }
pure def navigated(t: Tab, url: str, loadVersion: int): Tab = {
  ...t,
  history: t.history.foldl(List(), (kept, visit) =>
    if (kept.length() <= t.cursor) kept.append(visit) else kept).append(url),
  cursor: t.cursor + 1, scroll: 0, pagePanel: "", load: Loading, loadVersion: loadVersion, secure: false
}
pure def canNavigate(b: Browser, url: str): bool = url != ""
pure def navigate(b: Browser, url: str): Browser =
  addressClosed(b.tabs.listMap(t => if (t.id == b.selected) navigated(t, url, b.revision + 1) else t), b)
pure def sometimesEmptyAddressIsExplained(b: Browser): bool = b.emptyAddressNotice
pure def sometimesARealNavigationLoads(b: Browser): bool = activeTab(b).load == Loading
```

### Typed text that is not a web address searches with the default provider

Go turns what the person typed into a destination. The adapter reads the
text with the browser's own address parsing, adding `https:` when the person
typed no scheme: it is a web address, words to search for, or nothing that
names a page. A web address opens as read; search words open the default
search provider's results for them; anything else opens no page, and Go
explains the empty address instead. The default provider is DuckDuckGo, a
product constant rather than a setting: the shell opens `provider` followed
by the search words, URL-encoded.

```quint
type TypedAddress = WebAddress({ url: str }) | SearchWords({ query: str }) | NoAddress
type Destination = Visit({ url: str }) | Search({ provider: str, query: str }) | Nowhere
pure val searchProvider: str = "https://duckduckgo.com/?q="
pure def addressDestination(typed: TypedAddress): Destination = match typed {
  | WebAddress(a) => if (a.url == "") Nowhere else Visit({ url: a.url })
  | SearchWords(w) => if (w.query == "") Nowhere else Search({ provider: searchProvider, query: w.query })
  | NoAddress => Nowhere
}
pure def lawSearchesUseOnlyTheDefaultProvider(typed: TypedAddress): bool = {
  val d = addressDestination(typed)
  match d {
    | Visit(v) => v.url != ""
    | Search(q) => q.provider == searchProvider and q.query != ""
    | Nowhere => true
  }
}
pure val typedValues = Set(WebAddress({ url: "https://utility.example" }), WebAddress({ url: "" }),
  SearchWords({ query: "utility bill" }), SearchWords({ query: "" }), NoAddress)
```

### A page that moves by itself keeps the address the person is typing

When the selected tab's page goes to another address by itself, such as a
website's redirect or a link it follows on its own, the tab records it as a
navigation: its history, load and revision change as they do for Go. The
person's address edit is left as it was: an address being typed stays open
with its draft and any empty-address notice, so the person's typing is never
thrown away, and the address bar keeps editing until the person submits it
or dismisses it.

```quint
pure def canPageMoved(b: Browser, url: str): bool = canNavigate(b, url)
pure def pageMoved(b: Browser, url: str): Browser = {
  ...navigate(b, url),
  editingAddress: b.editingAddress, addressDraft: b.addressDraft, emptyAddressNotice: b.emptyAddressNotice
}
pure def lawAPageMovingByItselfKeepsTheAddressEdit(b: Browser, url: str): bool =
  canPageMoved(b, url) implies
    (pageMoved(b, url).tabs == navigate(b, url).tabs and pageMoved(b, url).revision == navigate(b, url).revision and
     pageMoved(b, url).editingAddress == b.editingAddress and pageMoved(b, url).addressDraft == b.addressDraft)
```

### A tab whose page moves by itself while I am not looking at it records where it went

A page keeps running in a tab that is not selected, and while the browser
is hidden, so a website's redirect or a link it follows on its own can move
it there too. That tab records the new address in its history, as a page
moving by itself does, so every tab says where its page really is. A
selected tab's page records it exactly as above. Any other tab's page is
already there: it keeps its load and load version, and the browser's
revision, the selected tab and the person's address edit stay as they were.
Such a tab records a move only once its own load has ended: while it is
loading, the move is refused and the load under way reports its result for
the entry it started, so no load's result is ever credited to an entry the
page moved to by itself.

```quint
pure def canTabMoved(b: Browser, id: int, url: str): bool =
  hasTab(b, id) and canPageMoved(b, url) and (id == b.selected or tabById(b, id).load != Loading)
pure def tabMoved(b: Browser, id: int, url: str): Browser =
  if (id == b.selected) pageMoved(b, url) else {
    ...b, tabs: b.tabs.listMap(t => if (t.id == id) { ...navigated(t, url, t.loadVersion), load: t.load } else t)
  }
pure def lawABackgroundTabMovingKeepsTheSelectedPage(b: Browser, id: int, url: str): bool =
  canTabMoved(b, id, url) and id != b.selected implies
    (activeTab(tabMoved(b, id, url)) == activeTab(b) and tabMoved(b, id, url).revision == b.revision and
     tabMoved(b, id, url).selected == b.selected)
pure def lawNoLoadFinishesOnABackgroundTabsMove(b: Browser, id: int, url: str, loadVersion: int, result: Load): bool =
  canTabMoved(b, id, url) and id != b.selected implies not(canFinishLoad(tabMoved(b, id, url), id, loadVersion, result))
```

### Back and Forward stay within the selected tab's history

Navigating after Back drops only that tab's forward entries. A reload is an
actual load, while switching tabs is not. Empty or unavailable navigation is
refused without altering the page. Back and Forward are the same move one
entry either way (`moveInHistory`): it closes the address editor but keeps
its draft.

```quint
pure def moveInHistory(offset: int, b: Browser): Browser = {
  ...b, tabs: b.tabs.listMap(t => if (t.id == b.selected)
    { ...t, cursor: t.cursor + offset, scroll: 0, pagePanel: "",
      load: if (t.history.nthOr(t.cursor + offset, "") == "") Blank else Loading,
      loadVersion: b.revision + 1, secure: false } else t),
  revision: b.revision + 1, editingAddress: false
}
pure def canGoBack(b: Browser): bool = activeTab(b).cursor > 0
pure def goBack(b: Browser): Browser = moveInHistory(-1, b)
pure def canGoForward(b: Browser): bool = activeTab(b).cursor + 1 < activeTab(b).history.length()
pure def goForward(b: Browser): Browser = moveInHistory(1, b)
pure def canReload(b: Browser): bool = tabUrl(activeTab(b)) != ""
pure def reload(b: Browser): Browser = {
  ...b, tabs: b.tabs.listMap(t => if (t.id == b.selected)
    { ...t, load: Loading, loadVersion: b.revision + 1, secure: false } else t),
  revision: b.revision + 1
}
```

### Load results must match the tab and request that produced them

A stale callback cannot replace a newer navigation in its tab or a closed
tab. A background tab can finish loading without being selected. Selecting
it later uses the retained result without a new load. A security block is a
distinct result and does not authorize a bypass. Recent websites are recorded
only for an actually loaded nonempty destination. The adapter reports with
each result whether the connection was secure; only a page that loaded keeps
it. `finishLoad` is the same report from a host that does not say, and counts
the page as not secure until the [workspace](./workspace.md) passes the
adapter's answer through `finishPageLoad`.

```quint
pure def tabById(b: Browser, id: int): Tab = {
  val matches = b.tabs.select(t => t.id == id)
  matches.nthOr(matches.length() - 1, blankTab(0, 0))
}
pure def canFinishLoad(b: Browser, id: int, loadVersion: int, result: Load): bool =
  hasTab(b, id) and loadVersion == tabById(b, id).loadVersion and tabById(b, id).load == Loading
  and (result == Loaded or result == LoadFailed or result == SecurityBlocked)
pure def finishLoad(b: Browser, id: int, loadVersion: int, result: Load): Browser =
  finishPageLoad(b, id, loadVersion, result, false)
pure def canFinishPageLoad(b: Browser, id: int, loadVersion: int, result: Load): bool =
  canFinishLoad(b, id, loadVersion, result)
pure def finishPageLoad(b: Browser, id: int, loadVersion: int, result: Load, secure: bool): Browser = {
  val url = tabUrl(tabById(b, id))
  {
    ...b, tabs: b.tabs.listMap(t => if (t.id == id) { ...t, load: result, secure: secure and result == Loaded } else t),
    recent: if (result == Loaded and url != "")
      List(url).concat(b.recent.select(visit => visit != url)) else b.recent,
    clearRequested: if (result == Loaded and url != "") false else b.clearRequested,
    revision: if (id == b.selected) b.revision + 1 else b.revision
  }
}
pure def sometimesWebsiteLoads(b: Browser): bool = activeTab(b).load == Loaded
pure def sometimesWebsiteFails(b: Browser): bool = activeTab(b).load == LoadFailed
pure def sometimesSecurityBlocksWebsite(b: Browser): bool = activeTab(b).load == SecurityBlocked
pure val observedRevisionValues = Set(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
pure val loadVersionValues = Set(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
```

### The padlock shows only on a page that loaded over a secure connection

The address bar shows the padlock for the selected tab only once its load
ended Loaded and the adapter reported the connection secure. A blank tab, a
page still loading, one that failed and one blocked for security never show
it, and every new load, Back, Forward and reload takes it away until that
load ends. Decision: the prototype draws the padlock in every address bar,
even on an empty new tab (`prototype/Grace Prototype.html`, line 829); that is
a drawing shortcut, not product behavior, since an origin is never itself
proof that a website is safe.

```quint
pure def showsSecureIndicator(b: Browser): bool = activeTab(b).load == Loaded and activeTab(b).secure
pure def alwaysOnlyALoadedPageIsSecure(b: Browser): bool = b.tabs.every(t => t.secure implies t.load == Loaded)
pure def sometimesASecurePageShowsThePadlock(b: Browser): bool = showsSecureIndicator(b)
pure def sometimesALoadedPageIsNotSecure(b: Browser): bool = activeTab(b).load == Loaded and not(showsSecureIndicator(b))
```

## Story: Adjust the page without stale assistance

> As a person using Grace, I can scroll, zoom and use website controls,
> while Grace discards guidance and planned clicks based on the old page.

### Manual page changes and zoom invalidate observations without restyling the website

Page zoom scales website content only, not browser chrome or Grace. The
adapter supplies an available positive zoom level. Zoom belongs to the tab;
there is no separate remembered per-site preference. These events retain
history and never grant payment approval or personal-data access.

```quint
pure def canRememberPagePosition(b: Browser, scroll: int): bool = scroll >= 0
pure def rememberPagePosition(b: Browser, scroll: int, pagePanel: str): Browser = {
  ...b, tabs: b.tabs.listMap(t => if (t.id == b.selected)
    { ...t, scroll: scroll, pagePanel: pagePanel } else t),
  revision: b.revision + 1
}
pure def canZoomPage(b: Browser, percent: int): bool = percent > 0
pure def zoomPage(b: Browser, percent: int): Browser = {
  ...b, tabs: b.tabs.listMap(t => if (t.id == b.selected) { ...t, zoomPercent: percent } else t),
  revision: b.revision + 1
}
pure def canPageChanged(b: Browser): bool = alwaysBrowserCountersAreValid(b)
pure def pageChanged(b: Browser): Browser = { ...b, revision: b.revision + 1 }
pure def observationMatches(b: Browser, id: int, observedRevision: int): bool =
  id == b.selected and observedRevision == b.revision and activeTab(b).load == Loaded
pure def lawSecurityBlockPreventsObservationUse(b: Browser, id: int, observedRevision: int): bool =
  activeTab(b).load == SecurityBlocked implies not(observationMatches(b, id, observedRevision))
pure val percentValues = Set(-1, 0, 100, 125, 150, 200)
```

### Recent websites can be removed individually or cleared after one confirmation

The new-tab view renders at most two rows of these records according to its
available width. Each nonempty destination appears once. Removing a shortcut
does not close its tab or delete the provider's records. Cancelling Clear
keeps the list unchanged; a changed history invalidates the pending question.

```quint
pure def canRemoveRecent(b: Browser, url: str): bool = b.recent.includes(url)
pure def removeRecent(b: Browser, url: str): Browser = {
  ...b, recent: b.recent.select(visit => visit != url), clearRequested: false
}
pure def canRequestClearHistory(b: Browser): bool = alwaysBrowserCountersAreValid(b)
pure def requestClearHistory(b: Browser): Browser = { ...b, clearRequested: true }
pure def canAnswerClearHistory(b: Browser): bool = b.clearRequested
pure def answerClearHistory(b: Browser, confirmed: bool): Browser = {
  ...b, recent: if (confirmed) List() else b.recent, clearRequested: false
}
pure def alwaysRecentDestinationsAreDistinct(b: Browser): bool =
  b.recent.every(url => url != "" and b.recent.select(visit => visit == url).length() == 1)
pure def stepRevisionNeverMovesBack(before: Browser, after: Browser): bool = after.revision >= before.revision
pure def sometimesRecentWebsiteExists(b: Browser): bool = b.recent.length() > 0
```

### A browser is valid when it meets every rule above

`validBrowser` gathers every `always` rule of this spec in one place, so
that the [workspace](./workspace.md), which holds the browser, requires the
whole list and gains each new rule without keeping a copy of its own.
Whoever adds an `always` rule here adds it to `validBrowser` too.

```quint
pure def validBrowser(b: Browser): bool =
  alwaysTabsAreWellFormed(b) and alwaysTabIdentifiersAreUnique(b) and alwaysSelectedTabExists(b) and
  alwaysBrowserCountersAreValid(b) and alwaysOnlyALoadedPageIsSecure(b) and
  alwaysRecentDestinationsAreDistinct(b)
```
