lemma lawClearAllRemovesPersonalData_ensures(facts: seq<PersonalFact>)
  ensures (lawClearAllRemovesPersonalData(facts) == true)
{
  if forall f :: f in facts ==> validFact(f) {
    forall i | 0 <= i < |facts|
      ensures validFact(clearAll(facts)[i])
      ensures clearAll(facts)[i].value == ""
      ensures !clearAll(facts)[i].proposed && clearAll(facts)[i].proposal == ""
      ensures !clearAll(facts)[i].queued && clearAll(facts)[i].queuedTask == "" && clearAll(facts)[i].queuedDestination == ""
      ensures !clearAll(facts)[i].status.Stored?
    {
      var f := facts[i];
      assert validFact(f);
      if f.factKey != "" {
        assert clearAll(facts)[i] == forget(f, f.revision, MemoryActor.MemoryUser);
      } else {
        assert f.status.Missing? && f.value == "" && !f.proposed && !f.queued;
        assert clearAll(facts)[i] == f;
      }
    }
  }
}
