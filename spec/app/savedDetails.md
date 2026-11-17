# Saved details

The list of what Grace remembers about the person, held as one
[approved personal fact](./memory.md) per key, deleted keys included as
tombstones. Settings lists the saved ones, each with Delete, and Clear all.
Her name from set-up is the fact under the key `name`; Home's greeting, Grace's
opening line and set-up's name step read it here. A form or sign-up that needs
a saved detail is filled through the queued fill below, checked again at
dispatch by [the saved-value check](./memoryActuation.md).

## Story: See, change and delete what Grace remembers

> As an older adult, I want one list of the details Grace keeps about me,
> saved only when I say yes, that I can change or delete one by one or all at
> once, so that Grace greets me by my name and fills a booking form for me
> without asking again.

### Saved details hold one valid fact per key, and her name only under the name key

Every fact in the list satisfies each rule of [approved memory](./memory.md)
and has a key. No key appears twice, so a deleted key stays as its tombstone
and a later proposal for it continues that fact's revisions. Her name is the
fact of kind Name, and that kind is kept under the key `name` and no other.

```quint
import memory as M from "./memory"

type SavedDetails = { facts: List[M::PersonalFact] }
type DetailStep = { state: SavedDetails, out: List[M::MemoryEffect] }
pure val initial: SavedDetails = { facts: List() }
pure val nameKey: str = "name"
pure def detailAt(d: SavedDetails, factKey: str): M::PersonalFact =
  d.facts.select(f => f.factKey == factKey).nthOr(0, M::initial)
pure def withDetail(facts: List[M::PersonalFact], fact: M::PersonalFact): List[M::PersonalFact] =
  if (facts.some(f => f.factKey == fact.factKey)) facts.listMap(f => if (f.factKey == fact.factKey) fact else f)
  else facts.append(fact)
pure def alwaysEveryDetailIsValid(d: SavedDetails): bool =
  d.facts.every(f => M::validFact(f) and f.factKey != "")
pure def alwaysOneFactPerKey(d: SavedDetails): bool =
  d.facts.every(f => d.facts.select(other => other.factKey == f.factKey).length() == 1)
pure def alwaysNameUsesTheNameKey(d: SavedDetails): bool =
  d.facts.every(f => (f.kind == M::Name) iff (f.factKey == nameKey))
```

### A detail is proposed, saved, declined, scoped and deleted only as its own fact allows

Each change to one detail is the same change of that fact in approved memory,
with the same guard: only her fresh choice proposes, only her yes to the
current proposal saves, and a proposal for a key the list has never held
starts a new fact. A changed detail is a new proposal for the same key; until
she says yes the saved value stays. Proposing a Name under another key, or
another kind under `name`, is refused.

```quint
pure def canProposeDetail(d: SavedDetails, proposedFact: M::FactProposal, by: M::MemoryActor): bool =
  M::canPropose(detailAt(d, proposedFact.factKey), proposedFact, by) and
  ((proposedFact.kind == M::Name) iff (proposedFact.factKey == nameKey))
pure def proposeDetail(d: SavedDetails, proposedFact: M::FactProposal, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::propose(detailAt(d, proposedFact.factKey), proposedFact, by)) }
pure def canRememberDetail(d: SavedDetails, factKey: str, version: int, by: M::MemoryActor): bool =
  factKey != "" and M::canRemember(detailAt(d, factKey), version, by)
pure def rememberDetail(d: SavedDetails, factKey: str, version: int, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::remember(detailAt(d, factKey), version, by)) }
pure def canDeclineDetail(d: SavedDetails, factKey: str, version: int, by: M::MemoryActor): bool =
  factKey != "" and M::canDecline(detailAt(d, factKey), version, by)
pure def declineDetail(d: SavedDetails, factKey: str, version: int, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::decline(detailAt(d, factKey), version, by)) }
pure def canVerifyDetailScope(d: SavedDetails, factKey: str, scopeCheck: M::ScopeCheck, by: M::MemoryActor): bool =
  factKey != "" and M::canVerifyScope(detailAt(d, factKey), scopeCheck, by)
pure def verifyDetailScope(d: SavedDetails, factKey: str, scopeCheck: M::ScopeCheck, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::verifyScope(detailAt(d, factKey), scopeCheck, by)) }
pure def canForgetDetail(d: SavedDetails, factKey: str, version: int, by: M::MemoryActor): bool =
  factKey != "" and M::canForget(detailAt(d, factKey), version, by)
pure def forgetDetail(d: SavedDetails, factKey: str, version: int, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::forget(detailAt(d, factKey), version, by)) }
```

### Clear all deletes every detail at once and keeps each key

Only she can clear the list. Every key, a proposal waiting for her yes and a
queued fill included, becomes a tombstone with a newer revision, as approved
memory's Clear all says.

```quint
pure def canForgetAll(d: SavedDetails, by: M::MemoryActor): bool = by == M::MemoryUser and d.facts.length() > 0
pure def forgetAll(d: SavedDetails, by: M::MemoryActor): SavedDetails = { facts: M::clearAll(d.facts) }
```

### Deleting a detail changes only that detail and never cancels a commitment

Deleting one detail, or all of them, changes nothing but the list: it emits no
effect, so a payment, a booking, a calendar entry or any other commitment
made with the detail stays as it is. Every other detail of the list is left as
it was.

```quint
pure def lawForgetDetailChangesOnlyThatDetail(d: SavedDetails, factKey: str, version: int): bool =
  canForgetDetail(d, factKey, version, M::MemoryUser) implies
    (forgetDetail(d, factKey, version, M::MemoryUser).facts.length() == d.facts.length() and
     d.facts.every(f => f.factKey == factKey or forgetDetail(d, factKey, version, M::MemoryUser).facts.includes(f)))
```

### A form is filled only from a current saved detail, once

A fill of a form or sign-up field is queued against the detail's current
revision for one task and verified destination, and dispatched once, with the
same checks as approved memory. Any change to the detail first, a correction,
a deletion or Clear all, drops the queued fill.

```quint
pure def canQueueDetailFill(d: SavedDetails, factKey: str, fillRequest: M::FillRequest, by: M::MemoryActor): bool =
  factKey != "" and M::canQueueFill(detailAt(d, factKey), fillRequest, by)
pure def queueDetailFill(d: SavedDetails, factKey: str, fillRequest: M::FillRequest, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::queueFill(detailAt(d, factKey), fillRequest, by)) }
pure def canDispatchDetailFill(d: SavedDetails, factKey: str, fillTicket: M::FillTicket, by: M::MemoryActor): bool =
  factKey != "" and M::canDispatchFill(detailAt(d, factKey), fillTicket, by)
pure def dispatchDetailFill(d: SavedDetails, factKey: str, fillTicket: M::FillTicket, by: M::MemoryActor): DetailStep =
  val sent = M::dispatchFill(detailAt(d, factKey), fillTicket, by)
  { state: { facts: withDetail(d.facts, sent.state) }, out: sent.out }
pure def canCancelDetailFill(d: SavedDetails, factKey: str, by: M::MemoryActor): bool =
  factKey != "" and M::canCancelFill(detailAt(d, factKey), by)
pure def cancelDetailFill(d: SavedDetails, factKey: str, by: M::MemoryActor): SavedDetails =
  { facts: withDetail(d.facts, M::cancelFill(detailAt(d, factKey), by)) }
pure def stepDetailFillUsesCurrentApproval(before: SavedDetails, after: SavedDetails, out: List[M::MemoryEffect]): bool =
  out.every(e => match e {
    | FillAuthorized(x) => detailAt(before, x.factKey).status == M::Stored and not(detailAt(before, x.factKey).proposed) and
      detailAt(before, x.factKey).queued and x.revision == detailAt(before, x.factKey).revision and
      x.value == detailAt(before, x.factKey).value and x.task == detailAt(before, x.factKey).queuedTask and
      x.destination == detailAt(before, x.factKey).queuedDestination
  })
```

### A changed, deleted or cleared detail has no current saved value

Right after she changes a detail, its fact waits for her yes; right after she
deletes it, or clears the list, no fact under its key is a valid saved value.
So nothing queued or sent with the old value can pass the saved-value check.

```quint
pure def lawChangedDetailWaitsForHerYes(d: SavedDetails, proposedFact: M::FactProposal): bool =
  canProposeDetail(d, proposedFact, M::MemoryUser) implies
    detailAt(proposeDetail(d, proposedFact, M::MemoryUser), proposedFact.factKey).proposed
pure def lawDeletedDetailIsNotSaved(d: SavedDetails, factKey: str, version: int): bool =
  canForgetDetail(d, factKey, version, M::MemoryUser) implies
    detailAt(forgetDetail(d, factKey, version, M::MemoryUser), factKey).status != M::Stored
pure def lawClearedDetailIsNotSaved(d: SavedDetails, factKey: str): bool =
  not(M::validFact(detailAt(forgetAll(d, M::MemoryUser), factKey)) and
    detailAt(forgetAll(d, M::MemoryUser), factKey).status == M::Stored)
```

### Home and Grace greet her by her saved name and by nothing else

The greeting's name is the saved value of the Name fact, or nothing while she
has none, a proposal waiting for her yes included; it is never a default or a
name from her account. Deleting her name, alone or with Clear all, leaves the
greeting without one. Set-up's name step is answered when this name is not
empty.

```quint
pure def greetingName(d: SavedDetails): str =
  val f = detailAt(d, nameKey)
  if (f.kind == M::Name) M::rememberedValue(f) else ""
pure def lawGreetingNameIsSaved(d: SavedDetails): bool =
  greetingName(d) != "" implies d.facts.some(f => f.kind == M::Name and f.status == M::Stored and f.value == greetingName(d))
pure def lawForgottenNameIsNotGreeted(d: SavedDetails, version: int): bool =
  canForgetDetail(d, nameKey, version, M::MemoryUser) implies greetingName(forgetDetail(d, nameKey, version, M::MemoryUser)) == ""
```

### A detail is saved, changed, deleted, cleared, greeted and filled

```quint
pure val factKeyValues = Set("name", "email", "provider", "login", "missing")
pure val weight_proposeDetail = 4
pure val weight_rememberDetail = 4
pure val weight_queueDetailFill = 3
pure def sometimesDetailSaved(d: SavedDetails): bool = d.facts.some(f => f.status == M::Stored)
pure def sometimesDetailBeingChanged(d: SavedDetails): bool = d.facts.some(f => f.status == M::Stored and f.proposed)
pure def sometimesDetailDeleted(d: SavedDetails): bool =
  d.facts.some(f => f.status == M::Deleted) and d.facts.some(f => f.status == M::Stored)
pure def sometimesAllCleared(d: SavedDetails): bool =
  d.facts.length() > 1 and d.facts.every(f => f.status == M::Deleted)
pure def sometimesNameGreeted(d: SavedDetails): bool = greetingName(d) != ""
pure def sometimesDetailFillQueued(d: SavedDetails): bool = d.facts.some(f => f.queued)
pure val savedName: M::PersonalFact = M::exampleSavedFact
pure val dValues = Set(initial, { facts: List(savedName) }, { facts: List(savedName, M::exampleProposedFact) },
  { facts: List(M::exampleQueuedFact, M::exampleProposedFact) }, { facts: List(M::forget(savedName, 2, M::MemoryUser)) },
  { facts: List({ ...M::exampleProposedFact, factKey: "name" }) })
pure val versionValues = Set(0, 1, 2, 3, 4)
```
