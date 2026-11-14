lemma openTab_ensures(b: Browser)
  ensures (inv(b) ==> canOpenTab(b) ==> alwaysTabsAreWellFormed(openTab(b)))
  ensures (inv(b) ==> canOpenTab(b) ==> alwaysTabIdentifiersAreUnique(openTab(b)))
  ensures (inv(b) ==> canOpenTab(b) ==> alwaysBrowserCountersAreValid(openTab(b)))
  ensures (inv(b) ==> canOpenTab(b) ==> alwaysSelectedTabExists(openTab(b)))
  ensures (inv(b) ==> canOpenTab(b) ==> alwaysRecentDestinationsAreDistinct(openTab(b)))
  ensures (inv(b) ==> canOpenTab(b) ==> stepRevisionNeverMovesBack(b, openTab(b)))
{
  if inv(b) {
    TabKeysBridge(b);
    TabKeysBridge(openTab(b));
    assert forall i :: 0 <= i < |b.tabs| ==> b.tabs[i] in b.tabs;
  }
}

lemma closeBrowser_ensures(b: Browser)
  ensures (inv(b) ==> canCloseBrowser(b) ==> alwaysTabsAreWellFormed(closeBrowser(b)))
  ensures (inv(b) ==> canCloseBrowser(b) ==> alwaysTabIdentifiersAreUnique(closeBrowser(b)))
  ensures (inv(b) ==> canCloseBrowser(b) ==> alwaysBrowserCountersAreValid(closeBrowser(b)))
  ensures (inv(b) ==> canCloseBrowser(b) ==> alwaysSelectedTabExists(closeBrowser(b)))
  ensures (inv(b) ==> canCloseBrowser(b) ==> alwaysRecentDestinationsAreDistinct(closeBrowser(b)))
  ensures (inv(b) ==> canCloseBrowser(b) ==> stepRevisionNeverMovesBack(b, closeBrowser(b)))
{
  if inv(b) { TabKeysBridge(closeBrowser(b)); }
}

lemma selectTab_ensures(b: Browser, id: int)
  ensures (inv(b) ==> canSelectTab(b, id) ==> alwaysTabsAreWellFormed(selectTab(b, id)))
  ensures (inv(b) ==> canSelectTab(b, id) ==> alwaysTabIdentifiersAreUnique(selectTab(b, id)))
  ensures (inv(b) ==> canSelectTab(b, id) ==> alwaysBrowserCountersAreValid(selectTab(b, id)))
  ensures (inv(b) ==> canSelectTab(b, id) ==> alwaysSelectedTabExists(selectTab(b, id)))
  ensures (inv(b) ==> canSelectTab(b, id) ==> alwaysRecentDestinationsAreDistinct(selectTab(b, id)))
  ensures (inv(b) ==> canSelectTab(b, id) ==> stepRevisionNeverMovesBack(b, selectTab(b, id)))
{
  if inv(b) && canSelectTab(b, id) { MappedTabKeys(b, selectTab(b, id)); }
}

lemma navigate_ensures(b: Browser, url: string)
  ensures (inv(b) ==> canNavigate(b, url) ==> alwaysTabsAreWellFormed(navigate(b, url)))
  ensures (inv(b) ==> canNavigate(b, url) ==> alwaysTabIdentifiersAreUnique(navigate(b, url)))
  ensures (inv(b) ==> canNavigate(b, url) ==> alwaysBrowserCountersAreValid(navigate(b, url)))
  ensures (inv(b) ==> canNavigate(b, url) ==> alwaysSelectedTabExists(navigate(b, url)))
  ensures (inv(b) ==> canNavigate(b, url) ==> alwaysRecentDestinationsAreDistinct(navigate(b, url)))
  ensures (inv(b) ==> canNavigate(b, url) ==> stepRevisionNeverMovesBack(b, navigate(b, url)))
{
  if inv(b) && canNavigate(b, url) {
    var after := navigate(b, url);
    MappedTabKeys(b, after);
    forall t | t in b.tabs && t.id == b.selected
      ensures |navigated(t, url, b.revision + 1).history| == t.cursor + 2
    { HistoryPrefixLength(t.history, t.cursor); }
  }
}

// A page moving by itself changes the tabs and counters as navigate does, and only the address edit differs.
lemma pageMoved_ensures(b: Browser, url: string)
  ensures (inv(b) ==> canPageMoved(b, url) ==> alwaysTabsAreWellFormed(pageMoved(b, url)))
  ensures (inv(b) ==> canPageMoved(b, url) ==> alwaysTabIdentifiersAreUnique(pageMoved(b, url)))
  ensures (inv(b) ==> canPageMoved(b, url) ==> alwaysBrowserCountersAreValid(pageMoved(b, url)))
  ensures (inv(b) ==> canPageMoved(b, url) ==> alwaysSelectedTabExists(pageMoved(b, url)))
  ensures (inv(b) ==> canPageMoved(b, url) ==> alwaysRecentDestinationsAreDistinct(pageMoved(b, url)))
  ensures (inv(b) ==> canPageMoved(b, url) ==> stepRevisionNeverMovesBack(b, pageMoved(b, url)))
{
  if inv(b) && canPageMoved(b, url) {
    navigate_ensures(b, url);
    var n := navigate(b, url);
    assert pageMoved(b, url) == n.(editingAddress := b.editingAddress, addressDraft := b.addressDraft, emptyAddressNotice := b.emptyAddressNotice);
    assert pageMoved(b, url).tabs == n.tabs && pageMoved(b, url).selected == n.selected;
  }
}

// The selected tab moves as pageMoved does; any other tab only gains a history entry and keeps its load.
lemma tabMoved_ensures(b: Browser, id: int, url: string)
  ensures (inv(b) ==> canTabMoved(b, id, url) ==> alwaysTabsAreWellFormed(tabMoved(b, id, url)))
  ensures (inv(b) ==> canTabMoved(b, id, url) ==> alwaysTabIdentifiersAreUnique(tabMoved(b, id, url)))
  ensures (inv(b) ==> canTabMoved(b, id, url) ==> alwaysBrowserCountersAreValid(tabMoved(b, id, url)))
  ensures (inv(b) ==> canTabMoved(b, id, url) ==> alwaysSelectedTabExists(tabMoved(b, id, url)))
  ensures (inv(b) ==> canTabMoved(b, id, url) ==> alwaysRecentDestinationsAreDistinct(tabMoved(b, id, url)))
  ensures (inv(b) ==> canTabMoved(b, id, url) ==> stepRevisionNeverMovesBack(b, tabMoved(b, id, url)))
{
  if inv(b) && canTabMoved(b, id, url) {
    if id == b.selected {
      pageMoved_ensures(b, url);
    } else {
      MappedTabKeys(b, tabMoved(b, id, url));
      forall t | t in b.tabs && t.id == id
        ensures |navigated(t, url, t.loadVersion).history| == t.cursor + 2
      { HistoryPrefixLength(t.history, t.cursor); }
    }
  }
}

// Every tab with the selected id is the same after the move, position by position, so the lookup finds the same tab.
lemma lawABackgroundTabMovingKeepsTheSelectedPage_ensures(b: Browser, id: int, url: string)
  ensures (lawABackgroundTabMovingKeepsTheSelectedPage(b, id, url) == true)
{
  if canTabMoved(b, id, url) && id != b.selected {
    var after := tabMoved(b, id, url);
    ProofLib.FilterPointwise((t: Tab) => (t.id == b.selected), (t: Tab) => (t.id == b.selected),
      (x: Tab, y: Tab) => (x.id == b.selected ==> x == y), b.tabs, after.tabs);
    LookupFilter(b, b.selected);
    LookupFilter(after, after.selected);
    var before := ProofLib.Filter((t: Tab) => (t.id == b.selected), b.tabs);
    if |before| > 0 {
      ProofLib.FilterMember((t: Tab) => (t.id == b.selected), b.tabs, before[|before|-1]);
    }
  }
}

// A background tab moves only when not loading, and the move keeps each matching tab's load, position by position.
lemma lawNoLoadFinishesOnABackgroundTabsMove_ensures(b: Browser, id: int, url: string, loadVersion: int, result: Load)
  ensures (lawNoLoadFinishesOnABackgroundTabsMove(b, id, url, loadVersion, result) == true)
{
  if canTabMoved(b, id, url) && id != b.selected {
    var after := tabMoved(b, id, url);
    ProofLib.FilterPointwise((t: Tab) => (t.id == id), (t: Tab) => (t.id == id),
      (x: Tab, y: Tab) => (x.id == id ==> x.load == y.load), b.tabs, after.tabs);
    LookupFilter(b, id);
    LookupFilter(after, id);
  }
}

lemma goBack_ensures(b: Browser)
  ensures (inv(b) ==> canGoBack(b) ==> alwaysTabsAreWellFormed(goBack(b)))
  ensures (inv(b) ==> canGoBack(b) ==> alwaysTabIdentifiersAreUnique(goBack(b)))
  ensures (inv(b) ==> canGoBack(b) ==> alwaysBrowserCountersAreValid(goBack(b)))
  ensures (inv(b) ==> canGoBack(b) ==> alwaysSelectedTabExists(goBack(b)))
  ensures (inv(b) ==> canGoBack(b) ==> alwaysRecentDestinationsAreDistinct(goBack(b)))
  ensures (inv(b) ==> canGoBack(b) ==> stepRevisionNeverMovesBack(b, goBack(b)))
{
  if inv(b) && canGoBack(b) {
    MappedTabKeys(b, goBack(b));
    forall t | t in b.tabs && t.id == b.selected ensures t.cursor > 0
    { ActiveTabIsSelected(b, t); }
  }
}

lemma goForward_ensures(b: Browser)
  ensures (inv(b) ==> canGoForward(b) ==> alwaysTabsAreWellFormed(goForward(b)))
  ensures (inv(b) ==> canGoForward(b) ==> alwaysTabIdentifiersAreUnique(goForward(b)))
  ensures (inv(b) ==> canGoForward(b) ==> alwaysBrowserCountersAreValid(goForward(b)))
  ensures (inv(b) ==> canGoForward(b) ==> alwaysSelectedTabExists(goForward(b)))
  ensures (inv(b) ==> canGoForward(b) ==> alwaysRecentDestinationsAreDistinct(goForward(b)))
  ensures (inv(b) ==> canGoForward(b) ==> stepRevisionNeverMovesBack(b, goForward(b)))
{
  if inv(b) && canGoForward(b) {
    MappedTabKeys(b, goForward(b));
    forall t | t in b.tabs && t.id == b.selected ensures t.cursor + 1 < |t.history|
    { ActiveTabIsSelected(b, t); }
  }
}

lemma reload_ensures(b: Browser)
  ensures (inv(b) ==> canReload(b) ==> alwaysTabsAreWellFormed(reload(b)))
  ensures (inv(b) ==> canReload(b) ==> alwaysTabIdentifiersAreUnique(reload(b)))
  ensures (inv(b) ==> canReload(b) ==> alwaysBrowserCountersAreValid(reload(b)))
  ensures (inv(b) ==> canReload(b) ==> alwaysSelectedTabExists(reload(b)))
  ensures (inv(b) ==> canReload(b) ==> alwaysRecentDestinationsAreDistinct(reload(b)))
  ensures (inv(b) ==> canReload(b) ==> stepRevisionNeverMovesBack(b, reload(b)))
{
  if inv(b) && canReload(b) { MappedTabKeys(b, reload(b)); }
}

lemma rememberPagePosition_ensures(b: Browser, scroll: int, pagePanel: string)
  ensures (inv(b) ==> canRememberPagePosition(b, scroll) ==> alwaysTabsAreWellFormed(rememberPagePosition(b, scroll, pagePanel)))
  ensures (inv(b) ==> canRememberPagePosition(b, scroll) ==> alwaysTabIdentifiersAreUnique(rememberPagePosition(b, scroll, pagePanel)))
  ensures (inv(b) ==> canRememberPagePosition(b, scroll) ==> alwaysBrowserCountersAreValid(rememberPagePosition(b, scroll, pagePanel)))
  ensures (inv(b) ==> canRememberPagePosition(b, scroll) ==> alwaysSelectedTabExists(rememberPagePosition(b, scroll, pagePanel)))
  ensures (inv(b) ==> canRememberPagePosition(b, scroll) ==> alwaysRecentDestinationsAreDistinct(rememberPagePosition(b, scroll, pagePanel)))
  ensures (inv(b) ==> canRememberPagePosition(b, scroll) ==> stepRevisionNeverMovesBack(b, rememberPagePosition(b, scroll, pagePanel)))
{
  if inv(b) && canRememberPagePosition(b, scroll) { MappedTabKeys(b, rememberPagePosition(b, scroll, pagePanel)); }
}

lemma zoomPage_ensures(b: Browser, percent: int)
  ensures (inv(b) ==> canZoomPage(b, percent) ==> alwaysTabsAreWellFormed(zoomPage(b, percent)))
  ensures (inv(b) ==> canZoomPage(b, percent) ==> alwaysTabIdentifiersAreUnique(zoomPage(b, percent)))
  ensures (inv(b) ==> canZoomPage(b, percent) ==> alwaysBrowserCountersAreValid(zoomPage(b, percent)))
  ensures (inv(b) ==> canZoomPage(b, percent) ==> alwaysSelectedTabExists(zoomPage(b, percent)))
  ensures (inv(b) ==> canZoomPage(b, percent) ==> alwaysRecentDestinationsAreDistinct(zoomPage(b, percent)))
  ensures (inv(b) ==> canZoomPage(b, percent) ==> stepRevisionNeverMovesBack(b, zoomPage(b, percent)))
{
  if inv(b) && canZoomPage(b, percent) { MappedTabKeys(b, zoomPage(b, percent)); }
}

lemma removeRecent_ensures(b: Browser, url: string)
  ensures (inv(b) ==> canRemoveRecent(b, url) ==> alwaysTabsAreWellFormed(removeRecent(b, url)))
  ensures (inv(b) ==> canRemoveRecent(b, url) ==> alwaysTabIdentifiersAreUnique(removeRecent(b, url)))
  ensures (inv(b) ==> canRemoveRecent(b, url) ==> alwaysBrowserCountersAreValid(removeRecent(b, url)))
  ensures (inv(b) ==> canRemoveRecent(b, url) ==> alwaysSelectedTabExists(removeRecent(b, url)))
  ensures (inv(b) ==> canRemoveRecent(b, url) ==> alwaysRecentDestinationsAreDistinct(removeRecent(b, url)))
  ensures (inv(b) ==> canRemoveRecent(b, url) ==> stepRevisionNeverMovesBack(b, removeRecent(b, url)))
{
  if inv(b) && canRemoveRecent(b, url) {
    var after := removeRecent(b, url);
    RecentBridge(b); RecentBridge(after); RemoveRecentFilter(b, url);
    ProofLib.FilterKeepsDistinctBy((visit: string) => (visit != url), b.recent, (url: string) => url);
    forall visit | visit in after.recent ensures visit != ""
    { ProofLib.FilterMember((visit: string) => (visit != url), b.recent, visit); }
  }
}

lemma finishLoad_ensures(b: Browser, id: int, loadVersion: int, result: Load)
  ensures (inv(b) ==> canFinishLoad(b, id, loadVersion, result) ==> alwaysTabsAreWellFormed(finishLoad(b, id, loadVersion, result)))
  ensures (inv(b) ==> canFinishLoad(b, id, loadVersion, result) ==> alwaysTabIdentifiersAreUnique(finishLoad(b, id, loadVersion, result)))
  ensures (inv(b) ==> canFinishLoad(b, id, loadVersion, result) ==> alwaysBrowserCountersAreValid(finishLoad(b, id, loadVersion, result)))
  ensures (inv(b) ==> canFinishLoad(b, id, loadVersion, result) ==> alwaysSelectedTabExists(finishLoad(b, id, loadVersion, result)))
  ensures (inv(b) ==> canFinishLoad(b, id, loadVersion, result) ==> alwaysRecentDestinationsAreDistinct(finishLoad(b, id, loadVersion, result)))
  ensures (inv(b) ==> canFinishLoad(b, id, loadVersion, result) ==> stepRevisionNeverMovesBack(b, finishLoad(b, id, loadVersion, result)))
{
  if inv(b) && canFinishLoad(b, id, loadVersion, result) {
    var after := finishLoad(b, id, loadVersion, result);
    MappedTabKeys(b, after); RecentBridge(b); RecentBridge(after); FinishRecentFilter(b, id, loadVersion, result);
    var url := tabUrl(tabById(b, id));
    if result.Loaded? && url != "" {
      var kept := ProofLib.Filter((visit: string) => (visit != url), b.recent);
      ProofLib.FilterKeepsDistinctBy((visit: string) => (visit != url), b.recent, (url: string) => url);
      forall visit | visit in kept ensures visit != "" && visit != url
      { ProofLib.FilterMember((visit: string) => (visit != url), b.recent, visit); }
    }
  }
}

lemma TabKeysFilter(b: Browser)
  ensures alwaysTabIdentifiersAreUnique(b) == !(exists t :: t in b.tabs && !(|ProofLib.Filter((other: Tab) => (other.id == t.id), b.tabs)| == 1))
{
}

lemma TabKeysBridge(b: Browser)
  ensures alwaysTabIdentifiersAreUnique(b) <==> ProofLib.DistinctBy(b.tabs, (t: Tab) => t.id)
{
  TabKeysFilter(b);
  var xs := b.tabs;
  forall i | 0 <= i < |xs|
    ensures |ProofLib.Filter((other: Tab) => (other.id == xs[i].id), xs)| == 1 <==> forall j :: 0 <= j < |xs| && j != i ==> xs[j].id != xs[i].id
  {
    var t := xs[i];
    ProofLib.FilterCountOneIffUnique((other: Tab) => (other.id == t.id), xs, (t: Tab) => t.id, i);
  }
}

lemma MappedTabKeys(b: Browser, after: Browser)
  requires alwaysTabIdentifiersAreUnique(b)
  requires |after.tabs| == |b.tabs|
  requires forall i :: 0 <= i < |b.tabs| ==> after.tabs[i].id == b.tabs[i].id
  requires hasTab(b, after.selected)
  ensures alwaysTabIdentifiersAreUnique(after) && alwaysSelectedTabExists(after)
{
  TabKeysBridge(b);
  TabKeysBridge(after);
  var t :| t in b.tabs && t.id == after.selected;
  var i :| 0 <= i < |b.tabs| && b.tabs[i] == t;
  assert after.tabs[i] in after.tabs;
}

lemma LookupFilter(b: Browser, id: int)
  ensures tabById(b, id) == (var matches := ProofLib.Filter((t: Tab) => (t.id == id), b.tabs); if |matches| > 0 then matches[|matches|-1] else blankTab(0, 0))
{
}

lemma ActiveTabIsSelected(b: Browser, t: Tab)
  requires inv(b) && t in b.tabs && t.id == b.selected
  ensures activeTab(b) == t
{
  LookupFilter(b, b.selected);
  TabKeysBridge(b);
  var matches := ProofLib.Filter((t: Tab) => (t.id == b.selected), b.tabs);
  ProofLib.FilterMember((t: Tab) => (t.id == b.selected), b.tabs, t);
  assert |matches| > 0;
  var found := matches[|matches|-1];
  ProofLib.FilterMember((t: Tab) => (t.id == b.selected), b.tabs, found);
  var i :| 0 <= i < |b.tabs| && b.tabs[i] == t;
  var j :| 0 <= j < |b.tabs| && b.tabs[j] == found;
  assert i == j;
}

lemma HistoryPrefixLength(xs: seq<string>, cursor: int)
  requires cursor >= 0
  ensures |Std.Collections.Seq.FoldLeft((kept: seq<string>, visit: string) => (if (|kept| <= cursor) then (kept + [visit]) else kept), [], xs)| == (if |xs| <= cursor + 1 then |xs| else cursor + 1)
  decreases |xs|
{
  if |xs| > 0 {
    var rest := xs[..|xs|-1];
    var finalVisit := xs[|xs|-1];
    HistoryPrefixLength(rest, cursor);
    ProofLib.FoldLeftAppend((kept: seq<string>, visit: string) => (if (|kept| <= cursor) then (kept + [visit]) else kept), [], rest, finalVisit);
    assert xs == rest + [finalVisit];
  }
}

lemma RecentFilter(b: Browser)
  ensures alwaysRecentDestinationsAreDistinct(b) == !(exists url :: url in b.recent && !((url != "") && (|ProofLib.Filter((visit: string) => (visit == url), b.recent)| == 1)))
{
}

lemma RecentBridge(b: Browser)
  ensures alwaysRecentDestinationsAreDistinct(b) <==> ((forall url :: url in b.recent ==> url != "") && ProofLib.DistinctBy(b.recent, (url: string) => url))
{
  RecentFilter(b);
  var xs := b.recent;
  if alwaysRecentDestinationsAreDistinct(b) {
    assert forall url :: url in xs ==> url != "";
    forall i, j | 0 <= i < |xs| && 0 <= j < |xs| && i != j
      ensures xs[i] != xs[j]
    {
      var url := xs[i];
      assert url in xs;
      assert |ProofLib.Filter((visit: string) => (visit == url), xs)| == 1;
      if xs[i] == xs[j] {
        ProofLib.FilterTwo((visit: string) => (visit == url), xs, i, j);
      }
    }
  }
  if (forall url :: url in xs ==> url != "") && ProofLib.DistinctBy(xs, (url: string) => url) {
    forall url | url in xs
      ensures url != "" && |ProofLib.Filter((visit: string) => (visit == url), xs)| == 1
    {
      var i :| 0 <= i < |xs| && xs[i] == url;
      ProofLib.FilterCountOneIffUnique((visit: string) => (visit == url), xs, (url: string) => url, i);
    }
  }
}

lemma RemoveRecentFilter(b: Browser, url: string)
  ensures removeRecent(b, url).recent == ProofLib.Filter((visit: string) => (visit != url), b.recent)
{
}

lemma FinishRecentFilter(b: Browser, id: int, loadVersion: int, result: Load)
  ensures finishLoad(b, id, loadVersion, result).recent == (if result.Loaded? && tabUrl(tabById(b, id)) != "" then [tabUrl(tabById(b, id))] + ProofLib.Filter((visit: string) => (visit != tabUrl(tabById(b, id))), b.recent) else b.recent)
{
}

lemma CloseTabsFilter(b: Browser, id: int)
  ensures closeTab(b, id) == (
    var remaining := ProofLib.Filter((t: Tab) => (t.id != id), b.tabs);
    var replacement := if |remaining| > 0 then remaining[|remaining|-1] else blankTab(b.nextId, b.serial+1);
    b.(tabs := (if |remaining| == 0 then [replacement] else
      seq(|remaining|, i requires 0 <= i < |remaining| => var t := remaining[i];
        if b.selected == id && t.id == replacement.id then t.(recency := b.serial+1) else t)),
      selected := (if b.selected == id then replacement.id else b.selected),
      nextId := (if |remaining| == 0 then b.nextId+1 else b.nextId),
      serial := b.serial+1, revision := b.revision+1, editingAddress := false,
      addressDraft := "", emptyAddressNotice := false))
{
}

lemma initialHolds_ensures()
  ensures inv(initialHolds())
{
  TabKeysBridge(initialHolds());
  RecentBridge(initialHolds());
}

lemma closeTab_ensures(b: Browser, id: int)
  ensures (inv(b) ==> canCloseTab(b, id) ==> alwaysTabsAreWellFormed(closeTab(b, id)))
  ensures (inv(b) ==> canCloseTab(b, id) ==> alwaysTabIdentifiersAreUnique(closeTab(b, id)))
  ensures (inv(b) ==> canCloseTab(b, id) ==> alwaysBrowserCountersAreValid(closeTab(b, id)))
  ensures (inv(b) ==> canCloseTab(b, id) ==> alwaysSelectedTabExists(closeTab(b, id)))
  ensures (inv(b) ==> canCloseTab(b, id) ==> alwaysRecentDestinationsAreDistinct(closeTab(b, id)))
  ensures (inv(b) ==> canCloseTab(b, id) ==> stepRevisionNeverMovesBack(b, closeTab(b, id)))
{
  if inv(b) && canCloseTab(b, id) {
    var after := closeTab(b, id);
    CloseTabsFilter(b, id);
    TabKeysBridge(b);
    TabKeysBridge(after);
    var kept := ProofLib.Filter((t: Tab) => (t.id != id), b.tabs);
    ProofLib.FilterKeepsDistinctBy((t: Tab) => (t.id != id), b.tabs, (t: Tab) => t.id);
    forall t | t in kept ensures t in b.tabs && t.id != id
    { ProofLib.FilterMember((t: Tab) => (t.id != id), b.tabs, t); }
    if |kept| == 0 {
      var current :| current in b.tabs && current.id == b.selected;
      ProofLib.FilterMember((t: Tab) => (t.id != id), b.tabs, current);
      assert b.selected == id;
    } else {
      var chosen := if b.selected == id then kept[|kept|-1].id else b.selected;
      var middle := b.(tabs := kept, selected := chosen);
      TabKeysBridge(middle);
      if b.selected == id {
        assert kept[|kept|-1] in kept;
      } else {
        var current :| current in b.tabs && current.id == b.selected;
        ProofLib.FilterMember((t: Tab) => (t.id != id), b.tabs, current);
        assert current in kept;
      }
      MappedTabKeys(middle, after);
      forall i | 0 <= i < |after.tabs| ensures after.tabs[i].id == kept[i].id && kept[i] in b.tabs
      { }
    }
  }
}
