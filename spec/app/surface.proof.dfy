lemma TabMembership(tabs: seq<int>, tab: int, present: bool, item: int)
  ensures (item in withTab(tabs, tab, present)) == (if item == tab then present else item in tabs)
{
  if present {
    ProofLib.FilterMember((set_x: int) => !(set_x in tabs), [tab], item);
  } else {
    ProofLib.FilterMember((set_x: int) => !(set_x in [tab]), tabs, item);
  }
}

lemma lawHistoryAppliesOnlyToItsTab_ensures(l: PageLayer, history: PrivateHistory, tab: int)
  ensures (lawHistoryAppliesOnlyToItsTab(l, history, tab) == true)
{
  TabMembership(l.privateBack, history.tab, history.back, tab);
  TabMembership(l.privateForward, history.tab, history.forward, tab);
}

lemma reclaim_ensures(l: PageLayer, tab: int, selected: int)
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysRectsAreWellFormed(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysVersionIsNonnegative(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysDrawnControlsAreRouted(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysPendingRequestKeepsDrawnControls(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysKeyboardHeightIsNonnegative(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysReclaimedTabsAreTabs(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> alwaysFullscreenOnlyOnARunningPage(reclaim(l, tab, selected)))
  ensures (inv(l) ==> canReclaim(l, tab, selected) ==> stepRoutingFollowsAcknowledgement(l, "reclaim", reclaim(l, tab, selected)))
{
  if inv(l) && canReclaim(l, tab, selected) {
    forall item | item in reclaim(l, tab, selected).reclaimed
      ensures item >= 0
    {
      ProofLib.FilterMember((set_x: int) => !(set_x in l.reclaimed), [tab], item);
    }
  }
}

lemma reopen_ensures(l: PageLayer, tab: int, selected: int)
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysRectsAreWellFormed(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysVersionIsNonnegative(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysDrawnControlsAreRouted(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysPendingRequestKeepsDrawnControls(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysKeyboardHeightIsNonnegative(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysReclaimedTabsAreTabs(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> alwaysFullscreenOnlyOnARunningPage(reopen(l, tab, selected)))
  ensures (inv(l) ==> canReopen(l, tab, selected) ==> stepRoutingFollowsAcknowledgement(l, "reopen", reopen(l, tab, selected)))
{
  if inv(l) && canReopen(l, tab, selected) {
    forall item | item in reopen(l, tab, selected).reclaimed
      ensures item >= 0
    {
      ProofLib.FilterMember((set_x: int) => !(set_x in [tab]), l.reclaimed, item);
    }
  }
}

lemma forget_ensures(l: PageLayer, tab: int)
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysRectsAreWellFormed(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysVersionIsNonnegative(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysDrawnControlsAreRouted(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysPendingRequestKeepsDrawnControls(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysKeyboardHeightIsNonnegative(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysReclaimedTabsAreTabs(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> alwaysFullscreenOnlyOnARunningPage(forget(l, tab)))
  ensures (inv(l) ==> canForget(l, tab) ==> stepRoutingFollowsAcknowledgement(l, "forget", forget(l, tab)))
{
  if inv(l) && canForget(l, tab) {
    forall item | item in forget(l, tab).reclaimed
      ensures item >= 0
    {
      ProofLib.FilterMember((set_x: int) => !(set_x in [tab]), l.reclaimed, item);
    }
  }
}
