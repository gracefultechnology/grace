# Email and calendar requirement mapping

The replacement `prototype/Grace Prototype.html` is authoritative for these
application flows. It supersedes the older bill-pay-only file, whose Email and
Calendar cards were placeholders. Source ranges below refer to the replacement
file. This phase implements models and specifications, not UI/provider code.
The explicit user requirement for Calendar → bill payment remains an extension:
the replacement Calendar JavaScript has no payment action.

| ID | Requirement and source | Formal home |
|---|---|---|
| EMAIL-01 | Official provider/account choice, verified callback, separate read/send grants, revoke/expire/cancel and stale callback fencing. Legacy ACC-01–06 and current INV 01. | `email.md`: `connect`, `authorize`, `endConnection`, account/generation invariants |
| EMAIL-02 | Home opens Email; Inbox, Sent, Drafts and Trash; unread badges, current-folder search over sender/subject/body, distinct empty-folder/no-match states. HTML 1942–1971, 2179–2180, 2235. | `email.md` mailbox read/view state; `emailItem.md` `visibleMessages`, `unreadCount`, `searchMessages`, identity/query laws |
| EMAIL-03 | Open only the selected current account's returned message/attachment; read errors retry without invented content. HTML 1945–1951, 1964–1971, 2180–2187. | `readMail`, `receiveMessage`, `readResult`, `receiveAsset`, source/generation/selection invariants |
| EMAIL-04 | Photo gallery Back/Previous/Next at actual bounds; PDF Back/Open/Print; Save photo, Save all photos, Save PDF; no fixed page count or filename identity. HTML 1945–1951, 1965–1967, 2182–2187. | `photoAssets`, `photoPosition`, `movePhoto`, `backToMessage`, `selectedAssets`, `mayExportAttachments`; `files.md` content/save/print outcomes |
| EMAIL-05 | New email starts with recipient choice; To/Cc/Bcc add/remove; subject/body edit; attach via camera/photos/file picker; remove attachment; arbitrary real contacts. HTML 1953–1963, 2191–2204. | `DraftContent`, `startDraft`, `editDraft`, `attachAsset`, `removeAsset`; all changes invalidate revision approval |
| EMAIL-06 | Reply remains bound to source; Forward and individual-photo forwarding produce an editable draft, never send; Files photo sharing uses the exact asset. HTML 1955–1967, 2184, 2189, 2197–2198. | `replyTo`, `forwardMessage`, `draftAttachments`, `attachAsset`; Files `SharePhoto` owner/asset contract |
| EMAIL-07 | Back/app close preserve draft, reopening retains recipients/content/attachments; Discard removes only that draft. HTML 1943, 2156, 2180, 2199–2200. | `preserveDraft`, `draftStoreResult`, `restoreDraft`, `discardDraft`; draft versions, retirement registry, stale/newer snapshot laws, explicit storage failure recovery |
| EMAIL-08 | Manual Send uses the visible exact draft; no additional review dialog. Assisted send requires explicit exact-content approval. Empty body/subject and attachment-only messages work. HTML 1960–1963, 2204 and current INV 02/04/06. | `confirmVisibleSend`, `reviewDraft`, `approveDraft`, `alwaysSendHasRecipient`, revision/asset preservation invariants |
| EMAIL-09 | Fresh persisted operation ID; provider acceptance, verified failure and uncertain outcome distinguished; unknown sends cannot retry/change content. Prototype 2204 is a simulated success, current INV 07 supplies production requirement. | `sendDraft`, `sendResult`, `persistSendResult`, `restartMailbox`, `issuedSends`, `stepUnresolvedDraftIsFixed`; known outcome/save-failed distinction and durable retirement |
| EMAIL-10 | Delete moves selected message to Trash, Undo targets that exact mutation, Restore uses prior folder, Delete forever is irreversible; read/unread and provider mutation failures do not fake success. HTML 1964, 1970, 2205–2208. | `email.md`: canonical `messages` registry, `changeSelectedMessage`, `undoMessageTrash`, `completeMessageChange`; these apply `emailItem.md` reducers to the actual selected/provider-addressed record |
| EMAIL-11 | Bill extraction carries independently verified invoice/account and user-confirmed source; reading never pays. Explicit user scope, legacy connector requirements, current INV 01/06. | `receiveBill`, `confirmBill`, `billReady`; canonical `handoffs.md` and `payment.md` |
| CAL-01 | Week/Month, Today, prior/next period, month-day → Week, selected day, upcoming rows and exact detail identity. HTML 1895–1918, 2157–2163. | `calendarView.md`: `openCalendar`, `navigate`, `openOccurrence`, `selectedOccurrence`, `visibleOccurrences` |
| CAL-02 | Add/Edit/Cancel/Save title/day/time/location; detail includes participant, notes, reminder and repeat. Visible Save approves current revision; assistant-created draft is unsaved until confirmed. HTML 1904–1907, 1921–1931, 2133–2136, 2164–2173. | `calendarView.md`: `createOccurrence`, `changeOccurrence` route to the actual owned `calendar.md` state |
| CAL-03 | Real timezone/date intervals and duration, all-day support; Never/weekly/monthly recurrence; No/Day before/1 hour before reminder choices. HTML 1924–1928 plus legacy recurrence. | `EntryDetails`, `Recurrence`, `validDetails`, `followingAllowed`; validated calendar adapter boundary |
| CAL-04 | Delete/Keep modal; recurring one/all choice; single deletion preserves other occurrences; whole-series deletion prevents future resurrection. HTML 1931, 2174–2176. | occurrence tombstones; `calendarView.md` `requestDeletion`, `approveDeletion`, `deletionResult`, `deletedSeries`, deletion laws |
| CAL-05 | Saved reminder eligibility, explicit snooze/dismiss, no reminders after deletion, no automatic execution. Explicit user flow, legacy reminder semantics. | `calendarView.changeOccurrence` routes clock/show/snooze/dismiss to the same row scoped deletion changes; `calendar.md` reminder invariants |
| CAL-06 | Calendar bill uses owner/origin/account/unique invoice; UI occurrence ID cannot create duplicate payment attempt. Explicit user Calendar → bill-pay requirement and current TXN 01–02. | `billAvailable`, `occurrenceBill`, `billOrigin`, `billAccount`; current `calendarView.selectedOccurrence` and canonical handoff/payment registry |
| CAL-07 | Distinct recurring occurrences, new invoice/source for next cycle, prior receipt never reused. Explicit user scope/current INV 07. | `followingAllowed`, `followingIdentity`, `lawFollowingKeepsAccount`, series tombstones |
| CAL-08 | Own-calendar filtering, no duplicate row, stale upsert refused, missing/ambiguous/deleted selection safe. Current INV 01 and prototype list/detail behavior. | `calendar.md` collection helpers/laws; `calendarView.md` registry/selection invariants |

## Prototype corrections and explicit extensions

- Prototype arrays report Sent/Saved/Printed immediately. The model requires
  authenticated provider/store/printer results and represents failure or
  uncertainty. This is a required production completion, not evidence of a
  working provider integration.
- Monthly recurrence uses the original day of the month and skips months
  without that date, as `evOn` at HTML line 1894 specifies (January 31 → March
  31). It never clamps to February's last day or rolls an invalid date forward.
  Weekly recurrence preserves local weekday and wall time. Date/time ambiguity
  requires explicit validated resolution before creating an occurrence.
- The prototype's recurring “only this one” writes a `skip` array that `evOn`
  never reads and advances monthly events by 30 days. The model uses distinct
  occurrence tombstones and real calendar recurrence, preserving other dates.
- Its five-row month grid can omit dates. The specification requires every day
  of the chosen month; sample ranges and sample contacts are not domain caps.
- The Trash “30 days” copy is a provider policy example. Deletion/retention is
  driven by actual provider policy/evidence, not an unconditional timer.
- The prior model's mandatory nonempty email body was too restrictive for the
  real composer and Files sharing. Its rule now requires a valid recipient and
  exact reviewed content, including intentionally empty body/subject.
- Calendar bill handoff, unknown-send recovery, source provenance, durable
  persistence and reminder delivery extend the demonstration with explicit
  requirements; they are not portrayed as implemented JavaScript features.

## Draft completion and recovery

A mailbox keeps its owner, provider and account identity after first binding.
Its draft retirement registry is scoped to that identity, so identical draft
IDs from different accounts do not share history. `draftVersion` orders the
provider/store content, `revision` binds approval to the current local composer,
and `draftRequest` distinguishes successive storage operations even when the
content is unchanged. A storage acknowledgment must match the draft ID, pending
revision and request serial. The store must also fence delayed writes and use
the exact draft version when saving or deleting; a conflict must preserve newer
content.

Durable provider-confirmed Sent and acknowledged Discard retire that draft
version. Restoring or preserving a version at or below the recorded retirement
cutoff is rejected; a newer authenticated version can be restored through the
current account's selected Drafts result. Retirement preserves other draft IDs.
Discarding an existing draft retains its contents until deletion is acknowledged;
failure leaves the draft recoverable. A new unsaved composer with no draft ID has
no stored draft to retire.

Provider outcome and local persistence are separate facts. Verified Sent or
SendFailed remains the visible outcome if saving its evidence fails. For these
terminal outcomes, the draft and operation stay fixed while `sendResultSaved` is false, and
`persistSendResult` retries only the local write. It never sends another email.
A sent draft is retired only when that result is durable. Sending or SendUnknown
also holds the draft fixed; reconciliation must inspect the same issued operation
and cannot interpret absent confirmation as failure.

Startup hydrates durable mailbox history before `restartMailbox`; `initial` is
only for a mailbox with no history. Restart retains account binding, draft
versions, retirement cutoffs, pending storage request serials and issued send
IDs, while invalidating read callbacks and composer approval. An in-flight send,
or a known terminal result whose unsaved evidence was lost, resumes as
SendUnknown from its durable intent. A durably saved terminal result remains
known. Pending draft writes still require store reconciliation; restart neither
acknowledges them nor permits old writes to resurrect retired content.

## Message ownership and stale-selection recovery

The mailbox owns a canonical list of `emailItem` records with unique provider
message references. Owner, provider and account are already immutable at mailbox scope.
A selected message is only a reference into that registry; there is no separate live
message copy. Typed listing metadata can initialize an unseen ID or refresh settled folder/read
metadata for the same identity at the exact captured record revision, with
provider evidence and the current query generation. It increments that revision
and cannot replace a pending/unknown mutation or revive a purge tombstone.
Restart and reconnect retain this registry.

Opening an unread message requests its read flag on the same canonical record.
Selected Delete/Restore/Delete forever and toast Undo use an exact message and
revision. Delete immediately leaves the detail view and removes the pending
row, while another message remains usable. Provider acknowledgments address the
same record by identity and mutation revision, even after navigation. A move or
purge atomically clears only its affected selection, attachment authority and
bill-source authority. Reply/Forward and export guards consult the canonical
record, so a stale Inbox selection cannot act on a message already in Trash or
purged. Pending/unknown changes cannot be reissued; a fresh listing after a
verified failure makes the unchanged record available for retry.

## Boundary obligations for implementation

CalendarView owns the only live occurrence collection. Its typed occurrence
route applies Calendar's existing edit/save/reminder transitions to those same
values; components must not create separate Calendar machines for collection
rows. The selected form holds its current edit until Save or Cancel; form Back
uses Cancel. Previews read committed fields. Store imports validate the complete
child state and preserve its full identity, including bill source and invoice;
content revision alone cannot retarget an existing occurrence. Clock and
reminder changes use the owned route, not snapshot publishing, and deletion
stops the same reminder state.

The host authenticates actor roles outside parsed planner JSON. It verifies
provider identity/capabilities, selection grants, exact message and attachment
source, recipient syntax, persistence receipts, current request generations and
calendar conversions. Rendered email/PDF content is sanitized and cannot issue
commands. Secrets remain outside models/logs. `verified` and `persisted` are
admitted boundary facts, not mathematical proof of a network provider or disk.

Email-to-Files Save carries the same immutable asset ID/content reference plus
origin, account, message container and attachment source reference. File names
are display labels. The host loads the Files catalog before a source-authorized
save without switching the current app; Files commits only its matching current
generation. Files-to-Email Share passes the same owner and asset to an editable
draft and cannot send. Provider reads require current access; saved local files
can be used offline.

Implementation-stage journeys must exercise Home → each app, folder/search →
message → photo/PDF → Save/Print/Forward, compose/recipient/attachment → Back →
Drafts → restore → Send → provider outcome plus local save failure/retry,
restart → unknown → reconciliation, stale/newer draft-version restoration, and
Delete/Undo/Restore/Delete forever. Calendar journeys must cover Week/Month/Today, create/edit/
cancel/save/error, one/all deletion across month and DST boundaries, skipped
short months for monthly recurrence (including leap years), ambiguous/invalid
local-time resolution, reminders, and Calendar bill → canonical browser/payment
flow → current calendar result.
Pure models do not establish UI pixel fidelity, provider compatibility, durable
storage, printer behavior, accessibility or target-user acceptance.

## Verification evidence and limits

The isolated proof runs below completed on November 13, 2026 using the exported
Vibestack proof tooling and the repository's proof library. Each has zero
unproved obligations, zero exhausted obligations and zero errors. These local
temporary result files record the exact proof output; they are run artifacts,
not source files or a replacement for the combined project check.

| Model | Proved obligations | Local result artifact |
|---|---:|---|
| Email before canonical message ownership integration | 745/745 | `/tmp/grace-repeat-proof-i7CCqd/app__email.ts.json` |
| Email item lifecycle before metadata refresh | 44/44 | `/tmp/grace-expanded-proof-1DmEed/app__emailItem.ts.json` |
| Calendar occurrence, prior ownership snapshot | 171/171 | `/tmp/grace-expanded-proof-z8kF2L/app__calendar.ts.json` |
| Calendar view and series deletion, prior ownership snapshot | 66/66 | `/tmp/grace-expanded-proof-TuBP3B/app__calendarView.ts.json` |

The recorded earlier Email proof includes scoped draft retirement, known terminal
outcomes whose evidence is unsaved, and restart recovery. Canonical per-message
ownership, joined mutations and item metadata refresh require fresh proofs; their results are pending. Calendar's missing-day and local-time policies
are explicit implementation requirements at the validated calendar-conversion
boundary; the proofs do not implement Gregorian date or timezone conversion.

At this evidence snapshot the combined `pnpm check` is still in progress.
Isolated proofs do not establish combined simulation and reachability coverage,
conformance, generated integration/build success or user acceptance. The final
project validation report must record that check separately; `pnpm accept`
remains the user's sign-off step.
