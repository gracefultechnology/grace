import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, inject, it, type TestContext } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import {
  androidPagePluginAtItsBoundary, BrowserControl, decisionCloud, guidedDetails, guidedPageState, launch, LinkObservation, privateFormRecovery,
  proposeRead, SelectorRead, startBrowserReadPlan, typedAddress,
} from "@repo/app";
import { matchesPublicSearch, PublicSearch, publicSearchQuery } from "./browser-receipt.ts";

const BrowserDocument = Schema.Struct({
  url: Schema.NonEmptyString,
  documentId: Schema.NonEmptyString,
  title: Schema.String,
  text: Schema.String,
  readyState: Schema.Literals(["loading", "interactive", "complete"]),
  truncated: Schema.Boolean,
});
function guidanceRecovery(instruction: string) {
  return instruction === privateFormRecovery ? "private-form" :
    instruction.startsWith("I couldn’t read this page.") ? "unobservable" :
    instruction.startsWith("The page or task changed.") ? "changed" :
    instruction === "I couldn't find a link to point to on this page." ? "no-link" :
    instruction === "I could not highlight a link on this page." ? "guide-exception" :
    /^I (couldn’t reach Grace|need you to sign in)|^Sign in to Grace/u.test(instruction) ? "guide-account" : "other";
}

type BrowserJourneyStage = "prepare-journey" | "follow-guidance" | "submit-public-search" | "observe-search-landing" | "open-public-category" | "set-website-price-order" |
  "tap-guide-ring" | "observe-link-landing" | "bind-native-landing" |
  "wait-for-check-controls" | "check-page" | "observe-check-result" | "confirm-completion";
type PendingPageCheck = {
  startedAt: number;
  returnedAt?: number;
  resumed: boolean;
  snapshot: "not-requested" | "requested" | "returned" | "failed";
};

it.each(inject("browserBenchmarks"))('Follow Grace to a benchmark link $titleId (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async ({ taskId, intent, startUrl, exploratory, gradeWholeCohort, requiredStep }) => {
  const transport = commands.benchmarkSurface;
  const publicFailure = (failure: unknown, stage: "Browser setup" | "Browser journey" | "Benchmark grading or cleanup") => {
    if (failure instanceof Error && (failure.name === "TimeoutError" ||
        failure.message.startsWith("expect.poll() function didn't resolve in time") ||
        failure.message.startsWith("expect.poll() assertion didn't resolve in time"))) return new Error(`${stage} timed out`);
    if (failure instanceof Error && failure.name === "AssertionError") return new Error(`${stage} assertion failed`);
    return new Error(`${stage} failed`);
  };
  await transport({ kind: "begin", taskId });
  const read = async () => Schema.decodeUnknownSync(BrowserDocument)(await transport({ kind: "read" }));
  let selected: string | null | undefined;
  let failureStage: BrowserJourneyStage = "prepare-journey";
  let pendingCheck: PendingPageCheck | undefined;
  let guidanceSnapshot: object | "failed" | "invalid" | undefined;
  let guidanceResult: "waiting" | "link" | "menu" | "unavailable" | undefined;
  const outcome: Record<string, unknown> = {
    chatProvider: "fixture", observationPermission: "awaiting permission",
    operator: "trusted Chromium mouse input at visible guide ring",
  };
  const native = androidPagePluginAtItsBoundary({
    async createSurface(request) {
      if (!request.url) throw new Error("A benchmark surface needs a start URL");
      try {
        await transport({ kind: "open", url: request.url });
        const actual = await read();
        native.started(actual.url);
        native.finished(actual.url);
      } catch (error) {
        const failure = publicFailure(error, "Browser setup");
        outcome.browserBoundaryFailure = { operation: "createSurface", detail: failure.message };
        throw failure;
      }
    },
    presentSurface(request) {
      selected = request.id;
      return Promise.resolve();
    },
    async readPage(request) {
      if (request.id !== selected) throw new Error("The benchmark site is not the selected Grace surface");
      if (request.selector !== undefined) return Schema.decodeUnknownSync(SelectorRead)(await transport({ kind: "read", selector: request.selector }));
      const { url, title, text, truncated } = await read();
      return { url, title, text, truncated };
    },
    async controlPage(request) {
      if (request.id !== selected && request.command.guidance?.kind !== "hide")
        throw new Error("The benchmark site is not the selected Grace surface");
      const check = request.command.subaction === "snapshot" ? pendingCheck : undefined;
      const guide = failureStage === "follow-guidance" && request.command.subaction === "snapshot";
      if (check) check.snapshot = "requested";
      try {
        const observed = Schema.decodeUnknownSync(BrowserControl)(await transport({ kind: "control", request }));
        if (check) check.snapshot = "returned";
        if (guide) {
          const snapshot = Schema.decodeUnknownOption(LinkObservation)(observed);
          if (snapshot._tag === "None") guidanceSnapshot = "invalid";
          else {
            const { url, blockers, elements } = snapshot.value.result;
            const origin = URL.parse(url)?.origin;
            const usable = elements.filter(item => !item.disabled && !item.sensitive && item.inViewport && item.label);
            guidanceSnapshot = {
              eligibility: guidedPageState(snapshot.value, typedAddress() ?? "", "GuidePublicLinks"),
              blockerCount: Math.min(blockers.length, 255),
              blockers: blockers.slice(0, 8).map(({ kind, covers }) => ({
                kind: ["captcha", "login-wall", "paywall", "modal", "cookie-consent"].includes(kind) ? kind : "other",
                covers: ["partial", "viewport", "target"].includes(covers) ? covers : "other",
              })),
              visibleSameOriginLinks: Math.min(usable.filter(item => item.tag === "a" && item.href &&
                origin !== undefined && URL.parse(item.href)?.origin === origin).length, 255),
              visibleMenuControls: Math.min(usable.filter(item => item.role === "menuitem" || item.expanded !== undefined).length, 255),
            };
          }
        }
        return observed;
      } catch (error) {
        if (check) check.snapshot = "failed";
        if (guide) guidanceSnapshot = "failed";
        throw error;
      }
    },
  });
  try {
    const { cloud, secret } = await proposeRead(intent, "Review the browser step.", "ReadChangedBrowser");
    const decisions = await Effect.runPromise(decisionCloud(cloud, secret));
    await transport({ kind: "decisionRoute", cloud, deadlineMs: decisions.deadlineMs });
    const { workspace } = await launch(native.plugin, decisions.host);
    const bindNativeLanding = async (url: string, timeout: number) => {
      failureStage = "bind-native-landing";
      const beforeLoad = workspace().browser.tabs[0]?.loadVersion ?? 0;
      native.started(url);
      native.finished(url);
      await expect.poll(() => {
        const tab = workspace().browser.tabs[0];
        return { address: typedAddress(), arrived: tab !== undefined && tab.load === "Loaded" && tab.loadVersion > beforeLoad };
      }, { timeout }).toEqual({ address: url, arrived: true });
    };
    await userEvent.click(page.getByRole("button", { name: "Internet" }));
    const address = page.getByRole("textbox", { name: "Address" });
    await userEvent.fill(address, startUrl);
    await userEvent.click(page.getByRole("button", { name: "Go", exact: true }));
    await expect.poll(() => outcome.browserBoundaryFailure ?? workspace().browser.tabs[0]?.load, { timeout: 30_000 }).toBe("Loaded");
    const initial = await read();
    outcome.start = { url: initial.url, documentId: initial.documentId };
    expect(initial.url).toBe(new URL(startUrl).href);
    await userEvent.click(page.getByRole("button", { name: "Ask Grace" }));
    await userEvent.click(page.getByRole("button", { name: "Allow Grace to read this browser", exact: true }));
    await expect.element(page.getByRole("button", { name: "Turn off browser reading", exact: true })).toBeVisible();
    outcome.observationPermission = "person granted browser reading in Grace";
    await userEvent.fill(page.getByRole("textbox", { name: "Message to Grace" }), intent);
    await userEvent.click(page.getByRole("button", { name: "Send", exact: true }));
    await expect.element(page.getByRole("region", { name: "Review read plan" })).toBeVisible();
    const reviewed = workspace().review.request.steps;
    const named = reviewed.find(step => step.tag === "ReachNamedPage");
    const record = reviewed.find(step => step.tag === "ReadLatestRecord");
    const search = reviewed.find(step => step.tag === "SearchPublicSite");
    if (named) outcome.reviewedDestination = named.subject;
    if (requiredStep) {
      outcome.reviewedSteps = reviewed.map(step => ({ kind: step.tag, subject: step.tag === "SearchPublicSite" ? step.query : guidedDetails(step).subject }));
      const matches = reviewed.some(step => step.tag === requiredStep);
      if (exploratory && !matches && reviewed.length > 0) {
        outcome.miss = "missing-reviewed-step";
        return;
      }
      expect(matches).toBe(true);
      expect(reviewed).toHaveLength(1);
    }
    await userEvent.click(page.getByRole("button", { name: "Collapse", exact: true }));
    await userEvent.click(page.getByRole("button", { name: "Start read plan" }));
    const showLink = page.getByRole("button", { name: "Show me the link" });
    const plan = page.getByRole("region", { name: "Task plan" });
    const finished = plan.getByText("Read checks complete", { exact: true });
    const continuing = page.getByRole("status", { name: "Page check result" });
    if (requiredStep === "SearchPublicSite" && search) {
      expect(search.query).toBe(publicSearchQuery(intent));
      expect(search.origin).toBe(new URL(initial.url).origin);
      outcome.operator = "trusted Chromium keyboard input in the website search field";
      failureStage = "submit-public-search";
      const submitted = Schema.decodeUnknownSync(PublicSearch)(await transport({ kind: "submitPublicSearch", query: search.query }));
      failureStage = "observe-search-landing";
      const landed = await read();
      outcome.destination = { url: landed.url, documentId: landed.documentId };
      outcome.publicSearch = submitted;
      expect(landed.documentId).not.toBe(initial.documentId);
      expect(landed.readyState).toBe("complete");
      expect(matchesPublicSearch(new URL(landed.url), submitted)).toBe(true);
      await bindNativeLanding(landed.url, 15_000);
      failureStage = "wait-for-check-controls";
      const resume = page.getByRole("button", { name: "Resume Grace", exact: true });
      await expect.element(resume, { timeout: 15_000 }).toBeVisible();
      await userEvent.click(resume);
      outcome.resumed = true;
      failureStage = "check-page";
      const check = page.getByRole("button", { name: "Check search results", exact: true });
      await userEvent.click(check);
      failureStage = "confirm-completion";
      await expect.element(finished, { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan.receipts).toHaveLength(1);
      outcome.hops = [{ url: landed.url, documentId: landed.documentId, checked: true }];
      outcome.graceTerminal = plan.element().textContent;
      return;
    }
    const menuGuidance = page.getByRole("status", { name: "Open submenu guidance" });
    const linkGuidance = page.getByRole("status", { name: "Link guide result" });
    const guidanceFailure = page.getByRole("status", { name: "Link unavailable" });
    const recordRefusal = page.getByRole("status", { name: "Record check unavailable" });
    const words = (label: string) => (label.toLowerCase().replace(/[’']s\b/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [])
      .map(word => word === "men" ? "man" : word === "women" ? "woman" : word.replace(/s$/u, ""));
    const namedWords = new Set(words(named?.subject ?? ""));
    const labelMatchesGoal = (label: string | undefined) => {
      const tokens = label === undefined ? [] : words(label);
      return tokens.length > 0 && tokens.every(word => namedWords.has(word));
    };
    const visited = new Set([initial.url]);
    const forwardPath = [initial.url];
    const disclosed = new Set<string>();
    const disclosures: { url: string; documentId: string; snapshotId: string; instruction: string; label: string; pointer: { x: number; y: number }; before: number; after: number }[] = [];
    outcome.disclosures = disclosures;
    const browserObservationTimeoutMs = 15_000;
    const hops: { url: string; documentId: string; checked: boolean; checkResultWaitMs: number; reason?: string | null }[] = [];
    outcome.hops = hops;
    const menuRetries: { documentId: string; instruction: string }[] = [];
    outcome.menuRetries = menuRetries;
    const actionLimit = named || record ? 8 : 1;
    const actionsTaken = () => hops.length + disclosures.length + menuRetries.length + Number(outcome.nameCorrection !== undefined);
    const stopAtActionLimit = () => {
      if (!exploratory || !(named || record) || actionsTaken() !== actionLimit) return false;
      outcome.miss = "action-budget-exhausted";
      return true;
    };
    let previous = initial;
    while (actionsTaken() < actionLimit) {
      failureStage = "follow-guidance";
      guidanceResult = "waiting";
      guidanceSnapshot = undefined;
      try {
        await userEvent.click(showLink);
      } catch (error) {
        const { device, assistant, browser } = workspace();
        outcome.guideBoundary = {
          connection: device.connectivity, observationAllowed: device.observationAllowed, reasoningAvailable: device.reasoningAvailable,
          surface: device.surface, presentation: assistant.presentation, activity: assistant.activity, load: browser.tabs[0]?.load,
        };
        throw error;
      }
      if (named) {
        let lastInstruction: string | undefined;
        while (true) {
          if (stopAtActionLimit()) return;
          expect(actionsTaken()).toBeLessThan(actionLimit);
          await expect.poll(() => {
            const instruction = menuGuidance.query()?.textContent;
            return linkGuidance.query() !== null || guidanceFailure.query() !== null ||
              (typeof instruction === "string" && instruction !== lastInstruction);
          }, { timeout: lastInstruction === undefined ? 45_000 : 50_000 }).toBe(true);
          const failure = guidanceFailure.query();
          if (failure) {
            guidanceResult = "unavailable";
            const instruction = failure.textContent ?? "The link could not be highlighted";
            const [, branch, leaf] = instruction.match(/^The open menu (?:“[^”]+” › )*“([^”]+)” calls this link “([^”]+)”\.?$/u) ?? [];
            const branchMatches = labelMatchesGoal(branch);
            const leafMatches = labelMatchesGoal(leaf);
            const offeredControl = leaf ? `Use “${leaf}” for this step` : undefined;
            const approval = offeredControl ? page.getByRole("button", { name: offeredControl, exact: true }) : undefined;
            if (branch && leaf && approval && !outcome.nameCorrection && branchMatches && leafMatches) {
              await userEvent.click(approval);
              await expect.poll(() => plan.getByText(`Find and check “${leaf}”.`, { exact: true }).query() !== null, {
                timeout: 45_000,
              }).toBe(true);
              outcome.nameCorrection = { original: named.subject, branch, leaf, instruction, documentId: previous.documentId };
              await userEvent.click(showLink);
            } else {
              const last = disclosures.at(-1);
              const nextMenu = page.getByRole("button", { name: "Try another menu", exact: true });
              if (exploratory && branch && leaf && approval && offeredControl && approval.query() !== null &&
                  (!branchMatches || !leafMatches) && last?.documentId === previous.documentId && last.label === branch) {
                await expect.element(approval).toBeVisible();
                outcome.rejectedNameCorrection = {
                  original: named.subject, branch, leaf, offeredControl, branchMatches, leafMatches,
                  documentId: previous.documentId, instruction,
                };
                if (nextMenu.query() === null) {
                  outcome.miss = "rejected-scoped-leaf";
                  return;
                }
              }
              if (nextMenu.query() === null) {
                if (exploratory && last?.documentId === previous.documentId &&
                    (instruction === `I couldn’t see “${named.subject}” in the open menu. You can try another menu.` ||
                     instruction === `I couldn’t find “${named.subject}” in the “${last.label}” menu.`)) {
                  outcome.miss = "target-absent-from-open-menu";
                  outcome.guideResult = instruction;
                  return;
                }
                outcome.guidanceRecovery = guidanceRecovery(instruction);
                throw new Error(instruction);
              }
              await userEvent.click(nextMenu);
              menuRetries.push({ documentId: previous.documentId, instruction });
            }
            await expect.poll(() => guidanceFailure.query()?.textContent !== instruction, {
              timeout: 45_000,
            }).toBe(true);
            continue;
          }
          if (linkGuidance.query() !== null) {
            guidanceResult = "link";
            break;
          }
          guidanceResult = "menu";
          const instruction = menuGuidance.element().textContent;
          if (!instruction || instruction === lastInstruction) throw new Error("Grace did not present fresh submenu guidance");
          outcome.menuInstruction = instruction;
          outcome.menuInteraction = { instruction, documentId: previous.documentId, status: "awaiting-hover" };
          await expect.poll(async () => {
            const result = await transport({ kind: "hoverGuide" });
            outcome.menuInteraction = result;
            if (result.reason) throw new Error(typeof result.reason === "string" ? result.reason : JSON.stringify(result.reason));
            return result.disclosed === true;
          }, { timeout: 15_000 }).toBe(true);
          const evidence = Schema.decodeUnknownSync(Schema.Struct({
            disclosed: Schema.Literal(true), url: Schema.NonEmptyString, documentId: Schema.NonEmptyString,
            snapshotId: Schema.NonEmptyString, label: Schema.NonEmptyString,
            pointer: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
            before: Schema.Int, after: Schema.Int,
          }))(outcome.menuInteraction);
          expect(evidence.url).toBe(previous.url);
          expect(evidence.documentId).toBe(previous.documentId);
          expect(instruction).toContain(`“${evidence.label}”`);
          expect(evidence.after).toBeGreaterThan(evidence.before);
          const disclosureId = JSON.stringify([evidence.documentId, evidence.snapshotId]);
          expect(disclosed.has(disclosureId)).toBe(false);
          disclosed.add(disclosureId);
          disclosures.push({ ...evidence, instruction });
          lastInstruction = instruction;
        }
      }
      if (record) await expect.element(linkGuidance.or(guidanceFailure).or(recordRefusal).first(), { timeout: 45_000 }).toBeVisible();
      if (record && guidanceFailure.query() !== null) throw new Error("Record guidance could not verify the next link");
      if (record && recordRefusal.query() !== null) {
        if (!exploratory || requiredStep !== "ReadLatestRecord") throw new Error("Record guidance stopped at an unverified collection");
        const instruction = recordRefusal.element().textContent;
        const { ringAvailable } = await transport({ kind: "inspectGuide" });
        expect(ringAvailable).toBe(false);
        const action = Schema.decodeUnknownSync(SelectorRead)(await transport({
          kind: "read", selector: "#my-orders-table tbody tr td.actions a.view",
        }));
        const current = await read();
        const last = hops.at(-1);
        expect(action.text.trim()).toBe("View Order");
        expect(action.url).toBe(current.url);
        expect(current).toMatchObject({ url: previous.url, documentId: previous.documentId, readyState: "complete" });
        expect(last).toMatchObject({ url: current.url, documentId: current.documentId, checked: false });
        const { recordSelection, receipts } = workspace().plan;
        expect(recordSelection.tag).toBe("NoGuidedRecordSelection");
        expect(receipts).toHaveLength(0);
        expect(finished.query()).toBeNull();
        outcome.recordRefusal = { kind: "record-check-unavailable", documentId: current.documentId, instruction,
          visibleAction: action.text.trim(), ringAvailable, selection: recordSelection.tag, receiptCount: receipts.length };
        outcome.miss = "insufficient-record-evidence";
        return;
      }
      const selection = workspace().plan.recordSelection;
      const bound = record && selection.tag === "StagedGuidedRecord" && selection.selection.documentId === previous.documentId
        ? selection.selection : undefined;
      const returningToRecord = record && linkGuidance.query()?.textContent?.includes("Go back one page in this list.") === true;
      failureStage = "tap-guide-ring";
      let refusal: string | undefined;
      await expect.poll(async () => {
        const unavailable = named || record ? null : guidanceFailure.query();
        if (unavailable) {
          refusal = unavailable.textContent ?? "";
          return true;
        }
        return (await transport({ kind: "tapGuide" })).tapped;
      }, { timeout: 45_000 }).toBe(true);
      if (refusal !== undefined) {
        failureStage = "follow-guidance";
        guidanceResult = "unavailable";
        outcome.guidanceRecovery = guidanceRecovery(refusal);
        outcome.linkUnavailable = true;
        throw new Error("Grace could not offer a link");
      }
      outcome.ringTap = true;
      failureStage = "observe-link-landing";
      await expect.poll(async () => {
        const document = await read();
        return document.documentId !== previous.documentId && document.readyState === "complete";
      }, { timeout: 30_000 }).toBe(true);
      const landed = await read();
      outcome.destination = { url: landed.url, documentId: landed.documentId };
      const expectedReturn = returningToRecord && forwardPath.at(-2) === landed.url;
      if (exploratory && !expectedReturn && visited.has(landed.url)) {
        outcome.miss = "repeated-address";
        return;
      }
      if (expectedReturn) {
        forwardPath.pop();
      } else {
        expect(visited.has(landed.url)).toBe(false);
        forwardPath.push(landed.url);
        visited.add(landed.url);
      }
      await bindNativeLanding(landed.url, browserObservationTimeoutMs);
      failureStage = "wait-for-check-controls";
      const resume = page.getByRole("button", { name: "Resume Grace" });
      const check = page.getByRole("button", { name: "Check page", exact: true });
      await expect.element(resume.or(check).first(), { timeout: browserObservationTimeoutMs }).toBeVisible();
      const resumed = resume.query() !== null;
      if (resumed) await userEvent.click(resume);
      failureStage = "check-page";
      const attempt: PendingPageCheck = { startedAt: performance.now(), resumed, snapshot: "not-requested" };
      pendingCheck = attempt;
      await userEvent.click(check);
      failureStage = "observe-check-result";
      const checkReturnedAt = attempt.returnedAt = performance.now();
      await expect.element(finished.or(continuing).first(), { timeout: browserObservationTimeoutMs }).toBeVisible();
      pendingCheck = undefined;
      const checked = finished.query() !== null;
      const reason = continuing.query()?.textContent;
      hops.push({ url: landed.url, documentId: landed.documentId, checked, checkResultWaitMs: Math.round(performance.now() - checkReturnedAt), reason });
      if (checked && record) {
        const receipts = workspace().plan.receipts;
        if (!bound || bound.documentId !== previous.documentId || bound.documentId === landed.documentId ||
            receipts.length !== 1 || receipts[0]?.sourceKey !== bound.key)
          throw new Error("The checked detail did not complete the reviewed record selection");
        outcome.checkedRecord = { collectionDocument: previous.documentId, detailDocument: landed.documentId };
      }
      if (checked) break;
      expect(named ?? record).toBeDefined();
      if (named) expect([`I couldn’t verify “${named.subject}” on this page. Check the page again or try another link.`, privateFormRecovery]).toContain(reason);
      if (record) await expect.element(continuing).toBeVisible();
      expect(workspace().plan.receipts).toHaveLength(0);
      previous = landed;
    }
    if (!hops.at(-1)?.checked && stopAtActionLimit()) return;
    failureStage = "confirm-completion";
    await expect.element(finished).toBeVisible();
    outcome.graceTerminal = plan.element().textContent;
  } catch (error) {
    const failure = publicFailure(error, "Browser journey");
    outcome.failure = failure.message;
    outcome.failureStage = failureStage;
    if (failureStage === "follow-guidance") outcome.guidanceFailure = {
      result: guidanceResult, snapshot: guidanceSnapshot ?? "not-requested",
    };
    if (pendingCheck) {
      const endedAt = performance.now();
      const { startedAt, returnedAt, resumed, snapshot } = pendingCheck;
      outcome.pageCheckFailure = {
        elapsedMs: Math.round(endedAt - startedAt), resumed, snapshot,
        ...(returnedAt === undefined ? {} : { checkResultWaitMs: Math.round(endedAt - returnedAt) }),
      };
      pendingCheck = undefined;
    }
    if (failureStage === "tap-guide-ring") outcome.linkUnavailable = page.getByRole("status", { name: "Link unavailable", exact: true }).query() !== null;
    if (!gradeWholeCohort) throw failure;
  } finally {
    await transport({ kind: "receipt", outcome }).catch((error: unknown) => {
      throw publicFailure(error, "Benchmark grading or cleanup");
    });
  }
}, 240_000);

async function prepareBillWorldStatement(attempt: string, billerId: string | undefined, context: TestContext) {
  const transport = async (action: Parameters<typeof commands.releasedStatement>[1]) => {
    context.signal.throwIfAborted();
    const result = await commands.releasedStatement(attempt, action);
    context.signal.throwIfAborted();
    return result;
  };
  const statement = Schema.decodeUnknownSync(Schema.Struct({
    url: Schema.NonEmptyString, taskId: Schema.NonEmptyString, question: Schema.NonEmptyString,
  }))(await transport({ kind: "prepare", billerId }));
  expect(statement.taskId).toBe(billerId === undefined ? "task_md9" : billerId + ":view-bill");
  return { ...statement, transport };
}

async function readBillWorldStatement(billerId: string | undefined, refuses: true | undefined, context: TestContext, prepared: Awaited<ReturnType<typeof prepareBillWorldStatement>>) {
  const { url, taskId, question, transport } = prepared;
  let shown: string | null | undefined;
  let observations = 0;
  const native = androidPagePluginAtItsBoundary({
    createSurface(request) {
      if (request.url !== url) return Promise.reject(new Error("Grace must attach to the exact prepared statement"));
      native.started(url);
      native.finished(url);
      return Promise.resolve();
    },
    presentSurface(request) {
      shown = request.id;
      return Promise.resolve();
    },
    async controlPage(request) {
      if (request.id !== shown || request.command.subaction !== "snapshot") throw new Error("Only the presented statement can be read");
      const observed = Schema.decodeUnknownSync(BrowserControl)(await transport({ kind: "observe", request }));
      observations++;
      return observed;
    },
  });
  const { cloud, secret } = await proposeRead(question, "Review the statement read.", "ReadStatement", context.signal);
  const { ui, workspace } = await launch(native.plugin, { url: cloud, key: secret }, context);
  await startBrowserReadPlan({ ui, workspace }, { url, question, askWith: "keyboard" });
  const check = ui.getByRole("button", { name: "Read statement", exact: true });
  const complete = ui.getByRole("region", { name: "Task plan" }).getByText("Read checks complete", { exact: true });
  if (billerId !== undefined) {
    for (const value of ["past", "ambiguous"] as const) {
      await transport({ kind: "evidence", value });
      const before = observations;
      await userEvent.click(check);
      await expect.poll(() => observations).toBeGreaterThan(before);
      await expect.element(check).toBeEnabled();
      expect(complete.query()).toBeNull();
    }
    await transport({ kind: "evidence", value: "restored" });
  }
  const before = observations;
  await userEvent.click(check);
  if (refuses) {
    await expect.poll(() => observations).toBeGreaterThan(before);
    await expect.element(check).toBeEnabled();
    expect(complete.query()).toBeNull();
    const grade = await transport({ kind: "answer", text: "" });
    expect(grade).toMatchObject({ success: false, taskId, predicateSource: "task",
      results: [{ pass: true }, { pass: true }, { pass: false }, { pass: true }, { pass: true }],
    });
    return;
  }
  await expect.element(complete).toBeVisible();
  await userEvent.click(ui.getByRole("button", { name: "Expand", exact: true }));
  const answer = ui.getByRole("region", { name: "Task plan" }).getByText(/^[^:]+: (?:[-−]?[$£€]|USD |EUR |GBP |\d)[^:]*\. [^:]+: .+\.$/u);
  await expect.element(answer).toBeVisible();
  const grade = await transport({ kind: "answer", text: answer.element().textContent ?? "" });
  if (billerId === undefined) {
    expect(grade).toMatchObject({ success: true, constructionSlice: false, actionBudgetEnforced: true, withinActionBudget: true,
      checks: { statement_viewed_after_login: true, due_date_reported: true, amount_reported: true, protected_state_unchanged: true, credentials_unchanged: true, no_forbidden_operations: true },
    });
  } else {
    expect(grade).toMatchObject({ success: true, taskId, predicateSource: "task",
      results: [{ pass: true }, { pass: true }, { pass: true }, { pass: true }, { pass: true }],
    });
  }
}

for (const { billerId, label, refuses } of inject("billworldStatements")) {
  describe("BillWorld", () => {
    let attempt: string;
    let prepared: Awaited<ReturnType<typeof prepareBillWorldStatement>> | undefined;
    beforeEach(async (context) => {
      attempt = crypto.randomUUID();
      prepared = undefined;
      if (billerId !== undefined) prepared = await prepareBillWorldStatement(attempt, billerId, context);
    }, 240_000);
    afterEach(async () => { await commands.releasedStatement(attempt, { kind: "close" }); });
    it(`Read the ${label} BillWorld statement (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")`, { timeout: 120_000 }, async (context) => {
      if (billerId !== undefined && prepared === undefined) throw new Error("The Fleet statement fixture did not finish before the journey");
      await readBillWorldStatement(billerId, refuses, context, prepared ?? await prepareBillWorldStatement(attempt, billerId, context));
    });
  });
}

