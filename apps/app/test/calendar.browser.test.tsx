// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { expect, inject, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { approveSave, create, initial as newEntry, save } from "../gen/app__calendar.ts";
import { lifetimeMs, type Offer } from "../gen/app__notices.ts";
import { type Ask, type Event as ProposalEvent, Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import { proposalOf } from "../gen/app__proposal.ts";
import { consent, type Request } from "../gen/app__request.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { day, dayOf, hour, longDate, midnight, timeLabel } from "../src/calendar.vibe";
import { Instances } from "../src/instances.vibe";
import { client, modelTurns, outage, script, signIn } from "./cloud.vibe";
import { actOnScreen, mountGmail } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

const journey = 240_000;
const atCloud = { timeout: 20_000 };

const cloud = inject("cloud");
const gmail = "owner@grace.test";
const click = (name: string | RegExp) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
const row = (title: string, tag?: string) => page.getByRole("button", { name: new RegExp(`${title}${tag ? `.*${tag}` : ""}`) });
const mondayOf = (n: number) => n - ((new Date(n * day).getUTCDay() + 6) % 7);
const ringed = (title: string, mark: string) => page.getByRole("group", { name: mark }).getByRole("button", { name: new RegExp(title) });
const picked = (name: string) => expect.element(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
const monthTitle = (n: number, ahead: number) => { const d = new Date(midnight(n)); return new Date(d.getFullYear(), d.getMonth() + ahead, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
const tile = (n: number, plans = "(\\s*has plans)?") => new RegExp(`^(Today|${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "short" })})\\s*${new Date(midnight(n)).getDate()}${plans}$`);

async function company(key: string) {
  const response = await fetch(new URL("/fake/account", cloud), { headers: { authorization: `Bearer ${key}` } });
  const { boxes } = await response.json() as { boxes: { calendar: { externalId: string; title: string; startAt: string; etag: string }[] }[] };
  return boxes[0].calendar;
}
const atCompany = async (key: string, id: string, init: { method: "PATCH" | "DELETE"; body?: object }) => {
  const etag = (await company(key)).find((e) => e.externalId === id)?.etag ?? "";
  return fetch(new URL(`/api/v1/eliza/google/calendar/events/${encodeURIComponent(id)}`, cloud), {
    method: init.method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "If-Match": etag },
    ...init.body === undefined ? {} : { body: JSON.stringify(init.body) },
  });
};
const toldGrace = async (key: string) => (await Effect.runPromise(Effect.provide(modelTurns(cloud, key), client))).map((t) => t.context).join("\n");
const marked = (title: string, tag: string) => page.getByRole("button", { name: new RegExp(`Important\\s*${title}.*${tag}`) });

const selectedGmailCalendar = Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(1)), (c) => c.get());
const held = async (key: string) => (await company(key)).filter((e) => e.title !== "Joan’s birthday").map((e) => ({ title: e.title, startAt: Date.parse(e.startAt) }));

async function start({ down = false, clockAt }: { down?: boolean; clockAt?: number } = {}) {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const [eye] = await company(secret);
  const reachable = (up: boolean) => Effect.runPromise(Effect.provide(outage(cloud, secret, !up), client));
  if (down) await reachable(false);
  const eyeAt = Date.parse(eye.startAt);
  const eyeDay = dayOf(eyeAt);
  const runtime = await mountGmail(gmail, { url: cloud, key: secret }, clockAt);
  const run = <A,>(effect: Effect.Effect<A, unknown, Workspaces | AccountsMachine | Proposal | Instances>) => act(() => runtime.runPromise(effect));
  const card = page.getByRole("group", { name: "Calendar", exact: true });
  const proposal = (event: ProposalEvent, by: "Grace" | "Person" | "Host") => run(Effect.flatMap(Effect.service(Proposal), (p) => p.send(event, by)));
  const ask = async (question: Ask) => {
    const turn = Math.max((await run(Effect.flatMap(Effect.service(Proposal), (p) => p.get()))).generation, 0) + 1;
    const spoken: Request = { generation: turn, workVersion: 1, origin: "Spoken" };
    await proposal({ type: "propose", ask: question, request: spoken, now: spoken }, "Grace");
    return turn;
  };
  return {
    secret, eye: eye.externalId, eyeAt, eyeDay, card, run, reachable,
    say: async (said: string, text: string, actions: unknown[]) => {
      await Effect.runPromise(Effect.provide(script(cloud, secret, [{ said, answer: JSON.stringify({ text, isQuestion: false, answers: [], actions }) }]), client));
      await act(() => page.getByRole("textbox", { name: "Message to Grace" }).fill(said));
      await act(() => userEvent.keyboard("{Enter}"));
      await expect.element(page.getByText(text).first()).toBeVisible();
    },
    ask, proposal,
    agree: async (question: Ask, shows?: () => Promise<unknown>) => {
      const turn = await ask(question);
      await shows?.();
      const asked = await run(Effect.flatMap(Effect.service(Proposal), (p) => p.get()));
      const tapped: Request = { generation: turn + 1, workVersion: 1, origin: "Tapped" };
      await proposal({ type: "agree", given: consent(tapped, asked.spent + 1, proposalOf(asked)), now: tapped }, "Person");
    },
    toEyeWeek: async () => {
      await act(() => userEvent.click(card.getByRole("button", { name: /^Calendar(?:$| )/ })));
      await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
      for (let i = (mondayOf(eyeDay) - mondayOf(dayOf(Date.now()))) / 7; i > 0; i--) await click("Next week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(eyeDay) })));
    },
    switchCalendar: async (on: boolean) => {
      await click("Settings");
      await act(() => userEvent.click(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Email & calendar" })));
      await act(() => userEvent.click(page.getByRole("button", { name: new RegExp(gmail) })));
      await act(() => userEvent.click(page.getByRole("switch", { name: "Calendar" })));
      await expect.element(page.getByRole("switch", { name: "Calendar" })).toHaveAttribute("aria-checked", String(on));
      await click("Close Settings");
    },
  };
}

it('Browse (spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives")', async () => {
  // spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"
  const { secret, eye, eyeDay, card, run, reachable, agree, say, toEyeWeek, switchCalendar } = await start({ down: true });
  const lifecycle = (lifecycle: "SleepDevice" | "WakeDevice") => run(Effect.flatMap(Effect.service(Workspaces), (w) => w.send({ type: "changeLifecycle", lifecycle }, "Host")));

  // spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
  await expect.element(card.getByRole("button", { name: "Calendar Nothing else today" })).toBeVisible();
  await expect.element(card.getByText("Eye check with Dr. Patel")).not.toBeInTheDocument();
  await reachable(true);
  await act(() => userEvent.click(card.getByRole("button", { name: /^Calendar(?:$| )/ })));
  await click("Close Calendar");
  await expect.element(card.getByText("Eye check with Dr. Patel")).toBeVisible();
  await act(() => userEvent.click(card.getByText("Eye check with Dr. Patel")));
  await expect.element(page.getByText("Riverside Clinic")).toBeVisible();
  await click("Back to Calendar");
  await click("Close Calendar");
  await lifecycle("SleepDevice");
  await expect.element(page.getByText(/Joan’s birthday,/)).toBeVisible();
  await act(() => userEvent.click(page.getByText("Touch the screen to wake it")));
  await expect.element(page.getByText(/Joan’s birthday,/)).not.toBeInTheDocument();

  // spec/app/calendarView.md, "Navigation clears detail and only accepts a validated calendar interval"; spec/app/calendars.md, "Tags show only when an email’s calendar is on"
  await toEyeWeek();
  await expect.element(row("Eye check with Dr\\. Patel", "Gmail")).toBeVisible();
  await act(() => userEvent.click(page.getByRole("radio", { name: "Month" })));
  const eyeCell = page.getByRole("button", { name: new RegExp(`^${new Date(midnight(eyeDay)).getDate()}\\s*Eye check`) });
  await expect.element(page.getByRole("heading", { name: monthTitle(eyeDay, 0) })).toBeVisible();
  await click("Next month");
  await expect.element(page.getByRole("heading", { name: monthTitle(eyeDay, 1) })).toBeVisible();
  await click("Previous month");
  await click("Previous month");
  await expect.element(page.getByRole("heading", { name: monthTitle(eyeDay, -1) })).toBeVisible();
  await click("Next month");
  await expect.element(eyeCell).toHaveAttribute("aria-pressed", "true");
  await act(() => userEvent.click(eyeCell));
  await act(() => userEvent.click(row("Eye check with Dr\\. Patel", "Gmail")));
  await expect.element(page.getByText("Riverside Clinic")).toBeVisible();
  await click("Back to Calendar");

  // spec/app/calendarView.md, "Navigation clears detail and only accepts a validated calendar interval"; spec/app/calendarView.md, "Coming up lists saved events after the selected day"
  await click("Today");
  await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: tile(dayOf(Date.now())) })).toHaveAttribute("aria-pressed", "true");
  await expect.element(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect.element(row("Joan’s birthday")).toBeVisible();
  await expect.element(row("Eye check with Dr\\. Patel")).not.toBeInTheDocument();

  // spec/app/calendars.md, "A switched-off account’s appointments and reminders show nowhere, to her or to Grace"; spec/app/calendars.md, "The connect banner shows until an email’s calendar is on or she says Not now"
  await click("Close Calendar");
  await switchCalendar(false);
  await expect.element(card.getByText("Eye check with Dr. Patel")).not.toBeInTheDocument();
  await toEyeWeek();
  await expect.element(page.getByText("Connect your email to keep your calendar up to date")).toBeVisible();
  await expect.element(row("Eye check with Dr\\. Patel")).not.toBeInTheDocument();
  await click("Connect email");
  await expect.element(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Email & calendar" })).toHaveAttribute("aria-current", "page");
  await expect.element(page.getByRole("switch", { name: "Calendar" })).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: new RegExp(gmail) })).toBeVisible();
  await click("Close Settings");
  await click("Not now");
  await expect.element(page.getByText("Connect your email to keep your calendar up to date")).not.toBeInTheDocument();
  await click("Close Calendar");
  await expect.element(card.getByText("Eye check with Dr. Patel")).not.toBeInTheDocument();
  await switchCalendar(true);
  await expect.element(card.getByText("Eye check with Dr. Patel")).toBeVisible();

  // spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/calendarView.md, "Coming up lists saved events after the selected day"; spec/app/proposal.md, "An agreed question stays exactly as agreed until the calendar answers"
  await toEyeWeek();
  await expect.element(row("Eye check with Dr\\. Patel", "Gmail")).toBeVisible();
  const gmailView = await run(selectedGmailCalendar);
  const startAt = midnight(eyeDay) + 15 * hour;
  const entry = {
    identity: { owner: gmailView.owner, calendarId: gmailView.calendarId, occurrenceId: "clinic-visit", sourceRef: "clinic", sourceAccount: 1, kind: "Appointment" as const, billRef: "", billOrigin: "", billAccount: "" },
    details: {
      title: "Doctor’s appointment", location: "Main St clinic", participant: "Dr. Patel", notes: "From the clinic’s email · Visit form attached",
      startAt, endAt: startAt + hour, timezone: gmailView.timezone, allDay: false, seriesId: "", recurrence: "Once" as const, reminderEnabled: true, leadTime: day, important: true,
    },
  };
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false, "createResponse"), client));
  await click("Previous week");
  await agree({ tag: "AddAsk", target: 1, review: { entry, calendarGeneration: gmailView.generation, displayTimezone: gmailView.timezone } },
    async () => {
      await expect.element(page.getByRole("button", { name: tile(eyeDay) })).toHaveAttribute("aria-pressed", "true");
      await expect.element(row("Doctor’s appointment", "Not added yet · Grace is asking you")).toBeVisible();
      await click("Previous week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(mondayOf(eyeDay) - 7) })));
      await expect.element(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
      await expect.element(row("Eye check with Dr\\. Patel", "Gmail")).toBeVisible();
      await expect.element(row("Doctor’s appointment")).not.toBeInTheDocument();
      await click("Next week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(eyeDay) })));
    });
  await expect.element(page.getByText("This wasn’t saved. Press Save to try again.")).toBeVisible();
  await click("Save");
  await expect.poll(async () => (await company(secret)).map((e) => e.title), atCloud).toEqual(["Eye check with Dr. Patel", "Joan’s birthday", "Doctor’s appointment"]);
  await expect.element(page.getByText("Saved to your calendar", { exact: true })).toBeVisible();
  await expect.element(ringed("Doctor’s appointment", "Done")).toBeVisible();
  const [stored] = (await run(selectedGmailCalendar)).entries.filter((e) => e.committed.title === entry.details.title && e.phase === "Saved");
  expect(stored?.identity.occurrenceId).toBe((await company(secret)).find((e) => e.title === entry.details.title)?.externalId);
  expect(stored?.identity.occurrenceId).not.toBe(entry.identity.occurrenceId);
  await act(() => userEvent.click(row("Doctor’s appointment", "Gmail")));
  await expect.element(page.getByText("From the clinic’s email · Visit form attached")).toBeVisible();
  await click("Back to Calendar");
  // spec/app/calendar.md, "Creation binds a unique occurrence and editing changes only its draft"
  await expect.element(marked("Doctor’s appointment", "Gmail")).toBeVisible();

  // spec/app/agentActions.md, "Grace opens a setting, and points only at what is on the screen"
  await click("Ask Grace");
  await expect.element(page.getByRole("button", { name: "Collapse", exact: true })).toBeVisible();
  await click("Collapse");
  await say("Which one is my eye check?", "This one is your eye check.", [{ kind: "guide", target: `event:1:${eye}`, emphasis: "instruction", title: "Your eye check" }]);
  await expect.element(ringed("Eye check with Dr\\. Patel", "Your eye check")).toBeVisible();
  await click("Close this tip");
  await expect.element(page.getByRole("group", { name: "Your eye check" })).not.toBeInTheDocument();
  // spec/app/agentActions.md, "Grace only asks about a calendar that shows, with a question that calendar would take"
  await say("Make my eye check every week.", "Let me see.", [{ kind: "proposeChange", entry: `event:1:${eye}`, repeat: "Weekly" }]);
  expect((await run(Effect.flatMap(Effect.service(Proposal), (p) => p.get()))).ask.tag).toBe("NoAsk");
  await expect.element(row("Eye check with Dr\\. Patel", "Not added yet")).not.toBeInTheDocument();
  await say("Why not?", "Only appointments on this tablet can repeat.", []);
  expect(await toldGrace(secret)).toContain("proposeChange was not done: only appointments kept On this tablet can repeat or stop repeating");
  expect(await toldGrace(secret)).toContain("Only appointments On this tablet can repeat");

  const original = (await run(selectedGmailCalendar)).entries.find((e) => e.identity.sourceRef === entry.identity.sourceRef && e.phase === "Saved");
  if (!original) throw new Error("The added appointment has no saved source");
  expect(original.identity.sourceAccount).toBe(1);
  await click("Close Calendar");
  const events = new URL("/api/v1/eliza/google/calendar/events", cloud);
  const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
  const removed = await atCompany(secret, original.identity.occurrenceId, { method: "DELETE" });
  expect(removed.ok).toBe(true);
  const created = await fetch(events, { method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({
    title: entry.details.title, location: "West clinic", startAt: new Date(startAt).toISOString(),
    endAt: new Date(startAt + hour).toISOString(), timeZone: gmailView.timezone,
  }) });
  expect(created.status).toBe(201);
  const { event: replacement } = await created.json() as { event: { externalId: string } };
  expect(replacement.externalId).not.toBe(original.identity.occurrenceId);
  await toEyeWeek();
  await expect.poll(async () => (await run(selectedGmailCalendar)).entries.some((e) => e.identity.occurrenceId === replacement.externalId && e.phase === "Saved"), atCloud).toBe(true);
  await expect.element(ringed("Doctor’s appointment", "Done")).not.toBeInTheDocument();
  await expect.element(page.getByRole("heading", { name: "Doctor’s appointment", exact: true })).not.toBeInTheDocument();
  await act(() => userEvent.click(row("Doctor’s appointment", "Gmail")));
  await expect.element(page.getByText("West clinic")).toBeVisible();
  await expect.element(page.getByText("No reminder")).toBeVisible();
  await expect.element(page.getByText("Dr. Patel", { exact: true })).not.toBeInTheDocument();
  const selected = await run(selectedGmailCalendar);
  expect(selected.entries.find((e) => e.identity.occurrenceId === selected.selectedId)?.identity).toMatchObject({
    occurrenceId: replacement.externalId, sourceRef: "", sourceAccount: 0,
  });
}, journey);

const edit = async (title: string, repeats: string) => {
  await click("Edit");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), title));
  await act(() => userEvent.click(page.getByRole("radio", { name: repeats })));
  await click("Save");
};
const selectedDay = (n: number) => page.getByRole("heading", { name: new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) });
const dated = (n: number) => page.getByText(`${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · 10 am to 11 am`);
const opensOn = async (title: string, n: number) => {
  await act(() => userEvent.click(row(title).first()));
  await expect.element(dated(n)).toBeVisible();
  await click("Back to Calendar");
};

it('Add, change and delete on the tablet (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { eyeDay, toEyeWeek, run, agree, ask, proposal } = await start();
  const tablet = () => run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(0)), (c) => c.get()));
  await toEyeWeek();

  // spec/app/calendars.md, "Calendar turns to the day of Grace’s question and of what was just added, but never past an edit"; spec/app/calendarView.md, "The form opens its Day or its Time list, one at a time"
  await click("Add");
  await click("Change Day");
  await expect.element(page.getByRole("button", { name: longDate(eyeDay), exact: true })).toBeVisible();
  await click("Change Time");
  await expect.element(page.getByRole("button", { name: longDate(eyeDay), exact: true })).not.toBeInTheDocument();
  await click("10 am");
  const lead = await tablet();
  const hairAt = midnight(eyeDay + 14) + 9 * hour;
  await ask({ tag: "AddAsk", target: 0, review: {
    entry: {
      identity: { owner: lead.owner, calendarId: lead.calendarId, occurrenceId: "grace-hair", sourceRef: "", sourceAccount: 0, kind: "Appointment", billRef: "", billOrigin: "", billAccount: "" },
      details: {
        title: "Hair appointment", location: "", participant: "", notes: "", startAt: hairAt, endAt: hairAt + hour, timezone: lead.timezone, allDay: false,
        seriesId: "", recurrence: "Once", reminderEnabled: false, leadTime: 0, important: false,
      },
    },
    calendarGeneration: lead.generation, displayTimezone: lead.timezone,
  } });
  await expect.element(page.getByRole("textbox", { name: "What" })).toBeVisible();
  await click("Back to Calendar");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 14) })).toHaveAttribute("aria-pressed", "true");
  await expect.element(row("Hair appointment", "Not added yet · Grace is asking you")).toBeVisible();
  await proposal({ type: "withdraw", interruption: "Cancellation" }, "Host");
  await expect.element(row("Hair appointment")).not.toBeInTheDocument();
  await click("Previous week");
  await click("Previous week");
  await act(() => userEvent.click(page.getByRole("button", { name: tile(eyeDay) })));

  // spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Lunch with Joan"));
  await click("Back to Calendar");
  await expect.element(selectedDay(eyeDay)).toBeVisible();
  await expect.element(row("Lunch with Joan")).not.toBeInTheDocument();
  expect((await tablet()).entries.filter((c) => c.hasSaved)).toEqual([]);

  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"; spec/app/calendars.md, "Grace is told what changed in a calendar, and being told authorizes nothing"
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Bridge club"));
  await act(() => userEvent.click(page.getByRole("radio", { name: "Every week" })));
  // spec/app/calendar.md, "Creation binds a unique occurrence and editing changes only its draft"
  await act(() => userEvent.click(page.getByRole("switch", { name: "Important" })));
  await click("Save");
  await expect.element(page.getByText("Saved to your calendar")).toBeVisible();
  await expect.element(marked("Bridge club", "On this tablet").first()).toBeVisible();
  await expect.element(ringed("Bridge club", "Done").first()).toBeVisible();
  await click("Next week");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "\\s*has plans") })).toBeVisible();
  await click("Add");
  await click("Change Day");
  await picked(longDate(eyeDay + 7));
  await click("Back to Calendar");

  await act(() => userEvent.click(row("Bridge club").first()));
  await edit("Bridge night", "Every week");
  // spec/app/calendars.md, "Calendar turns to the day of Grace’s question and of what was just added, but never past an edit"
  await expect.element(dated(eyeDay)).toBeVisible();
  await click("Back to Calendar");
  await click("Previous week");
  await opensOn("Bridge night", eyeDay);

  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"; spec/app/proposal.md, "An agreed question stays exactly as agreed until the calendar answers"
  const tabletView = await tablet();
  const second = tabletView.entries.find((c) => c.committed.title === "Bridge night" && c.identity.occurrenceId.endsWith("@1"));
  if (second === undefined) throw new Error("the second Bridge night is not on the tablet");
  const details = { ...second.committed, location: "The club house" };
  await agree({ tag: "ChangeAsk", target: 0, review: { id: second.identity.occurrenceId, details, committedRevision: second.revision, calendarGeneration: tabletView.generation } });
  await expect.element(page.getByText("The club house")).toBeVisible();
  await click("Back to Calendar");
  await opensOn("Bridge night", eyeDay);
  await click("Next week");
  await opensOn("Bridge night", eyeDay + 7);
  await click("Previous week");

  // spec/app/calendarView.md, "The deletion question binds its selected occurrence and explicit scope"
  await click("Next week");
  await act(() => userEvent.click(row("Bridge night").first()));
  await click("Delete");
  await click("Delete only this one");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "") })).toBeVisible();
  await click("Next week");
  await act(() => userEvent.click(row("Bridge night").first()));
  const retainedId = (await tablet()).selectedId;
  await edit("Bridge night", "Never");
  await expect.poll(async () => (await tablet()).entries.filter((entry) => entry.phase === "Saved" && entry.committed.title === "Bridge night").map((entry) => entry.identity.occurrenceId)).toEqual([retainedId]);
  await expect.element(page.getByText("Doesn’t repeat")).toBeVisible();
  await click("Back to Calendar");
  await click("Previous week");
  await click("Previous week");
  await expect.poll(() => row("Bridge night").elements().length).toBe(1);
  await act(() => userEvent.click(row("Bridge night").first()));
  await click("Delete");
  await click("Keep it");
  await expect.element(page.getByRole("button", { name: "Delete it" })).not.toBeInTheDocument();
  await click("Back to Calendar");
  await expect.element(row("Bridge night")).toBeVisible();
  await act(() => userEvent.click(row("Bridge night").first()));
  await click("Delete");
  await click("Delete it");
  await expect.element(page.getByText("Deleted Bridge night")).toBeVisible();
  await expect.element(row("Bridge night")).not.toBeInTheDocument();

  await click("Today");
  await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
  const { owner, calendarId, timezone, window } = await tablet();
  const firstDay = dayOf(window.fromTime);
  const seriesId = "tablet-standing-visit";
  const startAt = midnight(firstDay - 1 - 1001 * 7) + 10 * hour;
  const incoming = save(approveSave(create(newEntry, {
    owner, calendarId, occurrenceId: seriesId, sourceRef: "", sourceAccount: 0,
    kind: "Appointment", billRef: "", billOrigin: "", billAccount: "",
  }, {
    title: "Standing visit", location: "", participant: "", notes: "", startAt, endAt: startAt + 2 * day,
    timezone, allDay: false, seriesId, recurrence: "Weekly", reminderEnabled: false, leadTime: 0, important: false,
  }, "CalendarUser"), 1, "CalendarUser"), 1, true, "CalendarStore");
  await run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(0)), (calendar) => calendar.send({
    type: "publishOccurrence", incoming, seriesVersion: 0, scheduleVerified: true,
  }, "ViewStore")));
  await act(() => userEvent.click(page.getByRole("button", { name: tile(firstDay) })));
  await act(() => userEvent.click(row("Standing visit", "On this tablet").first()));
  const firstOccurrence = `${seriesId}@1001`;
  await expect.poll(async () => {
    const view = await tablet();
    const selected = view.entries.find((entry) => entry.identity.occurrenceId === view.selectedId);
    return [view.selectedId, dayOf(selected?.committed.startAt ?? 0), (selected?.committed.endAt ?? 0) > midnight(firstDay)];
  }).toEqual([firstOccurrence, firstDay - 1, true]);
  await click("Delete");
  await click("Delete only this one");
  await expect.poll(async () => (await tablet()).entries.find((entry) => entry.identity.occurrenceId === firstOccurrence)?.phase).toBe("Deleted");
  await click("Next week");
  await act(() => userEvent.click(page.getByRole("button", { name: tile(firstDay + 7) })));
  await act(() => userEvent.click(row("Standing visit", "On this tablet").first()));
  await expect.poll(async () => (await tablet()).selectedId).toBe(`${seriesId}@1002`);
  await click("Back to Calendar");
  await click("Previous week");
  expect((await tablet()).entries.some((entry) => entry.identity.occurrenceId === firstOccurrence && entry.phase !== "Deleted")).toBe(false);
}, journey);

it('Change and delete an appointment from email (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { secret, eye, eyeAt: scheduled, eyeDay, toEyeWeek, run } = await start();
  const eyeAt = scheduled + 7 * 60_000 + 12_345;
  const shifted = await atCompany(secret, eye, { method: "PATCH", body: { startAt: new Date(eyeAt).toISOString(), endAt: new Date(eyeAt + hour / 2).toISOString() } });
  expect(shifted.ok).toBe(true);
  const titles = async () => (await held(secret)).map((e) => e.title);
  await toEyeWeek();
  // spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await act(() => userEvent.click(row("Eye check with Dr\\. Patel")));
  // spec/app/calendar.md, "Creation binds a unique occurrence and editing changes only its draft"
  await click("Edit");
  await click("Change Time");
  await picked(timeLabel(eyeAt));
  await click(timeLabel(eyeAt));
  await click("Change Day");
  await picked(longDate(eyeDay));
  await click(longDate(eyeDay));
  expect((await run(selectedGmailCalendar)).entries.find((e) => e.identity.occurrenceId === eye)?.draft.startAt).toBe(eyeAt);
  await click("Back to Calendar");
  // spec/app/calendarView.md, "An email account's calendar is asked to keep only what its company keeps"
  await click("Edit");
  await expect.element(page.getByRole("radio", { name: "Every week" })).not.toBeInTheDocument();
  await click("Back to Calendar");
  // spec/app/calendarView.md, "A change at the company names the revision it read and never overwrites a newer one"
  const newer = "Gmail has a newer version of this appointment, so the tablet didn’t change it. This is how it is now.";
  const remembered = await run(selectedGmailCalendar);
  localStorage.setItem("calendar/1", JSON.stringify({
    ...remembered,
    entries: remembered.entries.map((entry) => entry.identity.occurrenceId === eye ? { ...entry, version: "" } : entry),
  }));
  await edit("Eye check before the tablet has a revision", "Never");
  await expect.element(page.getByText(newer)).toBeVisible();
  expect(await titles()).toEqual(["Eye check with Dr. Patel"]);
  await edit("Eye check at Riverside", "Never");
  await expect.element(page.getByText("Doesn’t repeat")).toBeVisible();
  await expect.poll(() => held(secret), atCloud).toEqual([{ title: "Eye check at Riverside", startAt: eyeAt }]);
  expect((await atCompany(secret, eye, { method: "PATCH", body: { title: "Eye check in room 4" } })).ok).toBe(true);
  await edit("Eye check at the front desk", "Never");
  await expect.element(page.getByText(newer)).toBeVisible();
  await expect.element(page.getByRole("heading", { name: "Eye check in room 4" })).toBeVisible();
  expect(await titles()).toEqual(["Eye check in room 4"]);
  await click("Back to Calendar");
  await click("Next week");
  await expect.element(row("Eye check in room 4")).not.toBeInTheDocument();
  await click("Previous week");
  await act(() => userEvent.click(row("Eye check in room 4", "Gmail")));
  await expect.element(page.getByText(newer)).not.toBeInTheDocument();
  expect((await atCompany(secret, eye, { method: "PATCH", body: { title: "Eye check in room 5" } })).ok).toBe(true);
  await click("Delete");
  await click("Delete it");
  await expect.element(page.getByText(newer)).toBeVisible();
  await expect.element(page.getByRole("heading", { name: "Eye check in room 5" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Delete it" })).not.toBeInTheDocument();
  expect(await titles()).toEqual(["Eye check in room 5"]);
  await click("Delete");
  await click("Delete it");
  await expect.element(row("Eye check in room 5")).not.toBeInTheDocument();
  await expect.poll(titles, atCloud).toEqual([]);

  await click("Today");
  await act(() => userEvent.click(row("Joan’s birthday")));
  const birthday = async () => (await run(selectedGmailCalendar)).entries.find((entry) => entry.identity.occurrenceId === "birthday")?.committed;
  const before = await birthday();
  expect(before?.allDay).toBe(true);
  expect((await atCompany(secret, "birthday", { method: "PATCH", body: { location: "Garden room" } })).ok).toBe(true);
  await edit("Birthday at the library", "Never");
  await expect.element(page.getByText(newer)).toBeVisible();
  await expect.element(page.getByRole("heading", { name: "Joan’s birthday" })).toBeVisible();
  await expect.element(page.getByText("Garden room")).toBeVisible();
  expect(await birthday()).toEqual({ ...before, location: "Garden room" });
}, journey);

it('Delete one occurrence, then its series (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { secret, eyeDay, toEyeWeek, run } = await start();
  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"; spec/app/calendar.md, "Story: Add and correct an appointment or bill reminder"
  const gmailView = await run(selectedGmailCalendar);
  const physioAt = midnight(eyeDay) + 14 * hour;
  const created = await fetch(new URL("/api/v1/eliza/google/calendar/events", cloud), {
    method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      title: "Physio", location: "Riverside Clinic", startAt: new Date(physioAt).toISOString(), endAt: new Date(physioAt + hour).toISOString(), timeZone: gmailView.timezone,
      recurrence: ["RRULE:FREQ=WEEKLY"], reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    }),
  });
  expect(created.status).toBe(201);
  const { event: physio } = await created.json() as { event: { externalId: string } };
  const physios = async () => (await company(secret)).filter((e) => e.externalId === physio.externalId) as { title: string; cancelled?: string[] }[];
  await toEyeWeek();
  await act(() => userEvent.click(row("Physio", "Gmail").first()));
  await expect.element(page.getByText("Repeats every week")).toBeVisible();
  await expect.element(page.getByText("Reminder 30 minutes before")).toBeVisible();

  // spec/app/calendarView.md, "An email account's calendar is asked to keep only what its company keeps"
  await click("Edit");
  await expect.element(page.getByRole("radio", { name: "Never" })).not.toBeInTheDocument();
  await expect.element(page.getByRole("radio", { name: "30 minutes before" })).toHaveAttribute("aria-checked", "true");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Physio with Sam"));
  await click("Save");
  await expect.element(page.getByText("Reminder 30 minutes before")).toBeVisible();
  await expect.element(page.getByText("Repeats every week")).toBeVisible();
  await expect.poll(async () => (await physios()).map((e) => e.title), atCloud).toEqual(["Physio with Sam"]);
  await click("Back to Calendar");

  // spec/app/calendarView.md, "The deletion question binds its selected occurrence and explicit scope"
  await click("Next week");
  await act(() => userEvent.click(row("Physio with Sam", "Gmail").first()));
  await expect.element(page.getByText(`${new Date(midnight(eyeDay + 7)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · 2 pm to 3 pm`)).toBeVisible();
  await click("Delete");
  await click("Delete only this one");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "") })).toBeVisible();
  const nextWeek = new Date(physioAt + 7 * day).toISOString().replace(/[-:]|\.\d+/g, "");
  await expect.poll(async () => (await physios()).map((e) => e.cancelled), atCloud).toEqual([[`${physio.externalId}_${nextWeek}`]]);
  await click("Previous week");
  await expect.element(row("Physio with Sam", "Gmail").first()).toBeVisible();
  await click("Next week");
  await click("Next week");
  await act(() => userEvent.click(row("Physio with Sam", "Gmail").first()));
  await expect.element(page.getByText("Repeats every week")).toBeVisible();
  await click("Delete");
  await click("Delete every one");
  await expect.element(row("Physio with Sam")).not.toBeInTheDocument();
  await expect.poll(physios, atCloud).toEqual([]);
  await click("Previous week");
  await click("Previous week");
  await expect.element(row("Physio with Sam")).not.toBeInTheDocument();
}, journey);

it('See a due reminder (spec/app/calendarView.md, "Story: See a due reminder and open its event")', async () => {
  // spec/app/notices.md, "Story: See what needs me on Home"
  const now = Date.now();
  const { card, run } = await start({ clockAt: now });
  const network = { online: true };
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => network.online });
  onTestFinished(() => { Reflect.deleteProperty(navigator, "onLine"); });
  const reach = (online: boolean) => act(() => {
    network.online = online;
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
  // spec/app/calendarView.md, "A shown reminder appears on Home or as a toast and See details opens its event"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
  const today = dayOf(now);
  const addToday = async (title: string, time: string) => {
    await click("Add");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), title));
    await click("Change Day");
    await click(`Today · ${new Date(midnight(today)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
    await click("Change Time");
    await click(time);
    await act(() => userEvent.click(page.getByRole("radio", { name: "Day before" })));
    await click("Save");
    await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect.element(row(title, "On this tablet")).toBeVisible();
  };
  const reminded = (title: string, time: string) => page.getByText(new RegExp(`^Reminder: ${title} today at ${time}`));
  const expireToast = (offer: Offer) => run(TestClock.adjust(lifetimeMs(offer)));
  await act(() => userEvent.click(card.getByRole("button", { name: /^Calendar(?:$| )/ })));
  await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await addToday("Pill pickup", "7 am");
  await expireToast("NoOffer");
  await expect.element(reminded("Pill pickup", "7 am")).toBeVisible();
  await addToday("Tea with Joan", "8 am");
  await expect.element(reminded("Pill pickup", "7 am"), { timeout: 15000 }).toBeVisible();
  await click("Settings");
  await expect.element(reminded("Pill pickup", "7 am")).toBeVisible();
  await click("Home");
  await expireToast("SeeDetails");
  await expect.element(reminded("Pill pickup", "7 am"), { timeout: 15000 }).not.toBeInTheDocument();
  await expect.element(card.getByText("Today", { exact: true })).toBeVisible();
  await click("Dismiss");
  await click("Settings");
  await expireToast("NoOffer");
  await expect.element(reminded("Tea with Joan", "8 am")).toBeVisible();
  await expect.element(reminded("Pill pickup", "7 am")).not.toBeInTheDocument();
  await click("Home");
  // spec/app/notices.md, "Home shows one banner: the connection first, then the first reminder to come due"
  reach(false);
  await expect.element(page.getByText("Not connected to the internet")).toBeVisible();
  await expireToast("SeeDetails");
  await expect.element(page.getByRole("button", { name: "See details" })).not.toBeInTheDocument();
  reach(true);
  await expect.element(page.getByText("Not connected to the internet")).not.toBeInTheDocument();
  await click("See details");
  await expect.element(page.getByText(/8 am to 9 am/)).toBeVisible();
  await expect.element(page.getByText(/^Reminder day before/)).toBeVisible();
  await click("Snooze");
  await expect.element(page.getByRole("button", { name: "Dismiss", exact: true })).not.toBeInTheDocument();
  await click("Back to Calendar");
  await click("Close Calendar");
  await expect.element(page.getByRole("button", { name: "See details" })).not.toBeInTheDocument();
  // spec/app/calendar.md, "Time only makes an enabled reminder eligible and never executes the task"
  await run(TestClock.adjust("11 minutes"));
  await act(() => userEvent.click(card.getByRole("button", { name: /^Calendar(?:$| )/ })));
  await click("Close Calendar");
  await click("See details");
  await expect.element(page.getByText(/8 am to 9 am/)).toBeVisible();
  await click("Dismiss");
  await expect.element(page.getByRole("button", { name: "Snooze", exact: true })).not.toBeInTheDocument();
  await expect.element(reminded("Tea with Joan", "8 am")).not.toBeInTheDocument();
  await click("Back to Calendar");
  await click("Close Calendar");
  await expect.element(page.getByRole("button", { name: "See details" })).not.toBeInTheDocument();
}, journey);
