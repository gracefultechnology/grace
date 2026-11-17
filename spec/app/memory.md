# Approved personal memory

One machine instance owns one stable fact key in the durable local fact
store. The store retains deleted keys as tombstones across restart; it does
not reconstruct memory from chat. [Saved details](./savedDetails.md) holds
these authoritative instances as the list she sees in Settings; Clear all
applies the same deletion to every known key, including proposed facts, in
one storage transaction. Provider records, browser sessions and
unresolved payment evidence are different stores and are never parameters or
effects of this model. Sources: MEM 01–04, INV 01/03/08, CTX 01 and DATA 01.

## Story: Choose what Grace remembers and correct or forget it

> As an older adult, I want to inspect, approve, correct or delete useful
> saved details, without changing my provider account or resurrecting an old
> detail from a previous conversation.

### A saved fact has a stable key, a supported type and a durable revision

`scope` is the verified origin for a provider association (her nickname for
the clinic, salon or company she uses there) or a sign-in identifier; other
facts are general and have an empty scope. `value` is non-secret content
already classified at the private-input boundary. The type gate excludes
passwords, codes, payment credentials and live provider facts such as a
balance or a payment status, which are read fresh each time; it cannot
classify arbitrary text by itself. State mutations are committed atomically
to storage before the UI reports that a save or deletion succeeded. A failed
storage transaction retains its old state and can be retried explicitly.

```quint
type MemoryActor = MemoryUser | MemoryRuntime
type FactKind = Name | ContactEmail | Phone | Address | Preference | ProviderAssociation | SignInIdentifier |
  Password | VerificationCode | PaymentSecret | LiveProviderFact
type FactStatus = Missing | Stored | Deleted
type ProposalSource = FreshUserChoice | OldConversation | ObservedWebsite
type PersonalFact = {
  factKey: str, kind: FactKind, scope: str, scopeEvidence: str, value: str,
  status: FactStatus, revision: int, proposed: bool, proposal: str,
  queued: bool, queuedRevision: int, queuedTask: str, queuedDestination: str
}
type MemoryEffect = FillAuthorized({ factKey: str, revision: int, task: str, destination: str, value: str })
type MemoryStep = { state: PersonalFact, out: List[MemoryEffect] }
type FactProposal = { factKey: str, kind: FactKind, scope: str, value: str, source: ProposalSource, version: int }
type ScopeCheck = { scope: str, version: int, evidence: str }
type FillRequest = { version: int, task: str, destination: str, requestedKind: FactKind, verified: bool, relevant: bool }
type FillTicket = { version: int, task: str, destination: str }
pure val initial: PersonalFact = {
  factKey: "", kind: Name, scope: "", scopeEvidence: "", value: "", status: Missing,
  revision: 0, proposed: false, proposal: "",
  queued: false, queuedRevision: 0, queuedTask: "", queuedDestination: ""
}
pure def allowedKind(kind: FactKind): bool =
  kind == Name or kind == ContactEmail or kind == Phone or kind == Address or
  kind == Preference or kind == ProviderAssociation or kind == SignInIdentifier
pure def scopedKind(kind: FactKind): bool = kind == ProviderAssociation or kind == SignInIdentifier
```

### A fresh user choice proposes a fact without silently saving it

The key/type/scope identity stays fixed after first use. A different address
or value corrects that same fact; a different identity uses a different key.
Old chat and observed website content cannot propose memory themselves.
Every proposal invalidates older approvals and queued fills, while leaving
the committed value visible in review until the user makes the save choice.

```quint
pure def canPropose(f: PersonalFact, proposedFact: FactProposal, by: MemoryActor): bool =
  by == MemoryUser and proposedFact.source == FreshUserChoice and proposedFact.version == f.revision and
  proposedFact.factKey != "" and proposedFact.value != "" and allowedKind(proposedFact.kind) and
  (if (scopedKind(proposedFact.kind)) proposedFact.scope != "" else proposedFact.scope == "") and
  (f.factKey == "" or (proposedFact.factKey == f.factKey and proposedFact.kind == f.kind and proposedFact.scope == f.scope))
pure def propose(f: PersonalFact, proposedFact: FactProposal, by: MemoryActor): PersonalFact =
  { ...f, factKey: proposedFact.factKey, kind: proposedFact.kind, scope: proposedFact.scope, proposed: true, proposal: proposedFact.value,
    revision: f.revision + 1, queued: false, queuedRevision: 0, queuedTask: "", queuedDestination: "" }
```

### Only explicit approval of the current proposal commits a remembered value

This save consent is not consent to fill a website, alter a provider account
or submit any transaction. A stale approval cannot save a corrected or
deleted value. Rejecting a proposal retains the existing committed fact.

```quint
pure def canRemember(f: PersonalFact, version: int, by: MemoryActor): bool =
  by == MemoryUser and f.proposed and version == f.revision and
  (not(scopedKind(f.kind)) or f.scopeEvidence != "")
pure def remember(f: PersonalFact, version: int, by: MemoryActor): PersonalFact =
  { ...f, value: f.proposal, status: Stored, proposed: false, proposal: "", revision: f.revision + 1 }
pure def canDecline(f: PersonalFact, version: int, by: MemoryActor): bool =
  by == MemoryUser and f.proposed and version == f.revision
pure def decline(f: PersonalFact, version: int, by: MemoryActor): PersonalFact =
  { ...f, proposed: false, proposal: "", revision: f.revision + 1 }
```

### A scoped fact cannot be saved until its exact destination is verified

The trusted browser integration verifies the proposed origin, supplies a
reference to that evidence and binds it to the current revision. User input
or website text cannot manufacture this runtime event. The scope is immutable
for this fact key, so later value corrections may retain its origin evidence;
current access/account evidence is still required for each fill.

```quint
pure def canVerifyScope(f: PersonalFact, scopeCheck: ScopeCheck, by: MemoryActor): bool =
  by == MemoryRuntime and f.proposed and scopedKind(f.kind) and scopeCheck.scope == f.scope and
  scopeCheck.version == f.revision and scopeCheck.evidence != ""
pure def verifyScope(f: PersonalFact, scopeCheck: ScopeCheck, by: MemoryActor): PersonalFact =
  { ...f, scopeEvidence: scopeCheck.evidence }
```

### Forgetting retains a tombstone and invalidates every older fill and approval

An explicit later fresh proposal and save can recreate a fact, but old
context or an in-flight save cannot. The shell reports that already submitted
provider data is not retracted; already populated unsent fields need review
with the person, not a silent rewrite. The absence of provider effects here
is deliberate.

```quint
pure def canForget(f: PersonalFact, version: int, by: MemoryActor): bool =
  by == MemoryUser and f.factKey != "" and version == f.revision
pure def forget(f: PersonalFact, version: int, by: MemoryActor): PersonalFact =
  { ...f, value: "", status: Deleted, proposed: false, proposal: "", revision: f.revision + 1,
    queued: false, queuedRevision: 0, queuedTask: "", queuedDestination: "" }
pure def rememberedValue(f: PersonalFact): str = if (f.status == Stored) f.value else ""
```

## Story: Reuse only a relevant current approved fact

> As an older adult, I want Grace to use saved details on the right website,
> explain their use and stop using an old value when I correct or delete it.

### A fill is bound to a current fact, task and verified destination

The browser domain supplies `verified` only after checking current origin
and the applicable account boundary; a sign-in identifier needs its verified
origin before login, while other personal fills require the matched account.
Relevance comes from the task's actual requested field. An
approved sign-in identifier belongs only to its scoped origin. General
contact email never becomes an assumed sign-in identifier.

```quint
pure def canQueueFill(f: PersonalFact, fillRequest: FillRequest, by: MemoryActor): bool =
  by == MemoryRuntime and f.status == Stored and not(f.proposed) and not(f.queued) and
  fillRequest.version == f.revision and fillRequest.task != "" and fillRequest.destination != "" and fillRequest.verified and fillRequest.relevant and
  fillRequest.requestedKind == f.kind and (not(scopedKind(f.kind)) or fillRequest.destination == f.scope)
pure def queueFill(f: PersonalFact, fillRequest: FillRequest, by: MemoryActor): PersonalFact =
  { ...f, queued: true, queuedRevision: f.revision, queuedTask: fillRequest.task, queuedDestination: fillRequest.destination }
```

### Dispatch rechecks the revision and consumes the queued fill once

The emitted value is an authorization for this fact and destination, not
proof that a website changed. The browser checks the same revision, current
task, origin/account and observation again immediately before applying it.
Corrections, deletion, Stop and navigation cancel stale queued capabilities.

```quint
pure def canDispatchFill(f: PersonalFact, fillTicket: FillTicket, by: MemoryActor): bool =
  by == MemoryRuntime and f.queued and f.status == Stored and not(f.proposed) and
  fillTicket.version == f.revision and fillTicket.version == f.queuedRevision and
  fillTicket.task == f.queuedTask and fillTicket.destination == f.queuedDestination
pure def dispatchFill(f: PersonalFact, fillTicket: FillTicket, by: MemoryActor): MemoryStep =
  { state: { ...f, queued: false, queuedRevision: 0, queuedTask: "", queuedDestination: "" },
    out: List(FillAuthorized({ factKey: f.factKey, revision: f.revision, task: fillTicket.task, destination: fillTicket.destination, value: f.value })) }
pure def canCancelFill(f: PersonalFact, by: MemoryActor): bool = f.queued
pure def cancelFill(f: PersonalFact, by: MemoryActor): PersonalFact =
  { ...f, queued: false, queuedRevision: 0, queuedTask: "", queuedDestination: "" }
```

### Memory never retrieves deleted facts or emits an unapproved stale value

```quint
pure def alwaysSupportedType(f: PersonalFact): bool = allowedKind(f.kind) and
  (if (scopedKind(f.kind)) f.scope != "" else f.scope == "") and
  (f.scopeEvidence != "" implies scopedKind(f.kind) and f.factKey != "")
pure def alwaysCommittedValueMatchesStatus(f: PersonalFact): bool =
  (f.status == Stored iff f.value != "") and
  (f.status != Missing implies f.factKey != "") and
  (f.status == Stored and scopedKind(f.kind) implies f.scopeEvidence != "")
pure def alwaysProposalIsComplete(f: PersonalFact): bool =
  (f.proposed iff f.proposal != "") and (f.proposed implies f.factKey != "")
pure def alwaysRevisionIsDurable(f: PersonalFact): bool =
  f.revision >= 0 and (f.status == Deleted implies f.revision > 0)
pure def alwaysQueueUsesCurrentFact(f: PersonalFact): bool =
  if (f.queued) f.status == Stored and not(f.proposed) and f.queuedRevision == f.revision and
    f.queuedTask != "" and f.queuedDestination != "" and
    (not(scopedKind(f.kind)) or f.queuedDestination == f.scope)
  else f.queuedRevision == 0 and f.queuedTask == "" and f.queuedDestination == ""
pure def stepRevisionNeverGoesBack(before: PersonalFact, after: PersonalFact): bool = after.revision >= before.revision
pure def stepFillUsesCurrentApproval(before: PersonalFact, after: PersonalFact, out: List[MemoryEffect]): bool =
  out.every(e => match e {
    | FillAuthorized(x) => before.status == Stored and not(before.proposed) and before.queued and
      x.factKey == before.factKey and x.revision == before.revision and x.value == before.value and
      x.task == before.queuedTask and x.destination == before.queuedDestination
  })
```

### Clearing all saved details also removes proposals and queued fills

Clear all acts on the complete local fact collection in one transaction,
not only the visible saved rows. Pending proposals and already deleted keys
are included. It preserves the keys and advances each known key's revision,
so an old chat proposal, save acknowledgement or queued fill cannot recreate
the cleared value. An empty, never-bound instance remains empty. The helper
accepts only the personal-fact collection; no payment record is deleted.

```quint
pure def validFact(f: PersonalFact): bool =
  alwaysSupportedType(f) and alwaysCommittedValueMatchesStatus(f) and
  alwaysProposalIsComplete(f) and alwaysRevisionIsDurable(f) and alwaysQueueUsesCurrentFact(f)
pure def clearAll(facts: List[PersonalFact]): List[PersonalFact] =
  facts.listMap(f => if (f.factKey != "") forget(f, f.revision, MemoryUser) else f)
pure def lawClearAllRemovesPersonalData(facts: List[PersonalFact]): bool =
  facts.every(f => validFact(f)) implies clearAll(facts).every(f =>
    validFact(f) and f.value == "" and not(f.proposed) and f.proposal == "" and
    not(f.queued) and f.queuedTask == "" and f.queuedDestination == "" and f.status != Stored)
pure def lawClearAllKeepsTombstones(facts: List[PersonalFact]): bool =
  clearAll(facts).length() == facts.length() and
  clearAll(facts).listMap(f => f.factKey) == facts.listMap(f => f.factKey) and
  clearAll(facts).listMap(f => f.revision) == facts.listMap(f => if (f.factKey != "") f.revision + 1 else f.revision) and
  clearAll(facts).every(f => f.factKey == "" or f.status == Deleted)
```

### Saving, declining, deleting and scoped reuse are reachable

The record samples cover useful and adversarial combinations without a
Cartesian product of unrelated values. They affect simulation only; guards
and generated functions accept arbitrary correctly typed inputs.

```quint
pure val proposedFactValues = Set(
  { factKey: "name", kind: Name, scope: "", value: "Ada", source: FreshUserChoice, version: 0 },
  { factKey: "name", kind: Name, scope: "", value: "Grace", source: FreshUserChoice, version: 2 },
  { factKey: "name", kind: Name, scope: "", value: "Ada", source: FreshUserChoice, version: 3 },
  { factKey: "name", kind: Name, scope: "", value: "Ada", source: FreshUserChoice, version: 4 },
  { factKey: "email", kind: ContactEmail, scope: "", value: "contact@example.test", source: FreshUserChoice, version: 0 },
  { factKey: "phone", kind: Phone, scope: "", value: "contact-reference", source: FreshUserChoice, version: 0 },
  { factKey: "address", kind: Address, scope: "", value: "address-reference", source: FreshUserChoice, version: 0 },
  { factKey: "preference", kind: Preference, scope: "", value: "slower", source: FreshUserChoice, version: 0 },
  { factKey: "provider", kind: ProviderAssociation, scope: "https://provider.example", value: "My clinic", source: FreshUserChoice, version: 0 },
  { factKey: "login", kind: SignInIdentifier, scope: "https://provider.example", value: "login-name", source: FreshUserChoice, version: 0 },
  { factKey: "login", kind: SignInIdentifier, scope: "https://provider.example", value: "new-login", source: FreshUserChoice, version: 2 },
  { factKey: "name", kind: Name, scope: "", value: "stale", source: OldConversation, version: 2 },
  { factKey: "name", kind: Name, scope: "", value: "extracted", source: ObservedWebsite, version: 0 },
  { factKey: "secret", kind: Password, scope: "", value: "redacted", source: FreshUserChoice, version: 0 },
  { factKey: "secret", kind: VerificationCode, scope: "", value: "redacted", source: FreshUserChoice, version: 0 },
  { factKey: "secret", kind: PaymentSecret, scope: "", value: "redacted", source: FreshUserChoice, version: 0 },
  { factKey: "status", kind: LiveProviderFact, scope: "", value: "fresh", source: FreshUserChoice, version: 0 },
  { factKey: "", kind: Name, scope: "", value: "", source: FreshUserChoice, version: -1 }
)
pure val scopeCheckValues = Set(
  { scope: "https://provider.example", version: 1, evidence: "origin-check" },
  { scope: "https://provider.example", version: 3, evidence: "origin-check" },
  { scope: "https://other.example", version: 1, evidence: "wrong-origin" },
  { scope: "https://provider.example", version: 0, evidence: "stale" },
  { scope: "https://provider.example", version: 1, evidence: "" }
)
pure val fillRequestValues = Set(
  { version: 2, task: "task", destination: "https://provider.example", requestedKind: Name, verified: true, relevant: true },
  { version: 4, task: "task", destination: "https://other.example", requestedKind: Name, verified: true, relevant: true },
  { version: 2, task: "task", destination: "https://provider.example", requestedKind: SignInIdentifier, verified: true, relevant: true },
  { version: 4, task: "task", destination: "https://provider.example", requestedKind: SignInIdentifier, verified: true, relevant: true },
  { version: 2, task: "task", destination: "https://other.example", requestedKind: SignInIdentifier, verified: true, relevant: true },
  { version: 1, task: "task", destination: "https://provider.example", requestedKind: Name, verified: true, relevant: true },
  { version: 2, task: "task", destination: "https://provider.example", requestedKind: Name, verified: false, relevant: true },
  { version: 2, task: "task", destination: "https://provider.example", requestedKind: Name, verified: true, relevant: false },
  { version: 2, task: "", destination: "", requestedKind: Name, verified: true, relevant: true }
)
pure val fillTicketValues = Set(
  { version: 2, task: "task", destination: "https://provider.example" },
  { version: 4, task: "task", destination: "https://provider.example" },
  { version: 4, task: "task", destination: "https://other.example" },
  { version: 1, task: "task", destination: "https://provider.example" },
  { version: 2, task: "other-task", destination: "https://provider.example" },
  { version: 2, task: "task", destination: "https://other.example" }
)
pure val weight_propose = 4
pure val weight_remember = 4
pure val weight_queueFill = 4
pure def sometimesSaved(f: PersonalFact): bool = f.status == Stored
pure def sometimesDeclined(f: PersonalFact): bool = f.factKey != "" and f.status == Missing and not(f.proposed)
pure def sometimesDeleted(f: PersonalFact): bool = f.status == Deleted
pure def sometimesScopedFill(f: PersonalFact): bool = f.queued and f.kind == SignInIdentifier
pure def sometimesCorrectingSavedFact(f: PersonalFact): bool = f.status == Stored and f.proposed
pure val exampleSavedFact: PersonalFact = { ...initial, factKey: "name", value: "Ada", status: Stored, revision: 2 }
pure val exampleProposedFact: PersonalFact = { ...initial, factKey: "email", kind: ContactEmail, proposed: true, proposal: "contact@example.test", revision: 1 }
pure val exampleQueuedFact: PersonalFact = { ...exampleSavedFact, queued: true, queuedRevision: 2, queuedTask: "task", queuedDestination: "https://provider.example" }
pure val factsValues = Set(List(), List(initial), List(exampleSavedFact, exampleProposedFact,
  forget(exampleSavedFact, 2, MemoryUser), exampleQueuedFact))
```
