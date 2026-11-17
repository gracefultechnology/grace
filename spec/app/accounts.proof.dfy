lemma AddressView(a: Accounts)
  ensures alwaysOneAccountPerAddress(a) == (forall x :: x in a.accounts ==>
    x.address != "" && |ProofLib.Filter((y: Account) => (y.address == x.address), a.accounts)| == 1)
{
}

lemma IdView(a: Accounts)
  ensures alwaysIdsAreIssued(a) == (a.nextId > 0 && forall x :: x in a.accounts ==>
    x.id > 0 && x.id < a.nextId && |ProofLib.Filter((y: Account) => (y.id == x.id), a.accounts)| == 1)
{
}

lemma NameView(a: Accounts)
  ensures alwaysNamesAreDistinct(a) == (forall x :: x in a.accounts ==>
    x.name != "" && |ProofLib.Filter((y: Account) => (y.name == x.name), a.accounts)| == 1)
{
}

lemma HistoryView(a: Accounts)
  ensures alwaysFromHistoryNamesAccounts(a) == (forall f :: f in a.lastFrom ==>
    f.recipient != "" && hasAccount(a, f.account) && |ProofLib.Filter((g: LastFrom) => (g.recipient == f.recipient), a.lastFrom)| == 1)
{
}

lemma MailView(a: Accounts)
  ensures mailAccounts(a) == ProofLib.Filter((x: Account) => x.use.mail, a.accounts)
{
}

lemma MailMember(a: Accounts, x: Account)
  ensures x in mailAccounts(a) <==> x in a.accounts && x.use.mail
{
  MailView(a);
  ProofLib.FilterMember((x: Account) => x.use.mail, a.accounts, x);
}

lemma AddressesDistinct(xs: seq<Account>)
  requires forall x :: x in xs ==> |ProofLib.Filter((y: Account) => (y.address == x.address), xs)| == 1
  ensures ProofLib.DistinctBy(xs, (z: Account) => z.address)
{
  forall i, j | 0 <= i < |xs| && 0 <= j < |xs| && i != j
    ensures xs[i].address != xs[j].address
  {
    var x := xs[i];
    assert x in xs;
    if xs[j].address == x.address {
      ProofLib.FilterTwo((y: Account) => (y.address == x.address), xs, i, j);
    }
  }
}

lemma AddressesUnique(xs: seq<Account>)
  requires ProofLib.DistinctBy(xs, (z: Account) => z.address)
  ensures forall x :: x in xs ==> |ProofLib.Filter((y: Account) => (y.address == x.address), xs)| == 1
{
  forall x | x in xs
    ensures |ProofLib.Filter((y: Account) => (y.address == x.address), xs)| == 1
  {
    var i :| 0 <= i < |xs| && xs[i] == x;
    ProofLib.FilterOne((y: Account) => (y.address == x.address), xs, i);
  }
}

lemma IdsDistinct(xs: seq<Account>)
  requires forall x :: x in xs ==> |ProofLib.Filter((y: Account) => (y.id == x.id), xs)| == 1
  ensures ProofLib.DistinctBy(xs, (z: Account) => z.id)
{
  forall i, j | 0 <= i < |xs| && 0 <= j < |xs| && i != j
    ensures xs[i].id != xs[j].id
  {
    var x := xs[i];
    assert x in xs;
    if xs[j].id == x.id {
      ProofLib.FilterTwo((y: Account) => (y.id == x.id), xs, i, j);
    }
  }
}

lemma IdsUnique(xs: seq<Account>)
  requires ProofLib.DistinctBy(xs, (z: Account) => z.id)
  ensures forall x :: x in xs ==> |ProofLib.Filter((y: Account) => (y.id == x.id), xs)| == 1
{
  forall x | x in xs
    ensures |ProofLib.Filter((y: Account) => (y.id == x.id), xs)| == 1
  {
    var i :| 0 <= i < |xs| && xs[i] == x;
    ProofLib.FilterOne((y: Account) => (y.id == x.id), xs, i);
  }
}

lemma NamesDistinct(xs: seq<Account>)
  requires forall x :: x in xs ==> |ProofLib.Filter((y: Account) => (y.name == x.name), xs)| == 1
  ensures ProofLib.DistinctBy(xs, (z: Account) => z.name)
{
  forall i, j | 0 <= i < |xs| && 0 <= j < |xs| && i != j
    ensures xs[i].name != xs[j].name
  {
    var x := xs[i];
    assert x in xs;
    if xs[j].name == x.name {
      ProofLib.FilterTwo((y: Account) => (y.name == x.name), xs, i, j);
    }
  }
}

lemma NamesUnique(xs: seq<Account>)
  requires ProofLib.DistinctBy(xs, (z: Account) => z.name)
  ensures forall x :: x in xs ==> |ProofLib.Filter((y: Account) => (y.name == x.name), xs)| == 1
{
  forall x | x in xs
    ensures |ProofLib.Filter((y: Account) => (y.name == x.name), xs)| == 1
  {
    var i :| 0 <= i < |xs| && xs[i] == x;
    ProofLib.FilterOne((y: Account) => (y.name == x.name), xs, i);
  }
}

lemma RecipientsDistinct(xs: seq<LastFrom>)
  requires forall f :: f in xs ==> |ProofLib.Filter((g: LastFrom) => (g.recipient == f.recipient), xs)| == 1
  ensures ProofLib.DistinctBy(xs, (h: LastFrom) => h.recipient)
{
  forall i, j | 0 <= i < |xs| && 0 <= j < |xs| && i != j
    ensures xs[i].recipient != xs[j].recipient
  {
    var f := xs[i];
    assert f in xs;
    if xs[j].recipient == f.recipient {
      ProofLib.FilterTwo((g: LastFrom) => (g.recipient == f.recipient), xs, i, j);
    }
  }
}

lemma RecipientsUnique(xs: seq<LastFrom>)
  requires ProofLib.DistinctBy(xs, (h: LastFrom) => h.recipient)
  ensures forall f :: f in xs ==> |ProofLib.Filter((g: LastFrom) => (g.recipient == f.recipient), xs)| == 1
{
  forall f | f in xs
    ensures |ProofLib.Filter((g: LastFrom) => (g.recipient == f.recipient), xs)| == 1
  {
    var i :| 0 <= i < |xs| && xs[i] == f;
    ProofLib.FilterOne((g: LastFrom) => (g.recipient == f.recipient), xs, i);
  }
}

lemma SameId(a: Accounts, x: Account, y: Account)
  requires alwaysIdsAreIssued(a) && x in a.accounts && y in a.accounts && x.id == y.id
  ensures x == y
{
  IdView(a);
  IdsDistinct(a.accounts);
  var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
  var j :| 0 <= j < |a.accounts| && a.accounts[j] == y;
  if i != j {
    assert a.accounts[i].id != a.accounts[j].id;
  }
}

lemma AccountAtMisses(xs: seq<Account>, id: int, init: Account)
  requires forall j :: 0 <= j < |xs| ==> xs[j].id != id
  ensures Std.Collections.Seq.FoldLeft((found: Account, x: Account) => (if (x.id == id) then x else found), init, xs) == init
  decreases |xs|
{
  if |xs| > 0 {
    AccountAtMisses(xs[1..], id, init);
  }
}

lemma AccountAtFinds(xs: seq<Account>, id: int, init: Account, i: int)
  requires 0 <= i < |xs| && xs[i].id == id
  requires forall j :: 0 <= j < |xs| && j != i ==> xs[j].id != id
  ensures Std.Collections.Seq.FoldLeft((found: Account, x: Account) => (if (x.id == id) then x else found), init, xs) == xs[i]
  decreases |xs|
{
  if i == 0 {
    AccountAtMisses(xs[1..], id, xs[0]);
  } else {
    AccountAtFinds(xs[1..], id, init, i - 1);
  }
}

lemma AccountAtIs(a: Accounts, x: Account)
  requires alwaysIdsAreIssued(a) && x in a.accounts
  ensures accountAt(a, x.id) == x
{
  IdView(a);
  IdsDistinct(a.accounts);
  var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
  forall j | 0 <= j < |a.accounts| && j != i
    ensures a.accounts[j].id != x.id
  {
  }
  AccountAtFinds(a.accounts, x.id, noAccount, i);
}

lemma AccountWithFinds(xs: seq<Account>, address: string, init: Account)
  ensures Std.Collections.Seq.FoldLeft((found: Account, x: Account) => (if (x.address == address) then x else found), init, xs) == init ||
    Std.Collections.Seq.FoldLeft((found: Account, x: Account) => (if (x.address == address) then x else found), init, xs) in xs
  ensures (exists x :: x in xs && x.address == address) ==>
    Std.Collections.Seq.FoldLeft((found: Account, x: Account) => (if (x.address == address) then x else found), init, xs) in xs
  decreases |xs|
{
  if |xs| > 0 {
    var next := if xs[0].address == address then xs[0] else init;
    AccountWithFinds(xs[1..], address, next);
    if exists x :: x in xs && x.address == address {
      var x :| x in xs && x.address == address;
      if xs[0].address != address {
        assert x in xs[1..];
      }
    }
  }
}

lemma AddressOnTablet(a: Accounts, address: string)
  requires alwaysIdsAreIssued(a)
  requires accountWith(a, address).id == 0
  ensures forall x :: x in a.accounts ==> x.address != address
{
  AccountWithFinds(a.accounts, address, noAccount);
  if exists x :: x in a.accounts && x.address == address {
    IdView(a);
  }
}

lemma BestFinds(xs: seq<Account>, init: Account)
  ensures Std.Collections.Seq.FoldLeft((best: Account, x: Account) => (if ((best.id == 0) || (x.sent > best.sent)) then x else best), init, xs) == init ||
    Std.Collections.Seq.FoldLeft((best: Account, x: Account) => (if ((best.id == 0) || (x.sent > best.sent)) then x else best), init, xs) in xs
  ensures (|xs| > 0 && init.id == 0) ==>
    Std.Collections.Seq.FoldLeft((best: Account, x: Account) => (if ((best.id == 0) || (x.sent > best.sent)) then x else best), init, xs) in xs
  decreases |xs|
{
  if |xs| > 0 {
    var next := if (init.id == 0) || (xs[0].sent > init.sent) then xs[0] else init;
    BestFinds(xs[1..], next);
  }
}

lemma SameAccountsSteps(a: Accounts, b: Accounts, via: string)
  requires alwaysIdsAreIssued(a) && b.accounts == a.accounts
  ensures stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, via, b) && stepRemovalNeedsTheQuestion(a, via, b)
{
  forall x, y | x in a.accounts && y in b.accounts && y.id == x.id
    ensures y == x
  {
    SameId(a, x, y);
  }
}

lemma MappedDistinct(a: Accounts, b: Accounts)
  requires alwaysOneAccountPerAddress(a) && alwaysIdsAreIssued(a) && alwaysNamesAreDistinct(a)
  requires b.nextId == a.nextId && |b.accounts| == |a.accounts|
  requires forall i :: 0 <= i < |a.accounts| ==> (b.accounts[i].id == a.accounts[i].id && b.accounts[i].address == a.accounts[i].address &&
    b.accounts[i].name == a.accounts[i].name && b.accounts[i].provider == a.accounts[i].provider && b.accounts[i].colour == a.accounts[i].colour)
  ensures alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b)
{
  AddressView(a); IdView(a); NameView(a);
  AddressesDistinct(a.accounts); IdsDistinct(a.accounts); NamesDistinct(a.accounts);
  forall i, j | 0 <= i < |b.accounts| && 0 <= j < |b.accounts| && i != j
    ensures b.accounts[i].address != b.accounts[j].address && b.accounts[i].id != b.accounts[j].id && b.accounts[i].name != b.accounts[j].name
  {
  }
  forall y | y in b.accounts
    ensures y.address != "" && y.name != "" && y.id > 0 && y.id < b.nextId
  {
    var i :| 0 <= i < |b.accounts| && b.accounts[i] == y;
    assert a.accounts[i] in a.accounts;
  }
  AddressesUnique(b.accounts); IdsUnique(b.accounts); NamesUnique(b.accounts);
  AddressView(b); IdView(b); NameView(b);
}

lemma MappedMatch(a: Accounts, b: Accounts, via: string)
  requires alwaysIdsAreIssued(a)
  requires |b.accounts| == |a.accounts|
  requires forall i :: 0 <= i < |a.accounts| ==> (b.accounts[i].id == a.accounts[i].id && b.accounts[i].address == a.accounts[i].address &&
    b.accounts[i].name == a.accounts[i].name && b.accounts[i].provider == a.accounts[i].provider && b.accounts[i].colour == a.accounts[i].colour)
  ensures forall x, y :: (x in a.accounts && y in b.accounts && y.id == x.id) ==>
    (exists i :: 0 <= i < |a.accounts| && a.accounts[i] == x && b.accounts[i] == y)
  ensures forall id :: hasAccount(b, id) == hasAccount(a, id)
  ensures stepRenewalKeepsTheAccount(a, b) && stepRemovalNeedsTheQuestion(a, via, b)
  ensures forall x :: x in a.accounts ==> (exists i :: 0 <= i < |a.accounts| && a.accounts[i] == x && b.accounts[i] in b.accounts)
{
  forall x, y | x in a.accounts && y in b.accounts && y.id == x.id
    ensures exists i :: 0 <= i < |a.accounts| && a.accounts[i] == x && b.accounts[i] == y
  {
    var j :| 0 <= j < |b.accounts| && b.accounts[j] == y;
    assert a.accounts[j] in a.accounts;
    SameId(a, x, a.accounts[j]);
  }
  forall x | x in a.accounts
    ensures exists i :: 0 <= i < |a.accounts| && a.accounts[i] == x && b.accounts[i] in b.accounts
  {
    var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
  }
  forall id
    ensures hasAccount(b, id) == hasAccount(a, id)
  {
    if hasAccount(a, id) {
      var x :| x in a.accounts && x.id == id;
      var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
      assert b.accounts[i] in b.accounts;
    }
    if hasAccount(b, id) {
      var y :| y in b.accounts && y.id == id;
      var i :| 0 <= i < |b.accounts| && b.accounts[i] == y;
      assert a.accounts[i] in a.accounts;
    }
  }
}

lemma MappedRenewing(a: Accounts, b: Accounts)
  requires alwaysIdsAreIssued(a) && alwaysIdsAreIssued(b) && alwaysRenewingNamesAnAccount(a) && b.signIn == a.signIn
  requires |b.accounts| == |a.accounts|
  requires forall i :: 0 <= i < |a.accounts| ==> (b.accounts[i].id == a.accounts[i].id && b.accounts[i].provider == a.accounts[i].provider)
  ensures alwaysRenewingNamesAnAccount(b)
{
  if a.signIn.renewing != 0 {
    var x :| x in a.accounts && x.id == a.signIn.renewing;
    var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
    assert b.accounts[i] in b.accounts;
    AccountAtIs(a, x);
    AccountAtIs(b, b.accounts[i]);
  }
}

lemma Colour(n: int)
  requires n >= 0
  ensures 0 <= remainder_app__accounts(n, 5) < 5
{
}

lemma GrownAccounts(a: Accounts, b: Accounts, n: Account, via: string)
  requires alwaysOneAccountPerAddress(a) && alwaysIdsAreIssued(a) && alwaysNamesAreDistinct(a)
  requires alwaysFromHistoryNamesAccounts(a) && alwaysFilterNamesAnEmailAccount(a)
  requires b.accounts == a.accounts + [n] && b.nextId == a.nextId + 1 && n.id == a.nextId
  requires n.address != "" && n.name != ""
  requires forall x :: x in a.accounts ==> x.address != n.address && x.name != n.name
  requires b.lastFrom == a.lastFrom && b.inboxFilter == a.inboxFilter
  ensures alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b)
  ensures hasAccount(b, n.id)
  ensures alwaysFilterNamesAnEmailAccount(b) && alwaysFromHistoryNamesAccounts(b)
  ensures stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, via, b) && stepRemovalNeedsTheQuestion(a, via, b)
{
  AddressView(a); IdView(a); NameView(a); HistoryView(a);
  AddressesDistinct(a.accounts); IdsDistinct(a.accounts); NamesDistinct(a.accounts);
  ProofLib.DistinctByConcat(a.accounts, [n], (z: Account) => z.address);
  ProofLib.DistinctByConcat(a.accounts, [n], (z: Account) => z.id);
  ProofLib.DistinctByConcat(a.accounts, [n], (z: Account) => z.name);
  AddressesUnique(b.accounts); IdsUnique(b.accounts); NamesUnique(b.accounts);
  AddressView(b); IdView(b); NameView(b); HistoryView(b);
  assert n in b.accounts;
  forall id | hasAccount(a, id)
    ensures hasAccount(b, id)
  {
    var x :| x in a.accounts && x.id == id;
    assert x in b.accounts;
  }
  if b.inboxFilter != 0 {
    var x :| x in mailAccounts(a) && x.id == a.inboxFilter;
    MailMember(a, x);
    MailMember(b, x);
  }
  forall x, y | x in a.accounts && y in b.accounts && y.id == x.id
    ensures y == x
  {
    if y != n {
      SameId(a, x, y);
    }
  }
  forall x | x in a.accounts
    ensures x in b.accounts
  {
  }
}

lemma AdmittedExisting(a: Accounts, b: Accounts, via: string, provider: Provider, address: string, name: string, use: Use)
  requires inv(a) && b == admitted(provider, a, address, name, use) && accountWith(a, address).id != 0
  ensures b.accounts == a.accounts && b.lastFrom == a.lastFrom && b.nextId == a.nextId && b.inboxFilter == a.inboxFilter
  ensures b.page.AccountDetail? ==> hasAccount(b, b.shown)
{
  var existing := accountWith(a, address);
  AccountWithFinds(a.accounts, address, noAccount);
  assert existing in a.accounts;
}

lemma AdmittedNew(a: Accounts, b: Accounts, via: string, provider: Provider, address: string, name: string, use: Use)
  requires alwaysOneAccountPerAddress(a) && alwaysIdsAreIssued(a) && alwaysNamesAreDistinct(a)
  requires alwaysFromHistoryNamesAccounts(a) && alwaysFilterNamesAnEmailAccount(a) && alwaysAccountsAreWellFormed(a)
  requires admits(a, address, name) && b == admitted(provider, a, address, name, use) && accountWith(a, address).id == 0
  ensures alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b)
  ensures alwaysFromHistoryNamesAccounts(b) && alwaysFilterNamesAnEmailAccount(b) && hasAccount(b, b.shown)
  ensures alwaysAccountsAreWellFormed(b) && b.signIn.renewing == 0
  ensures stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, via, b) && stepRemovalNeedsTheQuestion(a, via, b)
{
  AddressOnTablet(a, address);
  Colour(|a.accounts|);
  var n := Account(a.nextId, provider, address, name, remainder_app__accounts(|a.accounts|, 5), use, 0);
  assert b.accounts == a.accounts + [n];
  GrownAccounts(a, b, n, via);
}

lemma SameAccountsAlways(a: Accounts, b: Accounts)
  requires alwaysOneAccountPerAddress(a) && alwaysIdsAreIssued(a) && alwaysNamesAreDistinct(a) && alwaysAccountsAreWellFormed(a)
  requires alwaysRenewingNamesAnAccount(a) && alwaysFilterNamesAnEmailAccount(a) && alwaysFromHistoryNamesAccounts(a)
  requires b.accounts == a.accounts && b.lastFrom == a.lastFrom && b.nextId == a.nextId && b.inboxFilter == a.inboxFilter
  requires b.signIn.attempt >= 0
  requires b.signIn.renewing == 0 || (b.signIn.renewing == a.signIn.renewing && b.signIn.provider == a.signIn.provider)
  ensures alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) && alwaysAccountsAreWellFormed(b)
  ensures alwaysRenewingNamesAnAccount(b) && alwaysFilterNamesAnEmailAccount(b) && alwaysFromHistoryNamesAccounts(b)
{
  AddressView(a); IdView(a); NameView(a); HistoryView(a); MailView(a);
  AddressView(b); IdView(b); NameView(b); HistoryView(b); MailView(b);
}

lemma RemovedView(a: Accounts, id: int, waiting: int, by_: AccountActor)
  requires waiting <= 0
  ensures removeAccount(a, id, waiting, by_).accounts == ProofLib.Filter((x: Account) => (x.id != id), a.accounts)
  ensures removeAccount(a, id, waiting, by_).lastFrom == ProofLib.Filter((f: LastFrom) => (f.account != id), a.lastFrom)
{
}

lemma Removed(a: Accounts, id: int, waiting: int, by_: AccountActor)
  requires inv(a) && canRemoveAccount(a, id, waiting, by_) && waiting <= 0
  ensures alwaysOneAccountPerAddress(removeAccount(a, id, waiting, by_))
  ensures alwaysIdsAreIssued(removeAccount(a, id, waiting, by_))
  ensures alwaysNamesAreDistinct(removeAccount(a, id, waiting, by_))
  ensures alwaysAccountsAreWellFormed(removeAccount(a, id, waiting, by_))
  ensures alwaysRenewingNamesAnAccount(removeAccount(a, id, waiting, by_))
  ensures alwaysFilterNamesAnEmailAccount(removeAccount(a, id, waiting, by_))
  ensures alwaysFromHistoryNamesAccounts(removeAccount(a, id, waiting, by_))
  ensures stepAccountsGrowOnlyFromASignIn(a, "removeAccount", removeAccount(a, id, waiting, by_))
  ensures stepRenewalKeepsTheAccount(a, removeAccount(a, id, waiting, by_))
  ensures stepUsesChangeOnlyByHerSwitch(a, "removeAccount", removeAccount(a, id, waiting, by_))
  ensures stepRemovalNeedsTheQuestion(a, "removeAccount", removeAccount(a, id, waiting, by_))
{
  var b := removeAccount(a, id, waiting, by_);
  RemovedView(a, id, waiting, by_);
  AddressView(a); IdView(a); NameView(a); HistoryView(a);
  AddressesDistinct(a.accounts); IdsDistinct(a.accounts); NamesDistinct(a.accounts);
  RecipientsDistinct(a.lastFrom);
  ProofLib.FilterKeepsDistinctBy((x: Account) => (x.id != id), a.accounts, (z: Account) => z.address);
  ProofLib.FilterKeepsDistinctBy((x: Account) => (x.id != id), a.accounts, (z: Account) => z.id);
  ProofLib.FilterKeepsDistinctBy((x: Account) => (x.id != id), a.accounts, (z: Account) => z.name);
  ProofLib.FilterKeepsDistinctBy((f: LastFrom) => (f.account != id), a.lastFrom, (h: LastFrom) => h.recipient);
  AddressesUnique(b.accounts); IdsUnique(b.accounts); NamesUnique(b.accounts);
  RecipientsUnique(b.lastFrom);
  forall x
    ensures x in b.accounts <==> x in a.accounts && x.id != id
  {
    ProofLib.FilterMember((x: Account) => (x.id != id), a.accounts, x);
  }
  forall f
    ensures f in b.lastFrom <==> f in a.lastFrom && f.account != id
  {
    ProofLib.FilterMember((f: LastFrom) => (f.account != id), a.lastFrom, f);
  }
  AddressView(b); IdView(b); NameView(b); HistoryView(b);
  forall f | f in b.lastFrom
    ensures hasAccount(b, f.account)
  {
    var x :| x in a.accounts && x.id == f.account;
  }
  if b.signIn.renewing != 0 {
    var x :| x in a.accounts && x.id == a.signIn.renewing;
    AccountAtIs(a, x);
    AccountAtIs(b, x);
  }
  if b.inboxFilter != 0 {
    var x :| x in mailAccounts(a) && x.id == a.inboxFilter;
    MailMember(a, x);
    MailMember(b, x);
  }
  forall x, y | x in a.accounts && y in b.accounts && y.id == x.id
    ensures y == x
  {
    SameId(a, x, y);
  }
}

lemma SetUseView(a: Accounts, id: int, use: Use, by_: AccountActor)
  ensures |setUse(a, id, use, by_).accounts| == |a.accounts|
  ensures forall i :: 0 <= i < |a.accounts| ==>
    setUse(a, id, use, by_).accounts[i] == (if a.accounts[i].id == id then a.accounts[i].(use := use) else a.accounts[i])
{
}

lemma NoteSentView(a: Accounts, recipient: string, id: int, by_: AccountActor)
  ensures |noteSent(a, recipient, id, by_).accounts| == |a.accounts|
  ensures forall i :: 0 <= i < |a.accounts| ==>
    noteSent(a, recipient, id, by_).accounts[i] == (if a.accounts[i].id == id then a.accounts[i].(sent := a.accounts[i].sent + 1) else a.accounts[i])
  ensures noteSent(a, recipient, id, by_).lastFrom ==
    ProofLib.Filter((f: LastFrom) => (f.recipient != recipient), a.lastFrom) + [LastFrom(recipient, id)]
{
}


lemma NoteSentHistory(a: Accounts, b: Accounts, recipient: string, id: int)
  requires alwaysFromHistoryNamesAccounts(a) && recipient != "" && hasAccount(a, id)
  requires b.lastFrom == ProofLib.Filter((f: LastFrom) => (f.recipient != recipient), a.lastFrom) + [LastFrom(recipient, id)]
  requires forall id :: hasAccount(b, id) == hasAccount(a, id)
  ensures alwaysFromHistoryNamesAccounts(b)
{
  HistoryView(a);
  RecipientsDistinct(a.lastFrom);
  var kept := ProofLib.Filter((f: LastFrom) => (f.recipient != recipient), a.lastFrom);
  ProofLib.FilterKeepsDistinctBy((f: LastFrom) => (f.recipient != recipient), a.lastFrom, (h: LastFrom) => h.recipient);
  forall f
    ensures f in kept <==> f in a.lastFrom && f.recipient != recipient
  {
    ProofLib.FilterMember((f: LastFrom) => (f.recipient != recipient), a.lastFrom, f);
  }
  ProofLib.DistinctByConcat(kept, [LastFrom(recipient, id)], (h: LastFrom) => h.recipient);
  RecipientsUnique(b.lastFrom);
  HistoryView(b);
}

lemma ToldView(a: Accounts)
  requires |ProofLib.Filter((x: Account) => !((exists y :: y in a.accounts && (y.id == x.id))), a.accounts)| == 0
  ensures told(a, a).kind.TellNothing?
{
}

lemma NothingAdded(a: Accounts)
  ensures |ProofLib.Filter((x: Account) => !((exists y :: y in a.accounts && (y.id == x.id))), a.accounts)| == 0
{
  forall i | 0 <= i < |a.accounts|
    ensures !(!((exists y :: y in a.accounts && (y.id == a.accounts[i].id))))
  {
    assert a.accounts[i] in a.accounts;
  }
  ProofLib.FilterNone((x: Account) => !((exists y :: y in a.accounts && (y.id == x.id))), a.accounts);
}

lemma addAccount_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysOneAccountPerAddress(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysIdsAreIssued(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysNamesAreDistinct(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysAccountsAreWellFormed(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysPagesNameAnAccount(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysTypedDomainStaysOnItsForm(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysRenewingNamesAnAccount(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysFilterNamesAnEmailAccount(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> alwaysFromHistoryNamesAccounts(addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "addAccount", addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> stepAttemptNeverMovesBack(a, addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> stepRenewalKeepsTheAccount(a, addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "addAccount", addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> stepUseChangesKeepAccounts(a, "addAccount", addAccount(a, by_)))
  ensures (inv(a) ==> canAddAccount(a, by_) ==> stepRemovalNeedsTheQuestion(a, "addAccount", addAccount(a, by_)))
{
  if inv(a) && canAddAccount(a, by_) {
    assert stepRenewalKeepsTheAccount(a, addAccount(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "addAccount", addAccount(a, by_)) by {
      SameAccountsSteps(a, addAccount(a, by_), "addAccount");
    }
  }
}

lemma cancelSignIn_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysOneAccountPerAddress(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysIdsAreIssued(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysNamesAreDistinct(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysAccountsAreWellFormed(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysPagesNameAnAccount(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysTypedDomainStaysOnItsForm(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysRenewingNamesAnAccount(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysFilterNamesAnEmailAccount(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> alwaysFromHistoryNamesAccounts(cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "cancelSignIn", cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> stepAttemptNeverMovesBack(a, cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> stepRenewalKeepsTheAccount(a, cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "cancelSignIn", cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> stepUseChangesKeepAccounts(a, "cancelSignIn", cancelSignIn(a, by_)))
  ensures (inv(a) ==> canCancelSignIn(a, by_) ==> stepRemovalNeedsTheQuestion(a, "cancelSignIn", cancelSignIn(a, by_)))
{
  if inv(a) && canCancelSignIn(a, by_) {
    assert stepRenewalKeepsTheAccount(a, cancelSignIn(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "cancelSignIn", cancelSignIn(a, by_)) by {
      SameAccountsSteps(a, cancelSignIn(a, by_), "cancelSignIn");
    }
  }
}

lemma chooseProvider_ensures(a: Accounts, provider: Provider, by_: AccountActor)
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysOneAccountPerAddress(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysIdsAreIssued(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysNamesAreDistinct(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysAccountsAreWellFormed(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysPagesNameAnAccount(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysTypedDomainStaysOnItsForm(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysRenewingNamesAnAccount(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysFilterNamesAnEmailAccount(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> alwaysFromHistoryNamesAccounts(chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "chooseProvider", chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> stepAttemptNeverMovesBack(a, chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> stepRenewalKeepsTheAccount(a, chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "chooseProvider", chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> stepUseChangesKeepAccounts(a, "chooseProvider", chooseProvider(a, provider, by_)))
  ensures (inv(a) ==> canChooseProvider(a, provider, by_) ==> stepRemovalNeedsTheQuestion(a, "chooseProvider", chooseProvider(a, provider, by_)))
{
  if inv(a) && canChooseProvider(a, provider, by_) {
    assert stepRenewalKeepsTheAccount(a, chooseProvider(a, provider, by_)) && stepUsesChangeOnlyByHerSwitch(a, "chooseProvider", chooseProvider(a, provider, by_)) by {
      SameAccountsSteps(a, chooseProvider(a, provider, by_), "chooseProvider");
    }
  }
}

lemma restartAccounts_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysOneAccountPerAddress(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysIdsAreIssued(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysNamesAreDistinct(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysAccountsAreWellFormed(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysPagesNameAnAccount(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysTypedDomainStaysOnItsForm(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysRenewingNamesAnAccount(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysFilterNamesAnEmailAccount(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> alwaysFromHistoryNamesAccounts(restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "restartAccounts", restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> stepAttemptNeverMovesBack(a, restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> stepRenewalKeepsTheAccount(a, restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "restartAccounts", restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> stepUseChangesKeepAccounts(a, "restartAccounts", restartAccounts(a, by_)))
  ensures (inv(a) ==> canRestartAccounts(a, by_) ==> stepRemovalNeedsTheQuestion(a, "restartAccounts", restartAccounts(a, by_)))
{
  if inv(a) && canRestartAccounts(a, by_) {
    assert stepRenewalKeepsTheAccount(a, restartAccounts(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "restartAccounts", restartAccounts(a, by_)) by {
      SameAccountsSteps(a, restartAccounts(a, by_), "restartAccounts");
    }
  }
}

lemma submitOther_ensures(a: Accounts, domain: string, by_: AccountActor)
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysOneAccountPerAddress(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysIdsAreIssued(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysNamesAreDistinct(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysAccountsAreWellFormed(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysPagesNameAnAccount(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysTypedDomainStaysOnItsForm(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysRenewingNamesAnAccount(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysFilterNamesAnEmailAccount(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> alwaysFromHistoryNamesAccounts(submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "submitOther", submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> stepAttemptNeverMovesBack(a, submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> stepRenewalKeepsTheAccount(a, submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "submitOther", submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> stepUseChangesKeepAccounts(a, "submitOther", submitOther(a, domain, by_)))
  ensures (inv(a) ==> canSubmitOther(a, domain, by_) ==> stepRemovalNeedsTheQuestion(a, "submitOther", submitOther(a, domain, by_)))
{
  if inv(a) && canSubmitOther(a, domain, by_) {
    assert stepRenewalKeepsTheAccount(a, submitOther(a, domain, by_)) && stepUsesChangeOnlyByHerSwitch(a, "submitOther", submitOther(a, domain, by_)) by {
      SameAccountsSteps(a, submitOther(a, domain, by_), "submitOther");
    }
  }
}

lemma submitServers_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysOneAccountPerAddress(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysIdsAreIssued(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysNamesAreDistinct(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysAccountsAreWellFormed(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysPagesNameAnAccount(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysTypedDomainStaysOnItsForm(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysRenewingNamesAnAccount(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysFilterNamesAnEmailAccount(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> alwaysFromHistoryNamesAccounts(submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "submitServers", submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> stepAttemptNeverMovesBack(a, submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> stepRenewalKeepsTheAccount(a, submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "submitServers", submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> stepUseChangesKeepAccounts(a, "submitServers", submitServers(a, by_)))
  ensures (inv(a) ==> canSubmitServers(a, by_) ==> stepRemovalNeedsTheQuestion(a, "submitServers", submitServers(a, by_)))
{
  if inv(a) && canSubmitServers(a, by_) {
    assert stepRenewalKeepsTheAccount(a, submitServers(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "submitServers", submitServers(a, by_)) by {
      SameAccountsSteps(a, submitServers(a, by_), "submitServers");
    }
  }
}

lemma openAccount_ensures(a: Accounts, id: int, by_: AccountActor)
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysOneAccountPerAddress(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysIdsAreIssued(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysNamesAreDistinct(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysAccountsAreWellFormed(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysPagesNameAnAccount(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysTypedDomainStaysOnItsForm(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysRenewingNamesAnAccount(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysFilterNamesAnEmailAccount(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> alwaysFromHistoryNamesAccounts(openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "openAccount", openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> stepAttemptNeverMovesBack(a, openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> stepRenewalKeepsTheAccount(a, openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "openAccount", openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> stepUseChangesKeepAccounts(a, "openAccount", openAccount(a, id, by_)))
  ensures (inv(a) ==> canOpenAccount(a, id, by_) ==> stepRemovalNeedsTheQuestion(a, "openAccount", openAccount(a, id, by_)))
{
  if inv(a) && canOpenAccount(a, id, by_) {
    assert stepRenewalKeepsTheAccount(a, openAccount(a, id, by_)) && stepUsesChangeOnlyByHerSwitch(a, "openAccount", openAccount(a, id, by_)) by {
      SameAccountsSteps(a, openAccount(a, id, by_), "openAccount");
    }
  }
}

lemma goBack_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysOneAccountPerAddress(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysIdsAreIssued(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysNamesAreDistinct(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysAccountsAreWellFormed(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysPagesNameAnAccount(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysTypedDomainStaysOnItsForm(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysRenewingNamesAnAccount(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysFilterNamesAnEmailAccount(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> alwaysFromHistoryNamesAccounts(goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "goBack", goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> stepAttemptNeverMovesBack(a, goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> stepRenewalKeepsTheAccount(a, goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "goBack", goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> stepUseChangesKeepAccounts(a, "goBack", goBack(a, by_)))
  ensures (inv(a) ==> canGoBack(a, by_) ==> stepRemovalNeedsTheQuestion(a, "goBack", goBack(a, by_)))
{
  if inv(a) && canGoBack(a, by_) {
    assert stepRenewalKeepsTheAccount(a, goBack(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "goBack", goBack(a, by_)) by {
      SameAccountsSteps(a, goBack(a, by_), "goBack");
    }
  }
}

lemma signInAgain_ensures(a: Accounts, id: int, by_: AccountActor)
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysOneAccountPerAddress(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysIdsAreIssued(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysNamesAreDistinct(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysAccountsAreWellFormed(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysPagesNameAnAccount(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysTypedDomainStaysOnItsForm(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysRenewingNamesAnAccount(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysFilterNamesAnEmailAccount(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> alwaysFromHistoryNamesAccounts(signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "signInAgain", signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> stepAttemptNeverMovesBack(a, signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> stepRenewalKeepsTheAccount(a, signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "signInAgain", signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> stepUseChangesKeepAccounts(a, "signInAgain", signInAgain(a, id, by_)))
  ensures (inv(a) ==> canSignInAgain(a, id, by_) ==> stepRemovalNeedsTheQuestion(a, "signInAgain", signInAgain(a, id, by_)))
{
  if inv(a) && canSignInAgain(a, id, by_) {
    assert stepRenewalKeepsTheAccount(a, signInAgain(a, id, by_)) && stepUsesChangeOnlyByHerSwitch(a, "signInAgain", signInAgain(a, id, by_)) by {
      SameAccountsSteps(a, signInAgain(a, id, by_), "signInAgain");
    }
  }
}

lemma filterInbox_ensures(a: Accounts, id: int, by_: AccountActor)
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysOneAccountPerAddress(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysIdsAreIssued(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysNamesAreDistinct(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysAccountsAreWellFormed(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysPagesNameAnAccount(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysTypedDomainStaysOnItsForm(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysRenewingNamesAnAccount(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysFilterNamesAnEmailAccount(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> alwaysFromHistoryNamesAccounts(filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "filterInbox", filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> stepAttemptNeverMovesBack(a, filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> stepRenewalKeepsTheAccount(a, filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "filterInbox", filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> stepUseChangesKeepAccounts(a, "filterInbox", filterInbox(a, id, by_)))
  ensures (inv(a) ==> canFilterInbox(a, id, by_) ==> stepRemovalNeedsTheQuestion(a, "filterInbox", filterInbox(a, id, by_)))
{
  if inv(a) && canFilterInbox(a, id, by_) {
    assert stepRenewalKeepsTheAccount(a, filterInbox(a, id, by_)) && stepUsesChangeOnlyByHerSwitch(a, "filterInbox", filterInbox(a, id, by_)) by {
      SameAccountsSteps(a, filterInbox(a, id, by_), "filterInbox");
    }
  }
}

lemma dismissBanner_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysOneAccountPerAddress(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysIdsAreIssued(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysNamesAreDistinct(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysAccountsAreWellFormed(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysPagesNameAnAccount(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysTypedDomainStaysOnItsForm(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysRenewingNamesAnAccount(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysFilterNamesAnEmailAccount(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> alwaysFromHistoryNamesAccounts(dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "dismissBanner", dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> stepAttemptNeverMovesBack(a, dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> stepRenewalKeepsTheAccount(a, dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "dismissBanner", dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> stepUseChangesKeepAccounts(a, "dismissBanner", dismissBanner(a, by_)))
  ensures (inv(a) ==> canDismissBanner(a, by_) ==> stepRemovalNeedsTheQuestion(a, "dismissBanner", dismissBanner(a, by_)))
{
  if inv(a) && canDismissBanner(a, by_) {
    assert stepRenewalKeepsTheAccount(a, dismissBanner(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "dismissBanner", dismissBanner(a, by_)) by {
      SameAccountsSteps(a, dismissBanner(a, by_), "dismissBanner");
    }
  }
}

lemma requestRemoval_ensures(a: Accounts, id: int, by_: AccountActor)
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysOneAccountPerAddress(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysIdsAreIssued(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysNamesAreDistinct(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysAccountsAreWellFormed(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysPagesNameAnAccount(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysTypedDomainStaysOnItsForm(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysRenewingNamesAnAccount(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysFilterNamesAnEmailAccount(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> alwaysFromHistoryNamesAccounts(requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "requestRemoval", requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> stepAttemptNeverMovesBack(a, requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> stepRenewalKeepsTheAccount(a, requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "requestRemoval", requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> stepUseChangesKeepAccounts(a, "requestRemoval", requestRemoval(a, id, by_)))
  ensures (inv(a) ==> canRequestRemoval(a, id, by_) ==> stepRemovalNeedsTheQuestion(a, "requestRemoval", requestRemoval(a, id, by_)))
{
  if inv(a) && canRequestRemoval(a, id, by_) {
    assert stepRenewalKeepsTheAccount(a, requestRemoval(a, id, by_)) && stepUsesChangeOnlyByHerSwitch(a, "requestRemoval", requestRemoval(a, id, by_)) by {
      SameAccountsSteps(a, requestRemoval(a, id, by_), "requestRemoval");
    }
  }
}

lemma keepAccount_ensures(a: Accounts, by_: AccountActor)
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysOneAccountPerAddress(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysIdsAreIssued(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysNamesAreDistinct(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysAccountsAreWellFormed(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysPagesNameAnAccount(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysTypedDomainStaysOnItsForm(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysRenewingNamesAnAccount(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysFilterNamesAnEmailAccount(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> alwaysFromHistoryNamesAccounts(keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "keepAccount", keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> stepAttemptNeverMovesBack(a, keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> stepRenewalKeepsTheAccount(a, keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "keepAccount", keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> stepUseChangesKeepAccounts(a, "keepAccount", keepAccount(a, by_)))
  ensures (inv(a) ==> canKeepAccount(a, by_) ==> stepRemovalNeedsTheQuestion(a, "keepAccount", keepAccount(a, by_)))
{
  if inv(a) && canKeepAccount(a, by_) {
    assert stepRenewalKeepsTheAccount(a, keepAccount(a, by_)) && stepUsesChangeOnlyByHerSwitch(a, "keepAccount", keepAccount(a, by_)) by {
      SameAccountsSteps(a, keepAccount(a, by_), "keepAccount");
    }
  }
}

lemma sheetResult_ensures(a: Accounts, sheet: SheetReport, name: string, by_: AccountActor)
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysOneAccountPerAddress(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysIdsAreIssued(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysNamesAreDistinct(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysAccountsAreWellFormed(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysPagesNameAnAccount(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysTypedDomainStaysOnItsForm(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysRenewingNamesAnAccount(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysFilterNamesAnEmailAccount(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> alwaysFromHistoryNamesAccounts(sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "sheetResult", sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> stepAttemptNeverMovesBack(a, sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> stepRenewalKeepsTheAccount(a, sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "sheetResult", sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> stepUseChangesKeepAccounts(a, "sheetResult", sheetResult(a, sheet, name, by_)))
  ensures (inv(a) ==> canSheetResult(a, sheet, name, by_) ==> stepRemovalNeedsTheQuestion(a, "sheetResult", sheetResult(a, sheet, name, by_)))
{
  if inv(a) && canSheetResult(a, sheet, name, by_) {
    var b := sheetResult(a, sheet, name, by_);
    if sheet.outcome.Allowed? {
      assert alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) &&
        alwaysFromHistoryNamesAccounts(b) && alwaysFilterNamesAnEmailAccount(b) && (b.page.AccountDetail? ==> hasAccount(b, b.shown)) &&
        alwaysAccountsAreWellFormed(b) && alwaysRenewingNamesAnAccount(b) &&
        stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "sheetResult", b) && stepRemovalNeedsTheQuestion(a, "sheetResult", b) by {
        if accountWith(a, sheet.address).id != 0 {
          AdmittedExisting(a, b, "sheetResult", a.signIn.provider, sheet.address, name, sheet.granted);
          SameAccountsAlways(a, b);
          SameAccountsSteps(a, b, "sheetResult");
        } else {
          AdmittedNew(a, b, "sheetResult", a.signIn.provider, sheet.address, name, sheet.granted);
        }
      }
    } else {
      assert stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "sheetResult", b) by {
        SameAccountsSteps(a, b, "sheetResult");
      }
    }
  }
}

lemma otherResult_ensures(a: Accounts, check: OtherReport, name: string, by_: AccountActor)
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysOneAccountPerAddress(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysIdsAreIssued(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysNamesAreDistinct(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysAccountsAreWellFormed(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysPagesNameAnAccount(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysTypedDomainStaysOnItsForm(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysRenewingNamesAnAccount(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysFilterNamesAnEmailAccount(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> alwaysFromHistoryNamesAccounts(otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "otherResult", otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> stepAttemptNeverMovesBack(a, otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> stepRenewalKeepsTheAccount(a, otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "otherResult", otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> stepUseChangesKeepAccounts(a, "otherResult", otherResult(a, check, name, by_)))
  ensures (inv(a) ==> canOtherResult(a, check, name, by_) ==> stepRemovalNeedsTheQuestion(a, "otherResult", otherResult(a, check, name, by_)))
{
  if inv(a) && canOtherResult(a, check, name, by_) {
    var b := otherResult(a, check, name, by_);
    if check.outcome.OtherAllowed? {
      assert alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) &&
        alwaysFromHistoryNamesAccounts(b) && alwaysFilterNamesAnEmailAccount(b) && (b.page.AccountDetail? ==> hasAccount(b, b.shown)) &&
        alwaysAccountsAreWellFormed(b) && alwaysRenewingNamesAnAccount(b) &&
        stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "otherResult", b) && stepRemovalNeedsTheQuestion(a, "otherResult", b) by {
        if accountWith(a, check.address).id != 0 {
          AdmittedExisting(a, b, "otherResult", Provider.OtherEmail, check.address, name, otherUse);
          SameAccountsAlways(a, b);
          SameAccountsSteps(a, b, "otherResult");
        } else {
          AdmittedNew(a, b, "otherResult", Provider.OtherEmail, check.address, name, otherUse);
        }
      }
    } else {
      assert stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "otherResult", b) by {
        SameAccountsSteps(a, b, "otherResult");
      }
    }
  }
}

lemma serversResult_ensures(a: Accounts, check: OtherReport, name: string, by_: AccountActor)
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysOneAccountPerAddress(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysIdsAreIssued(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysNamesAreDistinct(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysAccountsAreWellFormed(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysPagesNameAnAccount(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysTypedDomainStaysOnItsForm(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysRenewingNamesAnAccount(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysFilterNamesAnEmailAccount(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> alwaysFromHistoryNamesAccounts(serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "serversResult", serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> stepAttemptNeverMovesBack(a, serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> stepRenewalKeepsTheAccount(a, serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "serversResult", serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> stepUseChangesKeepAccounts(a, "serversResult", serversResult(a, check, name, by_)))
  ensures (inv(a) ==> canServersResult(a, check, name, by_) ==> stepRemovalNeedsTheQuestion(a, "serversResult", serversResult(a, check, name, by_)))
{
  if inv(a) && canServersResult(a, check, name, by_) {
    var b := serversResult(a, check, name, by_);
    if check.outcome.OtherAllowed? {
      assert alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) &&
        alwaysFromHistoryNamesAccounts(b) && alwaysFilterNamesAnEmailAccount(b) && (b.page.AccountDetail? ==> hasAccount(b, b.shown)) &&
        alwaysAccountsAreWellFormed(b) && alwaysRenewingNamesAnAccount(b) &&
        stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "serversResult", b) && stepRemovalNeedsTheQuestion(a, "serversResult", b) by {
        if accountWith(a, check.address).id != 0 {
          AdmittedExisting(a, b, "serversResult", Provider.OtherEmail, check.address, name, otherUse);
          SameAccountsAlways(a, b);
          SameAccountsSteps(a, b, "serversResult");
        } else {
          AdmittedNew(a, b, "serversResult", Provider.OtherEmail, check.address, name, otherUse);
        }
      }
    } else {
      assert stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "serversResult", b) by {
        SameAccountsSteps(a, b, "serversResult");
      }
    }
  }
}

lemma setUse_ensures(a: Accounts, id: int, use: Use, by_: AccountActor)
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysOneAccountPerAddress(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysIdsAreIssued(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysNamesAreDistinct(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysAccountsAreWellFormed(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysPagesNameAnAccount(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysTypedDomainStaysOnItsForm(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysRenewingNamesAnAccount(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysFilterNamesAnEmailAccount(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> alwaysFromHistoryNamesAccounts(setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "setUse", setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> stepAttemptNeverMovesBack(a, setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> stepRenewalKeepsTheAccount(a, setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "setUse", setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> stepUseChangesKeepAccounts(a, "setUse", setUse(a, id, use, by_)))
  ensures (inv(a) ==> canSetUse(a, id, use, by_) ==> stepRemovalNeedsTheQuestion(a, "setUse", setUse(a, id, use, by_)))
{
  if inv(a) && canSetUse(a, id, use, by_) {
    var b := setUse(a, id, use, by_);
    assert alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) && alwaysAccountsAreWellFormed(b) &&
      alwaysPagesNameAnAccount(b) && alwaysRenewingNamesAnAccount(b) && alwaysFromHistoryNamesAccounts(b) && alwaysFilterNamesAnEmailAccount(b) &&
      stepRenewalKeepsTheAccount(a, b) && stepRemovalNeedsTheQuestion(a, "setUse", b) && stepUseChangesKeepAccounts(a, "setUse", b) by {
      SetUseView(a, id, use, by_);
      MappedDistinct(a, b);
      MappedMatch(a, b, "setUse");
      MappedRenewing(a, b);
      HistoryView(a);
      HistoryView(b);
      forall y | y in b.accounts
        ensures y.colour >= 0 && y.colour < 5 && y.sent >= 0
      {
        var i :| 0 <= i < |b.accounts| && b.accounts[i] == y;
        assert a.accounts[i] in a.accounts;
      }
      if b.inboxFilter != 0 {
        var x :| x in mailAccounts(a) && x.id == a.inboxFilter;
        MailMember(a, x);
        var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
        MailMember(b, b.accounts[i]);
      }
      forall x | x in a.accounts
        ensures exists y :: y in b.accounts && y.id == x.id && y.address == x.address
      {
        var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
        assert b.accounts[i] in b.accounts;
      }
    }
  }
}

lemma noteSent_ensures(a: Accounts, recipient: string, id: int, by_: AccountActor)
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysOneAccountPerAddress(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysIdsAreIssued(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysNamesAreDistinct(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysAccountsAreWellFormed(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysPagesNameAnAccount(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysTypedDomainStaysOnItsForm(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysRenewingNamesAnAccount(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysFilterNamesAnEmailAccount(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> alwaysFromHistoryNamesAccounts(noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "noteSent", noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> stepAttemptNeverMovesBack(a, noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> stepRenewalKeepsTheAccount(a, noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "noteSent", noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> stepUseChangesKeepAccounts(a, "noteSent", noteSent(a, recipient, id, by_)))
  ensures (inv(a) ==> canNoteSent(a, recipient, id, by_) ==> stepRemovalNeedsTheQuestion(a, "noteSent", noteSent(a, recipient, id, by_)))
{
  if inv(a) && canNoteSent(a, recipient, id, by_) {
    var b := noteSent(a, recipient, id, by_);
    assert alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) && alwaysAccountsAreWellFormed(b) &&
      alwaysPagesNameAnAccount(b) && alwaysRenewingNamesAnAccount(b) && alwaysFromHistoryNamesAccounts(b) && alwaysFilterNamesAnEmailAccount(b) &&
      stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "noteSent", b) && stepRemovalNeedsTheQuestion(a, "noteSent", b) by {
      NoteSentView(a, recipient, id, by_);
      MappedDistinct(a, b);
      MappedMatch(a, b, "noteSent");
      MappedRenewing(a, b);
      forall x, y | x in a.accounts && y in b.accounts && y.id == x.id
        ensures y.use == x.use
      {
        var i :| 0 <= i < |a.accounts| && a.accounts[i] == x && b.accounts[i] == y;
      }
      forall y | y in b.accounts
        ensures y.colour >= 0 && y.colour < 5 && y.sent >= 0
      {
        var i :| 0 <= i < |b.accounts| && b.accounts[i] == y;
        assert a.accounts[i] in a.accounts;
      }
      if b.inboxFilter != 0 {
        var x :| x in mailAccounts(a) && x.id == a.inboxFilter;
        MailMember(a, x);
        var i :| 0 <= i < |a.accounts| && a.accounts[i] == x;
        MailMember(b, b.accounts[i]);
      }
      NoteSentHistory(a, b, recipient, id);
    }
  }
}

lemma removeAccount_ensures(a: Accounts, id: int, waiting: int, by_: AccountActor)
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysOneAccountPerAddress(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysIdsAreIssued(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysNamesAreDistinct(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysAccountsAreWellFormed(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysPagesNameAnAccount(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysTypedDomainStaysOnItsForm(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysCompanyRenewalStaysOnItsAccount(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysRenewingNamesAnAccount(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysFilterNamesAnEmailAccount(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> alwaysFromHistoryNamesAccounts(removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> stepAccountsGrowOnlyFromASignIn(a, "removeAccount", removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> stepAttemptNeverMovesBack(a, removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> stepRenewalKeepsTheAccount(a, removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> stepUsesChangeOnlyByHerSwitch(a, "removeAccount", removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> stepUseChangesKeepAccounts(a, "removeAccount", removeAccount(a, id, waiting, by_)))
  ensures (inv(a) ==> canRemoveAccount(a, id, waiting, by_) ==> stepRemovalNeedsTheQuestion(a, "removeAccount", removeAccount(a, id, waiting, by_)))
{
  if inv(a) && canRemoveAccount(a, id, waiting, by_) {
    var b := removeAccount(a, id, waiting, by_);
    if waiting > 0 {
      assert stepRenewalKeepsTheAccount(a, b) && stepUsesChangeOnlyByHerSwitch(a, "removeAccount", b) by {
        SameAccountsSteps(a, b, "removeAccount");
      }
    } else {
      assert alwaysOneAccountPerAddress(b) && alwaysIdsAreIssued(b) && alwaysNamesAreDistinct(b) && alwaysAccountsAreWellFormed(b) &&
        alwaysRenewingNamesAnAccount(b) && alwaysFilterNamesAnEmailAccount(b) && alwaysFromHistoryNamesAccounts(b) &&
        stepAccountsGrowOnlyFromASignIn(a, "removeAccount", b) && stepRenewalKeepsTheAccount(a, b) &&
        stepUsesChangeOnlyByHerSwitch(a, "removeAccount", b) && stepRemovalNeedsTheQuestion(a, "removeAccount", b) by {
        Removed(a, id, waiting, by_);
      }
    }
  }
}

lemma lawNothingChangedTellsNothing_ensures(a: Accounts)
  ensures (lawNothingChangedTellsNothing(a) == true)
{
  NothingAdded(a);
  ToldView(a);
}

lemma lawDefaultFromSendsMail_ensures(a: Accounts, recipient: string)
  ensures (lawDefaultFromSendsMail(a, recipient) == true)
{
  BestFinds(mailAccounts(a), noAccount);
}

lemma lawDefaultFromExistsWithEmail_ensures(a: Accounts, recipient: string)
  ensures (lawDefaultFromExistsWithEmail(a, recipient) == true)
{
  BestFinds(mailAccounts(a), noAccount);
  forall x | x in mailAccounts(a)
    ensures x in a.accounts
  {
    MailMember(a, x);
  }
}
