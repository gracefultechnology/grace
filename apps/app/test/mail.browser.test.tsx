// spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/emailItem.md, "Story: Delete a message and recover it safely"
import { Effect, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { addAccount, allowedUse, chooseProvider, goBack, initial, type Provider, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { client, expire, outage, signIn } from "./cloud.vibe";
import "../src/main.css";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });

const cloud = inject("cloud");
const gmail = "owner@grace.test";
const outlook = "margaret@outlook.com";

const Kept = Schema.Struct({
  boxes: Schema.Array(Schema.Struct({
    address: Schema.String,
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

async function start() {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  await allowOutlook(secret);
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(kept()));
  const runtime = ManagedRuntime.make(application(undefined, undefined, { url: cloud, key: secret }));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    localStorage.clear();
  });
  return {
    secret,
    host: (availability: "Online" | "Offline") => act(() => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.flatMap(w.get(), ({ device }) =>
      w.send({ type: "setAvailability", availability: { connection: availability, reasoning: device.reasoningAvailable, microphone: device.microphoneAllowed, observation: device.observationAllowed } }, "Host"))))),
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
const opened = async (from: RegExp, title: string) => {
  await click(email(from));
  await expect.element(page.getByRole("heading", { name: title })).toBeVisible();
};

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
  // spec/app/email.md, "Attachment actions preserve exact asset and message identity"
  await click(page.getByRole("button", { name: "Open" }));
  await expect.element(page.getByRole("heading", { name: "Visit form.pdf" })).toBeVisible();
  await click(page.getByRole("button", { name: "Back to Main St Clinic’s email" }));
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

it("Delete a message and recover it safely", async () => {
  const { company } = await start();
  const prize = email(/Prize Desk/);
  const undo = page.getByRole("button", { name: "Undo" });
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

  await opened(/Prize Desk/, "A message for Grace");
  await click(page.getByRole("button", { name: "Delete" }));
  await expect.element(undo).toBeVisible();
  await click(row("Trash"));
  await opened(/Prize Desk/, "A message for Grace");
  await click(page.getByRole("button", { name: "Restore" }));
  await expect.element(prize).not.toBeInTheDocument();
  await expect.poll(labels).toEqual([["INBOX"]]);
  await click(row("All inboxes"));
  await opened(/Prize Desk/, "A message for Grace");
  await click(page.getByRole("button", { name: "Delete" }));
  await expect.element(undo).toBeVisible();
  await click(row("Trash"));
  await opened(/Prize Desk/, "A message for Grace");
  await click(page.getByRole("button", { name: "Delete forever" }));
  await expect.element(prize).not.toBeInTheDocument();
  await expect.poll(async () => (await company()).boxes.flatMap((b) => b.mail.filter((m) => m.externalId === "instruction"))).toEqual([]);
});
