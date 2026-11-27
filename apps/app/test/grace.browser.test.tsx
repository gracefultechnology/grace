// spec/app/agentActions.md, "Story: Ask Grace to help with my email"; spec/app/agentActions.md, "Story: Ask Grace about my calendar"; spec/app/calendars.md, "Story: Ask Grace to put an email’s appointment in my calendar"; spec/app/proposal.md, "Story: Say yes to exactly what Grace proposes for my calendar"
import { Effect } from "effect";
import { act } from "react";
import { beforeEach, expect, inject, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { addAccount, goBack, initial } from "../gen/app__accounts.ts";
import { Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import type { Origin } from "../gen/app__request.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { Agent, type GraceAction } from "../src/agent.vibe";
import { day, dayOf, midnight } from "../src/calendar.vibe";
import { Instances } from "../src/instances.vibe";
import { client, otherPassword, script, signIn } from "./cloud.vibe";
import { actOnScreen, allowOutlook, captureSignedOutChat, connected, mountAccounts } from "./screen.tsx";
import "../src/main.css";

actOnScreen();
const chatBodies: string[] = [];
beforeEach(() => captureSignedOutChat(chatBodies));

const cloud: string = inject("cloud");
const gmail = "owner@grace.test";
const riverview = "margaret@riverview.net";
const outlook = "margaret@outlook.com";
const tap = (target: Parameters<typeof userEvent.click>[0]) => act(() => userEvent.click(target));
const toldGrace = () => chatBodies.join("\n").replaceAll("\\n", "\n");

type Unknown = { readonly kind: string; readonly [field: string]: unknown };
type Reply = { text: string; isQuestion?: boolean; answers?: string[]; actions: (GraceAction | Unknown)[] };
type Runs = Workspaces | AccountsMachine | Proposal | Instances | Agent;

const dateOf = (n: number) => new Date(midnight(n)).toLocaleDateString("en-CA");
const tile = (n: number) => new RegExp(`^(Today|${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "short" })})\\s*${new Date(midnight(n)).getDate()}(\\s*has plans)?$`);
const mondayOf = (n: number) => n - ((new Date(n * day).getUTCDay() + 6) % 7);
const row = (title: string, tag: string) => page.getByRole("button", { name: new RegExp(`${title}.*${tag}`) });

const kept = (withOutlook: boolean) => {
  const first = connected(initial, "Gmail", gmail, "Gmail");
  return withOutlook ? connected(addAccount(goBack(first, "AccountPerson"), "AccountPerson"), "Outlook", outlook, "Outlook") : first;
};

async function company(key: string) {
  const response = await fetch(`${cloud}/fake/account`, { headers: { authorization: `Bearer ${key}` } });
  return await response.json() as { boxes: { calendar: { title: string; startAt: string; externalId: string }[]; mail: { subject: string; labels: string[] }[] }[] };
}

async function start(withOutlook = false) {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  if (withOutlook) await allowOutlook({ cloud, key: secret, address: outlook });
  const runtime = await mountAccounts(kept(withOutlook), { url: cloud, key: secret });
  const run = <A,>(effect: Effect.Effect<A, unknown, Runs>) => act(() => runtime.runPromise(effect));
  const scripted = (said: string, reply: Reply) =>
    Effect.runPromise(Effect.provide(script(cloud, secret, [{ said, answer: JSON.stringify({ isQuestion: false, answers: [], ...reply }) }]), client));
  await expect.element(page.getByRole("button", { name: /^Email/ })).toHaveAccessibleDescription(/Riverside Power/);
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Collapse" })));
  return {
    secret, run, scripted,
    mailbox: (key = 1) => run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.mail(key)), (m) => m.get())),
    calendar: (key: number) => run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(key)), (c) => c.get())),
    asked: () => run(Effect.flatMap(Effect.service(Proposal), (p) => p.get())),
    window: async () => (await run(Effect.flatMap(Effect.service(Workspaces), (w) => w.get()))).assistant.presentation,
    person: (event: AccountEvent) => run(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson"))),
    visit: (destination: "Email" | "Calendar" | "Home") => run(Effect.flatMap(Effect.service(Workspaces), (w) => w.send({ type: "visit", destination }, "Person"))),
    say: async (said: string, reply: Reply) => {
      await scripted(said, reply);
      await act(() => page.getByRole("textbox", { name: "Message to Grace" }).fill(said));
      await expect.element(page.getByRole("region", { name: "Grace" }).getByRole("button", { name: "Send" })).toBeEnabled();
      await act(() => userEvent.keyboard("{Enter}"));
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
  const { secret, mailbox, say, apply } = await start(true);
  const sentSubjects = async () => (await company(secret)).boxes.flatMap((b) => b.mail.filter((m) => m.labels.includes("SENT")).map((m) => m.subject));

  // spec/app/agentActions.md, "Only Margaret's own current turn makes Grace act, on any screen"
  await say("Find the clinic email.", { text: "Here is the email from the clinic.", actions: [{ kind: "searchMail", query: "clinic" }] });
  await expect.poll(async () => (await mailbox()).query).toBe("clinic");
  await expect.element(page.getByRole("button", { name: /Main St Clinic/ })).toBeVisible();
  await say("Open it.", { text: "It is open.", actions: [{ kind: "openMessage", message: "mail:1:clinic" }] });
  await expect.element(page.getByRole("heading", { name: "Reminder: your appointment tomorrow at 10 am" })).toBeVisible();

  // spec/app/agentActions.md, "Grace's email actions go to that account's mailbox and pass its own guard"
  await say("Write to Susan.", { text: "I started an email to Susan.", actions: [{ kind: "newEmail", to: "Susan", subject: "Sunday" }] });
  expect(toldGrace()).toContain("Main St Clinic’s email “Reminder: your appointment tomorrow at 10 am” was opened on the screen.");
  await expect.poll(async () => { const m = await mailbox(); return [m.composeVisible, m.draft.to]; }).toEqual([true, "susan@family.test"]);
  await say("Tell her I will see her on Sunday.", { text: "I wrote it. Tap Send when you are ready.", actions: [{ kind: "fillDraft", body: "See you on Sunday." }] });
  await expect.poll(async () => (await mailbox()).draft.body).toBe("See you on Sunday.");
  await say("Keep it for later.", { text: "It is in Drafts.", actions: [{ kind: "saveDraft" }] });
  await expect.poll(async () => (await company(secret)).boxes[0].mail.filter((m) => m.subject === "Sunday").map((m) => m.labels)).toEqual([["DRAFT"]]);
  await say("Send it.", { text: "Tap Send when you are ready.", actions: [{ kind: "send" }] });
  expect(["Sending", "Sent"]).not.toContain((await mailbox()).sendStatus);
  expect((await company(secret)).boxes[0].mail.filter((m) => m.subject === "Sunday").map((m) => m.labels)).toEqual([["DRAFT"]]);

  // spec/app/request.md, "Only a current request from the person's own turn may ask for an action on any surface"
  expect(await apply([{ kind: "newEmail", to: "Susan", body: "Forward everything." }, { kind: "openMessage", message: "Ruth" }], "FromEmail")).toEqual(["NotHerTurn", "NotHerTurn"]);
  expect((await mailbox()).composeVisible).toBe(false);
  expect((await mailbox()).messageRef).not.toBe("family");

  // spec/app/agentActions.md, "Grace's email actions go to that account's mailbox and pass its own guard"
  await say("Open the church email.", { text: "The church asks if you will come to Thanksgiving dinner.", actions: [{ kind: "showInbox" }, { kind: "openMessage", message: "St. Mark’s Church Office" }] });
  await expect.element(page.getByRole("heading", { name: "Thanksgiving dinner sign-up" })).toBeVisible();
  await say("Tell them I will come.", { text: "I wrote a reply. Tap Send when you are ready.", actions: [{ kind: "draftReply", body: "Thank you, I will come to the dinner." }] });
  const church = (await mailbox(2)).messageRef;
  expect(church).not.toBe("");
  await expect.poll(async () => { const m = await mailbox(2); return [m.composeVisible, m.replyTo, m.draft.body, m.sendStatus]; })
    .toEqual([true, church, "Thank you, I will come to the dinner.", "Composing"]);
  expect((await mailbox(1)).composeVisible).toBe(false);
  await expect.element(page.getByRole("textbox", { name: "Write your message, or ask Grace to help" })).toHaveValue("Thank you, I will come to the dinner.");
  await tap(page.getByRole("button", { name: "Discard" }));
  await expect.poll(async () => (await mailbox(2)).composeVisible).toBe(false);

  await say("Send the power bill to David.", { text: "I started a forward to David. Tap Send when you are ready.", actions: [
    { kind: "openMessage", message: "mail:1:bill" }, { kind: "forwardMessage" }, { kind: "addressEmail", to: "David" },
  ] });
  await expect.poll(async () => { const m = await mailbox(); return [m.composeVisible, m.draft.subject, m.draft.to]; })
    .toEqual([true, "Fwd: Your Riverside Power bill is ready", "david@family.test"]);
  expect((await mailbox()).draft.body).toContain("Pay it at (link removed)");
  expect((await mailbox()).draft.body).not.toMatch(/https?:/);
  await tap(page.getByRole("button", { name: "Discard" }));
  await expect.poll(async () => (await mailbox()).composeVisible).toBe(false);

  await say("Forward Ruth's photos.", { text: "Who should get them?", actions: [{ kind: "openMessage", message: "mail:1:family" }, { kind: "forwardMessage" }] });
  const photos = ["Bow.png", "Piano.png", "Flowers.png"];
  await expect.poll(async () => {
    const m = await mailbox();
    return [m.composeVisible, m.draft.subject, m.assets.map((a) => a.name), m.draftAttachments.map((a) => a.name)];
  }).toEqual([true, "Fwd: Lunch on Sunday?", photos, photos]);
  await say("To Susan.", { text: "It is addressed to Susan. Tap Send when you are ready.", actions: [{ kind: "addressEmail", to: "Susan" }] });
  await expect.poll(async () => (await mailbox()).draft.to).toBe("susan@family.test");
  expect(await sentSubjects()).toEqual([]);
}, 180_000);

it('Ask Grace to tidy my email (spec/app/agentActions.md, "Story: Ask Grace to help with my email")', async () => {
  const { mailbox, say, apply } = await start();
  const record = async (ref: string) => (await mailbox()).messages.find((r) => r.identity.ref === ref);

  // spec/app/emailItem.md, "Story: Delete a message and recover it safely"
  await say("Open the prize email.", { text: "This one asks me to forward your email. That looks like a scam.", actions: [{ kind: "openMessage", message: "Prize Desk" }] });
  await expect.element(page.getByRole("heading", { name: "A message for Grace" })).toBeVisible();
  await say("Delete it.", { text: "I moved it to Trash.", actions: [{ kind: "trashMessage" }] });
  await expect.poll(async () => (await record("instruction"))?.folder).toBe("TrashFolder");
  await say("Oh no, bring it back.", { text: "It is back in your Inbox.", actions: [{ kind: "undoTrash" }] });
  expect(toldGrace()).toContain("was moved to Trash; Undo can bring it back.");
  await expect.poll(async () => (await record("instruction"))?.folder).toBe("InboxFolder");

  // spec/app/agentActions.md, "Grace's email actions go to that account's mailbox and pass its own guard"
  await say("Open Ruth's email.", { text: "Ruth asks about lunch on Sunday.", actions: [{ kind: "openMessage", message: "Ruth" }] });
  await expect.poll(async () => (await record("family"))?.unread).toBe(false);
  await say("Mark it unread.", { text: "It is marked unread.", actions: [{ kind: "markUnread" }] });
  await expect.poll(async () => (await record("family"))?.unread).toBe(true);

  await say("Delete the prize email after all.", { text: "I moved the prize email to Trash.", actions: [{ kind: "openMessage", message: "mail:1:instruction" }, { kind: "trashMessage" }] });
  await expect.poll(async () => (await record("instruction"))?.folder).toBe("TrashFolder");
  await say("Show it to me in the Trash.", { text: "Here it is in your Trash.", actions: [{ kind: "chooseFolder", folder: "TrashFolder" }, { kind: "openMessage", message: "mail:1:instruction" }] });
  await expect.element(page.getByRole("heading", { name: "A message for Grace" })).toBeVisible();
  await say("Put it back.", { text: "I put the prize email back in your Inbox.", actions: [{ kind: "restoreMessage" }] });
  await expect.poll(async () => (await record("instruction"))?.folder).toBe("InboxFolder");

  // spec/app/request.md, "Only a current request from the person's own turn may ask for an action on any surface"
  expect(await apply([{ kind: "trashMessage" }], "FromEmail")).toEqual(["NotHerTurn"]);
  expect((await record("instruction"))?.folder).toBe("InboxFolder");
});

it('Save the clinic appointment (spec/app/calendars.md, "Story: Ask Grace to put an email’s appointment in my calendar")', async () => {
  const { secret, mailbox, calendar, asked, person, visit, say, tap } = await start();
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

  // spec/app/agentActions.md, "Her yes is taken only for a question waiting on her, and her No drops it"
  await tap("Yes, add it", { text: "I added it to your calendar.", actions: [{ kind: "confirmProposal" }] });
  await expect.poll(async () => (await company(secret)).boxes[0].calendar.map((e) => e.title)).toContain("Doctor’s appointment");
  await expect.element(page.getByRole("heading", { name: "Doctor’s appointment" })).toBeVisible();
  await expect.element(page.getByText("From Main St Clinic’s email · Visit form attached")).toBeVisible();
  await act(() => userEvent.click(page.getByRole("button", { name: "Back to Calendar" })));
  await expect.element(row("Doctor’s appointment", "Gmail")).toBeVisible();
  const added = (await calendar(1)).entries.filter((c) => c.identity.sourceRef === "clinic" && c.phase !== "Deleted");
  const providerId = (await company(secret)).boxes[0].calendar.find((event) => event.title === "Doctor’s appointment")?.externalId;
  expect(providerId).toBeTruthy();
  expect(added.map((c) => [c.identity.occurrenceId, c.committed.notes])).toEqual([[providerId, "From Main St Clinic’s email · Visit form attached"]]);
  await expect.element(page.getByRole("heading", { name: "Doctor’s appointment", exact: true })).not.toBeInTheDocument();
  expect((await asked()).ask.tag).toBe("NoAsk");

  // spec/app/agentActions.md, "An appointment from an email is asked only as the calendar rules allow"
  await visit("Email");
  expect((await mailbox()).messageRef).toBe("clinic");
  await say("Put it in my calendar again.", { text: "Shall I add it?", actions: [fromClinic] });
  expect((await asked()).ask.tag).toBe("NoAsk");

  // spec/app/calendars.md, "An appointment from an email names that email, goes to its account’s calendar, and is asked once"
  await person({ type: "setUse", id: 1, use: { mail: true, calendar: false, contacts: true } });
  await say("Open Ruth's email.", { text: "Ruth asks about lunch on Sunday.", actions: [{ kind: "showInbox" }, { kind: "openMessage", message: "Ruth" }] });
  expect(toldGrace()).toContain("proposeFromMessage was not done: it is already in their calendar");
  await expect.element(page.getByRole("heading", { name: "Lunch on Sunday?" })).toBeVisible();
  await say("Add lunch with Ruth.", { text: "Lunch with Ruth, the day after tomorrow at noon. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"],
    actions: [{ kind: "proposeFromMessage", title: "Lunch with Ruth", day: dateOf(today + 2), time: "12:00" }] });
  await tap("Yes, add it", { text: "Lunch with Ruth is on your calendar.", actions: [{ kind: "confirmProposal" }] });
  await expect.poll(async () => (await calendar(0)).entries.filter((c) => c.phase === "Saved").map((c) => [c.identity.sourceRef, c.committed.title, c.committed.notes]))
    .toEqual([["family", "Lunch with Ruth", "From Ruth’s email"]]);
});

it('Ask Grace about my calendar (spec/app/agentActions.md, "Story: Ask Grace about my calendar")', async () => {
  // spec/app/proposal.md, "Story: Say yes to exactly what Grace proposes for my calendar"
  const { secret, calendar, asked, say, tap, apply } = await start();
  const today = dayOf(Date.now());
  const saved = async (key: number) => (await calendar(key)).entries.filter((c) => c.phase === "Saved");
  const eyeCheck = async () => (await company(secret)).boxes[0].calendar.find((e) => e.title.startsWith("Eye check"));
  const yes = { kind: "confirmProposal" } as const;

  await say("Lunch with Ruth tomorrow at 10.", { text: "Lunch with Ruth tomorrow at 10. Shall I add it?", actions: [{ kind: "proposeAppointment", title: "Lunch with Ruth", day: "tomorrow", time: "10 am", repeat: "Once" }] });
  expect((await asked()).ask.tag).toBe("NoAsk");

  // spec/app/proposal.md, "A proposal comes only from her current turn"
  await say("Put bridge club on my calendar every week.", { text: "Bridge club every week at 2 pm. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"],
    actions: [{ kind: "proposeAppointment", title: "Bridge club", day: dateOf(today + 2), time: "14:00", repeat: "Weekly" }] });
  expect(toldGrace()).toContain("proposeAppointment could not be read, so it was not done");
  expect(await saved(0)).toEqual([]);
  await tap("Yes, add it", { text: "Bridge club is on your calendar every week.", actions: [yes] });
  await expect.poll(async () => (await saved(0)).filter((c) => c.committed.title === "Bridge club").length).toBeGreaterThan(1);

  // spec/app/calendarView.md, "Grace's change takes effect only for the exact change the person agreed to"
  const before = (await eyeCheck())?.startAt;
  await say("Move my eye check to 11.", { text: "Move the eye check to 11 am. Shall I?", isQuestion: true, answers: ["Yes, move it", "No"],
    actions: [{ kind: "proposeChange", entry: "Eye check", time: "11:00" }] });
  expect((await asked()).ask.tag).toBe("ChangeAsk");
  expect((await eyeCheck())?.startAt).toBe(before);
  await tap("Yes, move it", { text: "Your eye check is at 11 am now.", actions: [yes] });
  await expect.poll(async () => new Date((await eyeCheck())?.startAt ?? 0).getHours()).toBe(11);

  // spec/app/calendarView.md, "Grace's deletion takes effect only for the occurrence and scope the person agreed to"
  const series = (await saved(0)).find((c) => c.committed.title === "Bridge club" && c.committed.recurrence === "Weekly" && !c.identity.occurrenceId.includes("@"));
  const next = `${series?.identity.occurrenceId}@1`;
  await say("I can't go to bridge club next week.", { text: "Remove next week’s bridge club only. Shall I?", isQuestion: true, answers: ["Yes, remove it", "No"],
    actions: [{ kind: "proposeDeletion", entry: `event:0:${next}`, scope: "ThisOccurrence" }] });
  expect((await saved(0)).map((c) => c.identity.occurrenceId)).toContain(next);
  await tap("Yes, remove it", { text: "Next week’s bridge club is removed.", actions: [yes] });
  await expect.poll(async () => (await saved(0)).map((c) => c.identity.occurrenceId)).not.toContain(next);
  expect((await saved(0)).map((c) => c.identity.occurrenceId)).toContain(series?.identity.occurrenceId);

  // spec/app/proposal.md, "A correction, a No or a new conversation drops a question she has not agreed to"
  const teaAt = { kind: "proposeAppointment", title: "Tea with Susan", day: dateOf(today + 3), time: "15:00", repeat: "Once" } as const;
  const tea = async () => (await saved(0)).filter((c) => c.committed.title === "Tea with Susan");
  await say("Add tea with Susan.", { text: "Tea with Susan at 3 pm. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"], actions: [teaAt] });
  expect((await asked()).ask.tag).toBe("AddAsk");
  await tap("No", { text: "All right, I won’t add it.", actions: [] });
  await expect.poll(async () => (await asked()).ask.tag).toBe("NoAsk");
  await expect.element(page.getByRole("button", { name: "Yes, add it" })).not.toBeInTheDocument();
  expect(await apply([yes], "Typed")).toEqual(["NothingAsked"]);
  expect(await tea()).toEqual([]);
  await say("Add tea with Susan after all.", { text: "Tea with Susan after all, at 3 pm. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"], actions: [teaAt] });
  expect((await asked()).ask.tag).toBe("AddAsk");
  await say("Never mind.", { text: "All right, I’ve dropped it.", actions: [{ kind: "cancelProposal" }] });
  await expect.poll(async () => (await asked()).ask.tag).toBe("NoAsk");
  expect(toldGrace()).not.toContain("cancelProposal was not done");
  expect(await apply([yes], "Typed")).toEqual(["NothingAsked"]);
  expect(await tea()).toEqual([]);
  await say("Remove my eye check.", { text: "Remove your eye check? Shall I?", isQuestion: true, answers: ["Yes, remove it", "No"],
    actions: [{ kind: "proposeDeletion", entry: "Eye check", scope: "ThisOccurrence" }] });
  expect((await asked()).ask.tag).toBe("DeleteAsk");
  await say("What day is it today?", { text: "It is today, all day.", actions: [] });
  await expect.poll(async () => (await asked()).ask.tag).toBe("NoAsk");
  expect(await apply([yes], "Typed")).toEqual(["NothingAsked"]);
  await say("Take the eye check off my calendar.", { text: "Take off your eye check? Shall I?", isQuestion: true, answers: ["Yes, take it off", "No"],
    actions: [{ kind: "proposeDeletion", entry: "Eye check", scope: "ThisOccurrence" }] });
  expect((await asked()).ask.tag).toBe("DeleteAsk");
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{ said: "Is it raining?", answer: "[]" }]), client));
  await act(() => page.getByRole("textbox", { name: "Message to Grace" }).fill("Is it raining?"));
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.element(page.getByText("Sorry, I didn’t catch that. Could you say it again?")).toBeVisible();
  await expect.poll(async () => (await asked()).ask.tag).toBe("NoAsk");
  expect(await apply([yes], "Typed")).toEqual(["NothingAsked"]);
  expect(await eyeCheck()).toBeDefined();
});

it('Grace is told about my email accounts (spec/app/accounts.md, "Story: Connect the email I already use")', async () => {
  const { say, window, secret, visit, asked, calendar } = await start();
  const tea = async () => (await calendar(0)).entries.filter((c) => c.committed.title === "Tea with Susan" && c.phase === "Saved");
  const form = (name: string) => page.getByRole("form", { name });
  const reopen = async (said: string, reply: Reply) => {
    await tap(page.getByRole("button", { name: "Close Settings" }));
    await tap(page.getByRole("button", { name: "Ask Grace", exact: true }));
    await say(said, reply);
  };

  // spec/app/agentActions.md, "Grace opens a setting, and points only at what is on the screen"
  await say("Open my email settings.", { text: "Here are your email settings.", actions: [{ kind: "showSetting", page: "EmailCalendarSettings" }] });
  await say("Where is my Gmail?", { text: "Your Gmail is the first email in the list.", actions: [{ kind: "guide", target: "acc-1", emphasis: "instruction", title: "Tap your Gmail" }] });
  await expect.element(page.getByText("Tap your Gmail")).toBeVisible();
  await tap(page.getByRole("button", { name: "Close this tip" }));
  await expect.element(page.getByText("Tap your Gmail")).not.toBeInTheDocument();
  // spec/app/conversation.md, "Detected private content is removed before the conversation continues"
  await say("Show me again.", { text: "Here it is again.", actions: [{ kind: "guide", target: "acc-1", emphasis: "instruction", title: "Tap your Gmail, not card 4111 1111 1111 1111" }] });
  await expect.element(page.getByText(/^Tap your Gmail, not card [* ]+$/)).toBeVisible();
  expect(document.body.textContent).not.toContain("4111");
  await tap(page.getByRole("button", { name: "Close this tip" }));
  await tap(page.getByRole("button", { name: "Close Grace" }));
  await tap(page.getByRole("button", { name: new RegExp(gmail) }));
  await tap(page.getByRole("button", { name: "Remove from this tablet" }));
  await tap(page.getByRole("dialog", { name: "Remove Gmail from this tablet?" }).getByRole("button", { name: "Remove from tablet" }));
  await expect.element(page.getByText("Not sure which?")).toBeVisible();

  // spec/app/accounts.md, "Grace is told what happened to the accounts, never what was typed"; spec/app/conversation.md, "A turn may start without her words, marked with where it came from"; spec/app/request.md, "A request records its turn, the work it belongs to and where the turn came from"
  const which = { text: "I can help. Which email do you use?", isQuestion: true, answers: ["Gmail", "Outlook or Hotmail", "I’m not sure"], actions: [{ kind: "confirmProposal" }, { kind: "cancelProposal" }, { kind: "showSetting", page: "EmailCalendarSettings" }] };
  await tap(page.getByRole("button", { name: "Close Settings" }));
  await visit("Email");
  await expect.element(page.getByText("Not sure which?")).not.toBeInTheDocument();
  await tap(page.getByRole("button", { name: "Ask Grace", exact: true }));
  await say("Add tea with Susan.", { text: "Tea with Susan, the day after tomorrow at 3 pm. Shall I add it?", isQuestion: true, answers: ["Yes, add it", "No"],
    actions: [{ kind: "proposeAppointment", title: "Tea with Susan", day: dateOf(dayOf(Date.now()) + 2), time: "15:00", repeat: "Once" }] });
  await expect.poll(async () => (await asked()).ask.tag).toBe("AddAsk");
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{ answer: JSON.stringify(which) }]), client));
  await tap(page.getByRole("button", { name: "Ask Grace to help" }));
  expect(await window()).toBe("Compact");
  await expect.element(page.getByText("I can help. Which email do you use?")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Outlook or Hotmail" })).toBeVisible();
  expect((await asked()).ask.tag).toBe("AddAsk");
  expect(toldGrace()).toContain("The person tapped Ask Grace for help connecting their email to the tablet.");
  expect(toldGrace()).toContain("The person tapped Ask Grace: what they want help with is what the tablet just told you.");
  expect(toldGrace()).toContain(`The person removed their Gmail email (${gmail}) from the tablet.`);
  await expect.element(page.getByText("Not sure which?")).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Grace" }));

  await tap(page.getByRole("button", { name: /^Other email/ }));
  await act(() => form("Other email").getByLabelText("Your name").fill("Margaret Hill"));
  await act(() => form("Other email").getByLabelText("Email address").fill(riverview));
  await act(() => form("Other email").getByLabelText("Password").fill("Not-the-password-7"));
  await tap(form("Other email").getByRole("button", { name: "Next" }));
  await expect.element(page.getByText(/That password didn’t work/)).toBeVisible();
  await act(() => form("Other email").getByLabelText("Password").fill(otherPassword));
  await tap(form("Other email").getByRole("button", { name: "Next" }));
  await tap(form("Mail settings").getByRole("button", { name: "Ask Grace" }));
  await say("What are these?", { text: "They are the addresses your email company uses. They are not secret.", actions: [] });
  expect(toldGrace()).toContain("Their email company said the password they typed was wrong.");
  expect(toldGrace()).toContain("The person tapped Ask Grace while connecting their riverview.net email");
  // spec/app/agentActions.md, "Her yes is taken only for a question waiting on her, and her No drops it"; spec/app/request.md, "Only a current request from the person's own turn may ask for an action on any surface"
  expect(toldGrace()).toContain("confirmProposal was not done: the person has not answered your question yet");
  // spec/app/proposal.md, "A correction, a No or a new conversation drops a question she has not agreed to"
  expect(toldGrace()).toContain("cancelProposal was not done: the person has not answered your question yet");
  expect(await tea()).toEqual([]);
  await tap(page.getByRole("button", { name: "Close Grace" }));
  await tap(form("Mail settings").getByRole("button", { name: "Connect" }));
  await expect.element(page.getByText("Other email · Connected")).toBeVisible();
  await reopen("Is my email on now?", { text: "Yes, your Riverview email is on the tablet.", actions: [] });
  expect(toldGrace()).toContain(`The person connected their Riverview email (${riverview}) to the tablet.`);
  expect(toldGrace()).not.toContain(otherPassword);
  expect(toldGrace()).not.toContain("Not-the-password-7");
});
