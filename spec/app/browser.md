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
`left` keeps the history, entry and padlock the tab had when its current load
began, which Stay on a leave-page warning returns it to.

```quint
type Load = Blank | Loading | Loaded | LoadFailed | SecurityBlocked
type LeftPage = { history: List[str], cursor: int, secure: bool }
type Tab = {
  id: int, history: List[str], cursor: int, scroll: int,
  pagePanel: str, load: Load, recency: int, loadVersion: int, zoomPercent: int, secure: bool, left: LeftPage, manualSignIn: bool
}
type Browser = {
  tabs: List[Tab], selected: int, serial: int, nextId: int,
  capacity: int, revision: int, addressDraft: str,
  editingAddress: bool, emptyAddressNotice: bool,
  recent: List[str], clearRequested: bool
}
pure def blankTab(id: int, recency: int): Tab = {
  id: id, history: List(""), cursor: 0, scroll: 0,
  pagePanel: "", load: Blank, recency: recency, loadVersion: 0, zoomPercent: 100, secure: false,
  left: { history: List(""), cursor: 0, secure: false }, manualSignIn: false
}
pure def leftOf(t: Tab): LeftPage = { history: t.history, cursor: t.cursor, secure: t.secure }
pure val initial: Browser = {
  tabs: List(blankTab(1, 0)), selected: 1, serial: 0, nextId: 2,
  capacity: 1, revision: 0, addressDraft: "", editingAddress: false,
  emptyAddressNotice: false, recent: List(), clearRequested: false
}
pure def hasTab(b: Browser, id: int): bool = b.tabs.some(t => t.id == id)
pure def activeTab(b: Browser): Tab = tabById(b, b.selected)
pure def tabUrl(browserTab: Tab): str = browserTab.history.nthOr(browserTab.cursor, "")
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
A new tab can always be opened; selecting one needs a tab with that id.
Opening, selecting and closing tabs, Close browser and Go each give the
browser its new tabs and revision and close the address editor, dropping its
draft and any empty-address notice (`addressClosed`).

```quint
pure def addressClosed(tabs: List[Tab], b: Browser): Browser = {
  ...b, tabs: tabs, revision: b.revision + 1, editingAddress: false, addressDraft: "", emptyAddressNotice: false
}
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

### A link I tap to open a new window opens in a new tab

A website's link meant for a new window, which the person tapped, opens its
address in a new tab after the others, selected and loading, as a new tab
followed by Go would; the page she tapped it on stays in its own tab. The
surface reports such a window only from the person's tap: a window a script
opens by itself never opens.

```quint
pure def canOpenWindow(b: Browser, url: str): bool = url != "" and not(activeTab(b).manualSignIn)
pure def openWindow(b: Browser, url: str): Browser = navigate(openTab(b), url)
pure def lawANewWindowOpensANewSelectedTab(b: Browser, url: str): bool =
  canOpenWindow(b, url) implies
    (openWindow(b, url).tabs.length() == b.tabs.length() + 1 and openWindow(b, url).selected == b.nextId)
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
pure def closeBrowser(b: Browser): Browser = {
  ...addressClosed(List(blankTab(b.nextId, b.serial + 1)), b), selected: b.nextId,
  nextId: b.nextId + 1, serial: b.serial + 1
}
```

## Story: Sign in privately on a website

> On a secure website, I can ask Grace to open a separate private sign-in tab
> and choose a saved login through Android, or type my own. I submit on the
> site. If it asks for verification, I can open Grace Email to find mail that
> has already arrived. I can also watch for new mail or use another email app,
> messages, an authenticator or another device. I return to the same website to finish.

### A private sign-in tab keeps its purpose until it closes

Private Sign-in opens from the selected HTTPS website’s origin. The
person can paste a full HTTPS address directly into its private address bar;
paths, query values and fragments stay out of the workspace, recent sites,
conversation and diagnostics. Its native
process and storage stay isolated for the tab's lifetime. Browser chrome
gets origins, load outcomes and whether the native tab can go Back or Forward. Grace cannot read or capture private page
content, send website operations, or offer a password through conversation.
The private tab can confirm a load at its current origin. It never reports a redirect address or opens another window in the ordinary browser. A private visit never enters recent websites. Closing the tab discards its
native session; no authenticated session is transferred to another tab.

~~~quint
pure def canOpenPrivateSignIn(b: Browser, url: str): bool =
  alwaysBrowserCountersAreValid(b) and url != "" and not(activeTab(b).manualSignIn)
pure def openPrivateSignIn(b: Browser, url: str): Browser = {
  val tab = { ...blankTab(b.nextId, b.serial + 1), history: List(url),
    load: Loading, loadVersion: b.revision + 1, manualSignIn: true }
  {
    ...addressClosed(b.tabs.append(tab), b),
    selected: b.nextId, nextId: b.nextId + 1, serial: b.serial + 1
  }
}
pure def sometimesPrivateSignInIsOpen(b: Browser): bool = activeTab(b).manualSignIn
pure def lawPrivateLoadsRefuseOtherAddresses(b: Browser, id: int, loadVersion: int, result: Load, endedAt: str): bool =
  (tabById(b, id).manualSignIn and endedAt != tabUrl(tabById(b, id))) implies
    not(canFinishPageLoad(b, id, loadVersion, result, endedAt))
pure def lawPrivateTabsCannotOpenOrdinaryWindows(b: Browser, url: str): bool =
  activeTab(b).manualSignIn implies not(canOpenWindow(b, url))
pure def lawPrivateVisitsStayOutOfRecent(b: Browser, id: int, loadVersion: int, result: Load, secure: bool, endedAt: str): bool =
  (canFinishPageLoad(b, id, loadVersion, result, endedAt) and tabById(b, id).manualSignIn) implies
    finishPageLoad(b, id, loadVersion, result, secure, endedAt).recent == b.recent
~~~

## Story: Keep every tab reachable when the window changes

> As a person using Grace, I can still find all my tabs when Grace is open
> or the screen becomes narrower, without pages closing or moving around.

### Overflow retains the selected tab and the most recently used other tabs in opening order

The selected tab takes one position. Remaining positions go to the most
recently used others, breaking equal recency by newer ID. Both visible and
overflow lists preserve opening order. A width change never closes a tab.

```quint
pure def moreRecent(browserTab: Tab, candidate: Tab): bool =
  browserTab.recency > candidate.recency or (browserTab.recency == candidate.recency and browserTab.id > candidate.id)
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
pure val browserTabValues = candidateValues
pure val tValues = browserTabValues.union(Set(
  { ...blankTab(1, 0), history: List("https://utility.example", "https://utility.example/home"), cursor: 1 },
  { ...blankTab(1, 0), history: List("https://utility.example", "https://utility.example/home"), cursor: 0 },
  { ...blankTab(1, 0), history: List("first", "middle", "last"), cursor: 1 },
  { ...blankTab(1, 0), history: List(), cursor: -1 },
  { ...blankTab(2, 1), history: List("https://utility.example"), manualSignIn: true }))
pure val capacityValues = Set(-1, 0, 1, 2, 3)
```

## Story: Enter a website and understand loading or failure

> As a person using Grace, I can type an address, use browser navigation and
> tell a new page load from a retained page, an error or a security block.

### Address entry preserves a draft and empty Go gives a visible explanation

Go and the keyboard's Enter dispatch the same navigation event. The adapter
resolves a nonempty address or search expression, rather than this model
guessing a domain. Go on text that names no page (next rule) shows a visible
explanation under the address until the person types again; while it shows,
Go again changes nothing. Address typing never starts the Grace microphone.
Browser toolbar and tabs retain their size when the native keyboard opens.

```quint
pure def editAddress(b: Browser, text: str): Browser = {
  ...b, addressDraft: text, editingAddress: true, emptyAddressNotice: false
}
pure def canExplainEmptyAddress(b: Browser): bool = not(b.emptyAddressNotice)
pure def explainEmptyAddress(b: Browser): Browser = { ...b, emptyAddressNotice: true }
pure def dismissAddress(b: Browser): Browser = { ...b, editingAddress: false }
pure def navigated(browserTab: Tab, url: str, loadVersion: int): Tab = {
  ...browserTab,
  history: browserTab.history.foldl(List(), (kept, visit) =>
    if (kept.length() <= browserTab.cursor) kept.append(visit) else kept).append(url),
  cursor: browserTab.cursor + 1, scroll: 0, pagePanel: "", load: Loading, loadVersion: loadVersion, secure: false,
  left: leftOf(browserTab)
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
names a page. A web address opens as read. Any other text that has something
in it is searched for as typed, including text the parsing refuses as an
address, such as another scheme (`ftp:`), a user name and password in the
address, or a control character: search words open the default search
provider's results for them. Only text with nothing in it, empty or spaces
alone, names no page: it opens nothing, and Go explains the empty address
instead. The default provider is DuckDuckGo, a
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

When the selected tab's page goes to another address by itself once its
load has ended, such as a link it follows on its own or a website sending it
on after it loaded, the tab records it as a navigation: its history, load
and revision change as they do for Go. While the tab's own load is under
way, a move is part of that load, even one the page makes after it starts:
the load reports where it ended and the entry it started records it (a load
that ends at another address, below), so no entry is added and Back still
returns to the page before. The
person's address edit is left as it was: an address being typed stays open
with its draft and any empty-address notice, so the person's typing is never
thrown away, and the address bar keeps editing until the person submits it
or dismisses it. A host-observed start at the same address, or without an
observable new address, reports an empty destination. A completed visit
then starts a fresh load at its retained address and clears the padlock.
Its history, forward entries and address edit survive.

```quint
pure def restartableVisit(t: Tab): bool = tabUrl(t) != "" and t.load != Blank and t.load != Loading
pure def canPageMoved(b: Browser, url: str): bool =
  activeTab(b).load != Loading and (canNavigate(b, url) or restartableVisit(activeTab(b)))
pure def pageMoved(b: Browser, url: str): Browser = if (url == "") reload(b) else {
  ...navigate(b, url),
  editingAddress: b.editingAddress, addressDraft: b.addressDraft, emptyAddressNotice: b.emptyAddressNotice
}
pure def lawAPageMovingByItselfKeepsTheAddressEdit(b: Browser, url: str): bool =
  val navigation = if (url == "") reload(b) else navigate(b, url)
  canPageMoved(b, url) implies
    (pageMoved(b, url).tabs == navigation.tabs and pageMoved(b, url).revision == navigation.revision and
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
Every tab, selected or not, records a move only once its own load has ended:
while it is loading, the move is refused and the load under way reports its
result with the address it ended at, which the entry it started then records
(a load that ends at another address, below). When an unselected page restarts without
a new observable address, it drops the prior connection mark and retains
its history and load outcome until a new load can be correlated.

```quint
pure def canTabMoved(b: Browser, id: int, url: str): bool =
  hasTab(b, id) and (canNavigate(b, url) or restartableVisit(tabById(b, id))) and tabById(b, id).load != Loading
pure def tabMoved(b: Browser, id: int, url: str): Browser =
  if (id == b.selected) pageMoved(b, url) else {
    ...b, tabs: b.tabs.listMap(t => if (t.id != id) t else if (url == "") { ...t, secure: false }
      else { ...navigated(t, url, t.loadVersion), load: t.load })
  }
pure def lawABackgroundTabMovingKeepsTheSelectedPage(b: Browser, id: int, url: str): bool =
  canTabMoved(b, id, url) and id != b.selected implies
    (activeTab(tabMoved(b, id, url)) == activeTab(b) and tabMoved(b, id, url).revision == b.revision and
     tabMoved(b, id, url).selected == b.selected)
pure def lawNoLoadFinishesOnABackgroundTabsMove(b: Browser, id: int, url: str, loadVersion: int, result: Load): bool =
  canTabMoved(b, id, url) and id != b.selected implies not(loadIsCurrent(tabMoved(b, id, url), id, loadVersion, result))
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
      loadVersion: b.revision + 1, secure: false, left: leftOf(t) } else t),
  revision: b.revision + 1, editingAddress: false
}
pure def canGoBack(b: Browser): bool = activeTab(b).cursor > 0
pure def goBack(b: Browser): Browser = moveInHistory(-1, b)
pure def canGoForward(b: Browser): bool = activeTab(b).cursor + 1 < activeTab(b).history.length()
pure def goForward(b: Browser): Browser = moveInHistory(1, b)
pure def canReload(b: Browser): bool = tabUrl(activeTab(b)) != ""
pure def reload(b: Browser): Browser = {
  ...b, tabs: b.tabs.listMap(t => if (t.id == b.selected)
    { ...t, load: Loading, loadVersion: b.revision + 1, secure: false, left: leftOf(t) } else t),
  revision: b.revision + 1
}
```

### Load results must match the tab and request that produced them

A stale callback cannot replace a newer navigation in its tab or a closed
tab. A background tab can finish loading without being selected. Selecting
it later uses the retained result without a new load. A security block is a
distinct result and does not authorize a bypass. Recent websites are recorded
only for an actually loaded nonempty destination. The adapter reports with
each result whether the connection was secure, and the address the load
ended at (`endedAt`, next rule); only a page that loaded keeps the
connection's security. The [workspace](./workspace.md) finishes every load
with this whole report (`finishPageLoad`). A website that asks for a user name
and password in the browser's own sign-in box (HTTP authentication) is not
supported: the box is cancelled and the website's own refusal page loads as
any page does.

```quint
pure def tabById(b: Browser, id: int): Tab = {
  val matches = b.tabs.select(t => t.id == id)
  matches.nthOr(matches.length() - 1, blankTab(0, 0))
}
pure def loadIsCurrent(b: Browser, id: int, loadVersion: int, result: Load): bool =
  hasTab(b, id) and loadVersion == tabById(b, id).loadVersion and tabById(b, id).load == Loading
  and (result == Loaded or result == LoadFailed or result == SecurityBlocked)
pure def canFinishPageLoad(b: Browser, id: int, loadVersion: int, result: Load, endedAt: str): bool =
  loadIsCurrent(b, id, loadVersion, result) and endedAt != "" and
  (not(tabById(b, id).manualSignIn) or endedAt == tabUrl(tabById(b, id)))
pure def finishPageLoad(b: Browser, id: int, loadVersion: int, result: Load, secure: bool, endedAt: str): Browser = {
  val tab = tabById(b, id)
  val url = if (endedAt == "") tabUrl(tab) else endedAt
  val remember = result == Loaded and url != "" and not(tab.manualSignIn)
  {
    ...b, tabs: b.tabs.listMap(t => if (t.id == id)
      { ...endedAtCursor(t, endedAt), load: result, secure: secure and result == Loaded } else t),
    recent: if (remember)
      List(url).concat(b.recent.select(visit => visit != url)) else b.recent,
    clearRequested: if (remember) false else b.clearRequested,
    revision: if (id == b.selected) b.revision + 1 else b.revision
  }
}
pure def sometimesWebsiteLoads(b: Browser): bool = activeTab(b).load == Loaded
pure def sometimesWebsiteFails(b: Browser): bool = activeTab(b).load == LoadFailed
pure def sometimesSecurityBlocksWebsite(b: Browser): bool = activeTab(b).load == SecurityBlocked
pure val observedRevisionValues = Set(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
pure val loadVersionValues = Set(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
```

### A load that ends at another address records where the page really is

A website often sends a page on while it loads, such as from its bare name
to `www` or to its sign-in page, and the person can tap a link before a load
has finished. The adapter reports the address the page is at when its load
ends, and the tab records it in the same history entry the load started
(a report always names where its load ended: a host that cannot tell
reports the tab's own address, and a report naming none is refused):
the address bar, the tab's label and the recent websites then name where the
page is, no history entry is added, and Back still returns to the page
before. A tab's other entries are kept as they were.

```quint
pure def endedAtCursor(t: Tab, endedAt: str): Tab =
  if (endedAt == "") t else {
    ...t, history: t.history.foldl(List(), (kept, visit) =>
      kept.append(if (kept.length() == t.cursor) endedAt else visit))
  }
pure def lawALoadRecordsWhereItEnded(endingTab: Tab, endedAt: str): bool =
  endedAt != "" and endingTab.cursor >= 0 and endingTab.cursor < endingTab.history.length() implies
    (endedAtCursor(endingTab, endedAt).history.length() == endingTab.history.length() and tabUrl(endedAtCursor(endingTab, endedAt)) == endedAt)
pure val redirectHistory = List("https://utility.example/start", "https://utility.example", "https://utility.example/charges")
pure val endingTabValues = Set(
  blankTab(1, 0),
  { ...blankTab(1, 0), history: redirectHistory, cursor: 0 },
  { ...blankTab(1, 0), history: redirectHistory, cursor: 1 },
  { ...blankTab(1, 0), history: redirectHistory, cursor: 2 },
  { ...blankTab(1, 0), history: redirectHistory, cursor: -1 },
  { ...blankTab(1, 0), history: redirectHistory, cursor: 3 })
pure val redirectedTo: str = "https://www.utility.example/home"
pure def sometimesARedirectIsFollowed(b: Browser): bool =
  activeTab(b).load == Loaded and tabUrl(activeTab(b)) == redirectedTo and activeTab(b).cursor > 0
pure val endedAtValues = Set("", redirectedTo)
```

### A load that never starts or never ends becomes the failure view with Reload

A load can fail to end: the page's surface cannot be created, the website
never answers, or it never finishes. The host then reports the load as
failed once `loadWaitSeconds` have passed since it started without its end,
as it reports any failed load, so nothing spins for ever: the tab shows
"This page didn't open." with Reload. The wait counts only while the page is
free to load: while it holds a website message for the person, the page is
paused, so the wait starts again from the beginning once she has answered.
When the wait ends, the host stops the load, so nothing goes on loading under
the failure view. Reload then opens the tab's address again, even when the
page never reached it, and Back and Forward go from the page actually shown.
There is no Stop: Reload, another address, Back and closing the tab are the
ways on. Stay on a leave-page warning is not a load that fails to end (next
rule).

```quint
pure val loadWaitSeconds: int = 30
pure def lawAFailedLoadOffersReload(b: Browser, loadVersion: int, endedAt: str): bool =
  alwaysTabsAreWellFormed(b) and canFinishPageLoad(b, b.selected, loadVersion, LoadFailed, endedAt) implies
    (activeTab(finishPageLoad(b, b.selected, loadVersion, LoadFailed, false, endedAt)).load == LoadFailed and
     canReload(finishPageLoad(b, b.selected, loadVersion, LoadFailed, false, endedAt)))
pure def sometimesAHungLoadOffersReload(b: Browser): bool = activeTab(b).load == LoadFailed and canReload(b)
```

### Opened offline, the browser shows the offline page, never a blank page

Internet opens whether or not the tablet is connected. While it is not, the
page area shows Grace's offline page in the browser's own grey, never a
blank or black page and never plum: "You're offline" over "Websites need the
internet. Grace can help you reconnect.", with one Fix Wi-Fi, which opens
the written steps on the Wi-Fi page as Home's offline banner does
([Notices](./notices.md)). It covers every tab, whatever its page, because
nothing a website draws can arrive. The tabs keep their pages while offline.
When the connection returns the browser carries on: a new tab shows the
new-tab page, a loaded page shows again, and a page that was asked for but
did not load (still loading, or failed) opens again.

```quint
type PageView = OfflinePage | NewTabView | FailureView | WebsiteView
pure def pageView(t: Tab, online: bool): PageView =
  if (not(online)) OfflinePage
  else if (tabUrl(t) == "") NewTabView
  else if (t.load == LoadFailed or t.load == SecurityBlocked) FailureView
  else WebsiteView
pure def reopensWhenOnline(t: Tab): bool = tabUrl(t) != "" and (t.load == Loading or t.load == LoadFailed)
pure def lawOfflineShowsTheOfflinePage(offlineTab: Tab): bool =
  pageView(offlineTab, false) == OfflinePage and pageView(offlineTab, true) != OfflinePage and
  (pageView(offlineTab, true) == NewTabView iff tabUrl(offlineTab) == "") and
  (reopensWhenOnline(offlineTab) implies pageView(offlineTab, true) != NewTabView)
pure val offlineTabValues = Set(
  blankTab(1, 0),
  { ...blankTab(1, 0), history: List("", "https://utility.example"), cursor: 1, load: Loading },
  { ...blankTab(1, 0), history: List("", "https://utility.example"), cursor: 1, load: Loaded },
  { ...blankTab(1, 0), history: List("", "https://utility.example"), cursor: 1, load: LoadFailed })
```

### Stay on a leave-page warning keeps the page she was on

A website can ask before its page is left. When the person answers Stay to
that warning raised by her own navigation, Back, Forward or reload, the
surface drops the navigation: the page she was on stays, and no page start
follows. The host reports this at once, and the tab returns to the history,
entry and padlock it had when that load began, loaded, so she keeps using
the page, such as a half-filled form, and Back, Forward and Reload act on
it. A warning raised by the website's own navigation, before anything moved
the tab, leaves the tab as it was.

```quint
pure def canStayOnPage(b: Browser, id: int, loadVersion: int): bool =
  hasTab(b, id) and tabById(b, id).load == Loading and tabById(b, id).loadVersion == loadVersion and
  tabById(b, id).left.cursor >= 0 and tabById(b, id).left.cursor < tabById(b, id).left.history.length() and
  tabById(b, id).left.history.nthOr(tabById(b, id).left.cursor, "") != ""
pure def stayOnPage(b: Browser, id: int, loadVersion: int): Browser = {
  ...b, tabs: b.tabs.listMap(t => if (t.id == id)
    { ...t, history: t.left.history, cursor: t.left.cursor, load: Loaded, secure: t.left.secure } else t),
  revision: if (id == b.selected) b.revision + 1 else b.revision
}
pure def lawStayingKeepsThePageSheWasOn(b: Browser, id: int, loadVersion: int): bool =
  canStayOnPage(b, id, loadVersion) implies
    (tabUrl(tabById(stayOnPage(b, id, loadVersion), id)) == tabById(b, id).left.history.nthOr(tabById(b, id).left.cursor, "") and
     tabById(stayOnPage(b, id, loadVersion), id).load == Loaded and
     tabById(stayOnPage(b, id, loadVersion), id).secure == tabById(b, id).left.secure)
```

### The padlock shows only on a page that loaded over a secure connection

The address bar shows the padlock for the selected tab only once its load
ended Loaded and the adapter reported the connection secure. A blank tab, a
page still loading, one that failed and one blocked for security never show
it, and every new load, Back, Forward and reload takes it away until that
load ends. While the person types an address the bar shows her draft, not
the page's address, so the padlock is hidden until she submits or dismisses
it. The private sign-in bar keeps her draft to itself, out of the browser's
record (a private sign-in tab, above), so it says whether she is typing
there (`typingPrivately`), and the padlock hides the same way. An `http://` address, typed or followed from a page, opens as any
other: the adapter reports its connection as not secure, so the page loads
without the padlock. On the tablet the surface refuses every certificate
error and all mixed content, so the adapter reports a page that loaded at an
`https://` address as secure. Decision: the prototype draws the padlock in every address bar,
even on an empty new tab (`prototype/Grace Prototype.html`, line 829); that is
a drawing shortcut, not product behavior, since an origin is never itself
proof that a website is safe.

```quint
pure def showsSecureIndicator(b: Browser, typingPrivately: bool): bool =
  not(b.editingAddress or (typingPrivately and activeTab(b).manualSignIn)) and activeTab(b).load == Loaded and activeTab(b).secure
pure def alwaysOnlyALoadedPageIsSecure(b: Browser): bool = b.tabs.every(t => t.secure implies t.load == Loaded)
pure def sometimesASecurePageShowsThePadlock(b: Browser): bool = showsSecureIndicator(b, false)
pure def sometimesALoadedPageIsNotSecure(b: Browser): bool = activeTab(b).load == Loaded and not(activeTab(b).secure)
pure def sometimesTypingHidesThePadlock(b: Browser): bool =
  b.editingAddress and activeTab(b).load == Loaded and activeTab(b).secure
```

## Story: Adjust the page without stale assistance

> As a person using Grace, I can scroll, zoom and use website controls,
> while Grace discards guidance and planned clicks based on the old page.

### Manual page changes and zoom invalidate observations without restyling the website

Page zoom scales website content only, not browser chrome or Grace. There is
no zoom control: websites follow the person's Text size setting, which the
host applies to each page as its zoom, and pinching the page is the
website's own. The adapter supplies an available positive zoom level. Zoom
belongs to the tab; there is no separate remembered per-site preference.
These events retain history and never grant payment approval or
personal-data access.

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
The simulation includes the destination recorded after a completed visit so
it can exercise removing that recent website.

```quint
pure def canRemoveRecent(b: Browser, url: str): bool = b.recent.includes(url)
pure def removeRecent(b: Browser, url: str): Browser = {
  ...b, recent: b.recent.select(visit => visit != url), clearRequested: false
}
pure def requestClearHistory(b: Browser): Browser = { ...b, clearRequested: true }
pure def canAnswerClearHistory(b: Browser): bool = b.clearRequested
pure def answerClearHistory(b: Browser, confirmed: bool): Browser = {
  ...b, recent: if (confirmed) List() else b.recent, clearRequested: false
}
pure def alwaysRecentDestinationsAreDistinct(b: Browser): bool =
  b.recent.every(url => url != "" and b.recent.select(visit => visit == url).length() == 1)
pure def stepRevisionNeverMovesBack(before: Browser, after: Browser): bool = after.revision >= before.revision
pure def sometimesRecentWebsiteExists(b: Browser): bool = b.recent.length() > 0
pure val urlValues = Set("", "a", "b", redirectedTo)
```
