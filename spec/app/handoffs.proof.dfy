// spec/app/handoffs.md, "One task subject resolves to exactly one commitment record across all entry points"
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

// spec/app/handoffs.md, "A resolved task is presented only in the still-current source context"
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

// spec/app/handoffs.md, "Every entry point of one subject reaches the one commitment kept for it, and no other subject shares its record"
lemma lawOneRecordPerSubject_ensures(r: Registry, first: TaskSource, second: TaskSource, commitments: seq<app__commitment_Commitment>)
  ensures (lawOneRecordPerSubject(r, first, second, commitments) == true)
{
  if alwaysMappingsAreValid(r) && alwaysOneBillPerRecord(r) && first.key != second.key && accessibleRecord(r, first.key) != "" {
    LookupBindings(r.bindings, first.key, noBinding);
    LookupBindings(r.bindings, second.key, noBinding);
    var a := bindingFor(r, first.key);
    var b := bindingFor(r, second.key);
    if accessibleRecord(r, second.key) == accessibleRecord(r, first.key) {
      assert a in r.bindings && b in r.bindings && a.recordRef == b.recordRef;
      RegistryFilterView(r);
      ProofLib.FilterMember((other: Binding) => (other.recordRef == a.recordRef), r.bindings, a);
      ProofLib.FilterMember((other: Binding) => (other.recordRef == a.recordRef), r.bindings, b);
      assert a == b;
    }
  }
}

lemma EmailLinkSelectedTab(b: app__browser_Browser, id: int)
  ensures app__browser_tabById(b, id) == (var matches := ProofLib.Filter((t: app__browser_Tab) => (t.id == id), b.tabs); if |matches| > 0 then matches[|matches|-1] else app__browser_blankTab(0, 0))
{
}

lemma lawAReleasedLinkOpensInANewBrowserTab_ensures(device: app__shell_Shell, reader: app__email_Mailbox, browser: app__browser_Browser, link: string)
  ensures (lawAReleasedLinkOpensInANewBrowserTab(device, reader, browser, link) == true)
{
  if mayOpenEmailLink(device, reader, browser, link) {
    var id := browser.nextId;
    var newTabs := app__browser_openTab(browser);
    var navigated := app__browser_navigate(newTabs, link);
    var added := app__browser_blankTab(id, browser.serial + 1);
    var loaded := app__browser_navigated(added, link, newTabs.revision + 1);
    forall i | 0 <= i < |browser.tabs|
      ensures navigated.tabs[i] == browser.tabs[i]
    {
      assert browser.tabs[i] in browser.tabs;
      assert browser.tabs[i].id != id;
    }
    assert navigated.tabs[|browser.tabs|] == loaded;
    assert navigated.tabs == browser.tabs + [loaded];
    ProofLib.FilterNone((t: app__browser_Tab) => (t.id == id), browser.tabs);
    ProofLib.FilterAppend((t: app__browser_Tab) => (t.id == id), browser.tabs, loaded);
    EmailLinkSelectedTab(navigated, id);
    assert app__browser_activeTab(navigated) == loaded;
    assert loaded.history == ["", link];
  }
}

lemma OnlyEmailLinkMessage(m: app__email_Mailbox, ref: string)
  requires |m.messages| == 1 && m.messages[0].identity.ref == ref
  ensures app__email_messageRecord(m, ref) == m.messages[0]
{
  assert app__email_messageRecord(m, ref) == (var matches := ProofLib.Filter((record: app__emailItem_MessageRecord) => (record.identity.ref == ref), m.messages); if |matches| == 1 then matches[0] else app__emailItem_initial);
  ProofLib.FilterCons((record: app__emailItem_MessageRecord) => (record.identity.ref == ref), m.messages);
  ProofLib.FilterNil((record: app__emailItem_MessageRecord) => (record.identity.ref == ref), m.messages[1..]);
}

lemma lawConfirmingAFlaggedMessageLinkCanReachTheBrowser_ensures(link: string)
  ensures (lawConfirmingAFlaggedMessageLinkCanReachTheBrowser(link) == true)
{
  if link != "" {
    var held := app__email_openLink(flaggedMailbox, link, app__email_MailActor.MailUser);
    var confirmed := app__email_confirmLink(held, link, true, app__email_MailActor.MailUser);
    OnlyEmailLinkMessage(flaggedMailbox, flaggedMailbox.messageRef);
    OnlyEmailLinkMessage(held, held.messageRef);
    OnlyEmailLinkMessage(confirmed, confirmed.messageRef);
    assert app__email_selectedMessageIsCurrent(flaggedMailbox);
    assert app__email_selectedMessageIsCurrent(held);
    assert app__email_selectedMessageIsCurrent(confirmed);
    assert !app__browser_hasTab(app__browser_initial, app__browser_initial.nextId);
  }
}
