lemma DetailsFilterForms(d: SavedDetails, factKey: string)
  ensures alwaysOneFactPerKey(d) == !(exists f :: f in d.facts && !(|ProofLib.Filter((other: app__memory_PersonalFact) => (other.factKey == f.factKey), d.facts)| == 1))
  ensures detailAt(d, factKey) == (if ((0 <= 0) && (0 < |ProofLib.Filter((f: app__memory_PersonalFact) => (f.factKey == factKey), d.facts)|)) then ProofLib.Filter((f: app__memory_PersonalFact) => (f.factKey == factKey), d.facts)[0] else app__memory_initial)
{
}

lemma OneKeyMeansDistinct(d: SavedDetails)
  requires alwaysOneFactPerKey(d)
  ensures forall i, j :: 0 <= i < |d.facts| && 0 <= j < |d.facts| && i != j ==> d.facts[i].factKey != d.facts[j].factKey
{
  DetailsFilterForms(d, "");
  forall i, j | 0 <= i < |d.facts| && 0 <= j < |d.facts| && i != j
    ensures d.facts[i].factKey != d.facts[j].factKey
  {
    var f := d.facts[i];
    assert f in d.facts;
    assert |ProofLib.Filter((other: app__memory_PersonalFact) => (other.factKey == f.factKey), d.facts)| == 1;
    ProofLib.FilterCountOneIffUnique((other: app__memory_PersonalFact) => (other.factKey == f.factKey), d.facts, (x: app__memory_PersonalFact) => x.factKey, i);
  }
}

lemma DistinctMeansOneKey(d: SavedDetails)
  requires forall i, j :: 0 <= i < |d.facts| && 0 <= j < |d.facts| && i != j ==> d.facts[i].factKey != d.facts[j].factKey
  ensures alwaysOneFactPerKey(d)
{
  DetailsFilterForms(d, "");
  forall f | f in d.facts
    ensures |ProofLib.Filter((other: app__memory_PersonalFact) => (other.factKey == f.factKey), d.facts)| == 1
  {
    var i :| 0 <= i < |d.facts| && d.facts[i] == f;
    ProofLib.FilterOne((other: app__memory_PersonalFact) => (other.factKey == f.factKey), d.facts, i);
  }
}

lemma DetailAtIsMember(d: SavedDetails, factKey: string)
  ensures detailAt(d, factKey) == app__memory_initial || (detailAt(d, factKey) in d.facts && detailAt(d, factKey).factKey == factKey)
  ensures (exists f :: f in d.facts && f.factKey == factKey) ==> (detailAt(d, factKey) in d.facts && detailAt(d, factKey).factKey == factKey)
{
  DetailsFilterForms(d, factKey);
  if 0 < |ProofLib.Filter((f: app__memory_PersonalFact) => (f.factKey == factKey), d.facts)| {
    ProofLib.FilterMember((f: app__memory_PersonalFact) => (f.factKey == factKey), d.facts, ProofLib.Filter((f: app__memory_PersonalFact) => (f.factKey == factKey), d.facts)[0]);
  } else {
    ProofLib.FilterNone((f: app__memory_PersonalFact) => (f.factKey == factKey), d.facts);
  }
}

lemma WithDetailShape(xs: seq<app__memory_PersonalFact>, fact: app__memory_PersonalFact)
  ensures (exists f :: f in xs && f.factKey == fact.factKey) ==> (|withDetail(xs, fact)| == |xs| &&
    forall i :: 0 <= i < |xs| ==> withDetail(xs, fact)[i] == (if xs[i].factKey == fact.factKey then fact else xs[i]))
  ensures !(exists f :: f in xs && f.factKey == fact.factKey) ==> withDetail(xs, fact) == xs + [fact]
  ensures forall g :: g in withDetail(xs, fact) ==> g == fact || g in xs
{
}

lemma WithDetailKeepsInv(d: SavedDetails, fact: app__memory_PersonalFact)
  requires inv(d)
  requires app__memory_validFact(fact) && fact.factKey != "" && (fact.kind.Name? == (fact.factKey == nameKey))
  ensures inv(SavedDetails(withDetail(d.facts, fact)))
{
  var after := SavedDetails(withDetail(d.facts, fact));
  WithDetailShape(d.facts, fact);
  OneKeyMeansDistinct(d);
  if exists f :: f in d.facts && f.factKey == fact.factKey {
    assert forall i :: 0 <= i < |d.facts| ==> after.facts[i].factKey == d.facts[i].factKey;
  } else {
    assert forall i :: 0 <= i < |d.facts| ==> d.facts[i] in d.facts;
    assert forall i :: 0 <= i < |d.facts| ==> after.facts[i] == d.facts[i];
    assert after.facts[|d.facts|] == fact;
  }
  DistinctMeansOneKey(after);
}

lemma DetailToChange(d: SavedDetails, factKey: string)
  requires inv(d)
  ensures app__memory_validFact(detailAt(d, factKey))
  ensures detailAt(d, factKey) == app__memory_initial || (detailAt(d, factKey).factKey == factKey && factKey != "" &&
    (detailAt(d, factKey).kind.Name? == (factKey == nameKey)))
{
  DetailAtIsMember(d, factKey);
}

lemma proposeDetail_ensures(d: SavedDetails, proposedFact: app__memory_FactProposal, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canProposeDetail(d, proposedFact, by_) ==> alwaysEveryDetailIsValid(proposeDetail(d, proposedFact, by_)))
  ensures (inv(d) ==> canProposeDetail(d, proposedFact, by_) ==> alwaysOneFactPerKey(proposeDetail(d, proposedFact, by_)))
  ensures (inv(d) ==> canProposeDetail(d, proposedFact, by_) ==> alwaysNameUsesTheNameKey(proposeDetail(d, proposedFact, by_)))
  ensures (inv(d) ==> canProposeDetail(d, proposedFact, by_) ==> stepDetailFillUsesCurrentApproval(d, proposeDetail(d, proposedFact, by_), []))
{
  if inv(d) && canProposeDetail(d, proposedFact, by_) {
    DetailToChange(d, proposedFact.factKey);
    WithDetailKeepsInv(d, app__memory_propose(detailAt(d, proposedFact.factKey), proposedFact, by_));
  }
}

lemma rememberDetail_ensures(d: SavedDetails, factKey: string, version: int, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canRememberDetail(d, factKey, version, by_) ==> alwaysEveryDetailIsValid(rememberDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canRememberDetail(d, factKey, version, by_) ==> alwaysOneFactPerKey(rememberDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canRememberDetail(d, factKey, version, by_) ==> alwaysNameUsesTheNameKey(rememberDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canRememberDetail(d, factKey, version, by_) ==> stepDetailFillUsesCurrentApproval(d, rememberDetail(d, factKey, version, by_), []))
{
  if inv(d) && canRememberDetail(d, factKey, version, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_remember(detailAt(d, factKey), version, by_));
  }
}

lemma declineDetail_ensures(d: SavedDetails, factKey: string, version: int, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canDeclineDetail(d, factKey, version, by_) ==> alwaysEveryDetailIsValid(declineDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canDeclineDetail(d, factKey, version, by_) ==> alwaysOneFactPerKey(declineDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canDeclineDetail(d, factKey, version, by_) ==> alwaysNameUsesTheNameKey(declineDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canDeclineDetail(d, factKey, version, by_) ==> stepDetailFillUsesCurrentApproval(d, declineDetail(d, factKey, version, by_), []))
{
  if inv(d) && canDeclineDetail(d, factKey, version, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_decline(detailAt(d, factKey), version, by_));
  }
}

lemma verifyDetailScope_ensures(d: SavedDetails, factKey: string, scopeCheck: app__memory_ScopeCheck, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canVerifyDetailScope(d, factKey, scopeCheck, by_) ==> alwaysEveryDetailIsValid(verifyDetailScope(d, factKey, scopeCheck, by_)))
  ensures (inv(d) ==> canVerifyDetailScope(d, factKey, scopeCheck, by_) ==> alwaysOneFactPerKey(verifyDetailScope(d, factKey, scopeCheck, by_)))
  ensures (inv(d) ==> canVerifyDetailScope(d, factKey, scopeCheck, by_) ==> alwaysNameUsesTheNameKey(verifyDetailScope(d, factKey, scopeCheck, by_)))
  ensures (inv(d) ==> canVerifyDetailScope(d, factKey, scopeCheck, by_) ==> stepDetailFillUsesCurrentApproval(d, verifyDetailScope(d, factKey, scopeCheck, by_), []))
{
  if inv(d) && canVerifyDetailScope(d, factKey, scopeCheck, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_verifyScope(detailAt(d, factKey), scopeCheck, by_));
  }
}

lemma forgetDetail_ensures(d: SavedDetails, factKey: string, version: int, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canForgetDetail(d, factKey, version, by_) ==> alwaysEveryDetailIsValid(forgetDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canForgetDetail(d, factKey, version, by_) ==> alwaysOneFactPerKey(forgetDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canForgetDetail(d, factKey, version, by_) ==> alwaysNameUsesTheNameKey(forgetDetail(d, factKey, version, by_)))
  ensures (inv(d) ==> canForgetDetail(d, factKey, version, by_) ==> stepDetailFillUsesCurrentApproval(d, forgetDetail(d, factKey, version, by_), []))
{
  if inv(d) && canForgetDetail(d, factKey, version, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_forget(detailAt(d, factKey), version, by_));
  }
}

lemma forgetAll_ensures(d: SavedDetails, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canForgetAll(d, by_) ==> alwaysEveryDetailIsValid(forgetAll(d, by_)))
  ensures (inv(d) ==> canForgetAll(d, by_) ==> alwaysOneFactPerKey(forgetAll(d, by_)))
  ensures (inv(d) ==> canForgetAll(d, by_) ==> alwaysNameUsesTheNameKey(forgetAll(d, by_)))
  ensures (inv(d) ==> canForgetAll(d, by_) ==> stepDetailFillUsesCurrentApproval(d, forgetAll(d, by_), []))
{
  if inv(d) && canForgetAll(d, by_) {
    OneKeyMeansDistinct(d);
    var after := forgetAll(d, by_);
    assert forall i :: 0 <= i < |d.facts| ==> after.facts[i].factKey == d.facts[i].factKey;
    DistinctMeansOneKey(after);
  }
}

lemma lawForgetDetailChangesOnlyThatDetail_ensures(d: SavedDetails, factKey: string, version: int)
  ensures (lawForgetDetailChangesOnlyThatDetail(d, factKey, version) == true)
{
  if canForgetDetail(d, factKey, version, app__memory_MemoryActor.MemoryUser) {
    DetailAtIsMember(d, factKey);
    var f := detailAt(d, factKey);
    var g := app__memory_forget(f, version, app__memory_MemoryActor.MemoryUser);
    var after := forgetDetail(d, factKey, version, app__memory_MemoryActor.MemoryUser);
    assert f in d.facts && g.factKey == factKey;
    WithDetailShape(d.facts, g);
    forall h | h in d.facts && h.factKey != factKey
      ensures h in after.facts
    {
      var i :| 0 <= i < |d.facts| && d.facts[i] == h;
      assert after.facts[i] == h;
    }
  }
}

lemma queueDetailFill_ensures(d: SavedDetails, factKey: string, fillRequest: app__memory_FillRequest, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canQueueDetailFill(d, factKey, fillRequest, by_) ==> alwaysEveryDetailIsValid(queueDetailFill(d, factKey, fillRequest, by_)))
  ensures (inv(d) ==> canQueueDetailFill(d, factKey, fillRequest, by_) ==> alwaysOneFactPerKey(queueDetailFill(d, factKey, fillRequest, by_)))
  ensures (inv(d) ==> canQueueDetailFill(d, factKey, fillRequest, by_) ==> alwaysNameUsesTheNameKey(queueDetailFill(d, factKey, fillRequest, by_)))
  ensures (inv(d) ==> canQueueDetailFill(d, factKey, fillRequest, by_) ==> stepDetailFillUsesCurrentApproval(d, queueDetailFill(d, factKey, fillRequest, by_), []))
{
  if inv(d) && canQueueDetailFill(d, factKey, fillRequest, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_queueFill(detailAt(d, factKey), fillRequest, by_));
  }
}

lemma cancelDetailFill_ensures(d: SavedDetails, factKey: string, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canCancelDetailFill(d, factKey, by_) ==> alwaysEveryDetailIsValid(cancelDetailFill(d, factKey, by_)))
  ensures (inv(d) ==> canCancelDetailFill(d, factKey, by_) ==> alwaysOneFactPerKey(cancelDetailFill(d, factKey, by_)))
  ensures (inv(d) ==> canCancelDetailFill(d, factKey, by_) ==> alwaysNameUsesTheNameKey(cancelDetailFill(d, factKey, by_)))
  ensures (inv(d) ==> canCancelDetailFill(d, factKey, by_) ==> stepDetailFillUsesCurrentApproval(d, cancelDetailFill(d, factKey, by_), []))
{
  if inv(d) && canCancelDetailFill(d, factKey, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_cancelFill(detailAt(d, factKey), by_));
  }
}

lemma dispatchDetailFill_ensures(d: SavedDetails, factKey: string, fillTicket: app__memory_FillTicket, by_: app__memory_MemoryActor)
  ensures (inv(d) ==> canDispatchDetailFill(d, factKey, fillTicket, by_) ==> alwaysEveryDetailIsValid(dispatchDetailFill(d, factKey, fillTicket, by_).state))
  ensures (inv(d) ==> canDispatchDetailFill(d, factKey, fillTicket, by_) ==> alwaysOneFactPerKey(dispatchDetailFill(d, factKey, fillTicket, by_).state))
  ensures (inv(d) ==> canDispatchDetailFill(d, factKey, fillTicket, by_) ==> alwaysNameUsesTheNameKey(dispatchDetailFill(d, factKey, fillTicket, by_).state))
  ensures (inv(d) ==> canDispatchDetailFill(d, factKey, fillTicket, by_) ==> stepDetailFillUsesCurrentApproval(d, dispatchDetailFill(d, factKey, fillTicket, by_).state, dispatchDetailFill(d, factKey, fillTicket, by_).out))
{
  if inv(d) && canDispatchDetailFill(d, factKey, fillTicket, by_) {
    DetailToChange(d, factKey);
    WithDetailKeepsInv(d, app__memory_dispatchFill(detailAt(d, factKey), fillTicket, by_).state);
  }
}

lemma lawGreetingNameIsSaved_ensures(d: SavedDetails)
  ensures (lawGreetingNameIsSaved(d) == true)
{
  DetailAtIsMember(d, nameKey);
}

lemma DetailAfterChange(xs: seq<app__memory_PersonalFact>, fact: app__memory_PersonalFact)
  ensures detailAt(SavedDetails(withDetail(xs, fact)), fact.factKey) == fact
{
  var after := SavedDetails(withDetail(xs, fact));
  WithDetailShape(xs, fact);
  if exists f :: f in xs && f.factKey == fact.factKey {
    var i :| 0 <= i < |xs| && xs[i].factKey == fact.factKey;
    assert after.facts[i] == fact;
  } else {
    assert after.facts[|xs|] == fact;
  }
  assert fact in after.facts;
  forall h | h in after.facts && h.factKey == fact.factKey
    ensures h == fact
  {
    var i :| 0 <= i < |after.facts| && after.facts[i] == h;
  }
  DetailAtIsMember(after, fact.factKey);
}

lemma lawForgottenNameIsNotGreeted_ensures(d: SavedDetails, version: int)
  ensures (lawForgottenNameIsNotGreeted(d, version) == true)
{
  if canForgetDetail(d, nameKey, version, app__memory_MemoryActor.MemoryUser) {
    DetailAtIsMember(d, nameKey);
    DetailAfterChange(d.facts, app__memory_forget(detailAt(d, nameKey), version, app__memory_MemoryActor.MemoryUser));
  }
}

lemma lawChangedDetailWaitsForHerYes_ensures(d: SavedDetails, proposedFact: app__memory_FactProposal)
  ensures (lawChangedDetailWaitsForHerYes(d, proposedFact) == true)
{
  DetailAfterChange(d.facts, app__memory_propose(detailAt(d, proposedFact.factKey), proposedFact, app__memory_MemoryActor.MemoryUser));
}

lemma lawDeletedDetailIsNotSaved_ensures(d: SavedDetails, factKey: string, version: int)
  ensures (lawDeletedDetailIsNotSaved(d, factKey, version) == true)
{
  if canForgetDetail(d, factKey, version, app__memory_MemoryActor.MemoryUser) {
    DetailAtIsMember(d, factKey);
    DetailAfterChange(d.facts, app__memory_forget(detailAt(d, factKey), version, app__memory_MemoryActor.MemoryUser));
  }
}

lemma lawClearedDetailIsNotSaved_ensures(d: SavedDetails, factKey: string)
  ensures (lawClearedDetailIsNotSaved(d, factKey) == true)
{
  var after := forgetAll(d, app__memory_MemoryActor.MemoryUser);
  forall h | h in after.facts
    ensures h.factKey == "" || h.status.Deleted?
  {
    var i :| 0 <= i < |after.facts| && after.facts[i] == h;
  }
  DetailAtIsMember(after, factKey);
}

lemma lawChangedDetailDropsItsFill_ensures(d: SavedDetails, proposedFact: app__memory_FactProposal)
  ensures (lawChangedDetailDropsItsFill(d, proposedFact) == true)
{
  DetailAfterChange(d.facts, app__memory_propose(detailAt(d, proposedFact.factKey), proposedFact, app__memory_MemoryActor.MemoryUser));
}

lemma lawDeletedDetailDropsItsFill_ensures(d: SavedDetails, factKey: string, version: int)
  ensures (lawDeletedDetailDropsItsFill(d, factKey, version) == true)
{
  if canForgetDetail(d, factKey, version, app__memory_MemoryActor.MemoryUser) {
    DetailAtIsMember(d, factKey);
    DetailAfterChange(d.facts, app__memory_forget(detailAt(d, factKey), version, app__memory_MemoryActor.MemoryUser));
  }
}

lemma lawClearAllDropsEveryFill_ensures(d: SavedDetails)
  ensures (lawClearAllDropsEveryFill(d) == true)
{
  var after := forgetAll(d, app__memory_MemoryActor.MemoryUser);
  forall h | h in after.facts
    ensures h.factKey == "" || !h.queued
  {
    var i :| 0 <= i < |after.facts| && after.facts[i] == h;
  }
}

lemma lawClearedNameIsNotGreeted_ensures(d: SavedDetails)
  ensures (lawClearedNameIsNotGreeted(d) == true)
{
  var after := forgetAll(d, app__memory_MemoryActor.MemoryUser);
  forall h | h in after.facts
    ensures h.factKey == "" || h.status.Deleted?
  {
    var i :| 0 <= i < |after.facts| && after.facts[i] == h;
  }
  DetailAtIsMember(after, nameKey);
}
