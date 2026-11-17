lemma LookupBindings(xs: seq<Binding>, key: app__task_Subject, acc: Binding)
  requires acc == noBinding || (acc.key == key && acc.recordRef != "")
  requires forall row :: row in xs ==> row.recordRef != ""
  ensures (Std.Collections.Seq.FoldLeft((found: Binding, row: Binding) => (if (row.key == key) then row else found), acc, xs).recordRef == "") <==>
    (acc.recordRef == "" && forall row :: row in xs ==> row.key != key)
  ensures Std.Collections.Seq.FoldLeft((found: Binding, row: Binding) => (if (row.key == key) then row else found), acc, xs).recordRef != "" ==>
    Std.Collections.Seq.FoldLeft((found: Binding, row: Binding) => (if (row.key == key) then row else found), acc, xs).key == key &&
    (Std.Collections.Seq.FoldLeft((found: Binding, row: Binding) => (if (row.key == key) then row else found), acc, xs) == acc ||
     Std.Collections.Seq.FoldLeft((found: Binding, row: Binding) => (if (row.key == key) then row else found), acc, xs) in xs)
  decreases |xs|
{
  if |xs| > 0 {
    var next := if xs[0].key == key then xs[0] else acc;
    LookupBindings(xs[1..], key, next);
    assert forall row :: row in xs ==> row == xs[0] || row in xs[1..];
  }
}

lemma RegistryFilterView(r: Registry)
  ensures alwaysOneRecordPerBill(r) ==
    (forall row :: row in r.bindings ==> |ProofLib.Filter((other: Binding) => (other.key == row.key), r.bindings)| == 1)
  ensures alwaysOneBillPerRecord(r) ==
    (forall row :: row in r.bindings ==> |ProofLib.Filter((other: Binding) => (other.recordRef == row.recordRef), r.bindings)| == 1)
{
}

lemma resolve_ensures(r: Registry, expectedVersion: int, recordRef: string, by_: RegistryActor)
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysPendingBelongsToOwner(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysRequestVersion(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysResolutionError(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysMappingsAreValid(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysOneRecordPerBill(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysOneBillPerRecord(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysSelectedBelongsToOwner(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> stepMappingsAreRetained(r, resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> stepResolutionCarriesCapturedRequest(r, resolve(r, expectedVersion, recordRef, by_).state, resolve(r, expectedVersion, recordRef, by_).out))
{
  if inv(r) && canResolve(r, expectedVersion, recordRef, by_) {
    LookupBindings(r.bindings, r.pending.source.key, noBinding);
    var after := resolve(r, expectedVersion, recordRef, by_).state;
    RegistryFilterView(r);
    RegistryFilterView(after);
    if bindingFor(r, r.pending.source.key).recordRef == "" {
      var added := Binding(r.pending.source.key, recordRef);
      assert forall row :: row in r.bindings ==> row.key != added.key;
      assert forall row :: row in r.bindings ==> row.recordRef != added.recordRef;
      forall row | row in after.bindings
        ensures |ProofLib.Filter((other: Binding) => (other.key == row.key), after.bindings)| == 1
        ensures |ProofLib.Filter((other: Binding) => (other.recordRef == row.recordRef), after.bindings)| == 1
      {
        ProofLib.FilterAppend((other: Binding) => (other.key == row.key), r.bindings, added);
        ProofLib.FilterAppend((other: Binding) => (other.recordRef == row.recordRef), r.bindings, added);
        if row == added {
          ProofLib.FilterNone((other: Binding) => (other.key == row.key), r.bindings);
          ProofLib.FilterNone((other: Binding) => (other.recordRef == row.recordRef), r.bindings);
        } else {
          assert row in r.bindings;
        }
      }
    } else {
      var selected := bindingFor(r, r.pending.source.key);
      assert selected in r.bindings;
      assert selected.key.owner == r.owner && selected.recordRef == recordRef;
    }
  }
}

lemma lawCurrentResolutionCanNavigate_ensures(r: Registry, expectedVersion: int, recordRef: string, by_: RegistryActor)
  ensures (lawCurrentResolutionCanNavigate(r, expectedVersion, recordRef, by_) == true)
{
  if canResolve(r, expectedVersion, recordRef, by_) && validOpening(r.pending) {
    var after := resolve(r, expectedVersion, recordRef, by_).state;
    if bindingFor(r, r.pending.source.key).recordRef == "" {
      var added := Binding(r.pending.source.key, recordRef);
      ProofLib.FoldLeftAppend((found: Binding, row: Binding) => (if (row.key == r.pending.source.key) then row else found), noBinding, r.bindings, added);
      assert after.bindings == r.bindings + [added];
    }
    assert bindingFor(after, r.pending.source.key).recordRef == recordRef;
  }
}
