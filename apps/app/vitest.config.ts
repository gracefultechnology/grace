import { randomUUID, randomInt } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { Page } from "playwright";
import type { BrowserCommandContext } from "vitest/node";
import { graceTests, observeFromDocumentStart, observeSite, type Site, type SiteObservation } from "./test/project.ts";

const agentModel = Schema.decodeUnknownSync(Schema.Struct({ model: Schema.NonEmptyString }))(JSON.parse(readFileSync(join(import.meta.dirname, "agent/policy.json"), "utf8"))).model;
const ModelReply = Schema.Struct({ choices: Schema.Array(Schema.Struct({ message: Schema.Struct({ content: Schema.String }) })) });
const realModelCredential = process.env.GRACE_BENCHMARK_CLEF_ORIGIN && process.env.GRACE_BENCHMARK_CLEF_KEY
  ? { origin: process.env.GRACE_BENCHMARK_CLEF_ORIGIN, key: process.env.GRACE_BENCHMARK_CLEF_KEY } : undefined;
async function realModel(_context: BrowserCommandContext, system: string, messages: readonly { role: "user" | "assistant"; content: string }[]) {
  if (!realModelCredential || new URL(realModelCredential.origin).protocol !== "https:") throw new Error("The real model requires a test credential");
  const response = await fetch(new URL("/api/v1/chat/completions", realModelCredential.origin), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${realModelCredential.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: agentModel, max_tokens: 1024, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!response.ok) throw new Error(`The real model answered ${response.status}`);
  const [choice] = Schema.decodeUnknownSync(ModelReply)(await response.json()).choices;
  if (!choice) throw new Error("The real model gave no reply");
  return choice.message.content;
}

async function googleConsent(context: BrowserCommandContext, endpoint: string, address: string) {
  const expected = new URL(endpoint);
  if (expected.hostname !== "127.0.0.1" || expected.pathname !== "/o/oauth2/v2/auth" || !address.endsWith("@grace.test"))
    throw new Error("Google consent tests use only a local fixture and synthetic email");
  const isPopup = (page: Page) => page !== context.page && (page.url() === endpoint || page.url() === "about:blank");
  const popup = context.context.pages().find(isPopup) ?? await context.context.waitForEvent("page", { predicate: isPopup });
  try {
    await popup.waitForURL(endpoint);
    await popup.getByRole("heading", { name: "Sign in to Google" }).waitFor();
    await popup.getByLabel("Email", { exact: true }).fill(address);
    await popup.getByLabel("Password", { exact: true }).fill("fixture-password");
    const callback = new URL(expected.searchParams.get("redirect_uri") ?? "", expected);
    if (callback.origin !== expected.origin || callback.pathname !== "/fake/google/callback") throw new Error("Unexpected mock Google callback");
    const [consent] = await Promise.all([
      popup.waitForResponse((response) => response.url().startsWith(`${callback.href}?`) && response.request().method() === "GET"),
      popup.getByRole("button", { name: "Allow", exact: true }).click(),
    ]);
    if (!consent.ok()) throw new Error("Mock Google consent was refused");
  } finally {
    await popup.close();
    await context.page.bringToFront();
  }
}

type RecordCase = "later winner" | "earlier winner" | "tied latest" | "changed scope" | "mismatched detail" | "wrong record kind" | "ambiguous collection" | "conflicting counts" | "unclear count" | "conflicting account" | "private form" | "newsletter list" | "unverified account" | "same-name account switch" | "short dates" | "public list";
type RecordAction =
  | { kind: "open"; scenario: RecordCase; decisionUrl: string }
  | { kind: "close" } | { kind: "requests" } | { kind: "accountVisits" }
  | { kind: "manualRecordLink"; label: "View order" | "My Account" }
  | SiteObservation;
const recordSites = new WeakMap<Page, { site: Site; decisionUrl: string; chatUrl: string; requests: { count: number; leaked: boolean }; accountVisits?: string[] }>();

async function recordPage(context: BrowserCommandContext, action: RecordAction) {
  const open = recordSites.get(context.page);
  if (action.kind === "open") {
    if (open) throw new Error("The record fixture is already open");
    const browser = await context.context.browser()?.newContext();
    if (!browser) throw new Error("The record fixture needs Chromium");
    const origin = "https://records.localhost";
    const accountVisits: string[] | undefined = action.scenario === "same-name account switch" ? [] : undefined;
    const requests = { count: 0, leaked: false };
    const chatUrl = new URL("/api/v1/chat/completions", action.decisionUrl).href;
    try {
      const website = await browser.newPage();
      const session = await observeFromDocumentStart(website);
      await website.route(`${origin}/**`, (route) => {
        const url = new URL(route.request().url());
        const later = url.searchParams.get("page") === "2";
        const account = later && action.scenario === "changed scope" ? "acct-a" : "acct-A";
        const dashboard = url.pathname === "/home";
        if (route.request().isNavigationRequest())
          accountVisits?.push(`${url.pathname}:${dashboard ? "A" : "B"}`);
        const index = later ? 2 : 1;
        const unbound = action.scenario === "public list" || action.scenario === "unverified account";
        const conflictingCount = action.scenario === "conflicting counts" || action.scenario === "unclear count";
        const single = unbound || conflictingCount || accountVisits !== undefined;
        const detail = url.pathname.startsWith("/view/");
        const label = action.scenario === "mismatched detail" ? "private-canary-wrong" : "private-canary-" + url.pathname.split("/").at(-1);
        const newer = action.scenario === "earlier winner" ? !later : later;
        const day = newer && action.scenario !== "tied latest" ? 18 : 17;
        const date = action.scenario === "earlier winner" ? `<time datetime="2026-10-${day}">10/${day}/26</time>` :
          action.scenario === "short dates" ? `10/${day}/26` : `2026-10-${day}`;
        const status = action.scenario === "earlier winner" ? "Canceled" : "Complete";
        const newsletter = '<form><label>Newsletter email<input type="email"></label><button type="submit">Subscribe</button></form>';
        const homepage = '<h1>My Account</h1><nav><a id="orders" href="/list">My Orders</a></nav>' +
          `<section><h2>Recent orders</h2><table><tbody><tr>${accountVisits ? `<td>private-canary-1</td><td>${date}</td><td>${status}</td>` : ""}<td><a href="/view/1">View order</a></td></tr></tbody></table></section>`;
        const totals = conflictingCount
          ? `<div><p>1 Item</p><section><p>${action.scenario === "unclear count" ? "Showing part of 8" : "Showing 1–1 of 8"}</p></section></div>`
          : `<p>${single ? "1 Item" : `Items ${index} to ${index} of 2 total`}</p>`;
        const content = detail ? `<h1>${action.scenario === "wrong record kind" ? "Invoice" : "Order"} #${label}</h1>` +
          (accountVisits ? `<p>${status}</p><time>${date}</time><a href="/home">My Account</a>` : "") : dashboard ?
          homepage + (action.scenario === "private form" ?
            '<form aria-label="Sign in"><label>Username<input name="username"></label><label>Password<input name="password" type="password"></label><button type="submit">Sign in</button></form>' :
            newsletter) :
          `<h1>Orders</h1>${totals}<table>
          <thead><tr><th>Order number</th><th>Order date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody><tr><td>private-canary-${index}</td><td>${date}</td><td>${status}</td><td><a id="details" href="/view/${index}">View order</a></td></tr></tbody>
        </table><nav aria-label="Pages">${single ? "" : later ? '<a id="previous" href="/list">Previous</a>' : '<a id="next" href="/list?page=2">Next</a>'}</nav>` + (action.scenario === "newsletter list" ? newsletter : "");
        const decoy = action.scenario === "ambiguous collection" ?
          '<section><p>1 Item</p><table><thead><tr><th>Order number</th><th>Order date</th><th>Status</th></tr></thead><tbody><tr><td>private-canary-decoy</td><td>2026-10-20</td><td>Complete</td></tr></tbody></table></section>' : "";
        const badge = action.scenario === "conflicting account" ? '<span aria-label="Account">#acct-B</span>' : "";
        const banner = accountVisits ? `<header><span>Welcome, Morgan Lee</span>${dashboard ? "<p>Account ID: private-canary-A</p>" : ""}</header>`
          : unbound ? "" : `<header>Account ID: ${account}${badge}</header>`;
        const scope = action.scenario === "public list" ? ' aria-label="Public records"' : "";
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><title>Record fixture</title>${banner}<main${scope}>${content}${decoy}</main>` });
      });
      await context.page.route(action.decisionUrl, async (route) => {
        requests.count++;
        requests.leaked ||= (route.request().postData() ?? "").includes("private-canary");
        await route.abort();
      });
      await context.page.route(chatUrl, (route) => {
        requests.leaked ||= (route.request().postData() ?? "").includes("private-canary");
        return route.continue();
      });
      const url = origin + (accountVisits || action.scenario === "later winner" || action.scenario === "private form" ? "/home" : "/list");
      await website.goto(url);
      recordSites.set(context.page, { site: { page: website, origin, browser, session }, decisionUrl: action.decisionUrl, chatUrl, requests, accountVisits });
      await context.page.bringToFront();
      return { url };
    } catch (error) {
      await context.page.unroute(action.decisionUrl);
      await context.page.unroute(chatUrl);
      await browser.close();
      throw error;
    }
  }
  if (!open) throw new Error("The record fixture is not open");
  if (action.kind === "close") {
    recordSites.delete(context.page);
    await context.page.unroute(open.decisionUrl);
    await context.page.unroute(open.chatUrl);
    await open.site.browser.close();
    return {};
  }
  if (action.kind === "requests") return open.requests;
  if (action.kind === "accountVisits") return { visits: open.accountVisits };
  if (action.kind === "manualRecordLink") {
    if (!open.accountVisits) throw new Error("This fixture has no manual account-switch journey");
    await open.site.page.getByRole("link", { name: action.label, exact: true }).click();
    return { tapped: true };
  }
  return observeSite(open.site, action);
}

async function privateVerification(context: BrowserCommandContext, cloud: string, key: string) {
  const gmail = new URL(cloud);
  if (gmail.protocol !== "http:" || gmail.hostname !== "127.0.0.1" || !key.startsWith("fake-key-"))
    throw new Error("Private verification requires the local synthetic provider");
  const run = randomUUID();
  const password = randomUUID();
  const delivered = new Set<string>();
  const visits = new Map<string, { current: string; accepted: boolean }>();
  const mailbox = "owner@grace.test";
  const mailHeaders = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const SearchResult = Schema.Struct({ messages: Schema.Array(Schema.Struct({ externalId: Schema.String })) });
  const OpenedMessage = Schema.Struct({ bodyText: Schema.String });
  const site = createServer(async (request, response) => {
    const [visit, action] = (request.url ?? "").slice(1).split("/");
    if (!visit || !["primary", "foreign"].includes(visit)) {
      response.writeHead(404).end();
      return;
    }
    const send = (title: string, body: string, status = 200) => response.writeHead(status, {
      "Content-Type": "text/html", "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
    }).end(`<!doctype html><html lang="en"><title>${title}</title><main><h1>${title}</h1>${body}</main></html>`);
    try {
      if (request.method === "GET" && action === undefined) {
        send("Synthetic website sign-in", `<form method="post" action="/${visit}/sign-in">
          <label>Username <input name="username" autocomplete="username" required></label>
          <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
          <button>Sign in</button></form>`);
        return;
      }
      if (request.method !== "POST") { response.writeHead(404).end(); return; }
      let body = "";
      for await (const part of request) {
        body += String(part);
        if (body.length > 512) { response.writeHead(413).end(); return; }
      }
      const form = new URLSearchParams(body);
      const previous = visits.get(visit);
      const correctLogin = action === "sign-in" && form.get("username") === mailbox && form.get("password") === password;
      if (correctLogin || (action === "replace" && previous && !previous.accepted)) {
        let current: string;
        do { current = String(randomInt(100000, 1000000)); } while (delivered.has(current));
        const mailed = await fetch(new URL("/fake/gmail/incoming", gmail), {
          method: "POST", headers: mailHeaders, body: JSON.stringify({
            to: mailbox, from: "Synthetic issuer", fromEmail: "issuer@grace.test",
            subject: `${run} ${visit} verification code`, body: `Your verification code is ${current}.`,
          }),
        });
        if (!mailed.ok) { send("Delivery failed", "", 502); return; }
        delivered.add(current);
        visits.set(visit, { current, accepted: false });
      } else if (action === "verify" && previous && !previous.accepted) {
        if (form.get("code") === previous.current) {
          previous.accepted = true;
          send("Code accepted", "");
          return;
        }
      } else {
        send("Sign-in refused", "", 403);
        return;
      }
      send("Confirm your test email", `${action === "verify" ? '<p role="status">The code was rejected.</p>' : ""}
        <form method="post" action="/${visit}/verify"><label>Verification code
        <input name="code" inputmode="numeric" autocomplete="one-time-code" required></label><button>Verify code</button></form>
        <form method="post" action="/${visit}/replace"><button>Send a replacement</button></form>`);
    } catch {
      send("Synthetic issuer failed", "", 500);
    }
  });
  site.listen(0, "127.0.0.1");
  let primary: Page | undefined;
  let foreign: Page | undefined;
  let phase = "start issuer";
  try {
    await once(site, "listening");
    const address = site.address();
    if (!address || typeof address === "string") throw new Error("Missing local site");
    const enter = async (visit: "primary" | "foreign") => {
      const page = await context.context.newPage();
      if (visit === "primary") primary = page;
      else foreign = page;
      page.setDefaultTimeout(10_000);
      await page.goto(`http://127.0.0.1:${address.port}/${visit}`);
      await page.getByLabel("Username", { exact: true }).fill(mailbox);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("heading", { name: "Confirm your test email" }).waitFor();
      return page;
    };
    const mailCode = async (visit: string) => {
      const name = "/api/v1/eliza/google/gmail";
      const search = new URL(name + "/search", gmail);
      search.searchParams.set("query", `in:inbox ${run} ${visit}`);
      const listed = await fetch(search, { headers: mailHeaders });
      if (!listed.ok) throw new Error("Mailbox unavailable");
      const message = Schema.decodeUnknownSync(SearchResult)(await listed.json()).messages[0];
      if (!message) throw new Error("Synthetic verification mail missing");
      const read = new URL(name + "/read", gmail);
      read.searchParams.set("messageId", message.externalId);
      const opened = await fetch(read, { headers: mailHeaders });
      if (!opened.ok) throw new Error("Synthetic message unavailable");
      const text = Schema.decodeUnknownSync(OpenedMessage)(await opened.json()).bodyText;
      const code = text.match(/^Your verification code is ([0-9]{6})\.$/)?.[1];
      if (!code) throw new Error("Invalid synthetic message");
      return code;
    };
    const submit = async (page: Page, code: string) => {
      await page.getByLabel("Verification code", { exact: true }).fill(code);
      await page.getByRole("button", { name: "Verify code", exact: true }).click();
    };
    phase = "sign in and deliver two independent messages";
    const page = await enter("primary");
    await enter("foreign");
    const previous = await mailCode("primary");
    const other = await mailCode("foreign");
    phase = "reject foreign code";
    await submit(page, other);
    await page.getByText("The code was rejected.", { exact: true }).waitFor();
    phase = "reject replaced code";
    await page.getByRole("button", { name: "Send a replacement" }).click();
    const replacement = await mailCode("primary");
    await submit(page, previous);
    await page.getByText("The code was rejected.", { exact: true }).waitFor();
    phase = "accept current code only on website";
    await submit(page, replacement);
    await page.getByRole("heading", { name: "Code accepted" }).waitFor();
    if (visits.get("foreign")?.accepted !== false) throw new Error("Independent visit was affected");
  } catch {
    throw new Error(`Synthetic sign-in journey did not finish at ${phase}`);
  } finally {
    try {
      await Promise.all([primary?.close(), foreign?.close()]);
      await context.page.bringToFront();
    } finally {
      site.closeAllConnections();
      await new Promise<void>((done) => { site.close(() => done()); });
    }
  }
}

declare module "vitest/browser" {
  interface BrowserCommands {
    recordPage: (action: RecordAction) => Promise<Record<string, unknown>>;
    googleConsent: (endpoint: string, address: string) => Promise<void>;
    privateVerification: (cloud: string, key: string) => Promise<void>;
    realModel: (system: string, messages: readonly { role: "user" | "assistant"; content: string }[]) => Promise<string>;
  }
}
declare module "vitest" {
  interface ProvidedContext {
    realModel: boolean;
  }
}

export default graceTests({
  root: import.meta.dirname,
  commands: { googleConsent, privateVerification, recordPage, realModel },
  provide: { realModel: realModelCredential !== undefined },
});
