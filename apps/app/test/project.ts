import tailwindcss from "@tailwindcss/vite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";
import type { BrowserContext, CDPSession, Page } from "playwright";
import { defaultClientConditions, type PluginOption } from "vite";
import { defineConfig } from "vitest/config";
import type { BrowserConfigOptions, InlineConfig } from "vitest/node";
import { project } from "vibestack/testing/vitest";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";

export { selfSigned } from "./tls.ts";

type GraceTests = {
  root: string;
  commands: NonNullable<BrowserConfigOptions["commands"]>;
  provide: NonNullable<InlineConfig["provide"]>;
  browser?: { include?: string[]; plugins?: PluginOption[]; globalSetup?: string[] };
  reporters?: InlineConfig["reporters"];
};

export const graceTests = ({ root, commands, provide, browser = {}, reporters }: GraceTests) => {
  const base = project({ root, plugins: [tailwindcss()] });
  return defineConfig(async (env) => {
    const config = await (typeof base === "function" ? base(env) : base);
    const projects = config.test?.projects?.map((entry) =>
      typeof entry === "object" && "test" in entry && entry.test?.browser
        ? {
            ...entry,
            ...(browser.plugins && { plugins: browser.plugins }),
            optimizeDeps: { ...entry.optimizeDeps, include: [...(entry.optimizeDeps?.include ?? []), "effect/crypto", "effect/References", "effect/testing", "pdf-lib"] },
            test: {
              ...entry.test,
              ...(browser.include && { include: browser.include }),
              ...(browser.globalSetup && { globalSetup: browser.globalSetup }),
              browser: { ...entry.test.browser, connectTimeout: 180_000, commands },
            },
          }
        : entry);
    return {
      ...config,
      resolve: { ...config.resolve, conditions: ["eliza-source", ...defaultClientConditions] },
      test: { ...config.test, ...(reporters && { reporters }), projects, provide, globalSetup: [fileURLToPath(new URL("setup.vibe", import.meta.url))] },
    };
  });
};

declare module "vitest" {
  interface ProvidedContext {
    site: string;
    cloud: string;
    groundProxy: string;
  }
}

export type SurfaceCommand = Parameters<SurfacePlugin["controlPage"]>[0];
export type Site = { page: Page; origin: string; browser: BrowserContext; session: CDPSession; world?: { loaderId: string; executionContextId: number } };
export type SiteObservation =
  | { kind: "read"; selector?: string }
  | { kind: "inspectGuide" }
  | { kind: "tapGuide" }
  | { kind: "hoverGuide" }
  | { kind: "control"; request: SurfaceCommand };

const PageText = Schema.Struct({ title: Schema.String, text: Schema.String, truncated: Schema.Boolean, readyState: Schema.Literals(["loading", "interactive", "complete"]) });
async function source(file: "command" | "guidance", entry: "pageCommand" | "pageGuidance") {
  const location = new URL(`../../../vendor/eliza/packages/os/browser/src/page-${file}.mjs`, import.meta.url);
  const exports = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(await import(location.href));
  const run = exports[entry];
  if (typeof run !== "function") throw new Error("The pinned browser command is missing");
  return Function.prototype.toString.call(run);
}

const observationWorld = "grace-benchmark";

export async function observeFromDocumentStart(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Page.enable");
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    worldName: observationWorld,
    source: `if (window === window.top) (${await source("command", "pageCommand")})(null)`,
  });
  return session;
}

export async function observeSite(existing: Site, action: SiteObservation) {
  const { page, origin, session } = existing;
  const { frameTree } = await session.send("Page.getFrameTree");
  const { id, loaderId, url } = frameTree.frame;
  if (new URL(url).origin !== origin) throw new Error("The site left its benchmark origin");
  if (existing.world?.loaderId !== loaderId) {
    const { executionContextId } = await session.send("Page.createIsolatedWorld", { frameId: id, worldName: observationWorld });
    existing.world = { loaderId, executionContextId };
  }
  const { executionContextId } = existing.world;
  const evaluate = async (expression: string): Promise<unknown> => {
    const value = await session.send("Runtime.evaluate", { expression, contextId: executionContextId, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  };
  if (action.kind === "read") {
    if (action.selector !== undefined) {
      const reader = readFileSync(new URL("../../../vendor/eliza/packages/os/android/browser-surface/resources/read-page.js", import.meta.url), "utf8");
      const result = Schema.decodeUnknownSync(Schema.Struct({
        url: Schema.String, title: Schema.String, text: Schema.String, truncated: Schema.Boolean,
      }))(await evaluate(`(${reader})(${JSON.stringify(action.selector)})`));
      const { frameTree: current } = await session.send("Page.getFrameTree");
      if (current.frame.loaderId !== loaderId || result.url !== url) throw new Error("The website document changed during the read");
      return result;
    }
    const content = await evaluate(`(() => {
      const text = document.body?.innerText ?? "";
      return { title: document.title, text: text.slice(0, 6000), truncated: text.length > 6000, readyState: document.readyState };
    })()`);
    return { url, documentId: loaderId, ...Schema.decodeUnknownSync(PageText)(content) };
  }
  if (action.kind === "inspectGuide" || action.kind === "tapGuide" || action.kind === "hoverGuide") {
    if (action.kind !== "inspectGuide") await page.bringToFront();
    const point = Schema.decodeUnknownSync(Schema.NullOr(Schema.Struct({
      x: Schema.Finite, y: Schema.Finite, snapshotId: Schema.String, menu: Schema.Boolean, label: Schema.String,
    })))(await evaluate(`(() => {
      const guide = globalThis.__elizaPageGuidanceV1;
      const snapshot = globalThis.__elizaBrowserControlV1;
      if (!guide?.visible || guide.invalidated || guide.paused || !guide.host.isConnected ||
          snapshot?.document !== document || snapshot.url !== location.href || snapshot.snapshotId !== guide.id) return null;
      const node = snapshot.nodes.get(guide.nodeId)?.node;
      const ring = guide.shadow.querySelector(".ring");
      if (!node?.isConnected || !ring || ring.hidden || !ring.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
      const rect = ring.getBoundingClientRect();
      const view = visualViewport;
      if (!view || rect.width <= 0 || rect.height <= 0 || rect.left < view.offsetLeft || rect.top < view.offsetTop ||
          rect.right > view.offsetLeft + view.width || rect.bottom > view.offsetTop + view.height) return null;
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const menu = Boolean(node.closest('[role="menuitem"]:is([aria-haspopup="true"],[aria-haspopup="menu"])'));
      const label = (node.getAttribute("aria-label") || node.innerText || "").trim().slice(0, 100);
      return node.contains(document.elementFromPoint(x, y)) ? { x, y, snapshotId: guide.id, menu, label } : null;
    })()`));
    const { frameTree: current } = await session.send("Page.getFrameTree");
    const sameDocument = current.frame.loaderId === loaderId && current.frame.url === url;
    if (action.kind === "inspectGuide") {
      if (!sameDocument) throw new Error("The benchmark document changed during the guide check");
      return { ringAvailable: point !== null };
    }
    if (!point || !sameDocument) return { tapped: false, disclosed: false, url };
    if (action.kind === "hoverGuide") {
      if (!point.menu) return { disclosed: false, url, reason: "The highlighted control has no declared menu", label: point.label };
      const { x, y, snapshotId } = point;
      const selectVisibleChildren = ({ x, y }: { x: number; y: number }) => {
        const menu = document.elementFromPoint(x, y)?.closest('[role="menuitem"][aria-haspopup]');
        const item = menu?.closest('li,[role="presentation"],[role="none"]');
        const controlled = menu?.getAttribute("aria-controls");
        const declared = controlled ? document.getElementById(controlled) : null;
        const submenu = declared ?? item?.querySelector('[role="menu"],ul,ol');
        const items = submenu?.querySelectorAll('[role="menuitem"],a[href],button') ?? [];
        return [...items].filter((entry) => {
          const rect = entry.getBoundingClientRect();
          return entry.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && rect.width > 0 && rect.height > 0 &&
            entry.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }).length;
      };
      const before = await page.evaluate(selectVisibleChildren, { x, y });
      if (before !== 0) return { disclosed: false, url, reason: "The menu was already open", before, label: point.label };
      await page.mouse.move(x, y);
      await page.waitForFunction(selectVisibleChildren, { x, y }, { timeout: 8000 });
      const after = await page.evaluate(selectVisibleChildren, { x, y });
      const { frameTree: revealed } = await session.send("Page.getFrameTree");
      if (after <= before || revealed.frame.loaderId !== loaderId || revealed.frame.url !== url)
        return { disclosed: false, url };
      return { disclosed: true, url, label: point.label, documentId: loaderId, snapshotId, pointer: { x, y }, before, after };
    }
    await page.mouse.click(point.x, point.y);
    return { tapped: true, url };
  }
  const { request } = action;
  const { command } = request;
  if (command.subaction !== "snapshot" && command.subaction !== "guide")
    throw new Error("The benchmark surface accepts only observation and show-only guidance");
  if (command.subaction === "snapshot" && command.statementRegions && request.documentId !== loaderId)
    throw new Error("The requested statement document changed");
  if (command.subaction === "guide" && command.guidance?.kind !== "hide" &&
      (request.documentId !== loaderId || command.guidance?.kind !== "show" || command.guidance.action !== undefined || command.guidance.origin !== origin))
    throw new Error("The benchmark guide no longer belongs to the current document");
  const snapshotId = command.subaction === "snapshot" ? randomUUID() : undefined;
  const expression = snapshotId
    ? `(${await source("command", "pageCommand")})(${JSON.stringify(command)}, ${JSON.stringify(snapshotId)})`
    : `(${await source("guidance", "pageGuidance")})(${JSON.stringify(command.guidance)})`;
  const result = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(await evaluate(expression));
  const { frameTree: after } = await session.send("Page.getFrameTree");
  if (after.frame.loaderId !== loaderId) throw new Error("The website document changed during the request");
  return { documentId: loaderId, frameScope: "main", result: snapshotId && !result.error ? { ...result, snapshotId } : result };
}
