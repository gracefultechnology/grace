# Recheck saved personal details at website dispatch

This stateless join connects [approved memory](./memory.md), read through
[her saved details](./savedDetails.md), to the
[current actuator command](./actuation.md). Saved details, Memory and
Workspace retain their own authoritative states. No fact, permission flag or
revision is copied into the other machine. Sources: MEM 01–04, especially MEM 03's queued-fill exercise.

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
import savedDetails as SD from "./savedDetails"
import actuation as AC from "./actuation"
import workspace as WS from "./workspace"
import websiteRequests as WR from "./websiteRequests"
import execution as X from "./execution"
import shell as S from "./shell"
import browser as B from "./browser"
import assistant as A from "./assistant"
import conversation as C from "./conversation"
import commitment as CM from "./commitment"
import task as T from "./task"
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
pure def currentSavedEffect(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, f: M::PersonalFact, saved: SavedFill, by: WS::WorkspaceActor): bool =
  AC::currentEffect(w, pendingEffect, by) and match pendingEffect {
    | Execute(command) => currentSavedOperation(f, saved, command.effect)
    | _ => false
  }
pure def lawSavedEffectRequiresCurrentContext(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, f: M::PersonalFact, saved: SavedFill, by: WS::WorkspaceActor): bool =
  currentSavedEffect(w, pendingEffect, f, saved, by) implies
    AC::currentEffect(w, pendingEffect, by) and currentFactAuthorization(f, saved.authorization)
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
Non-fill plans derived from memory, such as navigating to a saved provider,
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
pure def lawForgetRevokesSavedCommand(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, f: M::PersonalFact, saved: SavedFill, by: WS::WorkspaceActor): bool =
  M::canForget(f, f.revision, M::MemoryUser) implies
    not(currentSavedEffect(w, pendingEffect, M::forget(f, f.revision, M::MemoryUser), saved, by))
pure def lawClearAllRevokesReceipts(facts: List[M::PersonalFact], authorization: M::MemoryEffect): bool =
  M::clearAll(facts).every(f => not(currentFactAuthorization(f, authorization)))
```

### A queued fill is checked against the current detail in her saved details

The fact a receipt is checked against is the one her
[saved details](./savedDetails.md) hold under the receipt's key now, never a
copy kept with the command. Changing that detail, deleting it or Clear all
therefore refuses the command at dispatch, even if Workspace has not changed.
None of these touches Workspace or any commitment: a payment, a booking or a
calendar entry made before stays as it is.

```quint
pure def receiptKey(authorization: M::MemoryEffect): str = match authorization {
  | FillAuthorized(receipt) => receipt.factKey
}
pure def currentSavedDetailEffect(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, saved: SavedFill, by: WS::WorkspaceActor): bool =
  currentSavedEffect(w, pendingEffect, SD::detailAt(d, receiptKey(saved.authorization)), saved, by)
pure def lawChangedDetailRevokesSavedCommand(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, proposedFact: M::FactProposal, saved: SavedFill, by: WS::WorkspaceActor): bool =
  SD::canProposeDetail(d, proposedFact, M::MemoryUser) and proposedFact.factKey == receiptKey(saved.authorization) implies
    not(currentSavedDetailEffect(w, pendingEffect, SD::proposeDetail(d, proposedFact, M::MemoryUser), saved, by))
pure def lawDeletedDetailRevokesSavedCommand(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, version: int, saved: SavedFill, by: WS::WorkspaceActor): bool =
  SD::canForgetDetail(d, receiptKey(saved.authorization), version, M::MemoryUser) implies
    not(currentSavedDetailEffect(w, pendingEffect, SD::forgetDetail(d, receiptKey(saved.authorization), version, M::MemoryUser), saved, by))
pure def lawClearAllRevokesSavedCommand(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, saved: SavedFill, by: WS::WorkspaceActor): bool =
  not(currentSavedDetailEffect(w, pendingEffect, SD::forgetAll(d, M::MemoryUser), saved, by))
```

## Story: Fill a booking or sign-up form for me

> As an older adult booking an appointment or signing up on a website, I want
> Grace to fill each field from what I just told her or from a detail I saved,
> and never from anything else.

### A form field is filled from her own answer or from a current saved detail

Each fill of a form or sign-up names one of two sources. Her answer in this
task needs the Workspace check of the current command alone. A saved detail
also needs the saved-value check against the detail her saved details hold
now. The host that resolves the value names its source: her answer only for
what she said in this task, never a value read from a website or an old
conversation. That naming is the host's duty; this check cannot see it.

After applying a saved fill, the host reads back the field it actually
changed. It presents the original saved receipt, the in-flight command and
the readback together. Only a matching positive readback puts the explanation
in the assistant's visible task checkpoint. Its fixed wording leaves out the
saved value, field contents, website text, account, origin and receipt.
A mismatch follows the ordinary verification failure route. A stale or
replayed callback cannot create another explanation.

```quint
type FillSource = HerAnswer | HerSavedDetail
pure def fillAllowed(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, source: FillSource, saved: SavedFill, by: WS::WorkspaceActor): bool =
  if (source == HerSavedDetail) currentSavedDetailEffect(w, pendingEffect, d, saved, by) else AC::currentEffect(w, pendingEffect, by)
pure val savedUseCheckpoint = "I filled this field using a detail you saved."
pure def afterSavedFillReadback(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, saved: SavedFill, currentVerification: WS::CurrentVerification, by: WS::WorkspaceActor): WS::Workspace = {
  val report = { ...currentVerification, checkpoint: savedUseCheckpoint }
  if (currentSavedDetailEffect(w, pendingEffect, d, saved, WS::Actuator) and WS::canVerify(w, report, by))
    WS::verify(w, report, by)
  else w
}
pure def lawOnlyVerifiedSavedUseExplains(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, saved: SavedFill, currentVerification: WS::CurrentVerification, by: WS::WorkspaceActor): bool = {
  val after = afterSavedFillReadback(w, pendingEffect, d, saved, currentVerification, by)
  val explained = after.execution.phase == X::Verified and after.assistant.workVersion > w.assistant.workVersion and after.assistant.checkpoint == savedUseCheckpoint
  val report = { ...currentVerification, checkpoint: savedUseCheckpoint }
  explained iff (currentVerification.website.matches and currentSavedDetailEffect(w, pendingEffect, d, saved, WS::Actuator) and WS::canVerify(w, report, by))
}
pure def lawSavedSourceNeedsTheCurrentDetail(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, saved: SavedFill, by: WS::WorkspaceActor): bool =
  fillAllowed(w, pendingEffect, d, HerSavedDetail, saved, by) implies
    AC::currentEffect(w, pendingEffect, by) and currentFactAuthorization(SD::detailAt(d, receiptKey(saved.authorization)), saved.authorization)
pure def lawAnswerSourceNeedsTheCurrentCommand(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, d: SD::SavedDetails, saved: SavedFill, by: WS::WorkspaceActor): bool =
  fillAllowed(w, pendingEffect, d, HerAnswer, saved, by) == AC::currentEffect(w, pendingEffect, by)
```

### Finite examples retain the original receipt after correction and deletion

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
  val queued = M::queueFill(f, { version: f.revision, task: "task", destination: CM::exampleKey.origin, requestedKind: M::Name, verified: true, relevant: true }, M::MemoryRuntime)
  M::dispatchFill(queued, { version: f.revision, task: "task", destination: CM::exampleKey.origin }, M::MemoryRuntime)
}
pure def savedWorkspace(w: WS::Workspace): WS::WorkspaceResult = {
  val queued = WS::prepare(w, AC::sampleOperationRequest(w, "name-field", "memory-name-revision-2", X::FillOrdinary), WS::Host)
  WS::dispatch(queued, AC::sampleOperationTokens(queued), WS::Actuator)
}
pure val correction: M::FactProposal = { factKey: "name", kind: M::Name, scope: "", value: "Grace", source: M::FreshUserChoice, version: 2 }
pure val wValues = Set(WS::initial, AC::observedSample(WS::initial), savedWorkspace(AC::observedSample(WS::initial)).state,
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
  M::FillAuthorized({ factKey: "name", revision: 1, task: "task", destination: CM::exampleKey.origin, value: "Ada" }))
pure val operationValues = Set(X::Operate({ owner: "owner", task: "task", origin: CM::exampleKey.origin, generation: 1, observation: 1,
  target: "name-field", valueRef: "memory-name-revision-2", kind: X::FillOrdinary }),
  X::Operate({ owner: "owner", task: "task", origin: CM::exampleKey.origin, generation: 1, observation: 1,
    target: "name-field", valueRef: "memory-name-revision-2", kind: X::FillSignInIdentifier }))
pure val currentVerificationValues = {
  val w = savedWorkspace(AC::observedSample(WS::initial)).state
  val report = { deviceVersion: w.device.contextVersion, browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion,
    website: { ...X::goodVerification, generation: w.execution.generation, observation: w.execution.observation },
    checkpoint: "Read the field", needsUser: false }
  Set(report, { ...report, browserRevision: report.browserRevision + 1 },
    { ...report, website: { ...report.website, matches: false, reason: "Field unchanged" } })
}
pure val proposedFactValues = Set(correction, { ...correction, version: 1 })
pure val factKeyValues = Set("name", "provider", "missing")
pure val dValues = Set(SD::initial, { facts: List(authorizedFill(approvedFact(M::initial)).state) },
  { facts: List(M::propose(authorizedFill(approvedFact(M::initial)).state, correction, M::MemoryUser)) },
  { facts: List(M::forget(authorizedFill(approvedFact(M::initial)).state, 2, M::MemoryUser)) })
pure val versionValues = Set(1, 2, 3)
pure val revisionValues = Set(1, 2, 3, 4)
pure val factsValues = Set(List(), List(authorizedFill(approvedFact(M::initial)).state),
  List(authorizedFill(approvedFact(M::initial)).state, M::initial))
```
