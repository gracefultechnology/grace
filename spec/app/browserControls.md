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
  | OpenPrivateSignIn({ url: str })
  | RequestPrivateSignIn({ id: int, revision: int, origin: str })
  | SelectTab({ id: int }) | CloseTab({ id: int }) | Navigate({ url: str })
  | EditAddress({ text: str }) | ZoomPage({ percent: int }) | RemoveRecent({ url: str })
  | AnswerClearHistory({ confirmed: bool })
  | OpenWindow({ url: str }) | ResizeTabs({ revision: int, capacity: int })
  | RememberPage({ id: int, revision: int, scroll: int, pagePanel: str })
  | PageChanged({ id: int, revision: int })

pure def canControl(b: B::Browser, browserInput: BrowserInput, by: BrowserControlActor): bool = match browserInput {
  | ResizeTabs(data) => by == BrowserControlHost and data.revision == b.revision and
      data.capacity != b.capacity and B::canResize(b, data.capacity)
  | RememberPage(data) => by == BrowserControlHost and not(B::activeTab(b).manualSignIn) and data.id == b.selected and data.revision == b.revision and
      (data.scroll != B::activeTab(b).scroll or data.pagePanel != B::activeTab(b).pagePanel) and
      B::canRememberPagePosition(b, data.scroll)
  | PageChanged(data) => by == BrowserControlHost and data.id == b.selected and data.revision == b.revision
  | OpenWindow(data) => by == BrowserControlHost and B::canOpenWindow(b, data.url)
  | ZoomPage(data) => by == BrowserControlHost and data.percent != B::activeTab(b).zoomPercent and B::canZoomPage(b, data.percent)
  | RequestPrivateSignIn(data) => by == BrowserControlUser and data.id == b.selected and data.revision == b.revision and B::canOpenPrivateSignIn(b, data.origin)
  | OpenPrivateSignIn(data) => by == BrowserControlUser and B::canOpenPrivateSignIn(b, data.url)
  | NewTab => by == BrowserControlUser
  | SelectTab(data) => by == BrowserControlUser and data.id != b.selected and B::canSelectTab(b, data.id)
  | CloseTab(data) => by == BrowserControlUser and B::canCloseTab(b, data.id)
  | Navigate(data) => by == BrowserControlUser and not(B::activeTab(b).manualSignIn) and B::canNavigate(b, data.url)
  | EditAddress(data) => by == BrowserControlUser and not(B::activeTab(b).manualSignIn)
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
  | RequestPrivateSignIn(data) => B::openPrivateSignIn(b, data.origin)
  | OpenPrivateSignIn(data) => B::openPrivateSignIn(b, data.url)
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
pure val privateVisit = B::openPrivateSignIn(B::initial, "https://utility.example")
pure val loadedPrivateVisit = B::finishPageLoad(privateVisit, privateVisit.selected,
  B::activeTab(privateVisit).loadVersion, B::Loaded, true, "https://utility.example")
pure val bValues = Set(B::initial, B::navigate(B::initial, "https://utility.example"), loadedPrivateVisit)
pure val browserInputValues = Set(NewTab, Back, Forward, Reload, ExplainEmptyAddress, DismissAddress,
  RequestClearHistory, SelectTab({ id: 1 }), SelectTab({ id: 2 }), CloseTab({ id: 1 }),
  OpenPrivateSignIn({ url: "https://utility.example" }),
  RequestPrivateSignIn({ id: 1, revision: 0, origin: "https://utility.example" }),
  Navigate({ url: "https://utility.example" }), Navigate({ url: "https://credit.example" }), Navigate({ url: "" }),
  OpenWindow({ url: "https://credit.example" }), OpenWindow({ url: "" }),
  EditAddress({ text: "https://utility.example" }), EditAddress({ text: "" }),
  ZoomPage({ percent: 125 }), ZoomPage({ percent: 0 }), RemoveRecent({ url: "https://utility.example" }),
  AnswerClearHistory({ confirmed: true }), AnswerClearHistory({ confirmed: false }),
  ResizeTabs({ revision: 0, capacity: 2 }), ResizeTabs({ revision: 2, capacity: 2 }),
  RememberPage({ id: 1, revision: 2, scroll: 200, pagePanel: "details" }),
  PageChanged({ id: 1, revision: 2 }), PageChanged({ id: 1, revision: 0 }), PageChanged({ id: 2, revision: 2 }))
```

## Story: Ask Grace to start a private sign-in for my bill

> When I ask Grace to sign me in on the bill website I have open, she can bring up private sign-in. I choose the matching login in Android and decide whether to submit the form.

### A direct request uses the selected page and revision

The tablet receives a current request from the person and derives the HTTPS origin from the selected page; the browser host cannot start private sign-in. The browser refuses stale requests. For an active task the origin must match the task destination. A help question or a request away from a secure website shows how to ask again from the browser. Opening private sign-in gives no permission to read credentials, submit the login form or make a payment.

A few fixed phrases open it at once, even while Cloud reasoning is unavailable. Any other way she asks goes to Grace, whose reply can offer Private sign-in as a control for the secure page selected when she asked, named by that site. Her tap on it is the request, for that page and revision; Grace never sends it herself.

Before showing the control, the tablet checks the person’s complete request. She can ask to sign in here or name the open website by its exact host or HTTPS origin. If she names another website or the destination is unclear, she sees no sign-in button for the open site.

When the conversation has no reply controls, Grace directs her to the website’s own sign-in form.

```quint
pure def directSignInRequest(words: str): bool =
  words == "fill my password" or words == "use my saved password" or words == "use a saved password" or
  words == "sign me in to pay my bill" or words == "sign in to pay my bill"
pure def requestMatchesTask(browserInput: BrowserInput, task: str, origin: str): bool = match browserInput {
  | RequestPrivateSignIn(request) => task == "" or request.origin == origin
  | _ => true
}
pure def lawAnActiveBillCannotHandOffToAnotherOrigin(task: str, origin: str, other: str): bool =
  (task != "" and origin != other) implies
    not(requestMatchesTask(RequestPrivateSignIn({ id: 1, revision: 1, origin: other }), task, origin))
pure def lawStaleSignInRequestIsIgnored(b: B::Browser, id: int, revision: int, origin: str): bool =
  (id != b.selected or revision != b.revision) implies
    not(canControl(b, RequestPrivateSignIn({ id: id, revision: revision, origin: origin }), BrowserControlUser))
pure def lawTheBrowserHostCannotRequestPrivateSignIn(b: B::Browser, origin: str): bool =
  not(canControl(b, RequestPrivateSignIn({ id: b.selected, revision: b.revision, origin: origin }), BrowserControlHost))
```

### Only the person can open their mail app from the current private tab

If the website asks for a code by email, the person taps **Check email** on
the loaded private sign-in tab. Android opens a mail app through its normal
app selection. Grace sends no address, search, message or code and receives
no mail result. A stale request, another tab or a host request cannot open
mail. The handoff leaves the private tab open and grants no website work or
completion. If Android cannot open a mail app, the person can check on another
device. Back or Android's app switcher returns to the same private tab, where
the person enters the code directly on the website.

~~~quint
pure def canCheckPrivateEmail(b: B::Browser, id: int, revision: int, by: BrowserControlActor): bool =
  by == BrowserControlUser and id == b.selected and revision == b.revision and
  B::activeTab(b).manualSignIn and B::activeTab(b).load == B::Loaded
pure def lawPrivateEmailRequiresTheCurrentPersonTab(b: B::Browser, id: int, revision: int, by: BrowserControlActor): bool =
  (by != BrowserControlUser or id != b.selected or revision != b.revision or
    not(B::activeTab(b).manualSignIn) or B::activeTab(b).load != B::Loaded) implies
    not(canCheckPrivateEmail(b, id, revision, by))
~~~

### Only the person can fill the current private website field

During private sign-in the person enters a code on the website. Android
manages any system suggestion for the focused field. A choice for a different
field, document, tab or origin has no authority over the current field.
Entering a value leaves the guided task pending until the person resumes and
Grace checks the ordinary page.

~~~quint
type PrivateCodeField = { tab: int, revision: int, loadVersion: int, document: int, fieldId: int, topOrigin: str, fieldOrigin: str }
pure val testCodeField: PrivateCodeField = {
  tab: loadedPrivateVisit.selected, revision: loadedPrivateVisit.revision,
  loadVersion: B::activeTab(loadedPrivateVisit).loadVersion, document: 1, fieldId: 1,
  topOrigin: "https://utility.example", fieldOrigin: "https://utility.example"
}
pure val offeredValues = Set(testCodeField, { ...testCodeField, fieldOrigin: "https://other.example" })
pure val focusedValues = offeredValues.union(Set({ ...testCodeField, document: 2 }, { ...testCodeField, fieldId: 2 }))
pure def currentPrivateCodeField(b: B::Browser, focused: PrivateCodeField): bool = {
  val tab = B::activeTab(b)
  focused.tab == b.selected and focused.revision == b.revision and focused.loadVersion == tab.loadVersion and
    tab.manualSignIn and tab.load == B::Loaded and tab.secure and focused.topOrigin != "" and
    focused.topOrigin == B::tabUrl(tab) and focused.fieldOrigin == focused.topOrigin
}
pure def mayFillPrivateCodeField(b: B::Browser, offered: PrivateCodeField, focused: PrivateCodeField, by: BrowserControlActor): bool =
  by == BrowserControlUser and offered == focused and currentPrivateCodeField(b, focused)
pure def lawOnlyThePersonCanFillTheCurrentPrivateCodeField(b: B::Browser, offered: PrivateCodeField, focused: PrivateCodeField, by: BrowserControlActor): bool =
  mayFillPrivateCodeField(b, offered, focused, by) implies
    (by == BrowserControlUser and offered == focused and focused.tab == b.selected and focused.revision == b.revision and
     focused.loadVersion == B::activeTab(b).loadVersion and B::activeTab(b).manualSignIn and
     B::activeTab(b).load == B::Loaded and B::activeTab(b).secure and focused.fieldOrigin != "" and
     focused.fieldOrigin == B::tabUrl(B::activeTab(b)))
~~~

### A private sign-in tab keeps its address and page position to itself

In a private sign-in tab, the person enters an address or moves through history
using the private browser controls. The workspace refuses address edits and
navigation destinations for that tab. The browser host cannot report its
scroll position or open page panel.

```quint
pure def lawPrivateAddressesAndPanelsStayOutOfControls(b: B::Browser, text: str, scroll: int): bool =
  B::activeTab(b).manualSignIn implies
    (not(canControl(b, EditAddress({ text: text }), BrowserControlUser)) and
     not(canControl(b, Navigate({ url: text }), BrowserControlUser)) and
     not(canControl(b, RememberPage({ id: b.selected, revision: b.revision, scroll: scroll, pagePanel: text }), BrowserControlHost)))
```
