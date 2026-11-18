// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/emailItem.md, "Story: Delete a message and recover it safely"
import { Effect, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { expect, inject, it, onTestFinished } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { addAccount, allowedUse, chooseProvider, goBack, initial, type Provider, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { application } from "../src/app.vibe";
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
  const started = await fetch(`${cloud}/api/v1/eliza/connections/outlook/sessions`, {
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

async function start(withAccounts = true) {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud, withAccounts), client));
  localStorage.clear();
  if (withAccounts) {
    await allowOutlook(secret);
    localStorage.setItem("accounts", JSON.stringify(kept()));
  }
  const runtime = ManagedRuntime.make(application(undefined, undefined, { url: cloud, key: secret }));
  onTestFinished(() => localStorage.clear());
  await mount(runtime);
  return {
    secret,
    host: (availability: "Online" | "Offline") => act(() => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.flatMap(w.get(), ({ device }) =>
      w.send({ type: "setAvailability", availability: { connection: availability, reasoning: device.reasoningAvailable, microphone: device.microphoneAllowed, observation: device.observationAllowed } }, "Host"))))),
    person: (event: AccountEvent) => act(() => runtime.runPromise(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson")))),
    company: async () => Schema.decodeUnknownSync(Kept)(await (await fetch(`${cloud}/fake/account`, { headers: { authorization: `Bearer ${secret}` } })).json()),
  };
}

const click = (target: Parameters<typeof userEvent.click>[0]) => act(() => userEvent.click(target));
const folders = () => page.getByRole("navigation", { name: "Folders" });
const row = (name: string) => folders().getByRole("button", { name: new RegExp(`^${name}`) });
const email = (from: RegExp) => page.getByRole("button", { name: from });
const subject = () => page.getByLabelText("Subject");
const words = () => page.getByRole("textbox", { name: "Write your message, or ask Grace to help" });
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
  await click(page.getByRole("button", { name: /^Calendar/ }).getByText(title, { exact: true }));
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
  const { secret, host, person } = await start();

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
  await click(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(row("Gmail 3")).toBeVisible();

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

  // spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"
  await person({ type: "setUse", id: 2, use: { mail: false, calendar: true, contacts: true } });
  await expect.element(church).not.toBeInTheDocument();
  await expect.element(page.getByText("Outlook needs you to sign in again")).not.toBeInTheDocument();
  await expect.element(row("Inbox 3")).toBeVisible();
  await expect.element(row("Outlook")).not.toBeInTheDocument();

  await click(page.getByRole("button", { name: "Close Email" }));
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);
});

it("Write or reply and confirm before sending", async () => {
  const { secret, host, company } = await start();
  const sent = async (title: string) => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.subject === title && m.labels.includes("SENT")).map((m) => ({ ...m, from: b.address })));
  const sentWith = async (title: string) => (await sent(title)).map((m) => m.from);
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(row("All inboxes 5")).toBeVisible();

  // spec/app/email.md, "A reply is addressed to the selected message's verified reply-to"
  await opened(/Main St Clinic/, "Reminder: your appointment tomorrow at 10 am");
  await click(page.getByRole("button", { name: "Reply" }));
  await expect.element(page.getByRole("button", { name: "Remove Main St Clinic" })).toBeVisible();
  await expect.element(subject()).toHaveValue("Re: Reminder: your appointment tomorrow at 10 am");
  await act(() => userEvent.fill(words(), "Thank you, I’ll be there."));
  // spec/app/email.md, "The visible Send button approves exactly the composer the user sees"
  await click(page.getByRole("button", { name: "Send" }));
  await expect.poll(() => sentWith("Re: Reminder: your appointment tomorrow at 10 am")).toEqual([gmail]);

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
  await opened(/^To Susan.*Lunch next week/, "Lunch next week");
  await expect.element(page.getByText("Shall we have lunch on Tuesday?")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  await click(page.getByRole("button", { name: "Back to Inbox" }));

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
});

it('Allow a new approval only when the prior send could not have reached Gmail (spec/app/email.md, "Only the current approved draft may dispatch and an unknown send cannot retry")', async () => {
  const { secret, host, company } = await start();
  await click(page.getByRole("button", { name: /^Email/ }));
  await expect.element(row("All inboxes 5")).toBeVisible();
  await click(page.getByRole("button", { name: "Write" }));
  await click(page.getByRole("button", { name: "Susan" }));
  await act(() => userEvent.fill(subject(), "Preflight unavailable"));
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
  expect((await company()).boxes.flatMap((box) => box.mail).filter((message) => message.subject === "Preflight unavailable" && message.labels.includes("SENT"))).toHaveLength(0);
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
