lemma lawASuggestionFitsOrIsAbsent_ensures(kind: app__task_TaskKind, facts: Facts, today: int)
  ensures (lawASuggestionFitsOrIsAbsent(kind, facts, today) == true)
{
  if factsFit(kind, facts) && facts.BillRead? && standing(facts).Actionable? && app__billKind_defaultAvailable(facts.bill, today) {
    var bill := facts.bill;
    var pay := app__billKind_suggestedPay(bill, today);
    assert bill.funding[0] in bill.funding;
    assert pay.funding == bill.funding[0] && pay.funding != "";
    assert app__task_validProposal(pay);
    assert app__billKind_payFits(bill, pay);
    assert termsFit(facts, suggestion(facts, today));
  }
  if factsFit(kind, facts) && facts.VisitRead? && standing(facts).Actionable? && app__bookingKind_onlyFreeSlot(facts.visit) {
    var visit := facts.visit;
    var free := app__bookingKind_freeSlots(visit);
    var book := app__bookingKind_suggestedBooking(visit);
    ProofLib.FilterMember((s: app__task_Slot) => !((s in visit.busy)), visit.slots, free[0]);
    assert free[0] in free;
    assert book.slot == free[0];
    assert book.slot in visit.slots && book.slot !in visit.busy;
    assert book.shares == visit.asks;
    assert app__task_validBooking(book);
    assert app__bookingKind_bookingFits(visit, book);
    assert termsFit(facts, suggestion(facts, today));
  }
  if factsFit(kind, facts) && facts.WalkthroughRead? && standing(facts).Actionable? && walkthroughDefaultAvailable(facts.walkthrough) {
    var walkthrough := facts.walkthrough;
    var offered := suggestedWalkthrough(walkthrough);
    assert offered.shares == walkthrough.asks;
    assert app__task_validWalkthrough(offered);
    assert walkthroughFits(walkthrough, offered);
    assert termsFit(facts, suggestion(facts, today));
  }
}

lemma lawEveryPlanConfirmsReviewsAndConsents_ensures(kind: app__task_TaskKind)
  ensures (lawEveryPlanConfirmsReviewsAndConsents(kind) == true)
{
  var steps := plan(kind);
  assert steps[3] == StepKind.ConfirmStep;
  assert steps[7] == StepKind.ReviewStep;
  assert steps[8] == StepKind.ConsentStep;
  assert steps[10] == StepKind.OutcomeStep;
  if app__task_recordsInCalendar(kind) {
    assert steps[11] == StepKind.RecordStep;
  } else {
    assert StepKind.RecordStep !in steps;
  }
}
