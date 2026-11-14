# Specification validation status

At checkpoint `887d411`, the 20 Grace domain units had successful individual
proof verdicts covering **4,197 obligations**. The retained template scaffold
adds six, for **4,203 obligations across 21 proof-bearing units**. Each result
listed below has zero unproved obligations, exhausted obligations and errors.
The guidance dismissal/restoration addition is undergoing fresh verification;
its affected Assistant, Interaction and Workspace results will supersede the
checkpoint results below. The complete combined model check and larger profile remain pending. The
isolated checkout has passed installation, its existing tests and both builds.
User acceptance remains a later step.

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
| Assistant | 282/282 | `/tmp/grace-assistant-current-proof/app__assistant.ts.result.json` |
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
| Assistant interaction dispatcher | 1/1 | `/tmp/grace-interaction-proof/result.json` |
| Memory | 60/60 | `/tmp/grace-memory-proof/result.json` |
| Network | 53/53 | `/tmp/grace-system-final-proof/app__network.ts.result.json` |
| Preferences | 40/40 | `/tmp/grace-files-handproof/app__preferences.ts.result.json` |
| Application shell | 52/52 | `/tmp/grace-system-final-proof/app__shell.ts.result.json` |
| Wake | 17/17 | `/tmp/grace-wake-proof/app__wake.ts.result.json` |
| Workspace composition | 1,260/1,260 | `/tmp/grace-workspace-modular-proof-8/result.json` |
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

The current CLI model cache was read without changing it, and all 23 generated
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
checkpoint was pushed. Validation continues in an isolated clone based on
`887d4119403ea1f5e513b9168dd8bc11b4ec1c44`, on branch
`codex/grace-spec-validation`. The concurrent application changes belong to
the following implementation phase.

The isolated checkpoint passed these commands:

| Command | Result | Log |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed, including prepare/build and generation | `/tmp/grace-isolated-install.log` |
| `pnpm test` | 34 tests passed | `/tmp/grace-isolated-root-tests.log` |
| `pnpm -C apps/app test` | 3 tests passed | `/tmp/grace-isolated-app-tests.log` |
| `pnpm -C apps/app test:browser` | 1 Chromium journey passed | `/tmp/grace-isolated-browser-tests.log` |
| `pnpm -C apps/app build` | Passed | `/tmp/grace-isolated-app-build.log` |
| `pnpm build` | Passed, six tasks successful | `/tmp/grace-isolated-root-build.log` |

These tests exercise the retained template and tooling. Grace's provider and
device journeys will be implemented in the next phase.

The specification checkpoint `7aa6ea1` is merged and pushed to `develop`.
The original checkout was fast-forwarded after checking that its concurrent
application edits did not overlap the incoming files. Those edits remain in
progress. Validation continues in the isolated checkout.

The [GitHub CI run for this checkpoint](https://github.com/gracefultechnology/grace-new/actions/runs/43547183011)
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

Earlier combined runs were stopped as the model definitions and simulation
inputs were corrected. Their partial results cannot certify the final source.
The next complete run must check invariant simulation, reachability, TypeScript
replay, generated types, proof obligations, tests and conformance together.
Email and Workspace sampling are being reviewed to keep that full run practical
while preserving their adversarial cases and all product rules.

The larger/nightly profile remains pending. No simulated-only proof acceptance
has been recorded, and `pnpm accept` has not been run. The remaining technical
work is to finish the combined check and larger profile and review the final
PRD/prototype coverage and prose/Quint agreement. Product review and
`pnpm accept` remain the user's sign-off step after technical validation.

The journeys in [implementation acceptance](implementation-acceptance.md)
cover real provider, device, visual and service boundaries when the VibeLang
shell and React interface are implemented.
