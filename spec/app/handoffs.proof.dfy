// spec/app/handoffs.md, "One provider bill resolves to exactly one payment record across all entry points"
lemma LookupBindings(xs: seq<Binding>, key: app__payment_BillKey, acc: Binding)
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
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysSelectedBelongsToOwner(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysResolutionError(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysMappingsAreValid(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysOneRecordPerBill(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> alwaysOneBillPerRecord(resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> stepMappingsAreRetained(r, resolve(r, expectedVersion, recordRef, by_).state))
  ensures (inv(r) ==> canResolve(r, expectedVersion, recordRef, by_) ==> stepHandoffIsOnlyNavigation(r, resolve(r, expectedVersion, recordRef, by_).state, resolve(r, expectedVersion, recordRef, by_).out))
{
  if inv(r) && canResolve(r, expectedVersion, recordRef, by_) {
    LookupBindings(r.bindings, r.pending.key, noBinding);
    var after := resolve(r, expectedVersion, recordRef, by_).state;
    RegistryFilterView(r);
    RegistryFilterView(after);
    if bindingFor(r, r.pending.key).recordRef == "" {
      var added := Binding(r.pending.key, recordRef);
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
      var selected := bindingFor(r, r.pending.key);
      assert selected in r.bindings;
      assert selected.key.owner == r.owner && selected.recordRef == recordRef;
    }
  }
}
