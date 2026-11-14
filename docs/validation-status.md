# Specification validation status

The current specification passed **4,316 individual proof obligations**
across 20 Grace domain units and the retained template scaffold.
The Workspace sampling update preserves the generated runtime and proof unit
byte for byte. The combined model check and larger profile remain pending.

## Scope and review

The work covers requirements, specification, reusable formal models and their
proofs. It does not migrate the old application implementation or deliver a
working provider/device integration. Research reviewed the replacement
`prototype/Grace Prototype.html`, current PRD, legacy requirements and all 32
legacy Quint inputs. The [coverage map](requirements-coverage.md), migration
inventory and [model review](model-review.md) record the scope and decisions.

The user explicitly approved “Hey Grace” wake behavior after the earlier PRD
excluded background wake listening. The current models include that approved
behavior, with generation-bound silence timers, explicit microphone and wake
permissions, interruption of previous work, and no payment authority derived
from the wake phrase. Generic website and canonical bill identity requirements
replace the prototype's single-provider fixtures.

## Individual proof evidence

These are local proof result artifacts, not CI or release receipts. `/tmp`
paths are exact inspection locations from this validation session and may be
removed by the operating system. Earlier counts elsewhere in research notes
describe earlier snapshots; the selected results below supersede them.

| Unit | Proved obligations | Exact result artifact |
|---|---:|---|
| Conversation | 201/201 | `/tmp/grace-wake-proof/app__conversation.ts.result.json` |
| Assistant | 317/317 | `/tmp/grace-guidance-final-proof-XomBfx/app__assistant.ts.json` |
| Payment | 354/354 | `/tmp/grace-payment-proof-2-0y6dup/result.json` |
| Bill preparation | 75/75 | `/tmp/grace-billpay-current-proof/app__billpay.ts.result.json` |
| Browser | 118/118 | `/tmp/grace-browser-proof-3/result.json` |
| Browser controls | 2/2 | `/tmp/grace-browser-controls-modular-proof/result.json` |
| Calendar occurrence | 173/173 | `/tmp/grace-calendar-retry-checked-uGltq8/app__calendar.ts.result.json` |
| Calendar view and series | 208/208 | `/tmp/grace-calendar-home-proof-5MwT6g/result.json` |
| Files | 192/192 | `/tmp/grace-files-final-feedback/app__files.ts.result.json` |
| Email message lifecycle | 54/54 | `/tmp/grace-repeat-proof-x8JiBb/app__emailItem.ts.json` |
| Email mailbox | 905/905 | `/tmp/grace-email-bill-selection-af5941p3/result.json` |
| Website execution | 112/112 | `/tmp/grace-execution-proof-4IMCiq/app__execution.ts.json` |
| Cross-application handoffs | 66/66 | `/tmp/grace-handoff-context-proof-xDGJy5/result.json` |
| Assistant interaction dispatcher | 1/1 | `/tmp/grace-guidance-final-proof-XomBfx/app__interaction.ts.json` |
| Memory | 60/60 | `/tmp/grace-memory-proof/result.json` |
| Network | 53/53 | `/tmp/grace-system-final-proof/app__network.ts.result.json` |
| Preferences | 40/40 | `/tmp/grace-files-handproof/app__preferences.ts.result.json` |
| Application shell | 52/52 | `/tmp/grace-system-final-proof/app__shell.ts.result.json` |
| Wake | 17/17 | `/tmp/grace-wake-proof/app__wake.ts.result.json` |
| Workspace composition | 1,310/1,310 | `/tmp/grace-guidance-workspace-proof-rzEKJQ/result.json` |
| Retained template scaffold, `app.ts` | 6/6 | `/tmp/grace-repeat-proof-ebarVo/app.ts.json` |

The scaffold is the template's greeting example, not a Grace feature or a proof
of application integration. `spec/index.md` and `spec/app/product.md` contain
definitions only and add no proof obligations.

The Email result includes canonical message ownership, atomic attachment
manifests, draft preservation, stale-picker rejection and uncertain-send
recovery. Calendar includes owned edits/reminders, coordinated series saves,
and Close retaining submitted save/deletion targets. Handoffs includes atomic
photo-to-draft transfer preserving all seven Files and all 23 Email invariants.
Workspace includes the actual child states, canonical payment registry,
conversation/browser control routes, wake lifecycle and interruption fences.

## Source alignment

At checkpoint `887d411`, the CLI model cache was read without changing it, and all 23 generated
model TypeScript files were regenerated in memory. They matched the current
`gen/*.ts` files byte for byte. The resulting proof units are at
`/tmp/grace-cli-header-audit/units.json`.

The selected 21 proof snapshots were compared against those CLI proof units,
including their imported declarations and contract clauses. The comparison
found no added, missing or changed declarations after normalizing declaration
order, generated local-variable names, pure invariant-conjunction order and
the order of distinct event-tag branches. This is semantic source alignment,
not a claim that the older emitted files are byte-identical. The comparison
record is `/tmp/grace-evidence-equivalence.json`; the read-only comparison
procedure is `/tmp/grace-evidence-equivalence.mts`. Email also has a dedicated
source/hash and unchanged-proof-body receipt at
`/tmp/grace-email-current-proof-N7bbTr/current-equivalence.json`.

CLI-generated proof-header order differed from the earlier in-memory snapshots
in Email, CalendarView, Handoffs and Workspace. Those headers were refreshed
without changing their clause sets or proof bodies. All nine sidecars now match
the actual CLI headers: `/tmp/grace-cli-header-audit/current-headers.json`.
The combined check still needs to verify the complete current emitted output;
source comparison and header alignment do not replace that check.

## Validation target and completed commands

Concurrent application work began in the original checkout after the model
checkpoint was pushed. Validation uses an isolated checkout of `develop`.
The concurrent application changes belong to the following implementation
phase.

The isolated baseline passed these commands:

| Command | Result | Log |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed, including prepare/build and generation | `/tmp/grace-isolated-install.log` |
| `pnpm test` | 34 tests passed | `/tmp/grace-isolated-root-tests.log` |
| `pnpm -C apps/app test` | 3 tests passed | `/tmp/grace-isolated-app-tests.log` |
| `pnpm -C apps/app test:browser` | 1 Chromium journey passed | `/tmp/grace-isolated-browser-tests.log` |
| `pnpm -C apps/app build` | Passed | `/tmp/grace-isolated-app-build.log` |
| `pnpm build` | Passed, six tasks successful | `/tmp/grace-isolated-root-build.log` |

At `22a5c3d`, `pnpm gen`, root TypeScript, app VibeLang type checking, the
three app unit tests, the Chromium journey and the app build passed. The
template's conformance driver passed its journey, five malformed inputs and
1,000 walks with seed 1. The root suite passed 33 tests and timed out in the
generated-test fixture at its 120-second limit. That fixture timed out again
when retried on its own. The root build initially waited for the active check's generation lock. It
then passed all six tasks on the Workspace sampling checkpoint. The log is
`/tmp/grace-current-root-build-after-check.log`. The root suite retry passed all
34 tests, including the generated-test fixture, in
`/tmp/grace-current-root-tests-after-check.log`. The next combined run started
after that retry and is recorded in `/tmp/grace-isolated-check-6.log`. These
tests exercise the retained template and tooling. Grace's provider and device
journeys belong to the implementation phase.

A separate guarded model trace exercised Calendar bill selection, browser
evidence, approval, durable payment results and Calendar updates across 61
transitions and 13 rejection checks. Two unrelated origins and accounts used
the same invoice number and retained separate records and receipts. The
spoken route emitted one current Pay command; observing the person's website
tap emitted none. The record is `/tmp/grace-calendar-payment-witness.json`.

The specification checkpoint `22a5c3d` is merged and pushed to `develop`.
The original checkout was fast-forwarded after checking that its concurrent
application edits did not overlap the incoming files. Those edits remain in
progress. Validation continues in the isolated checkout.

The [GitHub CI run for the Workspace sampling checkpoint](https://github.com/gracefultechnology/grace-new/actions/runs/43570162711)
ended before any job steps ran. Its annotation reports failed account payments
or a spending-limit restriction. Hosted CI needs the account billing issue
resolved before it can supply a verification result.

## Simulation input coverage

The sample domains include two-photo and photo/PDF Email manifests, complete
two-occurrence Calendar series schedules, and Workspace payment failure/return
paths followed by a later retry. Guarded reducer walks checked these paths and
wake timers against the generated invariants. The runtime TypeScript and proof
units remained identical after these sample additions.

The execution sampler uses representative task/owner identities, bounded
counter examples and progress weights of 10. All callback records, both
website origins, operation kinds and caller roles remain represented. Wrong
identities, stale reports, private input and missing redaction remain in the
examples. The selected trial passed a 2,500-trace safety shard and both retry
goals under the normal and nightly seeds. Evidence is recorded at
`/tmp/grace-execution-total-iU3HJT/summary.json` and
`/tmp/grace-execution-final-equivalence-hCqVcM/result.json`.

Assistant guidance publication, dismissal and restoration have sampling
weights of 10. Both guidance goals were reached under the normal and nightly
seeds with unchanged runtime and proof text. The trial record is
`/tmp/grace-guidance-sampling-N98qrA/summary.json`; it establishes those paths,
while the complete safety and replay checks remain part of the combined run.

## Current Calendar and Workspace follow-up

The Workspace sampler now includes compatible observation, verification and
completion reports for the second origin already present in task requests.
Its 11-event directed trace completed and rejected the first origin's
observation and endpoint. Generation preserved Workspace's runtime TypeScript
and proof unit byte for byte. The earlier combined run is still evaluating
the preceding sampler.

Calendar's failed-save transition now retires the approved revision without
changing the draft or committed entry. Generated traces reproduced the old
callback collision in single and recurring saves. With the fix, both routes
reject success and failure callbacks from the previous attempt, accept the new
revision's result and preserve the invariants. The hidden-failure/reopen path
also passed. The exact updated Calendar and CalendarView units passed 173
and 189 obligations respectively. The proof results are in
`/tmp/grace-calendar-retry-checked-uGltq8`. Handoffs also passed 60 obligations
against the initial retry-fence trial and again against the final Calendar and
CalendarView definitions after the appointment confirmation update.

Calendar now accepts an exact, current appointment confirmation while the
person stays on Home or in another app. Existing Calendar state owns the
approved draft and its storage result. The adapter authenticates consent
from the currently shown question. Both Home and already-open Calendar
paths passed directed Quint and matched generated TypeScript state by
state. The tests also reject changed details, the wrong actor and replayed
approval. See `/tmp/grace-calendar-home-directed.log` and
`/tmp/grace-calendar-home-replay.log`. The updated CalendarView unit passed
all 208 obligations in `/tmp/grace-calendar-home-proof-5MwT6g/result.json`.
The new proof establishes that confirmation preserves the Calendar invariants,
keeps the current view, consumes one approval and leaves an unsaved approved
row for the durable write. The combined run for this source is queued behind
the active run.

## Email confirmation and cross-source payment

A guarded trace showed that an earlier Email confirmation could accept a
replacement candidate for the same message. The confirmation now carries
the exact displayed mailbox/message identity, read generation and canonical
bill identity. The current Email unit proved all 905 obligations, including
refusal of any mismatched selection and preservation of the reviewed identity.
The sidecar proof bodies did not change.
Four directed Quint traces covered valid read generations 3, 4 and 5 and
a replacement candidate. All 43 guarded transitions agreed with generated
TypeScript. See `/tmp/grace-email-bill-selection-af5941p3/directed-replay.json`.

A 77-transition directed trace checked Email confirmation, canonical
handoff, two unrelated provider origins and accounts, voice and manual
payment routes and matching durable receipts. It passed 23 refusal checks,
including the replaced Email candidate, stale read generation, wrong mailbox,
wrong provider account, duplicate submission and receipt display for the
wrong bill. Email and Calendar independently resolved the same bill and
showed the same receipt. The two providers reused an invoice number but
retained distinct records. See
`/tmp/grace-email-selection-shared-bill-witness.json`.

Clean snapshot generation, root TypeScript and app VibeLang type checking
passed. The retained scaffold passed 34 root tests, three app unit tests
and one Chromium test. After the design-system task generated the CSS package
exports, the app build passed. The root build passed all six tasks on the
Email checkpoint.

## Current bill-handoff navigation

Guarded traces reproduced delayed navigation after Calendar Close, Back and
deletion, and after leaving or trashing the selected Email. The registry now
stores the opening's exact source and device context. Storage returns a
resolved candidate for that request. The host must independently project the
live source and consume the candidate by committing Browser navigation in the
same update. Cancellation preserves the canonical mapping and payment evidence.

The updated whole-tree generation and both type checks passed. Dafny proved
all 66 Handoff obligations. Its sidecar proves that an admitted lookup carries
the captured request, retains a unique canonical mapping and supplies a
candidate usable in the unchanged context. The new positive proof uses the
existing list-fold append lemma. A 1,000-trace Quint safety shard found no
violation; one directed Quint trace matched seven generated TypeScript states.
A directed
cross-source payment trace passed 88 transitions and 37 refusal checks,
including the same raw message ID in two mailboxes, Calendar Back/reselect,
and a ticket replay after the Browser visit. Both provider origins kept their
separate durable outcomes. An independent set of 17 directed checks covers
Calendar Close/reopen, deletion, Email Trash, cancellation before or after
resolution and a Browser visit when Browser is already selected. See
`/tmp/grace-handoff-context-shared-bill-witness.json` and
`/tmp/grace-handoff-context-witness.json`.

## Verified account identity

The website observation carries a verified, opaque account reference. A
guarded witness showed that the old match flag let two accounts under the
same origin attach to one observation. The changed Workspace accepts a bill
only when the current observed account matches its canonical key. The same
predicate governs payment review, submission and provider outcome reports.
The account switch invalidates old approval and retains the durable attempt.

The updated build from the model tree passed generation, root TypeScript and
app VibeLang type checking. The two-origin cross-source trace still completed
88 transitions and 39 refusals, including a same-origin different account
on each route. A separate 58-transition, 22-refusal trace changed the
authenticated account on the same page and revisited it after Resume. It
rejected old-account review, outcome and submission even with new page
tokens, retained the uncertain journal, and attached the new account only
after an explicit new task. See
`/tmp/grace-account-bound-shared-bill-witness.json` and
`/tmp/grace-account-bound-diagnostic.json`.

Two additional simulation reports represent ordinary progress and a
manual-wait verification for the second sampled task. They preserve the
generated runtime. A direct Quint path passed all six guard admissions
missed by the preceding combined run in 33 guarded transitions. It
included the second task's page progress and Continue, then a new task's
payment submit, result, save and fresh-review retry. The generated
TypeScript followed the same states. These are directed witnesses.
See `/tmp/grace-check7-account-guards-quint-run.log` and
`/tmp/grace-check7-account-guards.json`.

Email's representative records now include complete photo and PDF manifests
at two later read generations and Drafts listing callbacks for later
requests with empty or typed queries. The previous run reached those body
read and listing states without matching rich manifests or metadata samples.
Five guarded continuations from its retained traces passed using only
declared sample values, including photo paging, Back and restoring drafts.
The generated Email runtime and complete proof unit remained byte-identical.
See `/tmp/grace-email-late-manifest-Duh2Yn/frontier-replay.json`.

## Preparation and payment review handoff

The stateless conversion carries the exact verified preparation choice and
evidence into Workspace using the captured device, browser, task, payment
revision and attempt. It validates both current owners. The host must consume
the conversion and dispatch the existing Workspace review in one synchronous
update. The separate revision counters reflect each owner's lifecycle.

The conversion generated and compiled, and Dafny proved all three laws.
A directed trace checked 23 guarded owner transitions, a successful
preparation at version 4 entering payment revision 0, and 20 refusals for
stale context or changed choice, source and account. The review consumes the
payment revision so the original conversion cannot be submitted twice.
See `/tmp/grace-preparation-review-joxWTJ/proof-result.json` and
`/tmp/grace-preparation-review-joxWTJ/probe-results.json`.

## Current combined validation

The combined `pnpm check` at `8d41fd0` finished with an unsuccessful verdict.
All 23 model declarations compiled. Handoffs passed 12,000 safety traces,
all four named goals, all five guard admissions and refusals, and 404
TypeScript replays. Email passed the same safety budget, all 17 goals and
the generated TypeScript replay. The bounded search did not witness four
admissions: Undo Trash, Restore Draft, Back to Message and Move Photo.

Workspace's Keep Task reachability search wrote a complete valid witness.
Quint's piped output ended during its state printout, before the marker used
by the check. Repeating the exact search with Quint's supported verbosity
option produced the marker and an identical 40-step witness. Independent replay of 425 Workspace traces and 9,053 steps
found no model violation, saw all 16 goal predicates true somewhere and
recorded 48 of 54 guard admissions. The dedicated spoken approval search
and six independent guard searches still need passing receipts. The current
normal result skipped its downstream types, proofs, tests and conformance
stages. The independent results above remain the evidence for those checks.
The frozen source, generated artifacts, traces and replay are recorded in
`/tmp/grace-check7-recovery-04R4vs/replay-report.json`.
The combined log is `/tmp/grace-isolated-check-7.log`.

[Hosted CI for this commit](https://github.com/gracefultechnology/grace-new/actions/runs/43578198572)
ran zero steps. GitHub reported a billing or spending-limit restriction.

## Prior simulation runs

The combined run for `22a5c3d` parsed all 23 modules and recorded 19 passing
simulation and replay receipts. Email's Undo Trash guard search reached the
one-hour tool timeout. Workspace saved a valid guidance-dismissal witness, but
the CLI output lacked the result marker that Vibestack recognizes. The check
therefore did not reach its types, proof, tests or conformance stages. The run
is recorded in `/tmp/grace-isolated-check-5.log`.

A one-step Quint reproduction confirmed the output problem. At default
verbosity, the CLI returned exit 1 and wrote the complete ITF witness, but
its piped console output ended before the result marker. The same command
with Quint's `--verbosity=1` kept the marker and the complete witness. An
out-of-bounds expression still reported a runtime error. That error's ITF
file also carried the `violation` label, so the ITF label by itself cannot
identify a successful reachability search. The reproduction and its results
are at `/tmp/grace-quint-results.dir` and `/tmp/grace-quint-results.log`.
The Email profile uses one coherent mailbox, five metadata records and eight
read receipts. Listing samples include Trash and Drafts requests issued at
generations two through four, with the matching draft restore generations.
Direct guarded paths confirmed permanent deletion and durable draft retirement
using the added samples. The explicit domain audit of the original focused profile
still reaches all 33 transitions and 17 goals, observes all 33 guards refusing,
and checks 17 stale/identity/approval cases. Direct PDF opening and multiple
mailbox/message cases remain explicit witness and universal-proof coverage.
The exact omissions and audit artifacts are listed in
`/tmp/grace-email-fallback-report.md`. The final pipeline must measure this
profile before it can count as successful random simulation. The run has reached
all 17 Email goals. An independent replay of 418 saved Quint traces and 8,268
steps agreed with generated TypeScript, including all 33 guard refusals and 27
guard admissions. The additional random witness admitted Forward message.
Directed Quint paths exercised all seven guards that were originally pending
and matched the generated TypeScript through 64 transitions. See
`/tmp/grace-email-directed-quint.log` and `/tmp/grace-email-directed-replay.log`.
Six admissions remained without a passing standard-run receipt.

A 2,500-trace comparison tested reducing Email's read weight from eight to
four. Both runs preserved all invariants. The candidate reached Undo Trash
once, while neither reached Restore draft or Forward attachment. The
candidate also reached the attachment goal one fewer time. These mixed
results do not establish an improvement for the full profile. The model
and sampler remain at their existing settings. Logs are
`/tmp/grace-email-weight-baseline.log` and `/tmp/grace-email-weight-trial.log`.

The updated Workspace unit has 1,310 obligations. Its first proof attempt
exhausted resources on `changeLifecycle_ensures` and `changePage_ensures`;
the automatic isolated retry reached its 60-minute subprocess limit. The
current sidecar adds smaller invariant steps for closing a quiet workspace
and changing only keyboard ownership. The page-change lemma then passed on
the first pass and the lifecycle lemma passed on the automatic isolated retry.
The CalendarView sampler gives the deletion question, Keep and approval equal
weights of five. Workspace gives guidance publication a weight of twelve.
These weights only affect exploration.

A direct TypeScript check exposed a widened keyboard type in the generated
wake window. The spec now constructs that window through a function with an
explicit Assistant return type. The regenerated Workspace module passes strict
TypeScript checking, and guarded traces still reach all 54 transitions and 16
goals. The Workspace unit for this source proved all 1,310 obligations. The
isolated retry verified 655 assertion batches after the first pass exhausted
resources on the lifecycle lemma. The 21 selected proof results and their
current specification tree are recorded in
`/tmp/grace-current-4288-evidence-confirmation.json`.

Workspace exploration now tries ordinary preparation and repeated Talk less
often. Ordinary preparation invalidates the payment review, while repeated Talk
advances its speech token. The lower weights give the existing review, readback
and approval sequence more chances to complete within the sampled walks. The
second-origin replacement now has a matching request in the finite domain.
Previously, the harness could request that replacement but had no matching
confirmation input. Visit returns to its default weight after earlier traces
showed that repeated navigation advanced device versions before matching
callbacks could arrive. All four actors and all other existing input examples
remain available. The scratch build at `/tmp/grace-workspace-next-WvoVXq`
reproduced the current runtime and Workspace proof unit exactly. The matching
generated harness has sampled input choices for all 54 guarded transitions.
Four directed Quint traces exercised ordinary goal completion, spoken approval,
manual payment result persistence and task replacement. All 46 transitions
replayed against the generated TypeScript with the Workspace invariants intact.
The traces and replay log are at `/tmp/grace-workspace-next-WvoVXq` and
`/tmp/grace-workspace-directed-replay.log`. The bounded searches of 5,000 traces per goal did not reach ordinary
completion, spoken approval or payment-result completion. The full exploration
profile is still required.

Earlier combined runs were stopped as the model definitions and simulation
inputs were corrected. Their partial results cannot certify the final source.
The next complete run must check invariant simulation, reachability, TypeScript
replay, generated types, proof obligations, tests and conformance together.
The current sampling profiles focus coherent journeys, with separate negative
case audits and universal proofs covering the retained product rules.

The larger/nightly profile remains pending. No simulated-only proof acceptance
has been recorded, and `pnpm accept` has not been run. The remaining technical
work is to finish the combined check and larger profile and review the final
PRD/prototype coverage and prose/Quint agreement. Product review and
`pnpm accept` remain the user's sign-off step after technical validation.

The journeys in [implementation acceptance](implementation-acceptance.md)
cover real provider, device, visual and service boundaries when the VibeLang
shell and React interface are implemented.
