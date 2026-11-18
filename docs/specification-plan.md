# Grace specification rebuild

Up to [Guided tasks across applications](#guided-tasks-across-applications),
this is the plan of the models-only phase, which ended on 15 November 2026;
that section and its qualification of 17 November are current. The interface, the shell and the Android host are now being built from the
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

The replacement prototype reviewed on November 13 has SHA-256 `968731aa2fa9454443482d38f5af2d7f4760f31694a9ef4d5ab64f843144294e` (2,401 lines); commit `7007516` replaced it with the updated prototype on November 16. The PRD remains 2,345 lines, SHA-256 `1dec011b43682026f75525783ceb92758ef6e7ecb76c8f4ff0ae3fe62c030510`.

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

## Guided tasks across applications

The prototype gives Grace one visible instruction, a pause control and a way to show what Margaret has already done. Its `buildSteps` implementation chooses controls for its simulated Chase screens. Use those screens to review interaction design. Derive runnable controls from the current app or website. [Prototype](../prototype/Grace%20Prototype.html)

On the legacy host, goal interpretation preserves the whole request as requirements, constraints and context. The website planner proposes one next action from observed controls. Its separate evidence review checks quotations, while the task runtime owns consent, the account, recovery and durable results. The rebuild's assistant already owns the goal, operation, checkpoint and work version. The workspace originally required every unfinished task to have a website controller. The guided plan adds ordered app outcomes there and uses the existing pause and version checks. A plan can start in Email with the browser idle. [Legacy goal contract](https://github.com/gracefultechnology/grace/blob/f7a80526c6cf8d8ee5500b7e9d0f188e24defbe2/apps/app/shared/website-goal-contract.ts) · [Legacy planner](https://github.com/gracefultechnology/grace/blob/f7a80526c6cf8d8ee5500b7e9d0f188e24defbe2/apps/app/host/website-planner.ts) · [Workspace](../spec/app/workspace.md)

| Work to qualify | Implementation and acceptance |
|---|---|
| Review and present a task | A person starts a plan with a goal, owner and ordered outcomes. Each outcome names the surface, subject and expected result. Show the current instruction compactly and the sequence in expanded Grace. Retain progress across an app switch, pause and explicit Resume. |
| Connect the planner | Let the planner propose a plan from the original request, keeping prohibitions and unresolved choices. Preview it before accepting it as a person event. Replanning must preserve verified results, invalidate outstanding callbacks and require fresh review when scope changes. Apply the same rule to requests initiated by voice, typing and a selected message. |
| Bind provider evidence | Each adapter must resolve its subject under the active account, observe the expected result and supply an opaque receipt for the current task and context. Bind a later step to its source by provider resource ID and revision. Two distinct messages or pages can share a subject or title. Qualify both those collisions and a repeated read of the same source, plus a switched account and a stale response. A host-labelled synthetic observation exercises the model contract only. |
| Guide website actions | Rebuild a table of supported operations and visible controls for each document. Preserve disabled, selected, expanded and private-input state. Refresh after user input, tab changes and navigation. Offer manual help if no suitable control is visible. The actuator validates the current target immediately before acting. |
| Route hosted decisions | Keep Clef on Workers AI behind the upstream Eliza Cloud Decisions API. The product client can rank visible candidates and raise a suggestion to ask. Keep credentials, consent, final commits and receipt verification in their current owners. Record model, result and unavailable cases for qualification. Authenticate the same interface in the future Grace cloud. |
| Qualify billing environments | Pin BillWorld and the private grader. Run a no-action negative control. Sample at least 100 distinct Fleet billers across observed, documented and inferred families. Report changed-page navigation, authenticated reads, and each graded payment workflow separately. Cover sign-in handoff, fees, scheduled/declined outcomes, duplicate protection, blocked portals and restart in the hand-built sites. Keep fixture setup, simulated-person actions and every failed attempt visible. |
| Establish the WebArena baseline | Pin the official task file, seed and evaluator. Keep evaluator answers outside inference. Start with a read-only single-site task with a deterministic URL or answer, record actual browser commands and score the final state. Expand to state-changing, multi-tab and cross-site tasks with independent reset and programmatic grading. Publish the attempted IDs and denominator for every run. |
| Exercise Google in CI | Run OAuth consent, state, token exchange, Gmail and Calendar over local boundaries. Use seeded and resettable provider state. Walk message → reviewed link → observed venue → saved calendar event. Repeat with denied consent, wrong account, lost save response, duplicate callback and recurrence edits. Identify controlled bridges and every action the simulated person performs. |
| Qualify the integrated product | Replay these journeys through the rebuild's actual adapters, their permission checks, and the installed browser. Verify a signed-in staging decision through the selected cloud, redacted receipts and no repeated side effect after restart. Record hosted CI, device acceptance and any unimplemented connector separately. |

The reference implementations suggest three parts of the browser design. Jev constructs a new indexed action space at each observation. Agent Quick Browse leaves subgoals with the planner and can use Clef to select controls. The Reddit author's three manually initiated examples illustrate where richer toggle and tab state is needed. Cloudflare's hosted model scores a supplied decision schema. These sources do not measure Grace's task completion. [Jev Ultrafast](https://github.com/browser-use/jev-ultrafast) · [Agent Quick Browse](https://github.com/zachsents/agent-quick-browse) · [Clef demonstration](https://www.reddit.com/r/AI_Agents/comments/1x3ca4w/web_browsing_was_implemented_using_only_the/) · [Cloudflare Clef](https://blog.cloudflare.com/clef-decision-models)

The billpay research catalog supplies biller identities, categories and varying levels of evidence about their portals. BillWorld's Fleet renders those identities with shared templates and a simulated account engine. The separate hand-built environments and their released tasks have their own coverage. Westvale is a small public smoke site. Use each environment's own grader and report the observations that qualified a pass. [Billpay research](https://github.com/gracefultechnology/billpay-research) · [BillWorld](https://github.com/gracefultechnology/billworld) · [Westvale Electric](https://westvaleelectric.com/) · [WebArena setup and evaluation](https://github.com/web-arena-x/webarena#end-to-end-evaluation)

The pinned BillWorld release provides 142 authored Infinity tasks across 17 hand-built sites. The published Fleet cohort manifest identifies 100 distinct billers across 26 portal templates. For public support navigation, require a real browser interaction and a new visible document at the environment's expected destination. For balance lookup, require the private grader to accept both the amount owed on the statement and its due date. A seeded signed-in account is a separate precondition. Archive the original cohort, attempt counts and provider-rate-limit responses before running any retries. Publish route-based rescoring as a separate evaluation of the original observations. [Pinned Infinity mapping](https://github.com/gracefultechnology/billworld/blob/44e6fa006cffb1f7829797da2d6d6ee707f996c5/billworld/infinity/app/harness.py)

The connector integration is on `develop`. The account registry owns account identity, each mailbox and calendar owns its provider state, and the appointment proposal owns the separate approval. The guided plan retains the original request and constraints, ordered outcomes, current task version and verified receipts. A read checks the open message, browser document or selected calendar occurrence. The ordered receipts keep a local identifier for the observed resource and separate text for the person. Distinct mailbox messages can share a subject. Reloading the same resource cannot satisfy another selected-item check. An app switch and Resume retain the current plan. A device restart clears the session plan. Durable recovery of a multi-app plan needs an owner-bound checkpoint and fresh provider reconciliation. A saved appointment also needs the reviewed source message, exact approval, provider occurrence identity and a fresh provider read. Plan review, an app switch and Resume each have distinct effects. Files, multi-tab workflows and other provider writes still need their own outcome adapters and independent acceptance cases.

The cross-app read journey checks a named browser page, two clinic messages with the same subject, and an existing calendar occurrence. Rereading the first message leaves the second message step open. The write journey starts with a browser read, checks the selected clinic email, and asks the person to approve saving the appointment. Its calendar provider must contain no new appointment during review, one in the intended account after approval, and none in the second account. A separate journey starts with interactive Google consent and reads the saved event through the Calendar API. The hosted planner has also proposed a library invitation workflow. Reading a venue from its website and carrying the room into a saved event remains a qualification case.

### Grace-new qualification, November 17

The Grace-new Eliza SDK authenticated to the upstream staging Decisions API using a dedicated evaluation principal created by normal wallet sign-in. Hosted clef-flash chose “Opening hours” over “Make a payment.” A separate Cloudflare Worker with the pinned upstream provider and a Workers AI binding produced the same choice and rejected an unsigned request with HTTP 401. The temporary Worker was then removed. The staging origin and test key are configured in Grace-new Actions. Grace now sends the model selected by its agent policy when it requests streamed chat. After a $5 Stripe Sandbox credit settled in staging, qwen-3.8-27b returned a reviewed Email → Browser → Calendar plan with the requested step order. The browser qualification records whether a fixture or upstream chat supplied the plan. Its hosted Clef call selects among links actually observed in Chromium.

The released BillWorld statement test exercised `task_md9` on Malden. A simulated person signed in and opened the statement. Grace read the amount and due date through its native document adapter, and the original private grader accepted all six checks. The no-action control failed the required view and both answer checks. Fleet is a separate 100-biller qualification for finding a public help index across portal families. Each biller needs a visible destination and a completed Grace step. Testing 100 such billers provides one navigation task per site. The remaining released workflows, including payment, each require a matching grader and receipt.

On Linux, revisions `c787577` and `0f2cebd` each passed all 100 Fleet billers in a fresh run. The preceding revision `8b5008c` passed 92. Four health-care portals exposed ambiguous link descriptions and four municipal portals exposed guides aimed at partially clipped copies of a link. Both successful runs used a fixed chat plan, hosted Clef, and trusted Chromium mouse input. The host granted each step credit only after navigation to the expected visible destination. The two compressed receipt archives have SHA-256 digests `8356fec0b3b9b1b4a2495ac2218a4b86092d7db8f9fd89a53808c0bfb818f1ac` and `19711af3c51ccbcf6407ea63ab0826c26854b25edb8a8563e6d7ee887340ad68`, respectively.

Revision `0f2cebd` scored 1 on official Shopping task 260 and 0 on held-out task 261 with the same fixture planner. On 261 the visible guide led to the Electronics category, a real intermediate page. Grace completed its changed-page check while the requested Headphones destination remained outstanding. The named-destination capability keeps the reviewed target in the plan. Its check compares the current native document’s identity and visible words with that target. Intermediate pages leave the step open for further person-guided navigation.

On revision `aa72a2c`, Fleet again passed 100 of 100 and Shopping task 260 scored 1. On task 261 the live chat planner proposed the correct Headphones destination. The new check kept both an intermediate category and an individual product pending. The upstream grader scored 0. A subsequent observation of the seeded storefront showed how a person could reveal the category link. Opening the visible Electronics menu exposed the Headphones item on the same document. The browser guide can now ask for that action and read the visible choices again.

Revision `037b79f` passed 100 of 100 Fleet billers. Its archive contains 200 unique initial and destination document identities and 102 successful hosted Clef decisions. The app typecheck, Google Calendar save and reviewed cross-app journeys all passed on that Linux runner. The archive SHA-256 is `fe94b79f7e9473e49541de196123ea1c2d31950c6cf273968e9e339db7fbbc2f`. On the Shopping fixture, moving the pointer back to Grace closed an open submenu. The guide now keeps the original request active while the person opens the menu, reads the newly visible links, and checks the selected child again before pointing. A change of task or document invalidates that selection.

On revision `3f01377`, both Shopping tasks scored 1 in the official evaluator. On task 261 the person’s pointer opened the Electronics menu, revealing 13 visible choices, and followed the highlighted Headphones link. Grace kept the step open because the tab title also included its parent category. The named-page reader now checks the visible level-one heading inside the main content and brackets it with two observations of the current document. Sites that omit a main landmark or a readable level-one heading can still leave the step open. New app operations also need an owning adapter, an account-bound result and a failure case before a planner can offer them.

The connector integration supplies the actual application composition and its synthetic external accounts. The browser harness drives the Grace UI, presents a real top-level Chromium site through the native plugin boundary, and uses a simulated person's mouse input on the visible guide ring. Each hosted receipt states the chat planner, decision provider, initial and destination documents, and Grace's verdict. The site grader records its own verdict. For WebArena use the pinned official task and evaluator. A score from another product revision or a manually solved control belongs to that revision or operator.

| Required evidence | How to reproduce on the connector integration |
|---|---|
| Local Google sign-in, Gmail and Calendar | Run the app's normal Vitest browser project. Its resettable local provider requests synthetic consent, then serves the account-specific mail and calendar endpoints. Inspect the source message, the approval boundary and each account's saved events. |
| 100 Fleet billers | Check out the public BillWorld fixture at `f335b651f9820c3454f447e3d4722b78c5298a0b`. Set `GRACE_BILLWORLD_DIR` to its absolute path, `GRACE_BILLWORLD_RESULTS` to an output directory, and provide the benchmark's upstream-compatible Clef origin and test key as `GRACE_BENCHMARK_CLEF_ORIGIN` and `GRACE_BENCHMARK_CLEF_KEY`. Run `pnpm --filter @repo/app test:browser test/browser.browser.test.tsx -t 'Follow Grace to a benchmark link'`. The manual `ci` workflow accepts the `billworld` input and checks out the public fixture at that commit with the workflow’s built-in token. The Fleet fixture samples distinct billers across portal families before any decision, starts a loopback HTTPS site and grades the destination from Chromium. Each run writes its own cohort and receipts. This cohort qualifies public support-page navigation. Full billing operations need the task's private state grader. |
| WebArena browser baseline | Set `GRACE_BROWSER_BENCHMARK_FILE` to a sealed list of public task IDs, intents, loopback HTTPS start URLs and fresh receipt paths. Use the same browser command. For official cases include `evaluator: "webarena"`, `GRACE_WEBARENA_UPSTREAM` pointing to a clean checkout at `dce04686a56253aefba7b18a4fa0937cf1dc987b`, and `GRACE_WEBARENA_PYTHON` pointing to its prepared Python. Supply synthetic seeded site login where the task requires it. Set `chat: "upstream"` in a sealed case to exercise the live planner with a funded test tenant. Add `requiredStep: "ReachNamedPage"` when a named destination must appear in the actual reviewed plan. The benchmark records the target proposed by Grace and each observed hop. Score the landing URL independently of Grace’s verdict. Include failed attempts and manual controls in separate counts. |
| Full model and installed device | Run `pnpm check`. Inspect `review` separately from simulation and proof. The existing Android runner can record sealed benchmark interactions on a dedicated emulator. Record an installed, signed-in run independently of desktop Chromium. |

### Release qualification and remaining work

On Linux, `0fd538b` passed both declared WebArena Shopping tasks with the official URL evaluator and Grace’s completion check. Task 260 used a fixed plan and four hosted Clef decisions. Task 261 used live upstream chat and three hosted decisions. Holding one pointer over the indicated menu revealed 13 visible items. The person followed the highlighted link to a fresh document, and Grace confirmed the requested name in its main heading. The authenticated statement test on the same application source also passed all six Malden checks, and the control that took no action failed. The ordinary four-case offline Chromium group passed twice.

The same revision, with Eliza `787916c`, passed the full 100-biller Fleet cohort across 26 template families. The independent audit found 200 distinct initial and final document IDs, 102 successful hosted Clef choices and zero failed cases. It compared 115 files with the checksum-verified archive, SHA-256 `60721fc7e28e7d1b30d6869d6357dd70b24be8b8d533689f312a803d585ce5cf`. The same Linux run passed app typechecking, the isolated Google and native chat journeys, the cross-app suite and the four-case CI command. GitHub rejected the hosted jobs before startup because of account billing. [Workflow dispatch](https://github.com/gracefultechnology/grace-new/actions/runs/44238142307)

| Priority | Remaining work | Acceptance |
|---|---|---|
| 1 | Restore GitHub-hosted execution and compare it with the Linux benchmark receipts. | Dispatch `ci` with `billworld` and `webarena`. Preserve the four Fleet shards, aggregate, released statement control pair, both official Shopping receipts and the offline cross-app job log. |
| 2 | Extend the billing and WebArena tasks that have independent graders. | Publish denominators separately for authored billing tasks, additional Shopping intents and each new WebArena evaluator or site. Exercise a refusal, interruption and a successful outcome before qualifying each kind of write. |
| 3 | Extend app coverage with a source-bound checkpoint and a new adapter. | Recover a paused task across restart under the same account, invalidate a stale receipt after an account switch, and complete a Files or multi-tab task without reusing an earlier observation. Carry a venue read from a webpage into an explicitly approved calendar write. |
| 4 | Qualify the installed standalone app against its own cloud and finish whole-repository verification. | Record an authenticated hosted decision from an installed device, a completed browser task and the ordinary full `pnpm check` result. Keep the upstream sandbox, native build and installed-device receipts identifiable by revision. |

### WebArena Shopping on x86 Linux

The pinned upstream catalog has 812 tasks. Its grader assigns 325 solely by answer text, 282 solely by page content, 66 solely by URL, and 139 by combinations of those checks. The current adapter can load the 42 single-site Shopping tasks that start on the home page and use only URL matching. The workflow selects tasks 260 and 261. Task 260 retains its one-hop baseline and task 261 exercises the live planner and named-destination readback. Qualifying the other classes requires adapters for their own evaluators and authenticated site state. [Upstream catalog](https://github.com/web-arena-x/webarena/blob/dce04686a56253aefba7b18a4fa0937cf1dc987b/config_files/test.raw.json)

The manual `ci` workflow accepts the optional `webarena` input. It runs both cases and uploads the receipts as `webarena-shopping`. Turn off `billworld` to run only the Shopping benchmark in addition to the normal repository verification. The job uses the configured `GRACE_BENCHMARK_CLEF_ORIGIN` variable and `GRACE_BENCHMARK_CLEF_KEY` secret. A pass requires `officialScore: 1` and `qualifiedHostedGuidance: true` in Grace's browser receipt. The job uploads the image identity, browser log and scoring receipt. The synthetic account state, browser setup inputs and local CA stay under the runner's private directory. [Manual workflow](../.github/workflows/ci.yml)

Standard Linux GitHub-hosted runners list 14 GB of SSD storage. The manual job measures Docker's volume and releases unused preinstalled Android and .NET SDKs when the isolated hosted runner is short on space. Set the optional `GRACE_WEBARENA_RUNNER` repository variable to an existing x86-64 Linux runner label when you need a larger disk. [GitHub runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

For local reproduction, use an x86-64 Linux host with Docker or Podman, Caddy, Python 3.10, Node 26, pnpm and jq. The pinned compatibility image has about 5.4 GB of compressed layers. Leave room for the expanded image and database working files. Task 260 comes from the original WebArena catalog. Its checkout and URL evaluator are pinned independently of the container. [WebArena-Verified Shopping and published test login](https://servicenow.github.io/webarena-verified/v1.2.3/environments/shopping/) · [Pinned WebArena source](https://github.com/web-arena-x/webarena/tree/dce04686a56253aefba7b18a4fa0937cf1dc987b)

Run these commands from the Grace-new repository root.

```sh
fx="$(mktemp -d "${TMPDIR:-/tmp}/grace-webarena.XXXXXX")"
image=docker.io/am1n3e/webarena-verified-shopping@sha256:3e8cb9b945ea9b1c94ab26dba53e8d12dd0406abbf4bf686fd3bb2b6a5908feb
docker pull --platform linux/amd64 "$image"
docker image inspect "$image" --format '{{json .RepoDigests}}'
docker run -d --name grace-webarena-shopping --platform linux/amd64 \
  -p 127.0.0.1:17771:80 -e WA_ENV_CTRL_EXTERNAL_SITE_URL=https://127.0.0.1:7770/ "$image"
cat > "$fx/Caddyfile" <<'CADDY'
{
  admin off
  auto_https disable_redirects
  skip_install_trust
}
https://127.0.0.1:7770 {
  bind 127.0.0.1
  tls internal
  reverse_proxy http://127.0.0.1:17771
}
CADDY
XDG_DATA_HOME="$fx/caddy-data" XDG_CONFIG_HOME="$fx/caddy-config" \
  caddy start --config "$fx/Caddyfile" --adapter caddyfile
```

Install the repository’s pinned Dafny 4.11.0 on the host before running `pnpm install`. Workspace preparation locates the Z3 solver from Dafny or the host path. Wait for seeded MariaDB and Elasticsearch in `docker logs grace-webarena-shopping`. Configure the synthetic fixture's Magento address after the dependencies start, then confirm the real home page returns HTTP 200. Cold-start requests may take time while the database recovers.

```sh
docker exec grace-webarena-shopping sh -ec '
  cd /var/www/magento2
  php bin/magento config:set web/unsecure/base_url https://127.0.0.1:7770/
  php bin/magento config:set web/secure/base_url https://127.0.0.1:7770/
  php bin/magento config:set web/secure/use_in_frontend 1
  php bin/magento cache:flush
'
curl -k --fail --max-time 90 https://127.0.0.1:7770/ -o "$fx/home.html"
git clone https://github.com/web-arena-x/webarena "$fx/upstream"
git -C "$fx/upstream" checkout --detach dce04686a56253aefba7b18a4fa0937cf1dc987b
python3.10 -m venv "$fx/evaluator"
"$fx/evaluator/bin/pip" install -r "$fx/upstream/requirements.txt"
git submodule update --init --recursive vendor/eliza
pnpm install --frozen-lockfile
pnpm --filter @repo/app exec playwright install --with-deps chromium
pnpm gen
```

Export `WA_SHOPPING_FIXTURE_LOGIN` with the published synthetic `email:password` from the Shopping environment documentation. The browser sends the published login header on local navigation and saves a private storage-state file after the real account page is visible. [Shopping auto-login](https://servicenow.github.io/webarena-verified/v1.2.3/environments/shopping/#auto-login)

```sh
(
  cd apps/app
  umask 077
  node --input-type=module - "$fx/shopping-state.json" <<'JS'
import { chromium } from "playwright";
const origin = "https://127.0.0.1:7770";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.route("**/*", (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) return route.abort();
    return request.isNavigationRequest()
      ? route.continue({ headers: { ...request.headers(), "x-m2-customer-auto-login": process.env.WA_SHOPPING_FIXTURE_LOGIN } })
      : route.continue();
  });
  const page = await context.newPage();
  const response = await page.goto(origin + "/customer/account/", { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!response?.ok()) throw new Error("The seeded Shopping account request failed");
  await page.getByRole("heading", { name: "My Account", exact: true }).first().waitFor({ timeout: 120000 });
  await context.storageState({ path: process.argv[2] });
} finally {
  await browser.close();
}
JS
)
unset WA_SHOPPING_FIXTURE_LOGIN
```

Provide the hosted decision origin and test key in the environment. Generate both cases from the pinned public intents. The upstream evaluator keeps the expected URLs. The local fixture directory holds the synthetic shopper session.

```sh
git -C "$fx/upstream" show HEAD:config_files/test.raw.json |
  jq -e --arg results "$fx" --arg state "$fx/shopping-state.json" '
    [.[] | select(.task_id == 260 or .task_id == 261) |
      {taskId: (.task_id | tostring), intent, startUrl: "https://127.0.0.1:7770/",
       receipt: ($results + "/task-" + (.task_id | tostring) + ".json"),
       siteStorageState: $state, evaluator: "webarena"} +
      (if .task_id == 261 then {chat: "upstream", requiredStep: "ReachNamedPage"} else {} end)]' \
    > "$fx/shopping-input.json"
GRACE_WEBARENA_UPSTREAM="$fx/upstream" GRACE_WEBARENA_PYTHON="$fx/evaluator/bin/python" \
GRACE_BROWSER_BENCHMARK_FILE="$fx/shopping-input.json" \
  pnpm --filter @repo/app test:browser test/browser.browser.test.tsx -t 'Follow Grace to a benchmark link'
jq -es 'length == 2 and all(.[]; .webArena.officialScore == 1 and .webArena.qualifiedHostedGuidance)' \
  "$fx/task-260.json" "$fx/task-261.json"
jq -e '.chatStatus == 200 and .outcome.chatProvider == "upstream" and
  (.outcome.reviewedDestination | length) > 0 and .outcome.hops[-1].checked' "$fx/task-261.json"
```

For offline preparation, prefetch the pinned OCI image, upstream checkout and Python wheels, the application's Chromium binary and its Linux system packages, the Eliza submodule and pnpm dependencies. The pinned Python venv supplies the URL grader's dependencies. Hosted qualification needs access to the configured Decisions API.
