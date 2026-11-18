lemma lawControlsPreserveBrowser_ensures(b: app__browser_Browser, browserInput: BrowserInput, by_: BrowserControlActor)
  ensures (lawControlsPreserveBrowser(b, browserInput, by_) == true)
{
  if validBrowser(b) && canControl(b, browserInput, by_) {
    assert app__browser_inv(b);
    match browserInput {
      case OpenPrivateSignIn(url) => app__browser_openPrivateSignIn_ensures(b, url);
      case NewTab => app__browser_openTab_ensures(b);
      case SelectTab(id) => app__browser_selectTab_ensures(b, id);
      case CloseTab(id) => app__browser_closeTab_ensures(b, id);
      case Navigate(url) => app__browser_navigate_ensures(b, url);
      case OpenWindow(url) => app__browser_openWindow_ensures(b, url);
      case EditAddress(text) =>
        app__browser_editAddress_ensures(b, text);
        if !b.editingAddress { app__browser_pageChanged_ensures(app__browser_editAddress(b, text)); }
      case ExplainEmptyAddress => app__browser_explainEmptyAddress_ensures(b);
      case DismissAddress =>
        app__browser_dismissAddress_ensures(b);
        app__browser_pageChanged_ensures(app__browser_dismissAddress(b));
      case Back => app__browser_goBack_ensures(b);
      case Forward => app__browser_goForward_ensures(b);
      case Reload => app__browser_reload_ensures(b);
      case ResizeTabs(revision, capacity) => app__browser_resize_ensures(b, capacity);
      case RememberPage(id, revision, scroll, pagePanel) => app__browser_rememberPagePosition_ensures(b, scroll, pagePanel);
      case ZoomPage(percent) => app__browser_zoomPage_ensures(b, percent);
      case PageChanged(id, revision) => app__browser_pageChanged_ensures(b);
      case RemoveRecent(url) => app__browser_removeRecent_ensures(b, url);
      case RequestClearHistory => app__browser_requestClearHistory_ensures(b);
      case AnswerClearHistory(confirmed) => app__browser_answerClearHistory_ensures(b, confirmed);
    }
  }
}
