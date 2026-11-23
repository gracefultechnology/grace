lemma lawTheSuggestedTimeIsOfferedAndFree_ensures(facts: VisitFacts)
  ensures (lawTheSuggestedTimeIsOfferedAndFree(facts) == true)
{
  if onlyFreeSlot(facts) {
    var free := freeSlots(facts);
    ProofLib.FilterMember((s: app__task_Slot) => !((s in facts.busy)), facts.slots, free[0]);
    assert free[0] in free;
    assert suggestedBooking(facts).slot == free[0];
  }
}
