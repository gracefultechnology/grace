// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/files.md, "Story: Save, share and remove the chosen file"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/emailItem.md, "Story: Delete a message and recover it safely"
import { Effect, Fiber, Latch, Layer, ManagedRuntime, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { act } from "react";
import { expect, inject, it, onTestFinished, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { addAccount, goBack, initial } from "../gen/app__accounts.ts";
import { tabUrl } from "../gen/app__browser.ts";
import { approveSave, create, initial as emptyOccurrence, noDetails, noIdentity, save } from "../gen/app__calendar.ts";
import { bindCalendar, initial as emptyCalendar, publishOccurrence, type CalendarView } from "../gen/app__calendarView.ts";
import { parseState as parseMail } from "../gen/app__email.ts";
import { Machine as Setup } from "../gen/app__setup.effect.vibe";
import { type Event as WorkspaceEvent, Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { Email } from "../src/Email.tsx";
import { RuntimeContext } from "../src/useApp.ts";
import { application } from "../src/app.vibe";
import { FileEntry } from "../src/files.vibe";
import { Instances } from "../src/instances.vibe";
import { chooseMailLink } from "../src/mailLink.vibe";
import { AccountActions } from "../src/graceAccount.vibe";
import { client, expire, modelTurns, outage, script, signIn } from "./cloud.vibe";
import { actOnScreen, allowOutlook, browserAccountResponse, connected, tabletView } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

const cloud: string = inject("cloud");
const gmail = "owner@grace.test";
const outlook = "margaret@outlook.com";

const Kept = Schema.Struct({
  sendLookups: Schema.Array(Schema.String),
  draftDeletes: Schema.Array(Schema.String),
  googleRequests: Schema.Array(Schema.String),
  boxes: Schema.Array(Schema.Struct({
    address: Schema.String,
    calendar: Schema.Array(Schema.Struct({ title: Schema.String, startAt: Schema.String, description: Schema.String })),
    mail: Schema.Array(Schema.Struct({
      externalId: Schema.String, subject: Schema.String, labels: Schema.Array(Schema.String), bcc: Schema.Array(Schema.String),
      attachments: Schema.Array(Schema.Struct({ filename: Schema.String })),
    })),
  })),
  changes: Schema.Array(Schema.Struct({ receipt: Schema.Struct({ requestId: Schema.String, kind: Schema.String, state: Schema.String }) })),
});

function kept(): Accounts {
  return connected(addAccount(goBack(connected(initial, "Gmail", gmail, "Gmail"), "AccountPerson"), "AccountPerson"), "Outlook", outlook, "Outlook");
}

async function start(withAccounts = true, tabletCalendar?: CalendarView) {
  const { secret, credentialId } = await Effect.runPromise(Effect.provide(signIn(cloud, withAccounts), client));
  const digest = async (purpose: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(purpose + credentialId))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const scope = { accountId: credentialId, owner: await digest("files/owner"), session: await digest("files/session") };
  let signedIn = false;
  const fetchOriginal = window.fetch.bind(window);
  const browserSession = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin !== location.origin) return fetchOriginal(input, init);
    const account = browserAccountResponse(url, signedIn ? credentialId : undefined);
    if (account) return Promise.resolve(account);
    if (url.pathname === "/api/product/files/scope") return Promise.resolve(Response.json(signedIn ? scope : {}, { status: signedIn ? 200 : 401 }));
    if (url.pathname === "/api/v1/billing/subscription" || url.pathname === "/api/v1/eliza/google/status") return Promise.resolve(new Response(null, { status: 404 }));
    return fetchOriginal(input, init);
  });
  localStorage.clear();
  if (tabletCalendar) {
    localStorage.setItem("accounts", JSON.stringify({ ...initial, nextId: 3 }));
    localStorage.setItem("calendar/0", JSON.stringify(tabletCalendar, (key: string, value: unknown) =>
      key === "sourceAccount" && value === 0 ? undefined : value));
  }
  if (withAccounts) {
    await allowOutlook({ cloud, key: secret, address: outlook });
    localStorage.setItem("accounts", JSON.stringify(kept()));
  }
  const connectivity = vi.spyOn(window.navigator, "onLine", "get");
  const open = () => ManagedRuntime.make(application(undefined, undefined, { url: cloud, key: secret }));
  let runtime = open();
  let view = tabletView(runtime);
  onTestFinished(() => view.dispose());
  await view.render();
  onTestFinished(async () => {
    connectivity.mockRestore();
    browserSession.mockRestore();
    await forgotten(scope.owner);
    localStorage.clear();
  });
  return {
    secret,
    restartFromEarlierMailbox: async (account: number) => {
      await view.dispose();
      const key = `mail/${account}`;
      const raw = localStorage.getItem(key);
      if (raw === null) throw new Error("Missing the saved mailbox");
      const box = parseMail(JSON.parse(raw));
      if (box === undefined) throw new Error("Invalid stored mailbox");
      const { draftsTotal: _, bill: _bill, ...earlier } = box;
      expect(box.messageRef).not.toBe("");
      const oldBill = { ref: "prior-invoice", origin: "https://billing.example", account: "prior-utility", confirmed: true };
      localStorage.setItem(key, JSON.stringify({ ...earlier, bill: oldBill }));
      runtime = open();
      view = tabletView(runtime);
      await view.render();
      const restored = await runtime.runPromise(Effect.gen(function*() {
        const mail = yield* (yield* Instances).mail(account);
        return yield* mail.get();
      }));
      expect(restored).toMatchObject({
        operationId: box.operationId, issuedSends: box.issuedSends, retiredDrafts: box.retiredDrafts,
        outbox: box.outbox, draft: box.draft, draftAttachments: box.draftAttachments, bill: { ref: "", sourceRef: "", confirmed: false },
      });
      expect(restored.messages.map((message) => message.identity)).toEqual(expect.arrayContaining(box.messages.map((message) => message.identity)));
    },
    workspaceEvent: (event: WorkspaceEvent) => act(() => runtime.runPromise(Effect.flatMap(Workspaces, (desk) => desk.send(event, "Person")))),
    browserTabs: () => runtime.runPromise(Effect.flatMap(Workspaces, (desk) => Effect.map(desk.get(), (w) => w.browser.tabs.map((tab) => [tab.id, tabUrl(tab), tab.manualSignIn])))),
    pendingLink: (account: number) => runtime.runPromise(Effect.gen(function*() {
      const shelf = yield* Instances;
      const box = yield* shelf.mail(account);
      const { generation, messageRef: ref, link } = yield* box.get();
      const read = shelf.held(account, ref)?.read;
      const { device, browser } = yield* (yield* Workspaces).get();
      if (!read || link.status !== "LinkHeld") throw new Error("No email link is waiting for confirmation");
      return () => runtime.runPromise(chooseMailLink({ account, ref, generation, version: read.version, link: link.link, deviceVersion: device.contextVersion, browserRevision: browser.revision }, "confirm"));
    })),
    waitingTargets: () => runtime.runPromise(Effect.gen(function*() {
      const shelf = yield* Instances;
      const targets: string[] = [];
      for (const account of [1, 2]) targets.push(...(yield* (yield* shelf.mail(account)).get()).outbox.map((q) => `mail:${account}:${q.operationId}`));
      return targets;
    })),
    appointments: (key: number) => runtime.runPromise(Effect.gen(function*() {
      const shelf = yield* Instances;
      const calendar = yield* shelf.calendar(key);
      return (yield* calendar.get()).entries;
    })),
    libraryOwner: scope.owner,
    providerComponent: () => view.render(<RuntimeContext value={runtime}><div className="fixed inset-0"><Email /></div></RuntimeContext>),
    applicationScreen: () => view.render(),
    changeSession: (active: boolean) => act(async () => {
      signedIn = active;
      await runtime.runPromise(Effect.flatMap(AccountActions, (account) => account.run({ kind: "refresh" })));
    }),
    host: async (availability: "Online" | "Offline") => {
      const online = availability === "Online";
      connectivity.mockReturnValue(online);
      await act(() => Promise.resolve(window.dispatchEvent(new Event(online ? "online" : "offline"))));
      await expect.poll(() => runtime.runPromise(Effect.flatMap(Workspaces, (workspace) =>
        Effect.map(workspace.get(), ({ device }) => device.connectivity)))).toBe(availability);
    },
    person: (event: AccountEvent) => act(() => runtime.runPromise(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson")))),
    company: async () => Schema.decodeUnknownSync(Kept)(await (await fetch(new URL("/fake/account", cloud), { headers: { authorization: `Bearer ${secret}` } })).json()),
  };
}

const click = (target: Parameters<typeof userEvent.click>[0]) => act(() => userEvent.click(target));
const folders = () => page.getByRole("navigation", { name: "Folders" });
const row = (name: string) => folders().getByRole("button", { name: new RegExp(`^${name}`) });
const email = (from: RegExp) => page.getByRole("button", { name: from });
const subject = () => page.getByLabelText("Subject");
const words = () => page.getByRole("textbox", { name: "Write your message, or ask Grace to help" });
const library = (owner: string, version: number) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("grace-files/" + owner, version);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error("The test could not open the file library", { cause: request.error }));
});
const forgotten = (owner: string) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase("grace-files/" + owner);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(new Error("The test could not delete the file library", { cause: request.error }));
});
const writeTo = async (name: string) => {
  await click(page.getByRole("button", { name: "Write" }));
  const recipient = page.getByRole("button", { name, exact: true });
  await expect.element(recipient).toBeVisible();
  await click(recipient);
};
const opened = async (from: RegExp, title: string) => {
  await click(email(from));
  await expect.element(page.getByRole("heading", { name: title })).toBeVisible();
};

async function replyToClinic() {
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(row("All inboxes 5")).toBeVisible();
  await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Reply" }));
  await expect.element(page.getByRole("button", { name: "Remove Main St Clinic" })).toBeVisible();
}

const GoogleGrants = Schema.Array(Schema.Struct({
  connected: Schema.Boolean, connectionId: Schema.String,
  identity: Schema.Struct({ email: Schema.String }), grantedScopes: Schema.Array(Schema.String),
}));

const GoogleCalendarFeed = Schema.Struct({
  calendarId: Schema.String,
  events: Schema.Array(Schema.Struct({
    externalId: Schema.String, title: Schema.String, startAt: Schema.String, description: Schema.String,
  })),
});

it('Gmail signup to Calendar (spec/app/calendars.md, "Story: Ask Grace to put an email’s appointment in my calendar")', async () => {
  const existing = create(emptyOccurrence, {
    ...noIdentity, owner: "tablet", calendarId: "tablet", occurrenceId: "outlook-visit", sourceRef: "clinic", sourceAccount: 2,
  }, { ...noDetails, title: "Outlook follow-up", timezone: "UTC", startAt: 1, endAt: 2 }, "CalendarUser");
  const prior = save(approveSave(existing, existing.revision, "CalendarUser"), existing.revision, true, "CalendarStore");
  const bound = bindCalendar(emptyCalendar, "tablet", "tablet", "UTC", "ViewStore");
  const withOutlook = publishOccurrence(bound, prior, 0, true, "ViewStore");
  const legacyDetails = { ...prior.committed, title: "Earlier appointment" };
  const legacy = { ...prior, identity: { ...prior.identity, occurrenceId: "legacy-visit", sourceAccount: 0 }, committed: legacyDetails, draft: legacyDetails };
  const tablet = publishOccurrence(withOutlook, legacy, 0, true, "ViewStore");
  const { secret, company, appointments } = await start(false, tablet);
  const headers = { authorization: `Bearer ${secret}` };
  const grants = async () => Schema.decodeUnknownSync(GoogleGrants)(await (await fetch(`${cloud}/api/v1/eliza/google/accounts?side=owner`, { headers })).json());
  const openedProvider = vi.spyOn(window, "open");
  onTestFinished(() => { openedProvider.mockRestore(); });

  await click(page.getByRole("button", { name: "Settings", exact: true }));
  await click(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Email & calendar" }));
  await click(page.getByRole("button", { name: /^Gmail/ }));
  const pending = page.getByRole("dialog", { name: "Gmail sign-in page" });
  await expect.element(pending).toBeVisible();
  await expect.poll(() => openedProvider.mock.calls.length).toBe(1);
  expect(await grants()).toEqual([]);
  const provider = new URL(String(openedProvider.mock.calls[0][0]));
  expect(provider.origin).toBe(new URL(cloud).origin);
  expect(provider.pathname).toBe("/o/oauth2/v2/auth");
  expect(provider.searchParams.get("response_type")).toBe("code");
  expect(provider.searchParams.get("scope")?.split(" ")).toEqual(expect.arrayContaining([
    "openid", "email", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/calendar.events",
  ]));
  await act(() => commands.googleConsent(provider.href, gmail));
  await expect.element(pending).not.toBeInTheDocument();
  await expect.element(page.getByText("Gmail · Connected")).toBeVisible();
  const [grant] = await grants();
  expect(grant).toMatchObject({ connected: true, identity: { email: gmail } });
  expect(grant.grantedScopes).toEqual(expect.arrayContaining(["gmail.readonly", "calendar.events"]));
  expect(grant.connectionId).not.toBe("");
  expect((await fetch(`${cloud}/gmail/v1/users/me/messages`, { headers })).status).toBe(401);
  await click(page.getByRole("button", { name: "Close Settings", exact: true }));
  const ask = "Help me add the appointment in this email to my calendar.";
  const approve = "Yes, add it";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const day = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, "0"), String(tomorrow.getDate()).padStart(2, "0")].join("-");
  const title = "Visit with Dr. Patel";
  await Effect.runPromise(Effect.provide(script(cloud, secret, [
    { said: ask, answer: JSON.stringify({ text: "Add the visit with Dr. Patel tomorrow at 10 am?", isQuestion: true, answers: [approve, "No, thanks"], actions: [{ kind: "proposeFromMessage", title, day, time: "10:00" }] }) },
    { said: approve, answer: JSON.stringify({ text: "I’ll ask your calendar to save it.", isQuestion: false, answers: [], actions: [{ kind: "confirmProposal" }] }) },
  ]), client));
  const windowStart = new Date(tomorrow);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 1);
  const range = new URLSearchParams({
    grantId: grant.connectionId, calendarId: "primary", timeMin: windowStart.toISOString(), timeMax: windowEnd.toISOString(),
  });
  const visits = async () => {
    const response = await fetch(`${cloud}/api/v1/eliza/google/calendar/feed?${range}`, { headers });
    expect(response.ok).toBe(true);
    const feed = Schema.decodeUnknownSync(GoogleCalendarFeed)(await response.json());
    expect(feed.calendarId).toBe("primary");
    return feed.events.filter((event) => event.title === title);
  };
  await click(page.getByRole("button", { name: /^Email/ }));
  await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
  await expect.element(page.getByText(/appointment with Dr\. Patel tomorrow at 10:00 am/)).toBeVisible();
  const askGrace = page.getByRole("button", { name: "Ask Grace", exact: true });
  await click(askGrace);
  const message = page.getByRole("textbox", { name: "Message to Grace" });
  await expect.element(message).toBeVisible();
  await act(() => userEvent.type(message, ask + "{Enter}"));
  const yes = page.getByRole("button", { name: approve, exact: true });
  await expect.element(yes).toBeVisible();
  expect(await visits()).toEqual([]);
  expect((await company()).googleRequests).not.toContain("POST /calendar/v3/calendars/primary/events");
  await click(yes);
  await expect.poll(visits, { timeout: 10000 }).toHaveLength(1);
  const [saved] = await visits();
  expect(saved).toMatchObject({ title, startAt: tomorrow.toISOString() });
  expect(saved.externalId).toMatch(/^appointment/);
  expect(saved.description).toContain("Visit form");
  const sources = async () => (await Promise.all([appointments(0), appointments(3)])).flat()
    .filter((entry) => entry.hasSaved && entry.phase !== "Deleted" && entry.identity.sourceRef === "clinic").map((entry) => [entry.identity.sourceAccount, entry.committed.title]);
  await expect.poll(sources).toEqual([[2, "Outlook follow-up"], [0, "Earlier appointment"], [3, title]]);
  await click(page.getByRole("button", { name: "Close Grace", exact: true }));
  await click(page.getByRole("button", { name: "Close Email", exact: true }));
  await click(page.getByRole("group", { name: "Calendar", exact: true }).getByRole("button", { name: title }));
  await expect.element(page.getByText(/Visit form/)).toBeVisible();
  const requests = (await company()).googleRequests;
  expect(requests.slice(0, 4)).toEqual(["GET /o/oauth2/v2/auth", "POST /o/oauth2/v2/auth", "POST /token", "GET /oauth2/v3/userinfo"]);
  expect(requests).toEqual(expect.arrayContaining([
    "GET /gmail/v1/users/me/messages", "GET /gmail/v1/users/me/messages/clinic",
    "POST /calendar/v3/calendars/primary/events", "GET /calendar/v3/calendars/primary/events",
  ]));
  expect(requests.filter((request) => request === "POST /calendar/v3/calendars/primary/events")).toHaveLength(1);
});

it("See all my email in one place", async () => {
  const { secret, host, person, company, libraryOwner, changeSession, providerComponent, applicationScreen } = await start();

  // spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes"
  const card = page.getByRole("button", { name: /^Email/ });
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);
  // spec/app/mailboxes.md, "The Home Email card says Waiting for the internet, Not connected, or how many are new"
  await expect.element(card).toHaveAccessibleName(/5 new/);
  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"
  await host("Offline");
  await expect.element(card).toHaveAccessibleName(/Waiting for the internet/);
  await host("Online");
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);

  await click(card);
  await expect.element(row("All inboxes 5")).toBeVisible();
  await changeSession(true);
  await expect.element(row("Outlook 1")).toBeVisible();
  await providerComponent();
  await expect.element(row("Gmail 4")).toBeVisible();
  await expect.element(row("Outlook 1")).toBeVisible();
  const clinic = email(/Main St Clinic/);
  const church = email(/St\. Mark’s Church Office/);
  await expect.element(clinic).toBeVisible();
  await expect.element(email(/^Main St Clinic.*Has attachments/)).toBeVisible();
  await expect.element(email(/^Riverside Power.*Has attachments/)).not.toBeInTheDocument();
  await expect.element(church).toBeVisible();

  await click(row("Outlook"));
  await expect.element(row("Outlook")).toHaveAttribute("aria-current", "page");
  await expect.element(clinic).not.toBeInTheDocument();
  await expect.element(church).toBeVisible();
  await click(row("All inboxes"));
  await expect.element(clinic).toBeVisible();

  await act(() => userEvent.fill(page.getByRole("searchbox", { name: "Search email" }), "clinic"));
  await expect.element(page.getByRole("searchbox", { name: "Search email" })).toHaveValue("clinic");
  await expect.element(clinic).toBeVisible();
  await expect.element(church).not.toBeInTheDocument();
  await act(() => userEvent.fill(page.getByRole("searchbox", { name: "Search email" }), ""));
  await expect.element(church).toBeVisible();

  await host("Offline");
  await expect.element(page.getByText("No internet right now")).toBeVisible();
  await expect.element(clinic).toBeVisible();
  await host("Online");
  await expect.element(page.getByText("No internet right now")).not.toBeInTheDocument();

  const png = /^data:image\/png;base64,iVBORw0KGgo/;
  const unread = async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.externalId === "family").map((m) => m.labels.includes("UNREAD")));
  await opened(/^Ruth.*Has attachments/, "Lunch on Sunday?");
  await expect.element(page.getByText("3 photos")).toBeVisible();
  await expect.poll(unread).toEqual([false]);
  await expect.element(page.getByRole("img", { name: "Bow.png" })).toHaveAttribute("src", expect.stringMatching(png));
  await host("Offline");
  await Effect.runPromise(Effect.provide(outage(cloud, secret, true), client));
  await click(page.getByRole("button", { name: "Bow.png" }));
  await expect.element(page.getByRole("heading", { name: "Photo 1 of 3" })).toBeVisible();
  await expect.element(page.getByRole("img", { name: "Bow.png" })).toHaveAttribute("src", expect.stringMatching(png));
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false), client));
  await host("Online");
  await click(page.getByRole("button", { name: "Next photo" }));
  await expect.element(page.getByRole("heading", { name: "Photo 2 of 3" })).toBeVisible();
  await expect.element(page.getByRole("img", { name: "Piano.png" })).toHaveAttribute("src", expect.stringMatching(png));
  const blocking = await library(libraryOwner, 2);
  await click(page.getByRole("button", { name: "Save to Files" }));
  const unsaved = page.getByRole("alert");
  await expect.element(unsaved).toBeVisible();
  await expect.element(unsaved.getByRole("button", { name: "Try again" })).toBeVisible();
  await click(page.getByRole("button", { name: "Next photo" }));
  await expect.element(page.getByRole("heading", { name: "Photo 3 of 3" })).toBeVisible();
  await expect.element(unsaved).not.toBeInTheDocument();
  await click(page.getByRole("button", { name: "Save to Files" }));
  await expect.element(unsaved).toBeVisible();
  blocking.close();
  await forgotten(libraryOwner);
  await click(page.getByRole("button", { name: "Try again" }));
  await expect.element(page.getByText("Saved to Files").first()).toBeVisible();
  await click(page.getByRole("button", { name: "Previous photo" }));
  await expect.element(page.getByRole("heading", { name: "Photo 2 of 3" })).toBeVisible();
  await expect.element(unsaved).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Ruth’s email" }));
  await click(page.getByRole("button", { name: "Save all to Files" }));
  await expect.element(page.getByText("3 photos saved to Files")).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(row("Gmail 3")).toBeVisible();
  // spec/app/email.md, "Each search or content read needs current access and the user's choice"
  await click(clinic);
  await expect.element(page.getByText(/appointment with Dr\. Patel tomorrow at 10:00 am/)).toBeVisible();
  await expect.element(page.getByText("Visit form.pdf")).toBeVisible();
  // spec/app/email.md, "Attachment actions preserve exact asset and message identity"; spec/app/files.md, "Saving one attachment or all selected photos is one acknowledged local transaction"
  await click(page.getByRole("button", { name: "Open" }));
  await expect.element(page.getByRole("heading", { name: "Visit form.pdf" })).toBeVisible();
  await expect.poll(() => document.querySelector("object[type='application/pdf']")?.getAttribute("data")).toMatch(/^data:application\/pdf;base64,JVBERi/);
  await expect.element(page.getByText("Page 1 of 2")).toBeVisible();
  await click(page.getByRole("button", { name: "Save to Files" }));
  await expect.element(page.getByText("Saved to Files").first()).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Main St Clinic’s email" }));
  await expect.element(page.getByText("Visit form.pdf")).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(row("Gmail 2")).toBeVisible();

  const dinner = page.getByText(/Thanksgiving dinner is on Thursday the 26th/);
  await click(church);
  await expect.element(dinner).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));

  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"; spec/app/email.md, "Each search or content read needs current access and the user's choice"
  await Effect.runPromise(Effect.provide(expire(cloud, secret, outlook), client));
  await act(() => userEvent.type(page.getByRole("searchbox", { name: "Search email" }), "dinner"));
  await expect.element(page.getByRole("searchbox", { name: "Search email" })).toHaveValue("dinner");
  await expect.element(page.getByText("Outlook needs you to sign in again")).toBeVisible();
  await expect.element(church).toBeVisible();
  await expect.element(clinic).not.toBeInTheDocument();
  await click(church);
  await expect.element(dinner).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await click(row("All inboxes"));
  await expect.element(page.getByRole("searchbox", { name: "Search email" })).toHaveValue("");
  await expect.element(clinic).toBeVisible();
  // spec/app/accounts.md, "Signing in again renews the same account"
  await changeSession(false);
  await applicationScreen();
  await click(page.getByRole("button", { name: "Sign in again" }));
  const sheet = page.getByRole("dialog", { name: "Outlook sign-in page" });
  await expect.element(sheet).toBeVisible();
  await click(sheet.getByRole("button", { name: "Cancel" }));
  await click(page.getByRole("button", { name: "Close Settings" }));
  await expect.element(clinic).toBeVisible();

  // spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"
  await person({ type: "setUse", id: 2, use: { mail: false, calendar: true, contacts: true } });
  await expect.element(church).not.toBeInTheDocument();
  await expect.element(page.getByText("Outlook needs you to sign in again")).not.toBeInTheDocument();
  await expect.element(row("Inbox 2")).toBeVisible();
  await expect.element(row("Outlook")).not.toBeInTheDocument();

  await click(page.getByRole("button", { name: "Close Email" }));
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);
  await click(page.getByRole("button", { name: "Page 2", exact: true }));
  await click(page.getByRole("button", { name: /^Files/ }));
  await expect.element(page.getByText("Sign in to see your files")).toBeVisible();
  await changeSession(true);
  const piano = page.getByRole("button", { name: "Piano.png", exact: true });
  await expect.element(piano).toBeVisible();
  await click(piano);
  await expect.element(page.getByRole("img", { name: "Piano.png" })).toHaveAttribute("src", expect.stringMatching(png));
  await changeSession(false);
  await expect.element(page.getByText("Sign in to see your files")).toBeVisible();
  await expect.element(page.getByRole("img", { name: "Piano.png" })).not.toBeInTheDocument();
  await changeSession(true);
  await expect.element(piano).toBeVisible();
  // spec/app/files.md, "Sharing a photo opens a draft without sending it"; spec/app/email.md, "Attachment actions preserve exact asset and message identity"; spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"
  await expect.element(page.getByText("From Ruth · Lunch on Sunday?")).toBeVisible();
  await click(page.getByRole("radio", { name: "Documents" }));
  await expect.element(page.getByText(/^From Main St Clinic · Saved /)).toBeVisible();
  await click(page.getByRole("radio", { name: "Photos" }));
  await click(piano);
  const share = page.getByRole("button", { name: "Share" });
  const recipients = page.getByRole("heading", { name: "Who is it to?" });
  await expect.element(share).toBeVisible();
  await click(share);
  // spec/app/mailboxes.md, "Writing starts at Who is it to?, and Cc and Bcc show once opened or used"
  await expect.element(recipients).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Email discarded")).toBeVisible();
  await expect.element(row("Inbox")).toHaveAttribute("aria-current", "page");
  await click(page.getByRole("button", { name: "Close Email" }));
  await click(page.getByRole("button", { name: "Page 2", exact: true }));
  await click(page.getByRole("button", { name: /^Files/ }));
  await click(piano);
  await expect.element(share).toBeVisible();
  await click(share);
  await expect.element(recipients).toBeVisible();
  await click(page.getByRole("button", { name: "Susan" }));
  await expect.element(subject()).toHaveValue("A photo");
  await expect.element(page.getByRole("img", { name: "Piano.png" })).toBeVisible();
  const deviceFiles = await library(libraryOwner, 1);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = deviceFiles.transaction("files", "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error("Could not seed saved attachment choices", { cause: transaction.error }));
      const store = transaction.objectStore("files");
      const stored = store.getAll();
      stored.onsuccess = () => {
        try {
          const row = Schema.decodeUnknownSync(Schema.Array(Schema.Struct({ entry: FileEntry, data: Schema.String })))(stored.result)
            .find(({ entry }) => entry.name === "Piano.png");
          const source = row?.entry.source;
          if (!row || !source) throw new Error("Missing the saved source photo");
          for (const name of ["PIANO.PNG", "Phone photo.heic"]) {
            const id = crypto.randomUUID();
            store.add({ ...row, entry: { ...row.entry, id, name, source: { ...source, id, name, sourceRef: id } } });
          }
        } catch (error) {
          transaction.abort();
          reject(new Error("Could not seed saved attachment choices", { cause: error }));
        }
      };
    });
  } finally {
    deviceFiles.close();
  }
  await click(page.getByRole("button", { name: "Attach" }));
  await click(page.getByRole("menuitem", { name: "Choose from Photos" }));
  const photoPicker = page.getByRole("dialog", { name: "Choose from Photos" });
  for (const name of ["PIANO.PNG", "Phone photo.heic"]) {
    const photo = photoPicker.getByRole("button", { name, exact: true });
    await expect.element(photo).toBeVisible();
    await click(photo);
    await expect.element(photoPicker.getByRole("status")).toBeVisible();
    await expect.element(page.getByRole("button", { name: `Remove ${name}`, exact: true })).not.toBeInTheDocument();
  }
  await click(photoPicker.getByRole("button", { name: "Bow.png" }));
  await expect.element(page.getByRole("img", { name: "Bow.png" })).toBeVisible();
  await click(page.getByRole("button", { name: "Add", exact: true }));
  await click(page.getByRole("button", { name: "Add to Cc" }));
  await expect.element(page.getByRole("heading", { name: "Who should get a copy?" })).toBeVisible();
  await click(page.getByRole("button", { name: "Close Email" }));
  await click(page.getByRole("button", { name: /^Email/ }));
  await click(row("Drafts"));
  await expect.element(email(/A photo/)).toBeVisible();
  // spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"; spec/app/email.md, "Sending a saved draft takes it out of Drafts"
  await click(email(/A photo/));
  await expect.element(subject()).toHaveValue("A photo");
  await expect.element(page.getByRole("button", { name: "Remove Piano.png" })).toBeVisible();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "A photo").map((m) => [m.labels, m.attachments.map((a) => a.filename)])), { timeout: 10000 })
    .toEqual([[["SENT"], ["Piano.png", "Bow.png"]]]);

  // spec/app/email.md, "The composer remembers who she is choosing for, Cc and Bcc, and where she attaches from"; spec/app/email.md, "Attachment actions preserve exact asset and message identity"
  await click(row("Inbox"));
  await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Reply" }));
  await act(() => userEvent.fill(words(), "Here is the form."));
  await click(page.getByRole("button", { name: "Attach" }));
  await click(page.getByRole("menuitem", { name: "Choose a file" }));
  const form = page.getByRole("dialog", { name: "Choose a file" }).getByRole("button", { name: "Visit form.pdf" });
  await expect.element(form).toBeVisible();
  await click(form);
  await expect.element(page.getByRole("button", { name: "Remove Visit form.pdf" })).toBeVisible();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "Re: Reminder: your appointment tomorrow at 10 am" && m.labels.includes("SENT")).map((m) => m.attachments)))
    .toEqual([[{ filename: "Visit form.pdf" }]]);
}, 300_000);

it("Write or reply and confirm before sending", async () => {
  const { secret, host, person, company, waitingTargets } = await start();
  const sent = async (title: string) => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === title && m.labels.includes("SENT")).map((m) => ({ ...m, from: b.address })));
  const sentWith = async (title: string) => (await sent(title)).map((m) => m.from);
  // spec/app/email.md, "A reply is addressed to the selected message's verified reply-to"
  await replyToClinic();
  await expect.element(subject()).toHaveValue("Re: Reminder: your appointment tomorrow at 10 am");
  await act(() => userEvent.fill(words(), "Thank you, I’ll be there."));
  // spec/app/email.md, "The visible Send button approves exactly the composer the user sees"
  await click(page.getByRole("button", { name: "Send" }));
  await expect.element(page.getByText("Sent to Main St Clinic")).toBeVisible();
  await expect.poll(() => sentWith("Re: Reminder: your appointment tomorrow at 10 am")).toEqual([gmail]);
  await click(row("Sent"));
  await opened(/Main St Clinic/, "Re: Reminder: your appointment tomorrow at 10 am");
  // spec/app/email.md, "A draft is editable and a reply stays attached to its source message"
  await expect.element(page.getByRole("button", { name: "Forward" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  await click(page.getByRole("button", { name: "Back to Sent" }));
  await click(row("All inboxes"));
  await expect.element(email(/^Main St Clinic.*You replied: “Thank you, I’ll be there\.…”/)).toBeVisible();

  // spec/app/mailboxes.md, "Changing From moves a draft never saved, whole and unapproved, and a saved draft stays"
  await writeTo("Susan");
  await act(() => userEvent.fill(subject(), "Sunday"));
  await act(() => userEvent.fill(words(), "See you on Sunday."));
  await click(page.getByRole("button", { name: "Add", exact: true }));
  await click(page.getByRole("button", { name: "Add to Bcc" }));
  await expect.element(page.getByRole("heading", { name: "Who should get a hidden copy?" })).toBeVisible();
  await click(page.getByRole("button", { name: "Joan" }));
  await click(page.getByRole("button", { name: gmail }));
  await click(page.getByRole("menuitemradio", { name: new RegExp(outlook) }));
  await expect.element(page.getByRole("button", { name: outlook })).toBeVisible();
  await expect.element(subject()).toHaveValue("Sunday");
  await expect.element(words()).toHaveValue("See you on Sunday.");
  await expect.element(page.getByRole("button", { name: "Remove Joan" })).toBeVisible();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(async () => (await sent("Sunday")).map((m) => [m.from, m.bcc])).toEqual([[outlook, ["joan@family.test"]]]);

  // spec/app/email.md, "Attachment actions preserve exact asset and message identity"
  await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Forward" }));
  await click(page.getByRole("button", { name: "David" }));
  await expect.element(subject()).toHaveValue("Fwd: Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Remove Visit form.pdf" }));
  await expect.element(page.getByRole("button", { name: "Remove Visit form.pdf" })).not.toBeInTheDocument();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.element(page.getByText("Sent to David", { exact: true })).toBeVisible();
  await expect.poll(async () => (await sent("Fwd: Reminder: your appointment tomorrow at 10 am")).map((m) => m.attachments)).toEqual([[]]);
  await opened(/^Ruth.*Has attachments/, "Lunch on Sunday?");
  await click(page.getByRole("button", { name: "Bow.png" }));
  await expect.element(page.getByRole("heading", { name: "Photo 1 of 3" })).toBeVisible();
  await click(page.getByRole("button", { name: "Forward" }));
  await expect.element(page.getByRole("heading", { name: "Who is it to?" })).toBeVisible();
  await click(page.getByRole("button", { name: "David" }));
  await expect.element(subject()).toHaveValue("Fwd: Lunch on Sunday?");
  await expect.element(page.getByRole("button", { name: "Remove Bow.png" })).toBeVisible();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(async () => (await sent("Fwd: Lunch on Sunday?")).map((m) => m.attachments)).toEqual([[{ filename: "Bow.png" }]]);

  // spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"
  await click(page.getByRole("button", { name: "Write" }));
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Email discarded")).toBeVisible();
  await writeTo("Susan");
  await act(() => userEvent.fill(words(), "Never mind."));
  await click(page.getByRole("button", { name: "Discard" }));
  await expect.element(page.getByText("Email discarded")).toBeVisible();

  // spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"
  await writeTo("Susan");
  await expect.element(page.getByRole("button", { name: outlook })).toBeVisible();
  await act(() => userEvent.fill(subject(), "Lunch next week"));
  await act(() => userEvent.fill(words(), "Shall we have lunch on Tuesday?"));
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "Lunch next week").map((m) => [b.address, m.labels]))).toEqual([[outlook, ["DRAFT"]]]);
  // spec/app/email.md, "Drafts shows the provider's count of saved drafts, whichever folder is open"; spec/app/mailboxes.md, "Drafts counts the shown accounts’ saved drafts"
  await expect.element(row("Drafts 1")).toBeVisible();
  await click(row("Drafts"));
  await click(email(/^To Susan.*Lunch next week/));
  await expect.element(subject()).toHaveValue("Lunch next week");
  await expect.element(words()).toHaveValue("Shall we have lunch on Tuesday?");
  await expect.element(page.getByRole("button", { name: "Remove Susan" })).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(email(/^To Susan.*Lunch next week/)).toBeVisible();
  await expect.element(row("Drafts 1")).toBeVisible();

  // spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"
  await click(row("All inboxes"));
  await writeTo("Susan");
  await act(() => userEvent.fill(subject(), "Tea on Friday"));
  await act(() => userEvent.fill(words(), "Would you come for tea on Friday?"));
  await click(page.getByRole("button", { name: "Close Email" }));
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "Tea on Friday").map((m) => m.labels))).toEqual([["DRAFT"]]);
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(row("Drafts 2")).toBeVisible();
  await click(row("Drafts"));
  await expect.element(email(/^To Susan.*Tea on Friday/)).toBeVisible();
  await expect.element(row("Drafts 2")).toBeVisible();
  await expect.element(page.getByText("Saved to Drafts")).not.toBeInTheDocument();
  await click(email(/^To Susan.*Lunch next week/));
  await expect.element(subject()).toHaveValue("Lunch next week");
  await click(page.getByRole("button", { name: "Discard" }));
  await expect.element(page.getByText("Email discarded")).toBeVisible();
  await expect.element(email(/^To Susan.*Lunch next week/)).not.toBeInTheDocument();
  await expect.element(row("Drafts 1")).toBeVisible();
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "Lunch next week"))).toEqual([]);

  // spec/app/email.md, "Sending a saved draft takes it out of Drafts"
  await click(row("All inboxes"));
  await expect.element(row("Drafts 1")).toBeVisible();
  await click(row("Drafts"));
  await click(email(/^To Susan.*Tea on Friday/));
  await expect.element(subject()).toHaveValue("Tea on Friday");
  const earlierDeletes = (await company()).draftDeletes.length;
  const deletes = async () => (await company()).draftDeletes.slice(earlierDeletes);
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false, "deleteDraft"), client));
  await click(page.getByRole("button", { name: "Send" }));
  await expect.element(page.getByText("Sent to Susan")).toBeVisible();
  await expect.poll(async () => (await deletes())[0]).toBe("refused");
  await host("Offline");
  await host("Online");
  await expect.poll(deletes).toEqual(["refused", "deleted"]);
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "Tea on Friday").map((m) => m.labels.includes("DRAFT")))).toEqual([false]);
  await expect.element(email(/^To Susan.*Tea on Friday/)).not.toBeInTheDocument();
  await expect.element(row("Drafts 1")).not.toBeInTheDocument();

  // spec/app/email.md, "An email sent while offline waits in Outbox and goes once, by itself, when the tablet is back online"
  await click(row("All inboxes"));
  await opened(/Ruth/, "Lunch on Sunday?");
  await host("Offline");
  await expect.element(page.getByRole("button", { name: "Reply" })).toBeVisible();
  await Effect.runPromise(Effect.provide(outage(cloud, secret, true), client));
  await click(page.getByRole("button", { name: "Reply" }));
  await act(() => userEvent.fill(words(), "Yes, noon is perfect."));
  const sends = async () => (await company()).changes.filter((c) => c.receipt.kind === "send" && c.receipt.state === "succeeded").map((c) => c.receipt.requestId);
  const before = await sends();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.element(page.getByText("Waiting in Outbox until you’re back online")).toBeVisible();
  await click(row("Outbox 1"));
  const waiting = email(/Ruth.*Re: Lunch on Sunday\?/);
  await expect.element(waiting).toBeVisible();
  await expect.element(page.getByText("Just now")).toBeVisible();
  // spec/app/mailboxes.md, "Choosing Outbox shows its waiting email, and an emptied Outbox gives way to the folder"
  await click(page.getByRole("button", { name: "Close Email" }));
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(row("All inboxes")).toHaveAttribute("aria-current", "page");
  await expect.element(waiting).not.toBeInTheDocument();
  await click(row("Outbox 1"));
  await expect.element(waiting).toBeVisible();
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false), client));
  const delivered = expect.element(page.getByText("Your email to Ruth was sent"), { timeout: 60_000 }).toBeVisible();
  await host("Online");
  await delivered;
  await expect.element(waiting).not.toBeInTheDocument();
  await click(row("All inboxes"));
  await expect.element(row("Outbox")).not.toBeInTheDocument();
  await host("Offline");
  await host("Online");
  const after = (await sends()).filter((id) => !before.includes(id));
  expect(after).toHaveLength(1);
  expect(await sentWith("Re: Lunch on Sunday?")).toEqual([gmail]);

  // spec/app/email.md, "An email sent while offline waits in Outbox and goes once, by itself, when the tablet is back online"
  await host("Offline");
  await click(page.getByRole("button", { name: "Write" }));
  await act(() => userEvent.type(page.getByRole("searchbox"), "susan@family"));
  await click(page.getByRole("button", { name: "susan@family", exact: true }));
  await act(() => userEvent.fill(subject(), "Recital photos"));
  await act(() => userEvent.fill(words(), "I loved the recital."));
  await click(page.getByRole("button", { name: "Send" }));
  await expect.element(row("Outbox 1")).toBeVisible();
  await host("Online");
  await click(row("Outbox 1"));
  const refused = email(/Recital photos/);
  await expect.element(refused).toBeVisible();
  // spec/app/agentActions.md, "Grace opens a setting, and points only at what is on the screen"
  const [queued] = await waitingTargets();
  await click(page.getByRole("button", { name: "Ask Grace", exact: true }));
  await click(page.getByRole("button", { name: "Collapse", exact: true }));
  const tip = "Your email about the recital";
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{ said: "Which one is waiting?", answer: JSON.stringify({ text: "This one is waiting.", isQuestion: false, answers: [], actions: [{ kind: "guide", target: queued, emphasis: "instruction", title: tip }] }) }]), client));
  await act(() => page.getByRole("textbox", { name: "Message to Grace" }).fill("Which one is waiting?"));
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.element(page.getByRole("group", { name: tip }).getByRole("button", { name: /Recital photos/ })).toBeVisible();
  await click(page.getByRole("button", { name: "Close this tip" }));
  await click(page.getByRole("button", { name: "Close Grace", exact: true }));
  await expect.poll(async () => {
    if (refused.query()) await click(refused);
    return subject().query() !== null;
  }, { timeout: 15000 }).toBe(true);
  await host("Offline");
  await expect.element(subject()).toHaveValue("Recital photos");
  await expect.element(words()).toHaveValue("I loved the recital.");
  await click(page.getByRole("button", { name: "Remove susan@family" }));
  await click(page.getByRole("button", { name: "Add to To" }));
  await click(page.getByRole("button", { name: "Susan" }));
  await click(page.getByRole("button", { name: "Send" }));
  await expect.element(row("Outbox 1")).toBeVisible();
  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"
  await click(page.getByRole("button", { name: "Fix Wi-Fi" }));
  await expect.element(page.getByRole("textbox", { name: "Message to Grace" })).toBeVisible();
  await expect.poll(async () => (await Effect.runPromise(Effect.provide(modelTurns(cloud, secret), client))).at(-1)?.context, { timeout: 60_000 }).toContain("tapped Fix Wi-Fi in Email");
  await expect.element(page.getByRole("heading", { name: "Wi-Fi" })).not.toBeInTheDocument();
  await click(page.getByRole("button", { name: "Close Grace", exact: true }));
  await expect.element(page.getByText("No internet right now")).toBeVisible();
  await host("Online");
  await expect.poll(() => sentWith("Recital photos")).toHaveLength(1);
  await expect.element(row("Outbox")).not.toBeInTheDocument();

  // spec/app/mailboxes.md, "The Home Email card says Waiting for the internet, Not connected, or how many are new"; spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"
  await person({ type: "setUse", id: 1, use: { mail: false, calendar: true, contacts: true } });
  const card = page.getByRole("button", { name: /^Email/ });
  await click(page.getByRole("button", { name: "Close Email" }));
  await expect.element(card).toHaveAccessibleName(/1 new/);
  await click(card);
  await opened(/St\. Mark’s Church Office/, "Thanksgiving dinner sign-up");
  await click(page.getByRole("button", { name: "Close Email" }));
  await expect.element(card).toHaveAccessibleName(/No new email/);
}, 600_000);

it(`Keep the latest draft count (spec/app/email.md, "Drafts shows the provider's count of saved drafts, whichever folder is open")`, async () => {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const latches = () => ({ captured: Latch.makeUnsafe(), release: Latch.makeUnsafe(), settled: Latch.makeUnsafe() });
  let { captured, release, settled } = latches();
  const fetch = window.fetch.bind(window);
  let hold = false;
  const delayed: typeof fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : input, location.href).pathname;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (!hold || method !== "GET" || !path.endsWith("/inbox-v1/drafts")) return fetch(input, init);
    hold = false;
    const held = { captured, release, settled };
    const reader = Fiber.getCurrent();
    if (!reader) throw new Error("The draft count has no active reader");
    reader.addObserver(() => held.settled.openUnsafe());
    const response = await fetch(input, init);
    held.captured.openUnsafe();
    await Effect.runPromise(held.release.await);
    return response;
  };
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(connected(initial, "Gmail", gmail, "Gmail")));
  const app = application(undefined, undefined, { url: cloud, key: secret });
  const view = tabletView(ManagedRuntime.make(Layer.provide(app, Layer.succeed(FetchHttpClient.Fetch, delayed))));
  const save = async (title: string, delayCount: boolean) => {
    await click(page.getByRole("button", { name: "Write" }));
    const susan = page.getByRole("button", { name: "Susan", exact: true });
    await expect.element(susan).toBeVisible();
    await click(susan);
    await act(() => userEvent.fill(subject(), title));
    hold = delayCount;
    await click(page.getByRole("button", { name: "Back to Inbox" }));
  };
  try {
    await view.render();
    await click(page.getByRole("button", { name: /^Email/ }));
    await expect.element(email(/Main St Clinic/)).toBeVisible();
    await save("Lunch tomorrow", true);
    await Effect.runPromise(captured.await);
    await save("Tea next week", false);
    await expect.element(row("Drafts 2")).toBeVisible();
    await act(async () => { release.openUnsafe(); await Effect.runPromise(settled.await); });
    await expect.element(row("Drafts 2")).toBeVisible();

    ({ captured, release, settled } = latches());
    await save("Coffee on Monday", true);
    await Effect.runPromise(captured.await);
    await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
    await act(async () => { release.openUnsafe(); await Effect.runPromise(settled.await); });
    await click(page.getByRole("button", { name: "Back to Inbox" }));
    await expect.element(row("Drafts 3")).toBeVisible();
  } finally {
    release.openUnsafe();
    await view.dispose();
    localStorage.clear();
  }
}, 120_000);

it('Settle a hidden mailbox send (spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere")', async () => {
  const { secret, host, person, company } = await start();
  await replyToClinic();
  await act(() => userEvent.fill(words(), "Use the west entrance tomorrow."));
  const provider = (fault?: "sendResponse") => Effect.runPromise(Effect.provide(outage(cloud, secret, false, fault), client));
  const notification = page.getByText("Sent to Main St Clinic", { exact: true });
  const state = () => {
    const raw = localStorage.getItem("mail/1");
    return raw === null ? undefined : parseMail(JSON.parse(raw));
  };
  const sentFrom = async () => (await company()).boxes.flatMap((box) => box.mail.filter((message) =>
    message.subject === "Re: Reminder: your appointment tomorrow at 10 am" && message.labels.includes("SENT")).map(() => box.address));
  await provider("sendResponse");
  try {
    await click(page.getByRole("button", { name: "Send", exact: true }));
    await expect.poll(state).toMatchObject({ sendStatus: "SendUnknown", account: gmail });
    await expect.poll(sentFrom).toEqual([gmail]);
    await person({ type: "setUse", id: 1, use: { mail: false, calendar: true, contacts: true } });
    await expect.element(notification).not.toBeInTheDocument();
    await provider();
    await host("Offline");
    await host("Online");
    await expect.poll(state, { timeout: 15_000 }).toMatchObject({ sendStatus: "Sent", sendResultSaved: true, account: gmail });
    await expect.element(notification).not.toBeInTheDocument();
    expect(await sentFrom()).toEqual([gmail]);

    await person({ type: "openAccount", id: 1 });
    await person({ type: "requestRemoval", id: 1 });
    await person({ type: "removeAccount", id: 1, waiting: 0 });
    await expect.poll(state).toBeUndefined();
    await expect.element(notification).not.toBeInTheDocument();
  } finally {
    await provider();
  }
}, 120_000);

it('Review an unsent reply (spec/app/email.md, "Only the current approved draft may dispatch and an unknown send cannot retry")', async () => {
  const { secret, host, company, restartFromEarlierMailbox } = await start();
  await replyToClinic();
  await act(() => userEvent.fill(words(), "Please call me tomorrow."));
  const send = page.getByRole("button", { name: "Send", exact: true });
  const operations = async () => (await company()).changes.filter((c) => c.receipt.kind === "send");
  const previous = (await operations()).length;
  await Effect.runPromise(Effect.provide(outage(cloud, secret, true), client));
  await click(send);
  await expect.element(page.getByText(/The email wasn’t sent/)).toBeVisible();
  expect(await operations()).toHaveLength(previous);
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false, "dispatch"), client));
  await act(() => userEvent.fill(words(), "Please call me this afternoon."));
  await click(send);
  await expect.element(page.getByText(/I’m not sure this email was sent/)).toBeVisible();
  await expect.element(send).toBeDisabled();
  expect((await operations()).slice(previous).map((c) => c.receipt.state)).toEqual(["prepared"]);
  await expect.poll(async () => (await company()).sendLookups.includes("prepared")).toBe(true);
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false, "lookupMissing"), client));
  await restartFromEarlierMailbox(1);
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(words()).toHaveValue("Please call me this afternoon.");
  await expect.element(send).toBeDisabled();
  await host("Offline");
  await host("Online");
  await expect.poll(async () => (await company()).sendLookups.includes("missing")).toBe(true);
  await expect.element(send).toBeDisabled();
  expect((await company()).boxes.flatMap((box) => box.mail).filter((message) => message.subject === "Re: Reminder: your appointment tomorrow at 10 am" && message.labels.includes("SENT"))).toHaveLength(0);
  expect(await operations()).toHaveLength(previous + 1);
});

it('Open a link from the email I chose (spec/app/handoffs.md, "A link Email released opens in a new Browser tab, and no other link does")', async () => {
  // spec/app/email.md, "A scam warning needs current evidence and holds that message's links"
  const { person, company, browserTabs, pendingLink, workspaceEvent } = await start();
  const before = await browserTabs();
  const sent = async () => (await company()).boxes.flatMap((box) => box.mail.filter((message) => message.labels.includes("SENT")).map((message) => message.externalId));
  const priorMail = await sent();
  const openEmail = () => click(page.getByRole("button", { name: /^Email/ }));
  const address = page.getByRole("textbox", { name: "Address", exact: true });
  const flagged = page.getByRole("link", { name: /confirm-password/ });
  const warning = page.getByRole("dialog", { name: "Open this link?" });
  await openEmail();
  await opened(/Account Security/, "Urgent: confirm your password");
  await expect.element(flagged).toBeVisible();
  await expect.element(page.getByText("Grace thinks this email is a scam. Don’t tap its links.")).toBeVisible();
  await expect.element(page.getByText(/security-alert@acc0unt-help\.co/)).toBeVisible();
  await expect.element(page.getByRole("link", { name: /invalid\.example/ })).not.toBeInTheDocument();
  const target = flagged.element().textContent;
  await click(flagged);
  await expect.element(warning.getByText(target ?? "", { exact: true })).toBeVisible();
  expect(await browserTabs()).toEqual(before);
  await click(warning.getByRole("button", { name: "Stay in email" }));
  expect(warning.query()).toBeNull();
  await click(flagged);
  const confirmEarlier = await pendingLink(1);
  await person({ type: "setUse", id: 1, use: { mail: false, calendar: true, contacts: true } });
  await expect.element(warning).not.toBeInTheDocument();
  expect(await confirmEarlier()).toBe(false);
  expect(await browserTabs()).toEqual(before);
  await person({ type: "setUse", id: 1, use: { mail: true, calendar: true, contacts: true } });
  await expect.element(warning.getByText(target ?? "", { exact: true })).toBeVisible();
  await workspaceEvent({ type: "visit", destination: "Browser" });
  await workspaceEvent({ type: "changePage", browserInput: { tag: "NewTab" } });
  const changedTabs = await browserTabs();
  await workspaceEvent({ type: "visit", destination: "Home" });
  await openEmail();
  await expect.element(warning).toBeVisible();
  expect(await confirmEarlier()).toBe(false);
  expect(await browserTabs()).toEqual(changedTabs);
  await click(warning.getByRole("button", { name: "Open in Browser" }));
  await expect.element(address).toHaveValue(target ?? "");
  const first = await browserTabs();
  expect(first.slice(0, -1)).toEqual(changedTabs);
  await workspaceEvent({ type: "changePage", browserInput: { tag: "OpenPrivateSignIn", url: "https://utility.example" } });
  await expect.element(page.getByRole("textbox", { name: "Private website address" })).toBeVisible();
  const withPrivateTab = await browserTabs();
  expect(withPrivateTab.at(-1)?.[2]).toBe(true);
  await workspaceEvent({ type: "visit", destination: "Home" });
  await openEmail();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await opened(/Riverside Power/, "Your Riverside Power bill is ready");
  await expect.element(page.getByRole("link", { name: /\/statement\/\[print\]$/ })).toBeVisible();
  const ordinary = page.getByRole("link", { name: /\/bill\/#statement_\(journal\)$/ });
  await expect.element(ordinary).toBeVisible();
  const destination = ordinary.element().textContent;
  await click(ordinary);
  await expect.element(address).toHaveValue(destination ?? "");
  const after = await browserTabs();
  expect(after.slice(0, -1)).toEqual(withPrivateTab);
  expect(after.at(-1)).toEqual([expect.any(Number), destination, false]);
  expect(await sent()).toEqual(priorMail);
});

it("Delete a message and recover it safely", async () => {
  const { company } = await start();
  const prize = email(/Prize Desk/);
  const undo = page.getByRole("button", { name: "Undo" });
  const openDeletedMessage = async () => {
    await opened(/Prize Desk/, "A message for Grace");
    await click(page.getByRole("button", { name: "Delete" }));
    await expect.element(undo).toBeVisible();
    await click(row("Trash"));
    await opened(/Prize Desk/, "A message for Grace");
  };
  const labels = async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.externalId === "instruction").map((m) => m.labels.filter((l) => l !== "UNREAD")));
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(prize).toBeVisible();

  // spec/app/emailItem.md, "Only an authorized current selection can begin a provider mutation"
  await opened(/Prize Desk/, "A message for Grace");
  await click(page.getByRole("button", { name: "Delete" }));
  await expect.element(prize).not.toBeInTheDocument();
  await click(undo);
  await expect.poll(labels).toEqual([["INBOX"]]);
  await expect.element(prize).toBeVisible();

  await openDeletedMessage();
  await click(page.getByRole("button", { name: "Restore" }));
  await expect.element(prize).not.toBeInTheDocument();
  await expect.poll(labels).toEqual([["INBOX"]]);
  await click(row("All inboxes"));
  await openDeletedMessage();
  await click(page.getByRole("button", { name: "Delete forever" }));
  await expect.element(prize).not.toBeInTheDocument();
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.externalId === "instruction"))).toEqual([]);
});

it('Take a photo for an email on the tablet (spec/app/files.md, "A photo taken or a file chosen on the device has its own local source identity")', async () => {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const jpeg = btoa("\xff\xd8\xff\xe0a garden photo from the tablet");
  const lease = crypto.randomUUID();
  const taken = { id: crypto.randomUUID(), kind: "photo", name: "Garden.jpg", savedAt: Date.now(), pages: 0 };
  let entries: (typeof taken)[] = [];
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(connected(initial, "Gmail", gmail, "Gmail")));
  onTestFinished(() => localStorage.clear());
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true, url: cloud, key: secret,
    files: {
      open: () => Promise.resolve({ lease }),
      close: () => Promise.resolve(),
      list: () => Promise.resolve({ entries }),
      preview: ({ id, page: shown }) => Promise.resolve({ id, page: shown, image: `data:image/jpeg;base64,${jpeg}` }),
      content: ({ id }) => Promise.resolve({ id, mimeType: "image/jpeg", data: jpeg }),
      capture: () => Promise.resolve(taken),
      commit: ({ id }) => { entries = [taken]; return Promise.resolve({ id }); },
      saveAttachments: () => Promise.reject(new Error("No mail attachment is saved in this journey")),
      remove: () => Promise.reject(new Error("No photo is removed in this journey")),
    },
  }));
  const view = tabletView(runtime);
  onTestFinished(() => view.dispose());
  await view.render();
  await expect.poll(async () => (await runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.get()))).graceAccount.tag).toBe("AccountUnavailable");
  await act(() => runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.send({ type: "reportGraceService",
    report: { tag: "GraceSignedIn", accountId: "tablet-owner", email: gmail, plan: "PlanUnknown" }, link: { tag: "GoogleLinkUnknown" } }))));
  await click(page.getByRole("button", { name: /^Email/ }));
  await writeTo("Susan");
  await act(() => userEvent.fill(subject(), "The garden"));
  await click(page.getByRole("button", { name: "Attach" }));
  await click(page.getByRole("menuitem", { name: "Take a photo" }));
  await expect.element(page.getByRole("button", { name: "Remove Garden.jpg" })).toBeVisible();
  await click(page.getByRole("button", { name: "Send" }));
  const Sent = Schema.Struct({ boxes: Schema.Array(Schema.Struct({ mail: Schema.Array(Schema.Struct({
    subject: Schema.String, labels: Schema.Array(Schema.String), attachments: Schema.Array(Schema.Struct({ filename: Schema.String, data: Schema.optional(Schema.String) })),
  })) })) });
  const provider = async () => Schema.decodeUnknownSync(Sent)(await (await fetch(new URL("/fake/account", cloud), { headers: { authorization: `Bearer ${secret}` } })).json());
  await expect.poll(async () => (await provider()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "The garden" && m.labels.includes("SENT")).map((m) => m.attachments)))
    .toEqual([[{ filename: "Garden.jpg", data: jpeg }]]);

  // spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"
  await writeTo("Susan");
  await act(() => userEvent.fill(subject(), "More of the garden"));
  await click(page.getByRole("button", { name: "Attach" }));
  await click(page.getByRole("menuitem", { name: "Take a photo" }));
  await expect.element(page.getByRole("button", { name: "Remove Garden.jpg" })).toBeVisible();
  entries = [];
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Garden.jpg can’t go by email, so this email is kept on the tablet. Remove it to save it to Drafts.")).toBeVisible();
  await expect.element(subject()).toHaveValue("More of the garden");
  await click(page.getByRole("button", { name: "Remove Garden.jpg" }));
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Saved to Drafts")).toBeVisible();
  await expect.poll(async () => (await provider()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "More of the garden").map((m) => [m.labels, m.attachments]))).toEqual([[["DRAFT"], []]]);
}, 300_000);
