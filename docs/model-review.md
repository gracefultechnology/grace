# Model review

This records behavioral findings from the second pass over the PRD, replacement
prototype, legacy models and new Quint. It complements the
[coverage map](requirements-coverage.md); proof and simulation results belong in
the validation report. A reviewed rule is not user acceptance.

## Corrections and discovered rules

| Area | Finding and resulting contract |
|---|---|
| Canonical payment identity | A task or calendar row is not a bill. Payment records use owner, verified provider origin, account and invoice/cycle identity. Switching tasks or entry points retains the same durable uncertainty and outcome. |
| Receipt routing | Looking up a retained payment and applying its storage acknowledgment must use the same active-record predicate. An abstract empty active slot can carry a matching key; it must not intercept an acknowledgment intended for the retained record. |
| Outcome evidence | Missing confirmation cannot justify retry. Pending, scheduled, accepted, completed, failed and returned are distinct; a later authoritative return can supersede an earlier positive result. Receipt-storage failure does not undo the observed payment. |
| Inductive payment facts | Reviews require evidence; an attempt requires its review evidence; a saved outcome requires an attempt. Without these facts, abstract states admitted by the earlier invariants could manufacture authorization or durable confirmation. |
| Provider facts | Unknown fee is not zero, and a positive required minimum conflicts with “nothing due.” Preparation requires consistent observed facts and exact readback. No guard names a provider or fixed page sequence. |
| Repeated website failure | Retry identity includes semantic operation, target, value and page facts. At most one unchanged retry is allowed; pause and re-observation cannot erase that limit. Changed facts or a genuinely different approach can proceed. |
| Guidance dismissal | The anchored label and ring need their own visibility state. Dismiss retains the same task, instruction and conversation; Show restores only a target whose device, page, task and conversation context still matches. Private or app guidance does not grant browser action authority. |
| Normal website completion | A successful individual action does not finish the user's goal. The workspace needs a separate, current, evidence-backed goal-completion route; payment tasks must finish through their durable outcome route. |
| Expected page changes | An expected, correctly correlated response to an in-flight operation invalidates old page observations without imposing a new manual Resume step. Unrelated/manual changes pause and require reconciliation. |
| Wake lifecycle | The explicitly approved local “Hey Grace” feature can wake and open Grace while pausing old work. A wake phrase does not authorize a payment. Generation-bound silence and return timers cannot close a newer exchange or resume work. |
| Conversation composition | Calling a child conversation reducer outside the workspace would bypass its interruption rules. Typed messages, voice results, keyboard changes and reading controls need one coordinated route through the actual nested state; new input cancels stale wake timers and invalidates conflicting website work. |
| Browser and settings composition | Address editing, zoom, scroll, layout, recent-history controls, preference Undo and sample output also use the owning workspace. Current revision identifies host geometry reports. Text-size changes invalidate targets; history-only edits do not. The departure rule follows the browser revision so removing recent history preserves payment readiness while still retaining the attempt and durable record. Geometry changes preserve a pending user question or explicit user-wait state. |
| Spoken payment approval | An exact, fully classified approval must update the transcript and authorize the payment atomically. Routing it first as a generic correction would invalidate the review it is approving. Partial audio, corrections and unrelated requests cannot use the approval route. |
| Prototype presentation | Idle Ask Grace opens expanded; reopening a paused task opens compact; pressing Ask Grace while visible does nothing. Sleep hides Grace after pausing. Touch wake alone leaves it closed; an enabled human wake phrase is a distinct action. |
| Type during thinking | Switching to Type stops voice output/capture but preserves the already submitted response request. It must not silently discard the answer. |
| Replacement and private data | Asking to replace a task first quiets old speech. Explicit detected-private-text removal purges the affected transcript/draft content and invalidates pending output rather than preserving secrets under a blanket continuity rule. |
| Settings write ordering | Reverting to a previously saved setting while a different write is pending still needs a newer write. A late acknowledgment must not restore the superseded choice. Wake disable takes effect immediately in the session. |
| Draft callback ordering | Save and Discard of the same draft/revision need a monotonic request serial. Otherwise a late Save acknowledgment can defeat Discard. Sending remains fenced by the exact current draft and durable unique send operation. |
| Draft retirement and send storage | Confirmed sending or discard retires the exact stored draft version, so a stale listing cannot restore it. Provider acceptance and local result persistence are separate: an accepted message with failed result storage stays known as sent, blocks another send, and can retry storage. Restart uses durable uncertainty until reconciliation. |
| Email attachment manifest | A successful message read installs its complete attachment manifest atomically. Forwarding a message cannot race incremental attachment callbacks and silently omit originals. A picker result binds the current draft revision, so an old result cannot attach to a replacement draft. |
| Sharing and unsaved drafts | Files Share checks that the chosen mailbox can accept the photo before leaving its preview. A failed draft save keeps the old draft recoverable and cannot make it replaceable merely because its editor is hidden. |
| Email folder scope | Listing responses bind account, folder, query and generation. Search/folder changes retire old results. Trash does not expose reply/forward; settled per-message states carry no pending mutation that could create a phantom restore. |
| Email message ownership | The mailbox owns one canonical lifecycle record per message. Trash, Restore, Purge, unread changes and their receipts must update that record and invalidate affected selection/attachment authority. A pending mutation cannot block reading an unrelated message; listing refresh cannot erase uncertainty or revive a purged record. Verified external folder/read changes use the same identity, current record revision and listing request, and invalidate obsolete Undo. |
| Calendar occurrence ownership | The calendar view owns each full occurrence state and routes edits, save acknowledgments and reminder progression through that same value. A higher revision cannot replace immutable occurrence or bill identity. Cancelled unsaved occurrence IDs are retired, preventing an old save result from attaching to a recreated draft. List projections use committed fields while a form is being edited. |
| Recurring calendar entries | Deleting one occurrence does not suppress later occurrences. Deleting the series leaves a tombstone preventing old materialization callbacks from recreating it. Series tombstones require a nonempty series ID, so an empty committed field on a new draft cannot mean that its series was deleted. A pending whole-series deletion also retains the selected event’s recurring-series identity through the storage acknowledgment. Bill links resolve the currently saved occurrence. |
| Calendar save retry | A failure retires the approved write revision even when the draft is unchanged. Without this fence, reapproving the draft could accept the previous attempt's success or failure callback. Single-event and series retries use the same revision rule. |
| Recurring edits and Close | Editing a recurring event updates its versioned series definition and all affected occurrences in one validated save. Future materialization uses the same version. Calendar Close cancels an unsubmitted form before returning Home, preserving committed data and retiring cancelled unsaved IDs. Already-submitted save/deletion targets remain owned for acknowledgment while hidden and recovery on reopen. |
| Calendar timezones | Each event retains its recurrence timezone; the calendar's display timezone need not equal it. Actual timezone and daylight-saving conversion remains a required adapter journey. |
| Files catalog replacement | A catalog read is unloaded and has no old selection/search result. Without that invariant, a returned catalog could retain an ID absent from the new entries. Background loading for attachment saves clears only an unloaded stale view. |
| Files identity and callbacks | Immutable source identity, rather than filename, deduplicates saves. Reads, search, imports, delete, share and print bind the current owner, asset and request generation; late results cannot reopen a closed search. |
| Printing and reopening | An unsaved email PDF can be printed directly without a fictitious library save. A pending or uncertain print survives reopening with its known feedback; reopening cannot hide uncertainty or authorize a duplicate print. |
| Memory deletion | Clear all covers proposed, queued, saved and tombstoned facts. Removal revokes queued reuse, and old chat does not recreate permission to persist or fill the deleted value. |

## Review method and boundaries

Each domain is checked for its initial state, reachable success and recovery
states, every transition's admission conditions, rejected stale inputs,
ownership of identities and versions, emitted effects, and prose/Quint agreement.
Collection proofs cover arbitrary valid collections, not only the finite values
used to discover simulation traces. The generated model is the only owner of
product state; there is no copied application implementation in this phase.

The important external assumptions are explicit: host-supplied actor identity,
verified page/connector provenance, correctly correlated observations, atomic
durable storage, and enforcement at the actual audio/browser/network boundary.
The [implementation acceptance](implementation-acceptance.md) document assigns
those assumptions to concrete integration journeys. Model checks do not claim
that the prototype's simulated provider, storage or print callbacks performed
real operations.
