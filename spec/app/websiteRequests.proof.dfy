lemma raise_ensures(s: WebsiteRequests, report: HostReport, by_: WebsiteActor)
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysPagesAreValid(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysOnlyTheShownTabHoldsRequests(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysRequestsBelongToTheirPage(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysNoMessageWaitsWhilePaused(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysATabHoldsOneOfEach(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysDownloadsAreRecorded(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysDecisionsNameAWebsite(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysAWebsiteIsAskedOnce(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysOpeningsAreRecorded(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> alwaysNoPageIsOpenWhilePurging(raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepAnsweredRequestsNeverReturn(s, raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepOnlyThePersonGrants(s, raise(s, report, by_).state, raise(s, report, by_).out))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepDecisionsStandUntilCleared(s, "raise", raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepPagesAreToldTheStoredDecision(s, raise(s, report, by_).state, raise(s, report, by_).out))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepOnlyAndroidStoresAnAllow(s, "raise", raise(s, report, by_).state))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepOneAndroidCallPerWebsite(s, raise(s, report, by_).state, raise(s, report, by_).out))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepEveryAndroidWaitHasACall(s, raise(s, report, by_).state, raise(s, report, by_).out))
  ensures (inv(s) ==> canRaise(s, report, by_) ==> stepSignInsLastUntilCleared(s, "raise", raise(s, report, by_).state))
{
  if inv(s) && canRaise(s, report, by_) {
    var r := newRequest(s, report);
    var counted := s.(nextId := s.nextId + 1);
    if toAndroid(s, report) {
      RaiseToAndroid(s, report, by_);
      RaiseCalls(s, report, by_);
    } else if waits(s, report) {
      HoldMembers(r, counted);
      HoldRecords(r, counted);
      assert raise(s, report, by_) == hold(r, counted);
    } else {
      assert raise(s, report, by_) == conclude(r, replyOf(r, immediateAnswer(s, report)), counted);
    }
  }
}

lemma answer_ensures(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysPagesAreValid(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysOnlyTheShownTabHoldsRequests(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysRequestsBelongToTheirPage(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysNoMessageWaitsWhilePaused(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysATabHoldsOneOfEach(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysDownloadsAreRecorded(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysDecisionsNameAWebsite(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysAWebsiteIsAskedOnce(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysOpeningsAreRecorded(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> alwaysNoPageIsOpenWhilePurging(answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepAnsweredRequestsNeverReturn(s, answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepOnlyThePersonGrants(s, answer(s, id, choice, by_).state, answer(s, id, choice, by_).out))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepDecisionsStandUntilCleared(s, "answer", answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepPagesAreToldTheStoredDecision(s, answer(s, id, choice, by_).state, answer(s, id, choice, by_).out))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepOnlyAndroidStoresAnAllow(s, "answer", answer(s, id, choice, by_).state))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepOneAndroidCallPerWebsite(s, answer(s, id, choice, by_).state, answer(s, id, choice, by_).out))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepEveryAndroidWaitHasACall(s, answer(s, id, choice, by_).state, answer(s, id, choice, by_).out))
  ensures (inv(s) ==> canAnswer(s, id, choice, by_) ==> stepSignInsLastUntilCleared(s, "answer", answer(s, id, choice, by_).state))
{
  if inv(s) && canAnswer(s, id, choice, by_) {
    PresentedIsWaiting(s);
    AnswerState(s, id, choice, by_);
    AnswerOut(s, id, choice, by_);
    var r := presented(s);
    var reply := replyFor(r, choice);
    assert askIsWellFormed(r.ask);
    assert undecided(s, r.ask);
    assert !waitingOnAndroid(s, r.ask);
    assert r.id > 0 && r.id < s.nextId;
    var after := answer(s, id, choice, by_);
    Members((q: WebsiteRequest) => ((q.id != id) && !(sameSite(q.ask, presented(s).ask))), s.requests);
    Members((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests);
    forall x | x in after.state.requests
      ensures x in s.requests && !sameSite(x.ask, r.ask)
    { }
    if reply.answer.AskAndroid? {
      assert isPermission(r.ask);
      AnswerCalls(s, id, choice, by_);
      forall x | x in after.state.asking
        ensures x in s.asking || x == r || (x in s.requests && sameSite(x.ask, r.ask))
      { }
      forall x | x in after.state.requests
        ensures !waitingOnAndroid(after.state, x.ask)
      {
        assert !waitingOnAndroid(s, x.ask);
        if waitingOnAndroid(after.state, x.ask) {
          var q :| q in after.state.asking && sameSite(q.ask, x.ask);
          if q !in s.asking { assert sameSite(x.ask, r.ask); }
        }
      }
      forall x | x in after.state.asking
        ensures undecided(after.state, x.ask) || allowedBefore(after.state, originOf(x.ask), kindsOf(x.ask))
      {
        if x !in s.asking { assert undecided(s, x.ask); }
      }
    } else {
      forall x | x in after.state.requests
        ensures undecided(after.state, x.ask) && !waitingOnAndroid(after.state, x.ask)
      {
        assert undecided(s, x.ask);
        if isPermission(x.ask) && decided(after.state, originOf(x.ask), kindsOf(x.ask)) {
          var d :| d in after.state.decisions && d.origin == originOf(x.ask) && d.kinds == kindsOf(x.ask);
          assert d !in s.decisions;
          assert sameSite(x.ask, r.ask);
        }
      }
      forall x | x in after.state.asking
        ensures undecided(after.state, x.ask) || allowedBefore(after.state, originOf(x.ask), kindsOf(x.ask))
      {
        assert undecided(s, x.ask) || allowedBefore(s, originOf(x.ask), kindsOf(x.ask));
        if isPermission(x.ask) && isPermission(r.ask) && decided(after.state, originOf(x.ask), kindsOf(x.ask)) && !decided(s, originOf(x.ask), kindsOf(x.ask)) {
          assert sameSite(x.ask, r.ask);
        }
      }
      if isPermission(r.ask) {
        var o := originOf(r.ask);
        var k := kindsOf(r.ask);
        assert reply.answer.Denied?;
        assert after.state.decisions == s.decisions + [SiteDecision(o, k, false)];
        assert !allowedBefore(after.state, o, k);
      }
      forall x | x in after.out
        ensures matchesStoredDecision(after.state, x)
      {
        if x != reply {
          var q :| q in s.requests && sameSite(q.ask, r.ask) && x == reply.(request := q.id, ask := q.ask);
        }
      }
    }
  }
}

lemma followView_ensures(s: WebsiteRequests, view: PageView, by_: WebsiteActor)
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysPagesAreValid(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysOnlyTheShownTabHoldsRequests(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysRequestsBelongToTheirPage(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysNoMessageWaitsWhilePaused(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysATabHoldsOneOfEach(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysDownloadsAreRecorded(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysDecisionsNameAWebsite(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysAWebsiteIsAskedOnce(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysOpeningsAreRecorded(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> alwaysNoPageIsOpenWhilePurging(followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepAnsweredRequestsNeverReturn(s, followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepOnlyThePersonGrants(s, followView(s, view, by_).state, followView(s, view, by_).out))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepDecisionsStandUntilCleared(s, "followView", followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepPagesAreToldTheStoredDecision(s, followView(s, view, by_).state, followView(s, view, by_).out))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepOnlyAndroidStoresAnAllow(s, "followView", followView(s, view, by_).state))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepOneAndroidCallPerWebsite(s, followView(s, view, by_).state, followView(s, view, by_).out))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepEveryAndroidWaitHasACall(s, followView(s, view, by_).state, followView(s, view, by_).out))
  ensures (inv(s) ==> canFollowView(s, view, by_) ==> stepSignInsLastUntilCleared(s, "followView", followView(s, view, by_).state))
{
  if inv(s) && canFollowView(s, view, by_) { Follows(s, view, by_); }
}

lemma hideBrowser_ensures(s: WebsiteRequests, by_: WebsiteActor)
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysPagesAreValid(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysOnlyTheShownTabHoldsRequests(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysRequestsBelongToTheirPage(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysNoMessageWaitsWhilePaused(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysATabHoldsOneOfEach(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysDownloadsAreRecorded(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysDecisionsNameAWebsite(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysAWebsiteIsAskedOnce(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysOpeningsAreRecorded(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> alwaysNoPageIsOpenWhilePurging(hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepAnsweredRequestsNeverReturn(s, hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepOnlyThePersonGrants(s, hideBrowser(s, by_).state, hideBrowser(s, by_).out))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepDecisionsStandUntilCleared(s, "hideBrowser", hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepPagesAreToldTheStoredDecision(s, hideBrowser(s, by_).state, hideBrowser(s, by_).out))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepOnlyAndroidStoresAnAllow(s, "hideBrowser", hideBrowser(s, by_).state))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepOneAndroidCallPerWebsite(s, hideBrowser(s, by_).state, hideBrowser(s, by_).out))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepEveryAndroidWaitHasACall(s, hideBrowser(s, by_).state, hideBrowser(s, by_).out))
  ensures (inv(s) ==> canHideBrowser(s, by_) ==> stepSignInsLastUntilCleared(s, "hideBrowser", hideBrowser(s, by_).state))
{
  if inv(s) && canHideBrowser(s, by_) { Follows(s, viewOf(s).(shown := false), by_); }
}

lemma Follows(s: WebsiteRequests, view: PageView, by_: WebsiteActor)
  requires inv(s)
  ensures inv(followView(s, view, by_).state)
  ensures stepAnsweredRequestsNeverReturn(s, followView(s, view, by_).state)
  ensures stepOnlyThePersonGrants(s, followView(s, view, by_).state, followView(s, view, by_).out)
  ensures stepPagesAreToldTheStoredDecision(s, followView(s, view, by_).state, followView(s, view, by_).out)
  ensures stepOneAndroidCallPerWebsite(s, followView(s, view, by_).state, followView(s, view, by_).out)
  ensures stepEveryAndroidWaitHasACall(s, followView(s, view, by_).state, followView(s, view, by_).out)
  ensures followView(s, view, by_).state.decisions == s.decisions
  ensures followView(s, view, by_).state.signedIn == s.signedIn
  ensures followView(s, view, by_).state.clearing == s.clearing
{
  var gone := ProofLib.Filter((r: WebsiteRequest) => !(heldInView(view, r)), s.requests);
  var kept := ProofLib.Filter((r: WebsiteRequest) => heldInView(view, r), s.requests);
  var goneA := ProofLib.Filter((r: WebsiteRequest) => !(askingInView(view, r)), s.asking);
  var keptA := ProofLib.Filter((r: WebsiteRequest) => askingInView(view, r), s.asking);
  assert followView(s, view, by_) == (var left := stopAsking(goneA, keptA, withdraw(gone, kept, s));
    WebsiteResult(left.state.(shown := view.shown, selected := view.selected, paused := view.paused), left.out));
  Members((r: WebsiteRequest) => !(heldInView(view, r)), s.requests);
  Members((r: WebsiteRequest) => heldInView(view, r), s.requests);
  Members((r: WebsiteRequest) => !(askingInView(view, r)), s.asking);
  Members((r: WebsiteRequest) => askingInView(view, r), s.asking);
  Stable((r: WebsiteRequest) => askingInView(view, r), s.asking);
  Ended(goneA, keptA, gone, kept, s);
  EndedRules(goneA, keptA, gone, kept, s, followView(s, view, by_).state);
}

lemma pageStarted_ensures(s: WebsiteRequests, tab: int, by_: WebsiteActor)
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysPagesAreValid(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysOnlyTheShownTabHoldsRequests(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysRequestsBelongToTheirPage(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysNoMessageWaitsWhilePaused(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysATabHoldsOneOfEach(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysDownloadsAreRecorded(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysDecisionsNameAWebsite(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysAWebsiteIsAskedOnce(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysOpeningsAreRecorded(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> alwaysNoPageIsOpenWhilePurging(pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepAnsweredRequestsNeverReturn(s, pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepOnlyThePersonGrants(s, pageStarted(s, tab, by_).state, pageStarted(s, tab, by_).out))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepDecisionsStandUntilCleared(s, "pageStarted", pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepPagesAreToldTheStoredDecision(s, pageStarted(s, tab, by_).state, pageStarted(s, tab, by_).out))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepOnlyAndroidStoresAnAllow(s, "pageStarted", pageStarted(s, tab, by_).state))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepOneAndroidCallPerWebsite(s, pageStarted(s, tab, by_).state, pageStarted(s, tab, by_).out))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepEveryAndroidWaitHasACall(s, pageStarted(s, tab, by_).state, pageStarted(s, tab, by_).out))
  ensures (inv(s) ==> canPageStarted(s, tab, by_) ==> stepSignInsLastUntilCleared(s, "pageStarted", pageStarted(s, tab, by_).state))
{
  if inv(s) && canPageStarted(s, tab, by_) {
    var gone := ProofLib.Filter((r: WebsiteRequest) => (r.tab == tab), s.requests);
    var kept := ProofLib.Filter((r: WebsiteRequest) => (r.tab != tab), s.requests);
    var goneA := ProofLib.Filter((r: WebsiteRequest) => (r.tab == tab), s.asking);
    var keptA := ProofLib.Filter((r: WebsiteRequest) => (r.tab != tab), s.asking);
    var tabs := s.tabs + ProofLib.Filter((set_x: int) => !((set_x in s.tabs)), [tab]);
    assert pageStarted(s, tab, by_) == (var left := stopAsking(goneA, keptA, withdraw(gone, kept, s)); WebsiteResult(left.state.(tabs := tabs), left.out));
    Members((r: WebsiteRequest) => (r.tab == tab), s.requests);
    Members((r: WebsiteRequest) => (r.tab != tab), s.requests);
    Members((r: WebsiteRequest) => (r.tab == tab), s.asking);
    Members((r: WebsiteRequest) => (r.tab != tab), s.asking);
    IntMembers((set_x: int) => !((set_x in s.tabs)), [tab]);
    assert forall t :: t in tabs <==> t in s.tabs || t == tab;
    Stable((r: WebsiteRequest) => (r.tab != tab), s.asking);
    Ended(goneA, keptA, gone, kept, s);
    EndedRules(goneA, keptA, gone, kept, s, pageStarted(s, tab, by_).state);
  }
}

lemma closeTab_ensures(s: WebsiteRequests, tab: int, by_: WebsiteActor)
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysPagesAreValid(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysOnlyTheShownTabHoldsRequests(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysRequestsBelongToTheirPage(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysNoMessageWaitsWhilePaused(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysATabHoldsOneOfEach(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysDownloadsAreRecorded(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysDecisionsNameAWebsite(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysAWebsiteIsAskedOnce(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysOpeningsAreRecorded(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> alwaysNoPageIsOpenWhilePurging(closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepAnsweredRequestsNeverReturn(s, closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepOnlyThePersonGrants(s, closeTab(s, tab, by_).state, closeTab(s, tab, by_).out))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepDecisionsStandUntilCleared(s, "closeTab", closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepPagesAreToldTheStoredDecision(s, closeTab(s, tab, by_).state, closeTab(s, tab, by_).out))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepOnlyAndroidStoresAnAllow(s, "closeTab", closeTab(s, tab, by_).state))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepOneAndroidCallPerWebsite(s, closeTab(s, tab, by_).state, closeTab(s, tab, by_).out))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepEveryAndroidWaitHasACall(s, closeTab(s, tab, by_).state, closeTab(s, tab, by_).out))
  ensures (inv(s) ==> canCloseTab(s, tab, by_) ==> stepSignInsLastUntilCleared(s, "closeTab", closeTab(s, tab, by_).state))
{
  if inv(s) && canCloseTab(s, tab, by_) {
    var gone := ProofLib.Filter((r: WebsiteRequest) => (r.tab == tab), s.requests);
    var kept := ProofLib.Filter((r: WebsiteRequest) => (r.tab != tab), s.requests);
    var goneA := ProofLib.Filter((r: WebsiteRequest) => (r.tab == tab), s.asking);
    var keptA := ProofLib.Filter((r: WebsiteRequest) => (r.tab != tab), s.asking);
    var tabs := ProofLib.Filter((set_x: int) => !((set_x in [tab])), s.tabs);
    assert closeTab(s, tab, by_) == (var left := stopAsking(goneA, keptA, withdraw(gone, kept, s)); WebsiteResult(left.state.(tabs := tabs), left.out));
    Members((r: WebsiteRequest) => (r.tab == tab), s.requests);
    Members((r: WebsiteRequest) => (r.tab != tab), s.requests);
    Members((r: WebsiteRequest) => (r.tab == tab), s.asking);
    Members((r: WebsiteRequest) => (r.tab != tab), s.asking);
    IntMembers((set_x: int) => !((set_x in [tab])), s.tabs);
    assert forall t :: t in tabs <==> t in s.tabs && t != tab;
    Stable((r: WebsiteRequest) => (r.tab != tab), s.asking);
    Ended(goneA, keptA, gone, kept, s);
    EndedRules(goneA, keptA, gone, kept, s, closeTab(s, tab, by_).state);
  }
}

lemma closeBrowser_ensures(s: WebsiteRequests, by_: WebsiteActor)
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysPagesAreValid(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysOnlyTheShownTabHoldsRequests(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysRequestsBelongToTheirPage(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysNoMessageWaitsWhilePaused(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysATabHoldsOneOfEach(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysDownloadsAreRecorded(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysDecisionsNameAWebsite(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysAWebsiteIsAskedOnce(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysOpeningsAreRecorded(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> alwaysNoPageIsOpenWhilePurging(closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepAnsweredRequestsNeverReturn(s, closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepOnlyThePersonGrants(s, closeBrowser(s, by_).state, closeBrowser(s, by_).out))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepDecisionsStandUntilCleared(s, "closeBrowser", closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepPagesAreToldTheStoredDecision(s, closeBrowser(s, by_).state, closeBrowser(s, by_).out))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepOnlyAndroidStoresAnAllow(s, "closeBrowser", closeBrowser(s, by_).state))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepOneAndroidCallPerWebsite(s, closeBrowser(s, by_).state, closeBrowser(s, by_).out))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepEveryAndroidWaitHasACall(s, closeBrowser(s, by_).state, closeBrowser(s, by_).out))
  ensures (inv(s) ==> canCloseBrowser(s, by_) ==> stepSignInsLastUntilCleared(s, "closeBrowser", closeBrowser(s, by_).state))
{
  if inv(s) && canCloseBrowser(s, by_) {
    Ended(s.asking, [], s.requests, [], s);
    EndedRules(s.asking, [], s.requests, [], s, closeBrowser(s, by_).state);
  }
}

lemma withdrawPermission_ensures(s: WebsiteRequests, id: int, by_: WebsiteActor)
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysPagesAreValid(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysOnlyTheShownTabHoldsRequests(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysRequestsBelongToTheirPage(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysNoMessageWaitsWhilePaused(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysATabHoldsOneOfEach(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysDownloadsAreRecorded(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysDecisionsNameAWebsite(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysAWebsiteIsAskedOnce(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysOpeningsAreRecorded(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> alwaysNoPageIsOpenWhilePurging(withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepAnsweredRequestsNeverReturn(s, withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepOnlyThePersonGrants(s, withdrawPermission(s, id, by_).state, withdrawPermission(s, id, by_).out))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepDecisionsStandUntilCleared(s, "withdrawPermission", withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepPagesAreToldTheStoredDecision(s, withdrawPermission(s, id, by_).state, withdrawPermission(s, id, by_).out))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepOnlyAndroidStoresAnAllow(s, "withdrawPermission", withdrawPermission(s, id, by_).state))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepOneAndroidCallPerWebsite(s, withdrawPermission(s, id, by_).state, withdrawPermission(s, id, by_).out))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepEveryAndroidWaitHasACall(s, withdrawPermission(s, id, by_).state, withdrawPermission(s, id, by_).out))
  ensures (inv(s) ==> canWithdrawPermission(s, id, by_) ==> stepSignInsLastUntilCleared(s, "withdrawPermission", withdrawPermission(s, id, by_).state))
{
  if inv(s) && canWithdrawPermission(s, id, by_) {
    var gone := ProofLib.Filter((r: WebsiteRequest) => (r.id == id), s.requests);
    var kept := ProofLib.Filter((r: WebsiteRequest) => (r.id != id), s.requests);
    var goneA := ProofLib.Filter((r: WebsiteRequest) => (r.id == id), s.asking);
    var keptA := ProofLib.Filter((r: WebsiteRequest) => (r.id != id), s.asking);
    assert withdrawPermission(s, id, by_) == stopAsking(goneA, keptA, withdraw(gone, kept, s));
    Members((r: WebsiteRequest) => (r.id == id), s.requests);
    Members((r: WebsiteRequest) => (r.id != id), s.requests);
    Members((r: WebsiteRequest) => (r.id == id), s.asking);
    Members((r: WebsiteRequest) => (r.id != id), s.asking);
    Stable((r: WebsiteRequest) => (r.id != id), s.asking);
    Ended(goneA, keptA, gone, kept, s);
    EndedRules(goneA, keptA, gone, kept, s, withdrawPermission(s, id, by_).state);
  }
}

lemma androidAnswered_ensures(s: WebsiteRequests, id: int, verdict: AndroidOutcome, by_: WebsiteActor)
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysPagesAreValid(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysOnlyTheShownTabHoldsRequests(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysRequestsBelongToTheirPage(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysNoMessageWaitsWhilePaused(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysATabHoldsOneOfEach(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysDownloadsAreRecorded(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysDecisionsNameAWebsite(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysAWebsiteIsAskedOnce(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysOpeningsAreRecorded(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> alwaysNoPageIsOpenWhilePurging(androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepAnsweredRequestsNeverReturn(s, androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepOnlyThePersonGrants(s, androidAnswered(s, id, verdict, by_).state, androidAnswered(s, id, verdict, by_).out))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepDecisionsStandUntilCleared(s, "androidAnswered", androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepPagesAreToldTheStoredDecision(s, androidAnswered(s, id, verdict, by_).state, androidAnswered(s, id, verdict, by_).out))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepOnlyAndroidStoresAnAllow(s, "androidAnswered", androidAnswered(s, id, verdict, by_).state))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepOneAndroidCallPerWebsite(s, androidAnswered(s, id, verdict, by_).state, androidAnswered(s, id, verdict, by_).out))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepEveryAndroidWaitHasACall(s, androidAnswered(s, id, verdict, by_).state, androidAnswered(s, id, verdict, by_).out))
  ensures (inv(s) ==> canAndroidAnswered(s, id, verdict, by_) ==> stepSignInsLastUntilCleared(s, "androidAnswered", androidAnswered(s, id, verdict, by_).state))
{
  if inv(s) && canAndroidAnswered(s, id, verdict, by_) && !androidDecides(verdict) {
    withdrawPermission_ensures(s, id, WebsiteActor.WebsiteHost);
    assert androidAnswered(s, id, verdict, by_) == withdrawPermission(s, id, WebsiteActor.WebsiteHost);
  } else if inv(s) && canAndroidAnswered(s, id, verdict, by_) {
    var granted := verdict == AndroidOutcome.AndroidGranted;
    assert androidAnswered(s, id, verdict, by_) == androidSettled(id, granted, s);
    AskedOf(s, id);
    var r := askedOf(s, id);
    var o := originOf(r.ask);
    var k := kindsOf(r.ask);
    assert isPermission(r.ask) && askIsWellFormed(r.ask);
    var keptA := ProofLib.Filter((q: WebsiteRequest) => !(sameSite(q.ask, r.ask)), s.asking);
    var told := ProofLib.Filter((q: WebsiteRequest) => sameSite(q.ask, r.ask), s.asking);
    var decisions := if !granted then ProofLib.Filter((d: SiteDecision) => !(((d.origin == o) && (d.kinds == k) && d.allowed)), s.decisions)
      else (if allowedBefore(s, o, k) then s.decisions else s.decisions + [SiteDecision(o, k, true)]);
    var after := androidSettled(id, granted, s);
    AndroidFilter(id, granted, s);
    Members((q: WebsiteRequest) => !(sameSite(q.ask, r.ask)), s.asking);
    Members((q: WebsiteRequest) => sameSite(q.ask, r.ask), s.asking);
    DecisionMembers((d: SiteDecision) => !(((d.origin == o) && (d.kinds == k) && d.allowed)), s.decisions);
    assert after.state.asking == keptA;
    assert after.state.decisions == decisions;
    Stable((q: WebsiteRequest) => !(sameSite(q.ask, r.ask)), s.asking);
    forall q | q in keptA
      ensures calledFor(after.state, q.ask) == calledFor(s, q.ask)
    {
      FirstIs(s.asking, q.ask);
      assert isPermission(q.ask) && sameSite(q.ask, q.ask);
      var f := firstWaiting(s.asking, q.ask);
      assert !sameSite(f.ask, r.ask);
      assert f in keptA;
    }
    assert granted ==> allowedBefore(after.state, o, k);
    assert !granted ==> !allowedBefore(after.state, o, k);
    forall x | x in s.requests
      ensures !sameSite(x.ask, r.ask)
    { assert !waitingOnAndroid(s, x.ask); }
    forall x | x in s.requests
      ensures undecided(after.state, x.ask)
    {
      assert undecided(s, x.ask);
      if isPermission(x.ask) && decided(after.state, originOf(x.ask), kindsOf(x.ask)) {
        var d :| d in after.state.decisions && d.origin == originOf(x.ask) && d.kinds == kindsOf(x.ask);
        assert d !in s.decisions;
      }
    }
    forall x | x in keptA
      ensures undecided(after.state, x.ask) || allowedBefore(after.state, originOf(x.ask), kindsOf(x.ask))
    {
      assert undecided(s, x.ask) || allowedBefore(s, originOf(x.ask), kindsOf(x.ask));
      assert !sameSite(x.ask, r.ask);
      if allowedBefore(s, originOf(x.ask), kindsOf(x.ask)) {
        var d :| d in s.decisions && d.origin == originOf(x.ask) && d.kinds == kindsOf(x.ask) && d.allowed;
        assert d in after.state.decisions;
      } else if isPermission(x.ask) && decided(after.state, originOf(x.ask), kindsOf(x.ask)) {
        var d :| d in after.state.decisions && d.origin == originOf(x.ask) && d.kinds == kindsOf(x.ask);
        assert d !in s.decisions;
      }
    }
    forall x | x in after.out
      ensures exists q :: q in told && x == replyOf(q, if granted then Answer.Allowed else Answer.Denied)
    {
      var i :| 0 <= i < |told| && after.out[i] == x;
    }
    forall x | x in after.out
      ensures matchesStoredDecision(after.state, x) && x.request < s.nextId
    {
      var q :| q in told && x == replyOf(q, if granted then Answer.Allowed else Answer.Denied);
      assert sameSite(q.ask, r.ask);
    }
    forall d | d in s.decisions && d !in after.state.decisions
      ensures d.allowed
    { }
  }
}

lemma dismissDownload_ensures(s: WebsiteRequests, id: int, by_: WebsiteActor)
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysPagesAreValid(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysOnlyTheShownTabHoldsRequests(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysRequestsBelongToTheirPage(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysNoMessageWaitsWhilePaused(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysATabHoldsOneOfEach(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysDownloadsAreRecorded(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysDecisionsNameAWebsite(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysAWebsiteIsAskedOnce(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysOpeningsAreRecorded(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> alwaysNoPageIsOpenWhilePurging(dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepAnsweredRequestsNeverReturn(s, dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepOnlyThePersonGrants(s, dismissDownload(s, id, by_), []))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepDecisionsStandUntilCleared(s, "dismissDownload", dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepPagesAreToldTheStoredDecision(s, dismissDownload(s, id, by_), []))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepOnlyAndroidStoresAnAllow(s, "dismissDownload", dismissDownload(s, id, by_)))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepOneAndroidCallPerWebsite(s, dismissDownload(s, id, by_), []))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepEveryAndroidWaitHasACall(s, dismissDownload(s, id, by_), []))
  ensures (inv(s) ==> canDismissDownload(s, id, by_) ==> stepSignInsLastUntilCleared(s, "dismissDownload", dismissDownload(s, id, by_)))
{
  if inv(s) && canDismissDownload(s, id, by_) {
    DismissFilter(s, id, by_);
    forall x | x in ProofLib.Filter((d: DownloadRecord) => (d.id != id), s.downloads)
      ensures x in s.downloads
    { ProofLib.FilterMember((d: DownloadRecord) => (d.id != id), s.downloads, x); }
  }
}

lemma finishOpening_ensures(s: WebsiteRequests, id: int, opened_: bool, by_: WebsiteActor)
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysPagesAreValid(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysOnlyTheShownTabHoldsRequests(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysRequestsBelongToTheirPage(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysNoMessageWaitsWhilePaused(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysATabHoldsOneOfEach(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysDownloadsAreRecorded(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysDecisionsNameAWebsite(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysAWebsiteIsAskedOnce(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysOpeningsAreRecorded(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> alwaysNoPageIsOpenWhilePurging(finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepAnsweredRequestsNeverReturn(s, finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepOnlyThePersonGrants(s, finishOpening(s, id, opened_, by_), []))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepDecisionsStandUntilCleared(s, "finishOpening", finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepPagesAreToldTheStoredDecision(s, finishOpening(s, id, opened_, by_), []))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepOnlyAndroidStoresAnAllow(s, "finishOpening", finishOpening(s, id, opened_, by_)))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepOneAndroidCallPerWebsite(s, finishOpening(s, id, opened_, by_), []))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepEveryAndroidWaitHasACall(s, finishOpening(s, id, opened_, by_), []))
  ensures (inv(s) ==> canFinishOpening(s, id, opened_, by_) ==> stepSignInsLastUntilCleared(s, "finishOpening", finishOpening(s, id, opened_, by_)))
{
  if inv(s) && canFinishOpening(s, id, opened_, by_) {
    var after := finishOpening(s, id, opened_, by_);
    if opened_ {
      FinishOpenedFilter(s, id, opened_, by_);
      OpeningMembers((o: Opening) => (o.id != id), s.openings);
    } else {
      assert |after.openings| == |s.openings|;
      forall i | 0 <= i < |after.openings| ensures after.openings[i].id == s.openings[i].id { }
      forall x | x in after.openings ensures x.id > 0 && x.id < s.nextId
      {
        var i :| 0 <= i < |after.openings| && after.openings[i] == x;
        assert s.openings[i] in s.openings;
      }
    }
  }
}

lemma dismissOpening_ensures(s: WebsiteRequests, id: int, by_: WebsiteActor)
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysPagesAreValid(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysOnlyTheShownTabHoldsRequests(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysRequestsBelongToTheirPage(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysNoMessageWaitsWhilePaused(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysATabHoldsOneOfEach(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysDownloadsAreRecorded(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysDecisionsNameAWebsite(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysAWebsiteIsAskedOnce(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysOpeningsAreRecorded(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> alwaysNoPageIsOpenWhilePurging(dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepAnsweredRequestsNeverReturn(s, dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepOnlyThePersonGrants(s, dismissOpening(s, id, by_), []))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepDecisionsStandUntilCleared(s, "dismissOpening", dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepPagesAreToldTheStoredDecision(s, dismissOpening(s, id, by_), []))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepOnlyAndroidStoresAnAllow(s, "dismissOpening", dismissOpening(s, id, by_)))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepOneAndroidCallPerWebsite(s, dismissOpening(s, id, by_), []))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepEveryAndroidWaitHasACall(s, dismissOpening(s, id, by_), []))
  ensures (inv(s) ==> canDismissOpening(s, id, by_) ==> stepSignInsLastUntilCleared(s, "dismissOpening", dismissOpening(s, id, by_)))
{
  if inv(s) && canDismissOpening(s, id, by_) {
    DismissOpeningFilter(s, id, by_);
    OpeningMembers((o: Opening) => (o.id != id), s.openings);
  }
}

lemma answerClearBrowsingData_ensures(s: WebsiteRequests, confirmed: bool, by_: WebsiteActor)
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysPagesAreValid(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysOnlyTheShownTabHoldsRequests(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysRequestsBelongToTheirPage(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysNoMessageWaitsWhilePaused(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysATabHoldsOneOfEach(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysDownloadsAreRecorded(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysDecisionsNameAWebsite(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysAWebsiteIsAskedOnce(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysOpeningsAreRecorded(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> alwaysNoPageIsOpenWhilePurging(answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepAnsweredRequestsNeverReturn(s, answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepOnlyThePersonGrants(s, answerClearBrowsingData(s, confirmed, by_).state, answerClearBrowsingData(s, confirmed, by_).out))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepDecisionsStandUntilCleared(s, "answerClearBrowsingData", answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepPagesAreToldTheStoredDecision(s, answerClearBrowsingData(s, confirmed, by_).state, answerClearBrowsingData(s, confirmed, by_).out))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepOnlyAndroidStoresAnAllow(s, "answerClearBrowsingData", answerClearBrowsingData(s, confirmed, by_).state))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepOneAndroidCallPerWebsite(s, answerClearBrowsingData(s, confirmed, by_).state, answerClearBrowsingData(s, confirmed, by_).out))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepEveryAndroidWaitHasACall(s, answerClearBrowsingData(s, confirmed, by_).state, answerClearBrowsingData(s, confirmed, by_).out))
  ensures (inv(s) ==> canAnswerClearBrowsingData(s, confirmed, by_) ==> stepSignInsLastUntilCleared(s, "answerClearBrowsingData", answerClearBrowsingData(s, confirmed, by_).state))
{
  if inv(s) && canAnswerClearBrowsingData(s, confirmed, by_) {
    if confirmed {
      Ended(s.asking, [], s.requests, [], s);
      EndedRules(s.asking, [], s.requests, [], s, answerClearBrowsingData(s, confirmed, by_).state);
    } else {
      Ended([], s.asking, [], s.requests, s);
      EndedRules([], s.asking, [], s.requests, s, answerClearBrowsingData(s, confirmed, by_).state);
    }
  }
}

lemma lawADownloadIsNeverDropped_ensures(s: WebsiteRequests, report: HostReport, by_: WebsiteActor)
  ensures (lawADownloadIsNeverDropped(s, report, by_) == true)
{
  if canRaise(s, report, by_) && isDownload(report.ask) {
    var r := newRequest(s, report);
    var counted := s.(nextId := s.nextId + 1);
    assert !toAndroid(s, report);
    if waits(s, report) {
      HoldMembers(r, counted);
      assert raise(s, report, by_) == hold(r, counted);
      assert r in raise(s, report, by_).state.requests;
    } else {
      assert DownloadRecord(s.nextId, report.ask.fileName, DownloadStatus.NotSaved) in raise(s, report, by_).state.downloads;
    }
  }
}

lemma lawWaitingRequestsShareTheAnswer_ensures(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  ensures (lawWaitingRequestsShareTheAnswer(s, id, choice, by_) == true)
{
  if canAnswer(s, id, choice, by_) && isPermission(presented(s).ask) {
    AnswerState(s, id, choice, by_);
    AnswerOut(s, id, choice, by_);
    var r := presented(s);
    var after := answer(s, id, choice, by_);
    forall x | x in after.state.requests
      ensures !sameSite(x.ask, r.ask)
    { ProofLib.FilterMember((q: WebsiteRequest) => ((q.id != id) && !(sameSite(q.ask, presented(s).ask))), s.requests, x); }
    PresentedIsWaiting(s);
    Members((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests);
    forall q | q in s.requests && sameSite(q.ask, r.ask)
      ensures if choice.accept then (exists x :: x in after.state.asking && x.id == q.id)
        else replyFor(r, choice).(request := q.id, ask := q.ask) in after.out
    {
      if choice.accept {
        if q.id == id { assert r in after.state.asking; }
        else { assert q in after.state.asking; }
      } else if q.id == id {
        assert q.ask == r.ask;
        assert replyFor(r, choice).(request := q.id, ask := q.ask) == replyFor(r, choice);
      }
    }
  }
}

lemma lawAWebsiteGetsADeviceOnlyWhenAndroidAllows_ensures(s: WebsiteRequests, id: int, verdict: AndroidOutcome, by_: WebsiteActor)
  ensures (lawAWebsiteGetsADeviceOnlyWhenAndroidAllows(s, id, verdict, by_) == true)
{
  if canAndroidAnswered(s, id, verdict, by_) && androidDecides(verdict) && isPermission(askedOf(s, id).ask) {
    var granted := verdict == AndroidOutcome.AndroidGranted;
    assert androidAnswered(s, id, verdict, by_) == androidSettled(id, granted, s);
    assert toldOf(verdict) == (if granted then Answer.Allowed else Answer.Denied);
    AskedOf(s, id);
    var r := askedOf(s, id);
    var o := originOf(r.ask);
    var k := kindsOf(r.ask);
    var told := ProofLib.Filter((q: WebsiteRequest) => sameSite(q.ask, r.ask), s.asking);
    var after := androidSettled(id, granted, s);
    AndroidFilter(id, granted, s);
    Members((q: WebsiteRequest) => sameSite(q.ask, r.ask), s.asking);
    DecisionMembers((d: SiteDecision) => !(((d.origin == o) && (d.kinds == k) && d.allowed)), s.decisions);
    assert granted ==> allowedBefore(after.state, o, k) by {
      if granted && allowedBefore(s, o, k) {
        var d :| d in s.decisions && d.origin == o && d.kinds == k && d.allowed;
      }
    }
    forall x | x in after.out
      ensures x.answer == (if granted then Answer.Allowed else Answer.Denied)
    {
      var i :| 0 <= i < |told| && after.out[i] == x;
    }
    assert r in told;
    var i :| 0 <= i < |told| && told[i] == r;
    assert after.out[i] == replyOf(r, if granted then Answer.Allowed else Answer.Denied);
  }
}

lemma lawABlockedSignInIsExplained_ensures(s: WebsiteRequests, report: HostReport, by_: WebsiteActor)
  ensures (lawABlockedSignInIsExplained(s, report, by_) == true)
{
  if canRaise(s, report, by_) && isBlockedSignIn(report.ask) {
    var r := newRequest(s, report);
    var counted := s.(nextId := s.nextId + 1);
    assert !toAndroid(s, report);
    assert waits(s, report);
    HoldMembers(r, counted);
    assert raise(s, report, by_) == hold(r, counted);
  }
}

lemma lawHidingKeepsASignIn_ensures(s: WebsiteRequests, by_: WebsiteActor)
  ensures (lawHidingKeepsASignIn(s, by_) == true)
{
  var view := viewOf(s).(shown := false);
  assert hideBrowser(s, by_).state.requests == ProofLib.Filter((r: WebsiteRequest) => heldInView(view, r), s.requests);
  Members((r: WebsiteRequest) => heldInView(view, r), s.requests);
}

lemma lawANewViewKeepsASignIn_ensures(s: WebsiteRequests, view: PageView, by_: WebsiteActor)
  ensures (lawANewViewKeepsASignIn(s, view, by_) == true)
{
  var kept := ProofLib.Filter((r: WebsiteRequest) => heldInView(view, r), s.requests);
  assert followView(s, view, by_).state.requests == kept;
  Members((r: WebsiteRequest) => heldInView(view, r), s.requests);
}

lemma RaiseToAndroid(s: WebsiteRequests, report: HostReport, by_: WebsiteActor)
  requires inv(s) && canRaise(s, report, by_) && toAndroid(s, report)
  ensures raise(s, report, by_) == WebsiteResult(s.(nextId := s.nextId + 1, asking := s.asking + [newRequest(s, report)]),
    if waitingOnAndroid(s, report.ask) then [] else [replyOf(newRequest(s, report), Answer.AskAndroid)])
  ensures forall x :: x in s.requests ==> !sameSite(x.ask, report.ask)
  ensures !decided(s, report.ask.origin, report.ask.kinds) || allowedBefore(s, report.ask.origin, report.ask.kinds)
{
  var o := report.ask.origin;
  var k := report.ask.kinds;
  forall x | x in s.requests
    ensures !sameSite(x.ask, report.ask)
  {
    assert undecided(s, x.ask) && !waitingOnAndroid(s, x.ask);
    if sameSite(x.ask, report.ask) && !decided(s, o, k) {
      var q :| q in s.asking && sameSite(q.ask, report.ask);
      assert sameSite(q.ask, x.ask);
    }
  }
}

lemma RaiseCalls(s: WebsiteRequests, report: HostReport, by_: WebsiteActor)
  requires inv(s) && canRaise(s, report, by_) && toAndroid(s, report)
  ensures stepOneAndroidCallPerWebsite(s, raise(s, report, by_).state, raise(s, report, by_).out)
  ensures stepEveryAndroidWaitHasACall(s, raise(s, report, by_).state, raise(s, report, by_).out)
{
  RaiseToAndroid(s, report, by_);
  var r := newRequest(s, report);
  var after := raise(s, report, by_);
  assert after.state.asking == s.asking + [r];
  forall q | q in after.state.asking
    ensures calledFor(after.state, q.ask).id != q.id || calledFor(s, q.ask).id == q.id || replyOf(q, Answer.AskAndroid) in after.out
  {
    FirstConcat(s.asking, [r], q.ask);
    if q in s.asking {
      assert isPermission(q.ask) && sameSite(q.ask, q.ask);
    } else {
      assert q == r;
      FirstIs(s.asking, r.ask);
      if waitingOnAndroid(s, r.ask) {
        assert calledFor(s, r.ask) in s.asking;
      } else {
        assert after.out == [replyOf(r, Answer.AskAndroid)];
      }
    }
  }
  if !waitingOnAndroid(s, r.ask) {
    FirstConcat(s.asking, [r], r.ask);
    FirstHead([r], r.ask);
    FirstIs(s.asking, r.ask);
    assert calledFor(after.state, r.ask) == r;
    assert calledFor(s, r.ask) == noRequest;
  }
}

lemma Members(p: WebsiteRequest -> bool, xs: seq<WebsiteRequest>)
  ensures forall x :: x in ProofLib.Filter(p, xs) <==> x in xs && p(x)
{
  forall x ensures x in ProofLib.Filter(p, xs) <==> x in xs && p(x) { ProofLib.FilterMember(p, xs, x); }
}

lemma IntMembers(p: int -> bool, xs: seq<int>)
  ensures forall x :: x in ProofLib.Filter(p, xs) <==> x in xs && p(x)
{
  forall x ensures x in ProofLib.Filter(p, xs) <==> x in xs && p(x) { ProofLib.FilterMember(p, xs, x); }
}

lemma OpeningMembers(p: Opening -> bool, xs: seq<Opening>)
  ensures forall x :: x in ProofLib.Filter(p, xs) <==> x in xs && p(x)
{
  forall x ensures x in ProofLib.Filter(p, xs) <==> x in xs && p(x) { ProofLib.FilterMember(p, xs, x); }
}

lemma DecisionMembers(p: SiteDecision -> bool, xs: seq<SiteDecision>)
  ensures forall x :: x in ProofLib.Filter(p, xs) <==> x in xs && p(x)
{
  forall x ensures x in ProofLib.Filter(p, xs) <==> x in xs && p(x) { ProofLib.FilterMember(p, xs, x); }
}

lemma Ended(goneA: seq<WebsiteRequest>, keptA: seq<WebsiteRequest>, gone: seq<WebsiteRequest>, kept: seq<WebsiteRequest>, s: WebsiteRequests)
  requires alwaysDownloadsAreRecorded(s)
  requires forall r :: r in gone ==> r.id > 0 && r.id < s.nextId && askIsWellFormed(r.ask)
  requires forall q :: q in keptA ==> q in s.asking
  requires forall a :: firstWaiting(s.asking, a) in keptA ==> firstWaiting(keptA, a) == firstWaiting(s.asking, a)
  ensures alwaysDownloadsAreRecorded(stopAsking(goneA, keptA, withdraw(gone, kept, s)).state)
  ensures stopAsking(goneA, keptA, withdraw(gone, kept, s)).state == withdraw(gone, kept, s).state.(asking := keptA)
  ensures withdraw(gone, kept, s).state == s.(requests := kept, downloads := withdraw(gone, kept, s).state.downloads)
  ensures forall o :: o in stopAsking(goneA, keptA, withdraw(gone, kept, s)).out ==> (o.answer == Answer.Cancelled ||
    (o.answer == Answer.AskAndroid && (exists q :: q in keptA && o == replyOf(q, Answer.AskAndroid)) &&
     firstWaiting(keptA, o.ask).id == o.request && firstWaiting(s.asking, o.ask) !in keptA))
  ensures forall q :: q in keptA ==> (firstWaiting(keptA, q.ask).id != q.id || firstWaiting(s.asking, q.ask).id == q.id ||
    replyOf(q, Answer.AskAndroid) in stopAsking(goneA, keptA, withdraw(gone, kept, s)).out)
{
  WithdrawRecords(gone, kept, s);
  WithdrawFilter(gone, kept, s);
  WithdrawCancels(gone, kept, s);
  var left := withdraw(gone, kept, s);
  assert left.state.asking == s.asking;
  var called := ProofLib.Filter((q: WebsiteRequest) => ((firstWaiting(keptA, q.ask).id == q.id) && (firstWaiting(left.state.asking, q.ask).id != q.id)), keptA);
  Members((q: WebsiteRequest) => ((firstWaiting(keptA, q.ask).id == q.id) && (firstWaiting(left.state.asking, q.ask).id != q.id)), keptA);
  var tail := seq(|goneA|, i_map requires 0 <= i_map < |goneA| => var r := goneA[i_map]; replyOf(r, Answer.Cancelled));
  var calls := seq(|called|, i_map requires 0 <= i_map < |called| => var q := called[i_map]; replyOf(q, Answer.AskAndroid));
  assert stopAsking(goneA, keptA, left).out == left.out + tail + calls;
  forall o | o in left.out + tail + calls
    ensures o.answer == Answer.Cancelled || (o.answer == Answer.AskAndroid && (exists q :: q in keptA && o == replyOf(q, Answer.AskAndroid)) &&
      firstWaiting(keptA, o.ask).id == o.request && firstWaiting(s.asking, o.ask) !in keptA)
  {
    if o in left.out {
    } else if o in tail {
      var i :| 0 <= i < |tail| && tail[i] == o;
    } else {
      var i :| 0 <= i < |calls| && calls[i] == o;
      var q := called[i];
      assert q in called;
      assert o == replyOf(q, Answer.AskAndroid);
    }
  }
  forall q | q in keptA && firstWaiting(keptA, q.ask).id == q.id && firstWaiting(s.asking, q.ask).id != q.id
    ensures replyOf(q, Answer.AskAndroid) in left.out + tail + calls
  {
    assert q in called;
    var i :| 0 <= i < |called| && called[i] == q;
    assert calls[i] == replyOf(q, Answer.AskAndroid);
  }
}

lemma EndedRules(goneA: seq<WebsiteRequest>, keptA: seq<WebsiteRequest>, gone: seq<WebsiteRequest>, kept: seq<WebsiteRequest>, s: WebsiteRequests, after: WebsiteRequests)
  requires inv(s)
  requires forall r :: r in gone ==> r.id > 0 && r.id < s.nextId && askIsWellFormed(r.ask)
  requires forall q :: q in keptA ==> q in s.asking
  requires forall a :: firstWaiting(s.asking, a) in keptA ==> firstWaiting(keptA, a) == firstWaiting(s.asking, a)
  requires after.asking == keptA
  ensures stepOneAndroidCallPerWebsite(s, after, stopAsking(goneA, keptA, withdraw(gone, kept, s)).out)
  ensures stepEveryAndroidWaitHasACall(s, after, stopAsking(goneA, keptA, withdraw(gone, kept, s)).out)
  ensures stepOnlyThePersonGrants(s, after, stopAsking(goneA, keptA, withdraw(gone, kept, s)).out)
  ensures stepPagesAreToldTheStoredDecision(s, after, stopAsking(goneA, keptA, withdraw(gone, kept, s)).out)
{
  Ended(goneA, keptA, gone, kept, s);
  var out := stopAsking(goneA, keptA, withdraw(gone, kept, s)).out;
  forall o | o in out && o.answer == Answer.AskAndroid
    ensures grantedBefore(s, o)
  {
    var q :| q in keptA && o == replyOf(q, Answer.AskAndroid);
    assert q in s.asking && isPermission(q.ask);
    assert sameSite(q.ask, o.ask);
  }
}

lemma FirstIs(xs: seq<WebsiteRequest>, a: Ask)
  ensures (exists x :: x in xs && sameSite(x.ask, a)) ==> firstWaiting(xs, a) in xs && sameSite(firstWaiting(xs, a).ask, a)
  ensures !(exists x :: x in xs && sameSite(x.ask, a)) ==> firstWaiting(xs, a) == noRequest
{
  Members((q: WebsiteRequest) => sameSite(q.ask, a), xs);
  var g := ProofLib.Filter((q: WebsiteRequest) => sameSite(q.ask, a), xs);
  if exists x :: x in xs && sameSite(x.ask, a) {
    var x :| x in xs && sameSite(x.ask, a);
    assert x in g;
    assert g[0] in g;
  } else if |g| > 0 {
    assert g[0] in g;
  }
}

lemma FilterConcat(p: WebsiteRequest -> bool, xs: seq<WebsiteRequest>, ys: seq<WebsiteRequest>)
  ensures ProofLib.Filter(p, xs + ys) == ProofLib.Filter(p, xs) + ProofLib.Filter(p, ys)
  decreases |ys|
{
  if |ys| == 0 {
    assert xs + ys == xs;
    ProofLib.FilterNil(p, ys);
  } else {
    var init := ys[..|ys| - 1];
    var last := ys[|ys| - 1];
    assert ys == init + [last];
    assert xs + ys == (xs + init) + [last];
    ProofLib.FilterAppend(p, xs + init, last);
    ProofLib.FilterAppend(p, init, last);
    FilterConcat(p, xs, init);
  }
}

lemma FirstConcat(xs: seq<WebsiteRequest>, ys: seq<WebsiteRequest>, a: Ask)
  ensures firstWaiting(xs + ys, a) == (if exists x :: x in xs && sameSite(x.ask, a) then firstWaiting(xs, a) else firstWaiting(ys, a))
{
  FilterConcat((q: WebsiteRequest) => sameSite(q.ask, a), xs, ys);
  Members((q: WebsiteRequest) => sameSite(q.ask, a), xs);
  var g := ProofLib.Filter((q: WebsiteRequest) => sameSite(q.ask, a), xs);
  if exists x :: x in xs && sameSite(x.ask, a) {
    var x :| x in xs && sameSite(x.ask, a);
    assert x in g;
  } else {
    if |g| > 0 { assert g[0] in g; }
    assert g == [];
  }
}

lemma FirstHead(xs: seq<WebsiteRequest>, a: Ask)
  requires |xs| > 0 && sameSite(xs[0].ask, a)
  ensures firstWaiting(xs, a) == xs[0]
{
  ProofLib.FilterCons((q: WebsiteRequest) => sameSite(q.ask, a), xs);
}

lemma FirstKept(p: WebsiteRequest -> bool, xs: seq<WebsiteRequest>, a: Ask)
  requires forall x :: x in xs ==> isPermission(x.ask)
  requires firstWaiting(xs, a) in ProofLib.Filter(p, xs)
  ensures firstWaiting(ProofLib.Filter(p, xs), a) == firstWaiting(xs, a)
  decreases |xs|
{
  var f := firstWaiting(xs, a);
  ProofLib.FilterMember(p, xs, f);
  FirstIs(xs, a);
  var t := xs[1..];
  assert xs == [xs[0]] + t;
  ProofLib.FilterCons((q: WebsiteRequest) => sameSite(q.ask, a), xs);
  ProofLib.FilterCons(p, xs);
  var F := ProofLib.Filter(p, xs);
  if sameSite(xs[0].ask, a) {
    assert f == xs[0];
    assert F == [xs[0]] + ProofLib.Filter(p, t);
    FirstHead(F, a);
  } else {
    assert f == firstWaiting(t, a);
    assert f in t;
    ProofLib.FilterMember(p, t, f);
    assert forall x :: x in t ==> x in xs;
    FirstKept(p, t, a);
    if p(xs[0]) {
      assert F == [xs[0]] + ProofLib.Filter(p, t);
      ProofLib.FilterCons((q: WebsiteRequest) => sameSite(q.ask, a), F);
      assert F[1..] == ProofLib.Filter(p, t);
    } else {
      assert F == ProofLib.Filter(p, t);
    }
  }
}

lemma Stable(p: WebsiteRequest -> bool, xs: seq<WebsiteRequest>)
  requires forall x :: x in xs ==> isPermission(x.ask)
  ensures forall a :: firstWaiting(xs, a) in ProofLib.Filter(p, xs) ==> firstWaiting(ProofLib.Filter(p, xs), a) == firstWaiting(xs, a)
  ensures forall q :: q in ProofLib.Filter(p, xs) ==> q in xs
{
  Members(p, xs);
  forall a | firstWaiting(xs, a) in ProofLib.Filter(p, xs)
    ensures firstWaiting(ProofLib.Filter(p, xs), a) == firstWaiting(xs, a)
  { FirstKept(p, xs, a); }
}

lemma PresentedFilter(s: WebsiteRequests)
  ensures presented(s) == (if s.shown && |ProofLib.Filter((r: WebsiteRequest) => (r.tab == s.selected), s.requests)| > 0
    then ProofLib.Filter((r: WebsiteRequest) => (r.tab == s.selected), s.requests)[0] else noRequest)
{
}

lemma PresentedIsWaiting(s: WebsiteRequests)
  requires presented(s).id > 0
  ensures presented(s) in s.requests
{
  PresentedFilter(s);
  var xs := ProofLib.Filter((r: WebsiteRequest) => (r.tab == s.selected), s.requests);
  if s.shown && |xs| > 0 { ProofLib.FilterMember((r: WebsiteRequest) => (r.tab == s.selected), s.requests, xs[0]); }
}

lemma AskedOf(s: WebsiteRequests, id: int)
  requires exists r :: r in s.asking && r.id == id
  ensures askedOf(s, id) in s.asking && askedOf(s, id).id == id
{
  var xs := ProofLib.Filter((r: WebsiteRequest) => (r.id == id), s.asking);
  Members((r: WebsiteRequest) => (r.id == id), s.asking);
  var r :| r in s.asking && r.id == id;
  assert r in xs;
  assert askedOf(s, id) == xs[0];
  assert xs[0] in xs;
}

lemma AndroidFilter(id: int, granted: bool, s: WebsiteRequests)
  ensures androidSettled(id, granted, s) == (var r := askedOf(s, id); var o := originOf(r.ask); var k := kindsOf(r.ask);
    var told := ProofLib.Filter((q: WebsiteRequest) => sameSite(q.ask, r.ask), s.asking);
    WebsiteResult(s.(asking := ProofLib.Filter((q: WebsiteRequest) => !(sameSite(q.ask, r.ask)), s.asking),
      decisions := (if !granted then ProofLib.Filter((d: SiteDecision) => !(((d.origin == o) && (d.kinds == k) && d.allowed)), s.decisions)
        else (if allowedBefore(s, o, k) then s.decisions else s.decisions + [SiteDecision(o, k, true)])),
      openings := (if granted then s.openings else s.openings + [Opening(id, r.ask, true)])),
      seq(|told|, i_map requires 0 <= i_map < |told| => var q := told[i_map]; replyOf(q, (if granted then Answer.Allowed else Answer.Denied)))))
{
}

lemma AnswerFilter(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  ensures answer(s, id, choice, by_) == (var r := presented(s); var reply := replyFor(r, choice);
    var al := ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests);
    var rest := s.(requests := ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && !(sameSite(q.ask, presented(s).ask))), s.requests));
    var shared := seq(|al|, i_map requires 0 <= i_map < |al| => var q := al[i_map]; reply.(request := q.id, ask := q.ask));
    var done := conclude(r, reply, rest);
    if reply.answer.AskAndroid? then WebsiteResult(rest.(asking := s.asking + [r] + al), [reply])
    else WebsiteResult(done.state, done.out + shared))
{
}

lemma AnswerState(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  ensures answer(s, id, choice, by_).state == (var rest := s.(requests := ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && !(sameSite(q.ask, presented(s).ask))), s.requests));
    if replyFor(presented(s), choice).answer.AskAndroid?
    then rest.(asking := s.asking + [presented(s)] + ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests))
    else conclude(presented(s), replyFor(presented(s), choice), rest).state)
{
  AnswerFilter(s, id, choice, by_);
}

lemma AnswerCalls(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  requires inv(s) && canAnswer(s, id, choice, by_) && replyFor(presented(s), choice).answer.AskAndroid?
  ensures stepOneAndroidCallPerWebsite(s, answer(s, id, choice, by_).state, answer(s, id, choice, by_).out)
  ensures stepEveryAndroidWaitHasACall(s, answer(s, id, choice, by_).state, answer(s, id, choice, by_).out)
{
  PresentedIsWaiting(s);
  AnswerFilter(s, id, choice, by_);
  var r := presented(s);
  var reply := replyFor(r, choice);
  assert isPermission(r.ask) && sameSite(r.ask, r.ask);
  assert reply == replyOf(r, Answer.AskAndroid);
  var al := ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests);
  Members((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests);
  var after := answer(s, id, choice, by_);
  assert after.state.asking == s.asking + ([r] + al);
  assert after.out == [reply];
  assert !waitingOnAndroid(s, r.ask);
  forall q | q in [r] + al
    ensures sameSite(q.ask, r.ask) && !(exists x :: x in s.asking && sameSite(x.ask, q.ask)) && firstWaiting(after.state.asking, q.ask) == r
  {
    assert sameSite(q.ask, r.ask);
    if exists x :: x in s.asking && sameSite(x.ask, q.ask) {
      var x :| x in s.asking && sameSite(x.ask, q.ask);
      assert sameSite(x.ask, r.ask);
    }
    FirstConcat(s.asking, [r] + al, q.ask);
    FirstHead([r] + al, q.ask);
  }
  forall q | q in after.state.asking
    ensures calledFor(after.state, q.ask).id != q.id || calledFor(s, q.ask).id == q.id || replyOf(q, Answer.AskAndroid) in after.out
  {
    if q in s.asking {
      assert sameSite(q.ask, q.ask);
      FirstConcat(s.asking, [r] + al, q.ask);
    } else if q != r {
      assert q in al;
    }
  }
  FirstIs(s.asking, r.ask);
  assert r in [r] + al;
  assert calledFor(after.state, r.ask) == r;
  assert calledFor(s, r.ask) == noRequest;
}

lemma AnswerOut(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  ensures forall x :: x in answer(s, id, choice, by_).out ==> (x == replyFor(presented(s), choice) ||
    exists q :: q in s.requests && sameSite(q.ask, presented(s).ask) && x == replyFor(presented(s), choice).(request := q.id, ask := q.ask))
  ensures !replyFor(presented(s), choice).answer.AskAndroid? ==> forall q :: q in s.requests && q.id != id && sameSite(q.ask, presented(s).ask) ==>
    (replyFor(presented(s), choice).(request := q.id, ask := q.ask) in answer(s, id, choice, by_).out)
  ensures replyFor(presented(s), choice) in answer(s, id, choice, by_).out
{
  AnswerFilter(s, id, choice, by_);
  var r := presented(s);
  var reply := replyFor(r, choice);
  var al := ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests);
  var dups := seq(|al|, i_map requires 0 <= i_map < |al| => var q := al[i_map]; reply.(request := q.id, ask := q.ask));
  assert answer(s, id, choice, by_).out == (if reply.answer.AskAndroid? then [reply] else [reply] + dups);
  forall x | x in answer(s, id, choice, by_).out && x != reply
    ensures exists q :: q in s.requests && sameSite(q.ask, r.ask) && x == reply.(request := q.id, ask := q.ask)
  {
    var i :| 0 <= i < |dups| && dups[i] == x;
    ProofLib.FilterMember((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests, al[i]);
    assert al[i] in s.requests && sameSite(al[i].ask, r.ask) && x == reply.(request := al[i].id, ask := al[i].ask);
  }
  forall q | !reply.answer.AskAndroid? && q in s.requests && q.id != id && sameSite(q.ask, r.ask)
    ensures reply.(request := q.id, ask := q.ask) in answer(s, id, choice, by_).out
  {
    ProofLib.FilterMember((q: WebsiteRequest) => ((q.id != id) && sameSite(q.ask, presented(s).ask)), s.requests, q);
    var i :| 0 <= i < |al| && al[i] == q;
    assert dups[i] == reply.(request := q.id, ask := q.ask);
  }
}

lemma WithdrawFilter(gone: seq<WebsiteRequest>, kept: seq<WebsiteRequest>, s: WebsiteRequests)
  ensures withdraw(gone, kept, s).state == s.(requests := kept, downloads := s.downloads +
    (var s_map := ProofLib.Filter((r: WebsiteRequest) => isDownload(r.ask), gone);
     seq(|s_map|, i_map requires 0 <= i_map < |s_map| => var r := s_map[i_map]; notSaved(r))))
{
}

lemma WithdrawRecords(gone: seq<WebsiteRequest>, kept: seq<WebsiteRequest>, s: WebsiteRequests)
  requires alwaysDownloadsAreRecorded(s)
  requires forall r :: r in gone ==> r.id > 0 && r.id < s.nextId && askIsWellFormed(r.ask)
  ensures alwaysDownloadsAreRecorded(withdraw(gone, kept, s).state)
{
  WithdrawFilter(gone, kept, s);
  var ds := ProofLib.Filter((r: WebsiteRequest) => isDownload(r.ask), gone);
  var added := seq(|ds|, i_map requires 0 <= i_map < |ds| => var r := ds[i_map]; notSaved(r));
  forall i | 0 <= i < |ds|
    ensures added[i].id > 0 && added[i].id < s.nextId && added[i].fileName != ""
  { ProofLib.FilterMember((r: WebsiteRequest) => isDownload(r.ask), gone, ds[i]); }
  assert withdraw(gone, kept, s).state.downloads == s.downloads + added;
  forall x | x in s.downloads + added
    ensures x.id > 0 && x.id < s.nextId && x.fileName != ""
  {
    if x !in s.downloads { var i :| 0 <= i < |added| && added[i] == x; }
  }
}

lemma WithdrawCancels(gone: seq<WebsiteRequest>, kept: seq<WebsiteRequest>, s: WebsiteRequests)
  ensures forall o :: o in withdraw(gone, kept, s).out ==> o.answer == Answer.Cancelled
{
  forall o | o in withdraw(gone, kept, s).out ensures o.answer == Answer.Cancelled
  {
    var i :| 0 <= i < |gone| && withdraw(gone, kept, s).out[i] == o;
  }
}

lemma HoldFilter(r: WebsiteRequest, s: WebsiteRequests)
  ensures hold(r, s) == (var left := withdraw(ProofLib.Filter((q: WebsiteRequest) => ((q.tab == r.tab) && sameSlot(q.ask, r.ask)), s.requests),
    ProofLib.Filter((q: WebsiteRequest) => !(((q.tab == r.tab) && sameSlot(q.ask, r.ask))), s.requests), s);
    WebsiteResult(left.state.(requests := left.state.requests + [r]), left.out))
{
}

lemma HoldMembers(r: WebsiteRequest, s: WebsiteRequests)
  ensures forall x :: x in hold(r, s).state.requests <==> (x in s.requests && !(x.tab == r.tab && sameSlot(x.ask, r.ask))) || x == r
  ensures hold(r, s).state == s.(requests := hold(r, s).state.requests, downloads := hold(r, s).state.downloads)
  ensures forall o :: o in hold(r, s).out ==> o.answer == Answer.Cancelled
{
  HoldFilter(r, s);
  Members((q: WebsiteRequest) => ((q.tab == r.tab) && sameSlot(q.ask, r.ask)), s.requests);
  Members((q: WebsiteRequest) => !(((q.tab == r.tab) && sameSlot(q.ask, r.ask))), s.requests);
  var gone := ProofLib.Filter((q: WebsiteRequest) => ((q.tab == r.tab) && sameSlot(q.ask, r.ask)), s.requests);
  var kept := ProofLib.Filter((q: WebsiteRequest) => !(((q.tab == r.tab) && sameSlot(q.ask, r.ask))), s.requests);
  WithdrawCancels(gone, kept, s);
  WithdrawFilter(gone, kept, s);
}

lemma HoldRecords(r: WebsiteRequest, s: WebsiteRequests)
  requires alwaysDownloadsAreRecorded(s)
  requires forall x :: x in s.requests ==> x.id > 0 && x.id < s.nextId && askIsWellFormed(x.ask)
  ensures alwaysDownloadsAreRecorded(hold(r, s).state)
{
  HoldFilter(r, s);
  Members((q: WebsiteRequest) => ((q.tab == r.tab) && sameSlot(q.ask, r.ask)), s.requests);
  WithdrawRecords(ProofLib.Filter((q: WebsiteRequest) => ((q.tab == r.tab) && sameSlot(q.ask, r.ask)), s.requests),
    ProofLib.Filter((q: WebsiteRequest) => !(((q.tab == r.tab) && sameSlot(q.ask, r.ask))), s.requests), s);
}

lemma FinishOpenedFilter(s: WebsiteRequests, id: int, opened_: bool, by_: WebsiteActor)
  requires opened_
  ensures finishOpening(s, id, opened_, by_) == s.(openings := ProofLib.Filter((o: Opening) => (o.id != id), s.openings))
{
}

lemma DismissOpeningFilter(s: WebsiteRequests, id: int, by_: WebsiteActor)
  ensures dismissOpening(s, id, by_) == s.(openings := ProofLib.Filter((o: Opening) => (o.id != id), s.openings))
{
}

lemma DismissFilter(s: WebsiteRequests, id: int, by_: WebsiteActor)
  ensures dismissDownload(s, id, by_).downloads == ProofLib.Filter((d: DownloadRecord) => (d.id != id), s.downloads)
{
}

lemma lawAnsweringTheOnlyMessageReleasesThePage_ensures(s: WebsiteRequests, id: int, choice: Choice, by_: WebsiteActor)
  ensures (lawAnsweringTheOnlyMessageReleasesThePage(s, id, choice, by_) == true)
{
  if canAnswer(s, id, choice, by_) && isMessage(presented(s).ask) && |s.requests| == 1 && |s.asking| == 0 {
    PresentedIsWaiting(s);
    AnswerState(s, id, choice, by_);
    var r := presented(s);
    assert s.requests == [r];
    var kept := ProofLib.Filter((q: WebsiteRequest) => ((q.id != id) && !(sameSite(q.ask, presented(s).ask))), s.requests);
    forall q | q in kept ensures false
    { ProofLib.FilterMember((q: WebsiteRequest) => ((q.id != id) && !(sameSite(q.ask, presented(s).ask))), s.requests, q); }
    assert kept == [];
    var after := answer(s, id, choice, by_).state;
    assert after.requests == [] && after.asking == [];
    PresentedFilter(after);
    assert ProofLib.Filter((r: WebsiteRequest) => (r.tab == after.selected), after.requests) == [];
  }
}
