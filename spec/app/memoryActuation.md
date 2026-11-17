# Recheck saved personal details at website dispatch

This stateless join connects [approved memory](./memory.md) to the
[current actuator command](./actuation.md). Memory and Workspace retain their
own authoritative states. No fact, permission flag or revision is copied into
the other machine. Sources: MEM 01–04, especially MEM 03's queued-fill exercise.

## Story: Forget or correct a detail before a queued fill reaches the website

> As a person who corrects or forgets a saved detail, I want an old queued
> website command to stop using it without erasing my payment evidence.

### Saved facts and receipts must still name the current approved revision

`SavedFill` is an immutable resolution of the command's opaque `valueRef`,
not another live fact. The trusted resolver mints it for one accepted command
and classified field, bound to the original emitted `FillAuthorized` receipt.
The resolution projects its owner namespace and must match the command owner.
It loads the fact from that owner's canonical store; it never rebinds an old
reference to a newer receipt or another command/field, or treats a missing saved
reference as a fresh user choice. The predicate checks that current fact.
A pending correction already revokes the old receipt. Identical text saved
again has a newer revision and does not revive the old authorization.

```quint
import memory as M from "./memory"
import actuation as AC from "./actuation"
import workspace as WS from "./workspace"
import execution as X from "./execution"
import shell as S from "./shell"
import browser as B from "./browser"
import assistant as A from "./assistant"
import conversation as C from "./conversation"
import payment as P from "./payment"
import preferences as R from "./preferences"
import wake as W from "./wake"

type SavedFill = { owner: str, valueRef: str, authorization: M::MemoryEffect }
pure def currentFactRevision(f: M::PersonalFact, factKey: str, revision: int): bool =
  M::validFact(f) and f.status == M::Stored and not(f.proposed) and
    factKey == f.factKey and revision == f.revision
pure def currentFactAuthorization(f: M::PersonalFact, authorization: M::MemoryEffect): bool = match authorization {
  | FillAuthorized(receipt) => currentFactRevision(f, receipt.factKey, receipt.revision) and receipt.value == f.value and
    receipt.task != "" and receipt.destination != "" and
    (not(M::scopedKind(f.kind)) or receipt.destination == f.scope)
}
pure def lawStaleSavedRevisionIsRefused(f: M::PersonalFact, authorization: M::MemoryEffect): bool = match authorization {
  | FillAuthorized(receipt) => receipt.revision != f.revision implies not(currentFactAuthorization(f, authorization))
}
pure def lawSavedReceiptMatchesFact(f: M::PersonalFact, authorization: M::MemoryEffect): bool = match authorization {
  | FillAuthorized(receipt) => currentFactAuthorization(f, authorization) implies
    receipt.factKey == f.factKey and receipt.revision == f.revision and receipt.value == f.value and
    f.status == M::Stored and not(f.proposed)
}
```

### A saved fill also requires the current command's task, origin and field kind

Every memory-derived physical fill requires this join in addition to the
Workspace check. The resolved owner and receipt's task and destination must match the exact
current command. A sign-in identifier uses the sign-in operation on its verified
origin; general contact email cannot substitute for it. Other approved fact
kinds use ordinary filling, which already requires a matched current account.
Read, navigation and payment commands cannot consume a saved-value receipt.
The browser still authenticates the semantic field classification and relevance.

The successful check authorizes the receipt's exact value, never a substituted
latest value. `dispatchFill` has already consumed Memory's queue, so this check
does not require the fact to remain queued. The host requires original-emission
provenance and claims the outbox entry only once; arbitrary caller-supplied facts
or receipts cannot stand in for the resolver and owning stores.

```quint
pure def currentSavedOperation(f: M::PersonalFact, saved: SavedFill, operation: X::WebsiteEffect): bool =
  val authorization = saved.authorization
  match operation {
  | Operate(details) => saved.owner != "" and details.owner == saved.owner and
    saved.valueRef != "" and details.valueRef == saved.valueRef and
    currentFactAuthorization(f, saved.authorization) and
    ((details.kind == X::FillSignInIdentifier and f.kind == M::SignInIdentifier) or
      (details.kind == X::FillOrdinary and f.kind != M::SignInIdentifier)) and match authorization {
      | FillAuthorized(receipt) => details.task == receipt.task and details.origin == receipt.destination
    }
}
pure def currentSavedEffect(workspace: WS::Workspace, pendingEffect: WS::WorkspaceEffect, f: M::PersonalFact, saved: SavedFill, by: WS::WorkspaceActor): bool =
  AC::currentEffect(workspace, pendingEffect, by) and match pendingEffect {
    | Execute(command) => currentSavedOperation(f, saved, command.effect)
    | _ => false
  }
pure def lawSavedEffectRequiresCurrentContext(workspace: WS::Workspace, pendingEffect: WS::WorkspaceEffect, f: M::PersonalFact, saved: SavedFill, by: WS::WorkspaceActor): bool =
  currentSavedEffect(workspace, pendingEffect, f, saved, by) implies
    AC::currentEffect(workspace, pendingEffect, by) and currentFactAuthorization(f, saved.authorization)
pure def lawSavedOwnerMustMatch(f: M::PersonalFact, saved: SavedFill, operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => details.owner != saved.owner implies not(currentSavedOperation(f, saved, operation))
}
pure def lawSavedReferenceMustMatch(f: M::PersonalFact, saved: SavedFill, operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => details.valueRef != saved.valueRef implies not(currentSavedOperation(f, saved, operation))
}
pure def lawSavedOperationUsesExactTaskOriginKind(f: M::PersonalFact, saved: SavedFill, operation: X::WebsiteEffect): bool =
  val authorization = saved.authorization
  match operation {
  | Operate(details) => currentSavedOperation(f, saved, operation) implies match authorization {
    | FillAuthorized(receipt) => details.task == receipt.task and details.origin == receipt.destination and details.owner == saved.owner and
      (if (f.kind == M::SignInIdentifier) details.kind == X::FillSignInIdentifier else details.kind == X::FillOrdinary)
  }
}
```

### Correction and deletion revoke the old command without changing Workspace

The same original receipt fails after a correction proposal, confirmed
correction, deletion or Clear all, even if Workspace has not changed.
Non-fill plans derived from memory, such as navigating to a saved biller,
retain their original owner/key/revision dependencies. The host checks every
dependency with `currentFactRevision` before the next external action; a stale
dependency invalidates or pauses the existing Workspace operation. These plans
need no `FillAuthorized` receipt and cannot bypass the check through Navigate.
The canonical resolver supplies the original dependency, not a newer revision
substituted after the plan was accepted.
The adapter serializes the authoritative fact read, one-time outbox claim and
physical fill start with fact commits and Workspace interruption. A deletion
ordered first blocks that fill while its transaction settles. Failed persistence
retains the old fact and is reported honestly; it is not a successful deletion.
A fill already started may have reached the website: review unsent populated
fields with the person, and never claim forgetting retracts submitted data.
These storage and physical-dispatch races remain host responsibilities.
This predicate has no mutations or effects, so it neither clears website fields
nor cancels, deletes or changes payment records.

```quint
pure def lawCorrectionRevokesReceipt(f: M::PersonalFact, proposedFact: M::FactProposal, authorization: M::MemoryEffect): bool =
  M::canPropose(f, proposedFact, M::MemoryUser) implies
    not(currentFactAuthorization(M::propose(f, proposedFact, M::MemoryUser), authorization))
pure def lawRememberedCorrectionRevokesOldReceipt(f: M::PersonalFact, proposedFact: M::FactProposal, authorization: M::MemoryEffect): bool =
  val proposed = M::propose(f, proposedFact, M::MemoryUser)
  currentFactAuthorization(f, authorization) and M::canPropose(f, proposedFact, M::MemoryUser) and
    M::canRemember(proposed, proposed.revision, M::MemoryUser) implies
    not(currentFactAuthorization(M::remember(proposed, proposed.revision, M::MemoryUser), authorization))
pure def lawForgottenPlanDependencyIsRefused(f: M::PersonalFact, factKey: str, revision: int): bool =
  M::canForget(f, f.revision, M::MemoryUser) implies
    not(currentFactRevision(M::forget(f, f.revision, M::MemoryUser), factKey, revision))
pure def lawForgetRevokesSavedCommand(workspace: WS::Workspace, pendingEffect: WS::WorkspaceEffect, f: M::PersonalFact, saved: SavedFill, by: WS::WorkspaceActor): bool =
  M::canForget(f, f.revision, M::MemoryUser) implies
    not(currentSavedEffect(workspace, pendingEffect, M::forget(f, f.revision, M::MemoryUser), saved, by))
pure def lawClearAllRevokesReceipts(facts: List[M::PersonalFact], authorization: M::MemoryEffect): bool =
  M::clearAll(facts).every(f => not(currentFactAuthorization(f, authorization)))
```

The examples are simulation values only. They use the existing guarded Memory
and Workspace routes, then leave the emitted command unchanged while its fact
is corrected or deleted. Runtime identities, revisions and values are unbounded
by these samples. The host's immutable reference resolution and atomic delivery
are integration acceptance requirements, not facts established by these examples.

```quint
pure def approvedFact(f: M::PersonalFact): M::PersonalFact = {
  val proposed = M::propose(f, { factKey: "name", kind: M::Name, scope: "", value: "Ada", source: M::FreshUserChoice, version: f.revision }, M::MemoryUser)
  M::remember(proposed, proposed.revision, M::MemoryUser)
}
pure def authorizedFill(f: M::PersonalFact): M::MemoryStep = {
  val queued = M::queueFill(f, { version: f.revision, task: "task", destination: P::exampleKey.origin, requestedKind: M::Name, verified: true, relevant: true }, M::MemoryRuntime)
  M::dispatchFill(queued, { version: f.revision, task: "task", destination: P::exampleKey.origin }, M::MemoryRuntime)
}
pure def savedWorkspace(workspace: WS::Workspace): WS::WorkspaceResult = {
  val queued = WS::prepare(workspace, { deviceVersion: 6, browserRevision: 2, taskVersion: 1, generation: 1, observation: 1,
    target: "name-field", valueRef: "memory-name-revision-2", kind: X::FillOrdinary }, WS::Host)
  WS::dispatch(queued, { deviceVersion: 6, browserRevision: 2, taskVersion: 1, generation: 1, observation: 1 }, WS::Actuator)
}
pure val correction: M::FactProposal = { factKey: "name", kind: M::Name, scope: "", value: "Grace", source: M::FreshUserChoice, version: 2 }
pure val workspaceValues = Set(WS::initial, AC::observedSample(WS::initial), savedWorkspace(AC::observedSample(WS::initial)).state,
  WS::stop(savedWorkspace(AC::observedSample(WS::initial)).state, WS::Person))
pure val pendingEffectValues = Set(savedWorkspace(AC::observedSample(WS::initial)).out.nth(0),
  AC::ordinarySample(AC::observedSample(WS::initial)).out.nth(0), WS::WakeFeedback({ signal: W::WakeChime }))
pure val fValues = Set(M::initial, authorizedFill(approvedFact(M::initial)).state,
  M::propose(authorizedFill(approvedFact(M::initial)).state, correction, M::MemoryUser),
  M::forget(authorizedFill(approvedFact(M::initial)).state, 2, M::MemoryUser))
pure val savedValues = Set(
  { owner: "owner", valueRef: "memory-name-revision-2", authorization: authorizedFill(approvedFact(M::initial)).out.nth(0) },
  { owner: "owner", valueRef: "other-reference", authorization: authorizedFill(approvedFact(M::initial)).out.nth(0) },
  { owner: "other-owner", valueRef: "memory-name-revision-2", authorization: authorizedFill(approvedFact(M::initial)).out.nth(0) })
pure val authorizationValues = Set(authorizedFill(approvedFact(M::initial)).out.nth(0),
  M::FillAuthorized({ factKey: "name", revision: 1, task: "task", destination: P::exampleKey.origin, value: "Ada" }))
pure val operationValues = Set(X::Operate({ owner: "owner", task: "task", origin: P::exampleKey.origin, generation: 1, observation: 1,
  target: "name-field", valueRef: "memory-name-revision-2", kind: X::FillOrdinary }),
  X::Operate({ owner: "owner", task: "task", origin: P::exampleKey.origin, generation: 1, observation: 1,
    target: "name-field", valueRef: "memory-name-revision-2", kind: X::FillSignInIdentifier }))
pure val proposedFactValues = Set(correction, { ...correction, version: 1 })
pure val factKeyValues = Set("name", "biller", "missing")
pure val revisionValues = Set(1, 2, 3, 4)
pure val factsValues = Set(List(), List(authorizedFill(approvedFact(M::initial)).state),
  List(authorizedFill(approvedFact(M::initial)).state, M::initial))
```
