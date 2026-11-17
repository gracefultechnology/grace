# Grace specification rebuild

This is the plan of the models-only phase, which ended on 15 November 2026.
The interface, the shell and the Android host are now being built from the
spec, and the owner's directions in the
[acceptance list](implementation-acceptance.md#owner-directions) replace the
request below: bill payment is the first kind of a general task, set-up and
one Google sign-in are in scope, speech runs through Eliza Cloud with no model
on the tablet, and no wake detector is installed (decision 5). The template's
greeter it kept as a scaffold has been removed.

## Goal and source precedence

Specify the complete email, calendar, Files, browser and calendar-launched bill-payment MVP before migrating application code. `spec/` is the executable product contract; `prototype/Grace Prototype.html` is the new visual reference. The current rebuild request takes precedence over older delivery phases, including their exclusions of email, calendar and websites other than Chase.

Source order for this rebuild:

1. The current request: Email, Calendar, Files, browser and calendar bill payment, generic website support, models only.
2. The new HTML prototype for visible layout, controls and presentation.
3. The latest requirements and dated decisions in `prototype/prd.md` for behavioral controls and recovery. This file contains historical versions as well as the November 5 MVP PRD and November 9 amendments; old and new sections must not be combined indiscriminately.
4. Legacy product vision, helper PRD, exploration plan, wireframes and formal models for requirements and reusable invariants that do not conflict with the above.

The legacy source snapshot is `gracefultechnology/grace` at `c6e3fbbc38028ccb53ce05817e06c671d9e21642`, verified against remote `main`. The legacy working checkout is a different branch and is not modified. The snapshot contains 32 Quint files, including a generated capture graph and diagnostic variants that deliberately fail. Their intended safety properties are migration inputs; their failing behavior and fixed simulation bounds are not product requirements.

The replacement prototype reviewed on November 13 has SHA-256 `968731aa2fa9454443482d38f5af2d7f4760f31694a9ef4d5ab64f843144294e` (2,401 lines). The PRD remains 2,345 lines, SHA-256 `1dec011b43682026f75525783ceb92758ef6e7ecb76c8f4ff0ae3fe62c030510`.

## Decisions established by the research

- The replacement `Grace Prototype.html` includes working prototype flows for Email, Calendar, Files and settings. These supersede the first audit of the removed bill-pay-only HTML. The models represent their navigation, editing, attachment and recovery behavior; simulated storage/provider success remains an implementation boundary. Calendar-to-bill payment remains an explicit requirement from this request, beyond the appointment demonstration.
- Use the new compact bottom Grace window and expanded conversation presentation. The historical right sidebar is superseded visually. Preserve one current instruction, readable transcript, separate website and chat input, explicit controls and continuity.
- Use one provider-neutral workflow driven by verified origin, account, page facts and current semantic targets. Chase, example people, amounts, dates, selectors and fixed page sequences are sample data, never guards or routing keys.
- Both user website submission and explicit voice-authorized submission are required by the latest PRD. A current read-back, exact proposal binding, one-use approval and durable unresolved-attempt record are mandatory.
- Missing confirmation is uncertainty, never verified failure. Pending or unknown submissions block a new attempt. Scheduled and accepted results are distinguished from completed settlement. Later verified returns/reversals replace historical positive status while retaining the attempt and requiring durable evidence plus a new user decision before retry.
- Resume observes the current site and account before continuing; it never replays a saved click queue. Stop, corrections, navigation and changes to remembered facts invalidate stale work.
- Sleep and ordinary departures retain a paused session. Crash/Restart follows ANDROID 09 and the prototype reset at lines 1765–1767: clear the active assistance task, transient chat/draft/guidance and browser page session, advancing callback versions. Confirmed preferences, personal memory, saved application data and canonical payment evidence retain their separate lifecycles. A new request must reobserve before using an existing bill record; restart is never permission to resubmit.
- The user's November 13 decision included the prototype's enabled-by-default “Hey Grace” feature, including wake from sleep. The later direction of no models on the tablet overrides it for the MVP: the wake rules stay and no detector is installed. Native local wake detection is separate from conversation recording. A current human phrase starts listening, pauses old website work and grants no transaction authority. Opening Grace, typed exchanges, touch wake and navigation do not automatically activate conversation capture. Private passwords, verification codes and payment credentials are not model state or stored personal facts.
- Wake is not device authentication. The native host must retain the lock screen and withhold an admitted wake/ready report until OS authentication permits the application. A locked-device wake may illuminate the native lock screen without exposing Grace, file previews or a task.

## Implementation sequence

1. **Research and traceability.** Inventory every current requirement, prototype interaction and legacy model. Record retained, generalized, superseded and deferred behavior with source locations. Distinguish runtime obligations from facts a state model can establish.
2. **Domain contracts.** Add small literate Quint modules under `spec/app/`, grouped by lifecycle: shell, browser, assistant/voice, approved memory, email, calendar, Files, provider-neutral bill payment and cross-surface handoffs. Keep one owner for each state; use derived projections instead of mirrored status flags.
3. **Formalize failure paths.** Add guards, inductive invariants, step properties, reachability goals and representative input domains. Cover stale observations, mismatched identities, privacy gates, interrupted/reordered callbacks, persistent attempt uncertainty, retry approval and durable deletion. Simulation domains constrain exploration only, not production behavior.
4. **Generate and verify.** Install the pinned Node 26/pnpm toolchain; run the unmodified `pnpm check` pipeline. Repair models and supply honest Dafny proofs where needed. Never edit generated files, the review ledger or tool behavior to satisfy a check. Re-run with the larger profile after normal checks pass.
5. **Independent review.** Compare the resulting requirements and every important flow against the PRD, source inventory and prototype a second time. Check for omitted states, redundant state, unreachable events, permissive guards and outcome/approval inconsistencies. Close findings before the final validation run.
6. **Handoff.** Publish the coverage and verification results, remaining design/runtime acceptance work and exact commands for the next implementation phase. Leave the review ledger for the user's `pnpm accept`; accepting simulated-only obligations is not part of this task.

## Validation and acceptance boundary

The target is passing model, invariant simulation, event/goal reachability, TypeScript replay, generated types and Dafny proof stages for every Grace module. This phase adds no tests that merely reassert generated transitions; those are checked by the formal pipeline. Runtime journeys and drivers must be added when the VibeLang shell, React UI and real services are implemented.

Static requirements and formal proof cannot certify that Chromium observes arbitrary websites correctly, that a provider accepts a payment, that a visual layout works on hardware, or that a senior completes a task independently. The specification must define those interfaces and acceptance exercises explicitly without presenting model evidence as runtime evidence.

Only review items may remain after verification. The user reviews the product rules and runs `pnpm accept`. Neither acceptance nor financial/provider actions are run as part of this specification rebuild.
