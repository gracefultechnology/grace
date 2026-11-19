// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/files.md, "Story: Save, share and remove the chosen file"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/emailItem.md, "Story: Delete a message and recover it safely"
import { Effect, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { expect, inject, it, onTestFinished, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { addAccount, allowedUse, chooseProvider, goBack, initial, type Provider, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { application } from "../src/app.vibe";
import { AccountActions } from "../src/graceAccount.vibe";
import type { WiFiPlugin } from "../src/surfacePlugin.ts";
import { client, expire, outage, script, signIn } from "./cloud.vibe";
import { actOnScreen, mount } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

const cloud: string = inject("cloud");
const gmail = "owner@grace.test";
const outlook = "margaret@outlook.com";

const Kept = Schema.Struct({
  sendLookups: Schema.Array(Schema.String),
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

async function allowOutlook(key: string) {
  const started = await fetch(new URL("/api/v1/eliza/connections/outlook/sessions", cloud), {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ loginHint: "" }),
  });
  const { pageUrl } = await started.json() as { pageUrl: string };
  await fetch(pageUrl, { method: "POST", body: new URLSearchParams({ address: outlook, choice: "allow" }) });
}

function kept(): Accounts {
  const connected = (a: Accounts, provider: Provider, address: string, name: string) => {
    const chosen = chooseProvider(a, provider, "AccountPerson");
    return sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address, granted: allowedUse }, name, "AccountConnector");
  };
  return connected(addAccount(goBack(connected(initial, "Gmail", gmail, "Gmail"), "AccountPerson"), "AccountPerson"), "Outlook", outlook, "Outlook");
}

async function start(withAccounts = true, withFilesSession = false) {
  const { secret, credentialId } = await Effect.runPromise(Effect.provide(signIn(cloud, withAccounts), client));
  const digest = async (purpose: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(purpose + credentialId))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const scope = { owner: await digest("files/owner"), session: await digest("files/session") };
  let signedIn = withFilesSession;
  const fetchOriginal = window.fetch.bind(window);
  const browserSession = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin !== location.origin) return fetchOriginal(input, init);
    if (url.pathname === "/api/auth/session") return Promise.resolve(Response.json({ account: signedIn ? { id: credentialId, email: null } : null }));
    if (url.pathname === "/api/product/files/scope") return Promise.resolve(Response.json(signedIn ? scope : {}, { status: signedIn ? 200 : 401 }));
    if (url.pathname === "/api/auth/providers") return Promise.resolve(Response.json({ google: true, email: true, sms: false }));
    if (url.pathname === "/api/auth/refresh") return Promise.resolve(new Response(null, { status: 401 }));
    if (url.pathname === "/api/v1/billing/subscription" || url.pathname === "/api/v1/eliza/google/status") return Promise.resolve(new Response(null, { status: 404 }));
    return fetchOriginal(input, init);
  });
  localStorage.clear();
  if (withAccounts) {
    await allowOutlook(secret);
    localStorage.setItem("accounts", JSON.stringify(kept()));
  }
  const network = { online: true };
  const wifi: Pick<WiFiPlugin, "getConnectivity"> = { getConnectivity: () => Promise.resolve({ online: network.online, validated: network.online, captivePortal: false, ssid: null }) };
  const runtime = ManagedRuntime.make(application(undefined, wifi as WiFiPlugin, { url: cloud, key: secret }));
  const connectivity = () => runtime.runPromise(Effect.map(Effect.flatMap(Effect.service(Workspaces), (w) => w.get()), (w) => w.device.connectivity));
  await mount(runtime);
  onTestFinished(async () => {
    browserSession.mockRestore();
    await forgotten(scope.owner);
    localStorage.clear();
  });
  return {
    secret,
    libraryOwner: scope.owner,
    changeSession: (active: boolean) => act(async () => {
      signedIn = active;
      await runtime.runPromise(Effect.flatMap(AccountActions, (account) => account.run({ kind: "refresh" })));
    }),
    host: async (availability: "Online" | "Offline") => {
      network.online = availability === "Online";
      await act(() => Promise.resolve(window.dispatchEvent(new Event(availability === "Online" ? "online" : "offline"))));
      await expect.poll(connectivity).toBe(availability);
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
const opened = async (from: RegExp, title: string) => {
  await click(email(from));
  await expect.element(page.getByRole("heading", { name: title })).toBeVisible();
};

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
  const { secret, company } = await start(false);
  const headers = { authorization: `Bearer ${secret}` };
  const grants = async () => Schema.decodeUnknownSync(GoogleGrants)(await (await fetch(`${cloud}/api/v1/eliza/google/accounts?side=owner`, { headers })).json());
  const providerPages: string[] = [];
  const open = window.open;
  window.open = (...args) => {
    providerPages.push(String(args[0]));
    return open.apply(window, args);
  };
  onTestFinished(() => { window.open = open; });

  await click(page.getByRole("button", { name: "Settings", exact: true }));
  await click(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Email & calendar" }));
  await click(page.getByRole("button", { name: /^Gmail/ }));
  const pending = page.getByRole("dialog", { name: "Gmail sign-in page" });
  await expect.element(pending).toBeVisible();
  await expect.poll(() => providerPages.length).toBe(1);
  expect(await grants()).toEqual([]);
  const provider = new URL(providerPages[0]);
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
  expect(grant).toMatchObject({ connected: true, identity: { email: gmail },
    grantedScopes: expect.arrayContaining(["gmail.readonly", "calendar.events"]) });
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
  expect(saved).toMatchObject({ externalId: expect.stringMatching(/^appointment/), title, startAt: tomorrow.toISOString(),
    description: expect.stringContaining("Visit form") });
  await click(page.getByRole("button", { name: "Close Grace", exact: true }));
  await click(page.getByRole("button", { name: "Close Email", exact: true }));
  await click(page.getByRole("group", { name: "Calendar", exact: true }).getByText(title, { exact: true }));
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
  const { secret, host, person, company, libraryOwner, changeSession } = await start(true, true);

  // spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes"
  const card = page.getByRole("button", { name: /^Email/ });
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);
  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"
  await host("Offline");
  await expect.element(card).toHaveAccessibleName(/Waiting for the internet/);
  await host("Online");
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);

  await click(card);
  await expect.element(row("All inboxes 5")).toBeVisible();
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
  await expect.element(row("Gmail 3")).toBeVisible();

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
  const piano = page.getByRole("button", { name: "Piano.png", exact: true });
  await expect.element(piano).toBeVisible();
  await click(piano);
  await expect.element(page.getByRole("img", { name: "Piano.png" })).toHaveAttribute("src", expect.stringMatching(png));
  await changeSession(false);
  await expect.element(page.getByText("Sign in to see your files")).toBeVisible();
  await expect.element(page.getByRole("img", { name: "Piano.png" })).not.toBeInTheDocument();
  await changeSession(true);
  await expect.element(piano).toBeVisible();

}, 300_000);

async function replyToClinic() {
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(row("All inboxes 5")).toBeVisible();
  await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Reply" }));
  await expect.element(page.getByRole("button", { name: "Remove Main St Clinic" })).toBeVisible();
}

it("Write or reply and confirm before sending", async () => {
  const { secret, host, company } = await start();
  const sent = async (title: string) => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === title && m.labels.includes("SENT")).map((m) => ({ ...m, from: b.address })));
  const sentWith = async (title: string) => (await sent(title)).map((m) => m.from);
  // spec/app/email.md, "A reply is addressed to the selected message's verified reply-to"
  await replyToClinic();
  await expect.element(subject()).toHaveValue("Re: Reminder: your appointment tomorrow at 10 am");
  await act(() => userEvent.fill(words(), "Thank you, I’ll be there."));
  // spec/app/email.md, "The visible Send button approves exactly the composer the user sees"
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(() => sentWith("Re: Reminder: your appointment tomorrow at 10 am")).toEqual([gmail]);
  await click(row("Sent"));
  await opened(/Main St Clinic/, "Re: Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Reply" }));
  await expect.element(page.getByRole("button", { name: "Remove Main St Clinic" })).toBeVisible();
  await click(page.getByRole("button", { name: /^Back to / }));
  await click(page.getByRole("button", { name: "Back to Sent" }));
  await click(row("All inboxes"));
  await expect.element(email(/^Main St Clinic.*You replied: “Thank you, I’ll be there\.…”/)).toBeVisible();

  // spec/app/mailboxes.md, "Changing From moves a draft never saved, whole and unapproved, and a saved draft stays"
  await click(page.getByRole("button", { name: "Write" }));
  await click(page.getByRole("button", { name: "Susan" }));
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
  await expect.element(page.getByRole("button", { name: "Remove Visit form.pdf" })).toBeVisible();
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(async () => (await sent("Fwd: Reminder: your appointment tomorrow at 10 am")).map((m) => m.attachments)).toEqual([[{ filename: "Visit form.pdf" }]]);

  // spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"
  await click(page.getByRole("button", { name: "Write" }));
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Email discarded")).toBeVisible();

  // spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"
  await click(page.getByRole("button", { name: "Write" }));
  await click(page.getByRole("button", { name: "Susan" }));
  await expect.element(page.getByRole("button", { name: outlook })).toBeVisible();
  await act(() => userEvent.fill(subject(), "Lunch next week"));
  await act(() => userEvent.fill(words(), "Shall we have lunch on Tuesday?"));
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === "Lunch next week").map((m) => [b.address, m.labels]))).toEqual([[outlook, ["DRAFT"]]]);
  await click(row("Drafts"));
  await click(email(/^To Susan.*Lunch next week/));
  await expect.element(subject()).toHaveValue("Lunch next week");
  await expect.element(words()).toHaveValue("Shall we have lunch on Tuesday?");
  await expect.element(page.getByRole("button", { name: "Remove Susan" })).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(email(/^To Susan.*Lunch next week/)).toBeVisible();
  await expect.element(row("Drafts 1")).toBeVisible();

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
  await click(row("Outbox 1"));
  const waiting = email(/Re: Lunch on Sunday\?/);
  await expect.element(waiting).toBeVisible();
  await expect.element(page.getByText("Just now")).toBeVisible();
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false), client));
  await host("Online");
  await expect.element(waiting).not.toBeInTheDocument();
  await click(row("All inboxes"));
  await expect.element(row("Outbox")).not.toBeInTheDocument();
  await host("Offline");
  await host("Online");
  const after = (await sends()).filter((id) => !before.includes(id));
  expect(after).toHaveLength(1);
  expect(await sentWith("Re: Lunch on Sunday?")).toEqual([gmail]);
}, 300_000);

it('Review an unsent reply (spec/app/email.md, "Only the current approved draft may dispatch and an unknown send cannot retry")', async () => {
  const { secret, host, company } = await start();
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
  await host("Offline");
  await host("Online");
  await expect.poll(async () => (await company()).sendLookups.includes("missing")).toBe(true);
  await expect.element(send).toBeDisabled();
  expect((await company()).boxes.flatMap((box) => box.mail).filter((message) => message.subject === "Re: Reminder: your appointment tomorrow at 10 am" && message.labels.includes("SENT"))).toHaveLength(0);
  expect(await operations()).toHaveLength(previous + 1);
});

it("Delete a message and recover it safely", async () => {
  const { company } = await start();
  const prize = email(/Prize Desk/);
  const undo = page.getByRole("button", { name: "Undo" });
  const labels = async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.externalId === "instruction").map((m) => m.labels.filter((l) => l !== "UNREAD")));
  const openInTrash = async () => {
    await opened(/Prize Desk/, "A message for Grace");
    await click(page.getByRole("button", { name: "Delete" }));
    await expect.element(undo).toBeVisible();
    await click(row("Trash"));
    await opened(/Prize Desk/, "A message for Grace");
  };
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(prize).toBeVisible();

  // spec/app/emailItem.md, "Only an authorized current selection can begin a provider mutation"
  await opened(/Prize Desk/, "A message for Grace");
  await click(page.getByRole("button", { name: "Delete" }));
  await expect.element(prize).not.toBeInTheDocument();
  await click(undo);
  await expect.poll(labels).toEqual([["INBOX"]]);
  await expect.element(prize).toBeVisible();

  await openInTrash();
  await click(page.getByRole("button", { name: "Restore" }));
  await expect.element(prize).not.toBeInTheDocument();
  await expect.poll(labels).toEqual([["INBOX"]]);
  await click(row("All inboxes"));
  await openInTrash();
  await click(page.getByRole("button", { name: "Delete forever" }));
  await expect.element(prize).not.toBeInTheDocument();
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.externalId === "instruction"))).toEqual([]);
});
