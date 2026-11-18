# Browser controls over the current page

This stateless dispatcher supplies the [workspace](./workspace.md) with every
local [browser](./browser.md) control. It owns no browser copy. User controls
are separate from current-revision host reports; page load and correlated
task progress keep their dedicated workspace routes.

## Story: Use every browser control without bypassing Grace's interruption boundary

> As a person browsing, I can edit an address, navigate, manage tabs and recent
> websites, and change the page view while Grace observes the actual page.

### Controls reuse the browser's guards and update its one stored state

Typing into a previously closed address editor and dismissing its keyboard
change page geometry. Editing that same draft again does not. Navigation,
scroll, zoom, tab selection and layout changes invalidate observations;
editing recent shortcuts changes no displayed website. Host geometry reports
must name the current browser revision; page reports also name the selected
tab, so an old or background scroll callback cannot alter a newer page.
Repeated reports of unchanged geometry are refused. The host also opens the
new tab of a window the person tapped open on the selected page, and applies
the Text size setting to the selected page as its zoom; the person has no
zoom control. Every control keeps the browser's rules true, including that
only a loaded secure page shows the padlock.

```quint
import browser as B from "./browser"

type BrowserControlActor = BrowserControlUser | BrowserControlHost
type BrowserInput = NewTab | Back | Forward | Reload | ExplainEmptyAddress | DismissAddress
  | RequestClearHistory
  | SelectTab({ id: int }) | CloseTab({ id: int }) | Navigate({ url: str })
  | EditAddress({ text: str }) | ZoomPage({ percent: int }) | RemoveRecent({ url: str })
  | AnswerClearHistory({ confirmed: bool })
  | OpenWindow({ url: str }) | ResizeTabs({ revision: int, capacity: int })
  | RememberPage({ id: int, revision: int, scroll: int, pagePanel: str })
  | PageChanged({ id: int, revision: int })

pure def canControl(b: B::Browser, browserInput: BrowserInput, by: BrowserControlActor): bool = match browserInput {
  | ResizeTabs(data) => by == BrowserControlHost and data.revision == b.revision and
      data.capacity != b.capacity and B::canResize(b, data.capacity)
  | RememberPage(data) => by == BrowserControlHost and data.id == b.selected and data.revision == b.revision and
      (data.scroll != B::activeTab(b).scroll or data.pagePanel != B::activeTab(b).pagePanel) and
      B::canRememberPagePosition(b, data.scroll)
  | PageChanged(data) => by == BrowserControlHost and data.id == b.selected and data.revision == b.revision
  | OpenWindow(data) => by == BrowserControlHost and B::canOpenWindow(b, data.url)
  | ZoomPage(data) => by == BrowserControlHost and data.percent != B::activeTab(b).zoomPercent and B::canZoomPage(b, data.percent)
  | NewTab => by == BrowserControlUser
  | SelectTab(data) => by == BrowserControlUser and data.id != b.selected and B::canSelectTab(b, data.id)
  | CloseTab(data) => by == BrowserControlUser and B::canCloseTab(b, data.id)
  | Navigate(data) => by == BrowserControlUser and B::canNavigate(b, data.url)
  | EditAddress(data) => by == BrowserControlUser
  | ExplainEmptyAddress => by == BrowserControlUser and B::canExplainEmptyAddress(b)
  | DismissAddress => by == BrowserControlUser and b.editingAddress
  | Back => by == BrowserControlUser and B::canGoBack(b)
  | Forward => by == BrowserControlUser and B::canGoForward(b)
  | Reload => by == BrowserControlUser and B::canReload(b)
  | RemoveRecent(data) => by == BrowserControlUser and B::canRemoveRecent(b, data.url)
  | RequestClearHistory => by == BrowserControlUser and not(b.clearRequested)
  | AnswerClearHistory(data) => by == BrowserControlUser and B::canAnswerClearHistory(b)
}
pure def control(b: B::Browser, browserInput: BrowserInput, by: BrowserControlActor): B::Browser = match browserInput {
  | NewTab => B::openTab(b)
  | SelectTab(data) => B::selectTab(b, data.id)
  | CloseTab(data) => B::closeTab(b, data.id)
  | Navigate(data) => B::navigate(b, data.url)
  | OpenWindow(data) => B::openWindow(b, data.url)
  | EditAddress(data) => if (b.editingAddress) B::editAddress(b, data.text) else B::pageChanged(B::editAddress(b, data.text))
  | ExplainEmptyAddress => B::explainEmptyAddress(b)
  | DismissAddress => B::pageChanged(B::dismissAddress(b))
  | Back => B::goBack(b)
  | Forward => B::goForward(b)
  | Reload => B::reload(b)
  | ResizeTabs(data) => B::resize(b, data.capacity)
  | RememberPage(data) => B::rememberPagePosition(b, data.scroll, data.pagePanel)
  | ZoomPage(data) => B::zoomPage(b, data.percent)
  | PageChanged(data) => B::pageChanged(b)
  | RemoveRecent(data) => B::removeRecent(b, data.url)
  | RequestClearHistory => B::requestClearHistory(b)
  | AnswerClearHistory(data) => B::answerClearHistory(b, data.confirmed)
}
pure def validBrowser(b: B::Browser): bool =
  B::alwaysTabsAreWellFormed(b) and B::alwaysTabIdentifiersAreUnique(b) and
  B::alwaysSelectedTabExists(b) and B::alwaysBrowserCountersAreValid(b) and
  B::alwaysRecentDestinationsAreDistinct(b) and B::alwaysOnlyALoadedPageIsSecure(b)
pure def lawControlsPreserveBrowser(b: B::Browser, browserInput: BrowserInput, by: BrowserControlActor): bool =
  validBrowser(b) and canControl(b, browserInput, by) implies validBrowser(control(b, browserInput, by))
pure def editsRecent(browserInput: BrowserInput): bool = match browserInput {
  | RemoveRecent(data) => true
  | RequestClearHistory => true
  | AnswerClearHistory(data) => true
  | _ => false
}
pure def lawRecentEditsKeepPage(b: B::Browser, browserInput: BrowserInput, by: BrowserControlActor): bool =
  editsRecent(browserInput) implies
    (control(b, browserInput, by).revision == b.revision and control(b, browserInput, by).tabs == b.tabs)
pure val bValues = Set(B::initial, B::navigate(B::initial, "https://utility.example"))
pure val browserInputValues = Set(NewTab, Back, Forward, Reload, ExplainEmptyAddress, DismissAddress,
  RequestClearHistory, SelectTab({ id: 1 }), SelectTab({ id: 2 }), CloseTab({ id: 1 }),
  Navigate({ url: "https://utility.example" }), Navigate({ url: "https://credit.example" }), Navigate({ url: "" }),
  OpenWindow({ url: "https://credit.example" }), OpenWindow({ url: "" }),
  EditAddress({ text: "https://utility.example" }), EditAddress({ text: "" }),
  ZoomPage({ percent: 125 }), ZoomPage({ percent: 0 }), RemoveRecent({ url: "https://utility.example" }),
  AnswerClearHistory({ confirmed: true }), AnswerClearHistory({ confirmed: false }),
  ResizeTabs({ revision: 0, capacity: 2 }), ResizeTabs({ revision: 2, capacity: 2 }),
  RememberPage({ id: 1, revision: 2, scroll: 200, pagePanel: "details" }),
  PageChanged({ id: 1, revision: 2 }), PageChanged({ id: 1, revision: 0 }), PageChanged({ id: 2, revision: 2 }))
```
