// spec/app/agentActions.md, "Story: Ask Grace to help with my email"; spec/app/agentActions.md, "Story: Ask Grace about my calendar"; spec/app/calendars.md, "Story: Ask Grace to put an email’s appointment in my calendar"; spec/app/proposal.md, "Story: Say yes to exactly what Grace proposes for my calendar"
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { allowedUse, chooseProvider, initial, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import type { Origin } from "../gen/app__request.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { Agent, type GraceAction } from "../src/agent.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { day, dayOf, midnight } from "../src/calendar.vibe";
import { Instances } from "../src/instances.vibe";
import { client, otherPassword, reply as heard, script, signIn } from "./cloud.vibe";
import "../src/main.css";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const fetched = globalThis.fetch;
const chatBodies: string[] = [];
const decoded = (body: BodyInit | null | undefined) => typeof body === "string" ? body : body instanceof Uint8Array ? new TextDecoder().decode(body) : "";
beforeAll(async () => {
  globalThis.fetch = (input, init) => {
    if ((input instanceof Request ? input.url : String(input)).includes("/chat/completions")) chatBodies.push(decoded(init?.body));
    return fetched(input, init);
  };
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  await page.viewport(1280, 800);
});
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; globalThis.fetch = fetched; });

const cloud: string = inject("cloud");
const gmail = "owner@grace.test";
const riverview = "margaret@riverview.net";
const tap = (target: Parameters<typeof userEvent.click>[0]) => act(() => userEvent.click(target));
const toldGrace = () => chatBodies.join("\n").replaceAll("\\n", "\n");

type Reply = { text: string; isQuestion?: boolean; answers?: string[]; actions: GraceAction[] };
type Runs = Workspaces | AccountsMachine | Proposal | Instances | Agent;

const dateOf = (n: number) => new Date(midnight(n)).toLocaleDateString("en-CA");
const tile = (n: number) => new RegExp(`^(Today|${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "short" })})\\s*${new Date(midnight(n)).getDate()}(\\s*has plans)?$`);
const mondayOf = (n: number) => n - ((new Date(n * day).getUTCDay() + 6) % 7);
const row = (title: string, tag: string) => page.getByRole("button", { name: new RegExp(`${title}.*${tag}`) });

function kept(): Accounts {
  const chosen = chooseProvider(initial, "Gmail", "AccountPerson");
  return sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address: gmail, granted: allowedUse }, "Gmail", "AccountConnector");
}

async function company(key: string) {
  const response = await fetch(`${cloud}/fake/account`, { headers: { authorization: `Bearer ${key}` } });
  return await response.json() as { boxes: { calendar: { title: string; startAt: string }[]; mail: { subject: string; labels: string[] }[] }[] };
}

async function start() {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
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
  const run = <A,>(effect: Effect.Effect<A, unknown, Runs>) => act(() => runtime.runPromise(effect));
  const scripted = (said: string, reply: Reply) =>
    Effect.runPromise(Effect.provide(script(cloud, secret, [{ said, answer: JSON.stringify({ isQuestion: false, answers: [], ...reply }) }]), client));
  await expect.element(page.getByRole("button", { name: /^Email/ })).toHaveAccessibleDescription(/Riverside Power/);
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Collapse" })));
  return {
    secret, run, scripted,
    mailbox: () => run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.mail(1)), (m) => m.get())),
    calendar: (key: number) => run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(key)), (c) => c.get())),
    asked: () => run(Effect.flatMap(Effect.service(Proposal), (p) => p.get())),
    person: (event: AccountEvent) => run(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson"))),
    visit: (destination: "Email" | "Calendar" | "Home") => run(Effect.flatMap(Effect.service(Workspaces), (w) => w.send({ type: "visit", destination }, "Person"))),
    say: async (said: string, reply: Reply) => {
      await scripted(said, reply);
      await act(() => userEvent.type(page.getByRole("textbox", { name: "Message to Grace" }), `${said}{Enter}`));
      await expect.element(page.getByText(reply.text)).toBeVisible();
    },
    tap: async (answer: string, reply: Reply) => {
      await scripted(answer, reply);
      await act(() => userEvent.click(page.getByRole("button", { name: answer })));
      await expect.element(page.getByText(reply.text)).toBeVisible();
    },
    apply: async (actions: GraceAction[], origin: Origin) => (await run(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.flatMap(w.get(), ({ assistant }) =>
      Effect.flatMap(Effect.service(Agent), (agent) => agent.apply(actions, { generation: assistant.conversation.generation, workVersion: assistant.workVersion, origin }))))))
      .map((a) => a.outcome),
  };
}

it('Ask Grace to help with my email (spec/app/agentActions.md, "Story: Ask Grace to help with my email")', async () => {
  const { secret, mailbox, say, apply } = await start();
  const record = async (ref: string) => (await mailbox()).messages.find((r) => r.identity.ref === ref);

  // spec/app/agentActions.md, "Only Margaret's own current turn makes Grace act, on any screen": from Home, a search opens Email on what she asked for.
  await say("Find the clinic email.", { text: "Here is the email from the clinic.", actions: [{ kind: "searchMail", query: "clinic" }] });
  await expect.poll(async () => (await mailbox()).query).toBe("clinic");
  await expect.element(page.getByRole("button", { name: /Main St Clinic/ })).toBeVisible();
  await say("Open it.", { text: "It is open.", actions: [{ kind: "openMessage", message: "mail:1:clinic" }] });
  await expect.element(page.getByRole("heading", { name: "Reminder: your appointment tomorrow at 10 am" })).toBeVisible();

  // spec/app/agentActions.md, "Grace's email actions go to that account's mailbox and pass its own guard": a new email to a contact she names,
  // filled and kept in Drafts, and only Margaret can send it.
  await say("Write to Susan.", { text: "I started an email to Susan.", actions: [{ kind: "newEmail", to: "Susan", subject: "Sunday" }] });
  await expect.poll(async () => { const m = await mailbox(); return [m.composeVisible, m.draft.to]; }).toEqual([true, "susan@family.test"]);
  await say("Tell her I will see her on Sunday.", { text: "I wrote it. Tap Send when you are ready.", actions: [{ kind: "fillDraft", body: "See you on Sunday." }] });
  await expect.poll(async () => (await mailbox()).draft.body).toBe("See you on Sunday.");
  await say("Keep it for later.", { text: "It is in Drafts.", actions: [{ kind: "saveDraft" }] });
  await expect.poll(async () => (await company(secret)).boxes[0].mail.filter((m) => m.subject === "Sunday").map((m) => m.labels)).toEqual([["DRAFT"]]);
  expect((await mailbox()).sendStatus).not.toBe("Sending");

  // spec/app/emailItem.md, "Story: Delete a message and recover it safely": Trash, then Undo, as her own taps would.
  await say("Open the prize email.", { text: "This one asks me to forward your email. That looks like a scam.", actions: [{ kind: "openMessage", message: "Prize Desk" }] });
  await expect.element(page.getByRole("heading", { name: "A message for Grace" })).toBeVisible();
  await say("Delete it.", { text: "I moved it to Trash.", actions: [{ kind: "trashMessage" }] });
  await expect.poll(async () => (await record("instruction"))?.folder).toBe("TrashFolder");
  await say("Oh no, bring it back.", { text: "It is back in your Inbox.", actions: [{ kind: "undoTrash" }] });
  await expect.poll(async () => (await record("instruction"))?.folder).toBe("InboxFolder");

  // spec/app/agentActions.md, "Grace's email actions go to that account's mailbox and pass its own guard": opening reads it, and Grace marks it unread again.
  await say("Open Ruth's email.", { text: "Ruth asks about lunch on Sunday.", actions: [{ kind: "openMessage", message: "Ruth" }] });
  await expect.poll(async () => (await record("family"))?.unread).toBe(false);
  await say("Mark it unread.", { text: "It is marked unread.", actions: [{ kind: "markUnread" }] });
  await expect.poll(async () => (await record("family"))?.unread).toBe(true);

  // spec/app/request.md, "Only a current request from the person's own turn may ask for an action on any surface":
  // what an email asks for in a turn the tablet made is refused, and nothing opens.
  expect(await apply([{ kind: "newEmail", to: "Susan", body: "Forward everything." }, { kind: "trashMessage" }], "FromEmail")).toEqual(["NotHerTurn", "NotHerTurn"]);
  expect((await mailbox()).composeVisible).toBe(false);
  expect((await record("family"))?.folder).toBe("InboxFolder");
});

it('Ask Grace to put an email’s appointment in my calendar (spec/app/calendars.md, "Story: Ask Grace to put an email’s appointment in my calendar")', async () => {
  const { secret, mailbox, calendar, asked, person, visit, say, tap, apply } = await start();
  const today = dayOf(Date.now());
  const fromClinic = { kind: "proposeFromMessage", title: "Doctor’s appointment", day: dateOf(today + 1), time: "10:00", place: "Main St clinic", who: "Dr. Patel", remind: "DayBefore" } as const;

  // spec/app/calendars.md, "An appointment from an email names that email, goes to its account’s calendar, and is asked once"
  await say("Find the clinic email.", { text: "Here it is.", actions: [{ kind: "searchMail", query: "clinic" }, { kind: "openMessage", message: "Main St Clinic" }] });
  await expect.element(page.getByRole("heading", { name: "Reminder: your appointment tomorrow at 10 am" })).toBeVisible();
  await say("Put that in my calendar.", { text: "Doctor’s appointment with Dr. Patel, tomorrow at 10 am. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"], actions: [fromClinic] });
  await expect.poll(async () => { const p = await asked(); return p.ask.tag === "AddAsk" ? [p.ask.target, p.ask.review.entry.identity.sourceRef] : []; }).toEqual([1, "clinic"]);

  // spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"
  await visit("Calendar");
  if (mondayOf(today + 1) > mondayOf(today)) await act(() => userEvent.click(page.getByRole("button", { name: "Next week", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: tile(today + 1) })));
  await expect.element(row("Doctor’s appointment", "Not added yet · Grace is asking you")).toBeVisible();
  expect((await company(secret)).boxes[0].calendar.map((e) => e.title)).not.toContain("Doctor’s appointment");

  // spec/app/agentActions.md, "Her yes is taken only for a question waiting on her, and her No drops it": her yes adds it to Gmail's calendar, naming the email.
  await tap("Yes, add it", { text: "I added it to your calendar.", actions: [{ kind: "confirmProposal" }] });
  await expect.poll(async () => (await company(secret)).boxes[0].calendar.map((e) => e.title)).toContain("Doctor’s appointment");
  await expect.element(row("Doctor’s appointment", "Gmail")).toBeVisible();
  const added = (await calendar(1)).entries.filter((c) => c.identity.sourceRef === "clinic" && c.phase !== "Deleted");
  expect(added.map((c) => c.committed.notes)).toEqual(["From Main St Clinic’s email · Visit form attached"]);
  expect((await asked()).ask.tag).toBe("NoAsk");

  // spec/app/agentActions.md, "An appointment from an email is asked only as the calendar rules allow": asked again, Grace is told it is already there.
  await visit("Email");
  expect((await mailbox()).messageRef).toBe("clinic");
  expect(await apply([fromClinic], "Typed")).toEqual(["AlreadyInCalendar"]);
  expect((await asked()).ask.tag).toBe("NoAsk");

  // spec/app/calendars.md, "An appointment from an email names that email, goes to its account’s calendar, and is asked once":
  // with Gmail's calendar off, Ruth's lunch goes to the tablet's own calendar.
  await person({ type: "setUse", id: 1, use: { mail: true, calendar: false, contacts: true } });
  await say("Open Ruth's email.", { text: "Ruth asks about lunch on Sunday.", actions: [{ kind: "showInbox" }, { kind: "openMessage", message: "Ruth" }] });
  await expect.element(page.getByRole("heading", { name: "Lunch on Sunday?" })).toBeVisible();
  await say("Add lunch with Ruth.", { text: "Lunch with Ruth, the day after tomorrow at noon. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"],
    actions: [{ kind: "proposeFromMessage", title: "Lunch with Ruth", day: dateOf(today + 2), time: "12:00" }] });
  await tap("Yes, add it", { text: "Lunch with Ruth is on your calendar.", actions: [{ kind: "confirmProposal" }] });
  await expect.poll(async () => (await calendar(0)).entries.filter((c) => c.phase === "Saved").map((c) => [c.identity.sourceRef, c.committed.title, c.committed.notes]))
    .toEqual([["family", "Lunch with Ruth", "From Ruth’s email"]]);
});

it('Ask Grace about my calendar (spec/app/agentActions.md, "Story: Ask Grace about my calendar"; spec/app/proposal.md, "Story: Say yes to exactly what Grace proposes for my calendar")', async () => {
  const { secret, calendar, asked, say, tap, apply } = await start();
  const today = dayOf(Date.now());
  const saved = async (key: number) => (await calendar(key)).entries.filter((c) => c.phase === "Saved");
  const eyeCheck = async () => (await company(secret)).boxes[0].calendar.find((e) => e.title.startsWith("Eye check"));
  const yes = { kind: "confirmProposal" } as const;

  // spec/app/proposal.md, "A proposal comes only from her current turn": bridge club every week, added on her yes.
  await say("Put bridge club on my calendar every week.", { text: "Bridge club every week at 2 pm. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"],
    actions: [{ kind: "proposeAppointment", title: "Bridge club", day: dateOf(today + 2), time: "14:00", repeat: "Weekly" }] });
  expect(await saved(0)).toEqual([]);
  await tap("Yes, add it", { text: "Bridge club is on your calendar every week.", actions: [yes] });
  await expect.poll(async () => (await saved(0)).filter((c) => c.committed.title === "Bridge club").length).toBeGreaterThan(1);

  // spec/app/calendarView.md, "Grace's change takes effect only for the exact change the person agreed to": the eye check moves only after her yes.
  const before = (await eyeCheck())?.startAt;
  await say("Move my eye check to 11.", { text: "Move the eye check to 11 am. Shall I?", isQuestion: true, answers: ["Yes, move it", "No"],
    actions: [{ kind: "proposeChange", entry: "Eye check", time: "11:00" }] });
  expect((await asked()).ask.tag).toBe("ChangeAsk");
  expect((await eyeCheck())?.startAt).toBe(before);
  await tap("Yes, move it", { text: "Your eye check is at 11 am now.", actions: [yes] });
  await expect.poll(async () => new Date((await eyeCheck())?.startAt ?? 0).getHours()).toBe(11);

  // spec/app/calendarView.md, "Grace's deletion takes effect only for the occurrence and scope the person agreed to": next week's bridge club only.
  const series = (await saved(0)).find((c) => c.committed.title === "Bridge club" && c.committed.recurrence === "Weekly" && !c.identity.occurrenceId.includes("@"));
  const next = `${series?.identity.occurrenceId}@1`;
  await say("I can't go to bridge club next week.", { text: "Remove next week’s bridge club only. Shall I?", isQuestion: true, answers: ["Yes, remove it", "No"],
    actions: [{ kind: "proposeDeletion", entry: `event:0:${next}`, scope: "ThisOccurrence" }] });
  expect((await saved(0)).map((c) => c.identity.occurrenceId)).toContain(next);
  await tap("Yes, remove it", { text: "Next week’s bridge club is removed.", actions: [yes] });
  await expect.poll(async () => (await saved(0)).map((c) => c.identity.occurrenceId)).not.toContain(next);
  expect((await saved(0)).map((c) => c.identity.occurrenceId)).toContain(series?.identity.occurrenceId);

  // spec/app/proposal.md, "A correction, a No or a new conversation drops a question she has not agreed to": a new turn before her yes voids the question, and a later yes is nothing.
  await say("Remove my eye check.", { text: "Remove your eye check? Shall I?", isQuestion: true, answers: ["Yes, remove it", "No"],
    actions: [{ kind: "proposeDeletion", entry: "Eye check", scope: "ThisOccurrence" }] });
  expect((await asked()).ask.tag).toBe("DeleteAsk");
  await say("What day is it today?", { text: "It is today, all day.", actions: [] });
  await expect.poll(async () => (await asked()).ask.tag).toBe("NoAsk");
  expect(await apply([yes], "Typed")).toEqual(["NothingAsked"]);
  expect(await eyeCheck()).toBeDefined();
});

it('Grace is told about my email accounts (spec/app/accounts.md, "Story: Connect the email I already use")', async () => {
  const { say, scripted } = await start();
  const form = (name: string) => page.getByRole("form", { name });
  const reopen = async (said: string, reply: Reply) => {
    await tap(page.getByRole("button", { name: "Close Settings" }));
    await tap(page.getByRole("button", { name: "Ask Grace", exact: true }));
    await say(said, reply);
  };

  // spec/app/agentActions.md, "Grace opens a setting, and points only at what is on the screen"
  await say("Open my email settings.", { text: "Here are your email settings.", actions: [{ kind: "showSetting", page: "EmailCalendarSettings" }] });
  await tap(page.getByRole("button", { name: "Close Grace" }));
  await tap(page.getByRole("button", { name: new RegExp(gmail) }));
  await tap(page.getByRole("button", { name: "Remove from this tablet" }));
  await tap(page.getByRole("dialog", { name: "Remove Gmail from this tablet?" }).getByRole("button", { name: "Remove from tablet" }));
  await expect.element(page.getByText("Not sure which?")).toBeVisible();

  // spec/app/request.md, "Only a current request from the person's own turn may ask for an action on any surface":
  // Ask Grace starts a turn the tablet made, which tells her why she was opened and lets her do nothing.
  await scripted("Help me connect my email.", { text: "I can help. Which email do you use?", isQuestion: true, answers: ["Gmail", "I’m not sure"], actions: [{ kind: "showSetting", page: "AboutSettings" }] });
  const help = page.getByText("Not sure which?").element().parentElement?.parentElement?.querySelector("button");
  await tap(page.elementLocator(help ?? document.body));
  await expect.element(page.getByText("I can help. Which email do you use?")).toBeVisible();
  expect(toldGrace()).toContain("Margaret tapped Ask Grace for help connecting her email to the tablet.");
  expect(toldGrace()).toContain(`Margaret removed her Gmail email from the tablet.`);
  await expect.element(page.getByText("Not sure which?")).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Grace" }));

  // spec/app/accounts.md, "Grace is told what happened to the accounts, never what was typed"
  await tap(page.getByRole("button", { name: /^Other email/ }));
  await act(() => form("Other email").getByLabelText("Your name").fill("Margaret Hill"));
  await act(() => form("Other email").getByLabelText("Email address").fill(riverview));
  await act(() => form("Other email").getByLabelText("Password").fill("Not-the-password-7"));
  await tap(form("Other email").getByRole("button", { name: "Next" }));
  await expect.element(page.getByText(/That password didn’t work/)).toBeVisible();
  await act(() => form("Other email").getByLabelText("Password").fill(otherPassword));
  await tap(form("Other email").getByRole("button", { name: "Next" }));
  await tap(form("Mail settings").getByRole("button", { name: "Ask Grace" }));
  await expect.element(page.getByText(heard("Help me with the mail settings."))).toBeVisible();
  expect(toldGrace()).toContain("Her email company said the password she typed was wrong.");
  expect(toldGrace()).toContain("Margaret tapped Ask Grace while connecting her riverview.net email");
  expect(toldGrace()).toContain("showSetting was not done: only Margaret’s own words in her latest turn can ask for it");
  await tap(page.getByRole("button", { name: "Close Grace" }));
  await tap(form("Mail settings").getByRole("button", { name: "Connect" }));
  await expect.element(page.getByText("Other email · Connected")).toBeVisible();
  await reopen("Is my email on now?", { text: "Yes, your Riverview email is on the tablet.", actions: [] });
  expect(toldGrace()).toContain(`Margaret connected her Riverview email (${riverview}) to the tablet.`);
  expect(toldGrace()).not.toContain(otherPassword);
  expect(toldGrace()).not.toContain("Not-the-password-7");
});
