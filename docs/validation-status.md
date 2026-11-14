# Specification validation status

As of November 13, 2026, the 20 Grace domain units have successful individual
proof verdicts covering **4,197 obligations**. The retained template scaffold
adds six, for **4,203 obligations across 21 proof-bearing units**. Each result
listed below has zero unproved obligations, exhausted obligations and errors.
The current combined `pnpm check` is still running; this is not a claim that
the complete project check, larger profile, final build or user acceptance passed.

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

## Simulation input coverage

The final sample domains include two-photo and photo/PDF Email manifests,
complete two-occurrence Calendar series schedules, and Workspace payment
failure/return paths followed by a later retry. Guarded reducer walks checked
these paths and wake timers against the generated invariants. The runtime
TypeScript and proof units remained identical after these sample additions.

Website-execution exploration gives the five existing progress actions a
weight of 100 while retaining every original input domain. In an isolated copy
of the actual CLI harness, the normal profile reached the retry-stop goal in
140.2 seconds and the changed-approach goal in 98.9 seconds. Its runtime
TypeScript was unchanged. The measurement is recorded at
`/tmp/grace-execution-cli-sampling-SpSlAK/summary.json`; the combined run below
must still validate the complete current source.

## Combined validation still pending

The current run is recorded in `/tmp/grace-check-11.log`. This run starts from
the current source and the completed simulation input review. It has not yet
produced a complete success verdict. No
claim is made yet for combined simulation, reachability, replay, type checking,
proof, tests or conformance completion.

An earlier template build completed six tasks successfully, as recorded in
`/tmp/grace-build.log`. It predates later specification changes and is not a
final-source build receipt. The final larger/nightly check profile and final
build also remain pending. No simulated-only proof acceptance has been recorded,
and `pnpm accept` has not been run.

The remaining technical work is to finish the current combined check, resolve
any reported failures, run the larger profile and final build, and review the
final PRD/prototype coverage and prose/Quint agreement. Product review and
`pnpm accept` remain the user's sign-off step after technical validation.

Real provider, device, visual and service behavior remains outside these model
proofs. The journeys in [implementation acceptance](implementation-acceptance.md)
must validate those boundaries when the VibeLang shell and React interface are
implemented; this models-only phase does not claim that acceptance.
