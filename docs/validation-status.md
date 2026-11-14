# Specification validation status

The specification at `22a5c3d` passed all **4,288 individual proof obligations**
across 20 Grace domain units and the retained template scaffold. The subsequent
Workspace sampling change preserves the generated runtime and proof unit byte
for byte. The combined model check and larger profile remain pending.

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
| Calendar occurrence | 172/172 | `/tmp/grace-expanded-proof-pVJ0jQ/app__calendar.ts.json` |
| Calendar view and series | 189/189 | `/tmp/grace-calendar-import-proof-yUUnxd/app__calendarView.ts.json` |
| Files | 192/192 | `/tmp/grace-files-final-feedback/app__files.ts.result.json` |
| Email message lifecycle | 54/54 | `/tmp/grace-repeat-proof-x8JiBb/app__emailItem.ts.json` |
| Email mailbox | 903/903 | `/tmp/grace-email-current-proof-N7bbTr/result.json` |
| Website execution | 112/112 | `/tmp/grace-execution-proof-4IMCiq/app__execution.ts.json` |
| Cross-application handoffs | 60/60 | `/tmp/grace-expanded-proof-VpSzue/app__handoffs.ts.json` |
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

## Combined validation still pending

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
