// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"
import { Effect } from "effect";
import { act } from "react";
import { expect, inject, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { allowedUse } from "../gen/app__accounts.ts";
import { type Ask, type Event as ProposalEvent, Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import { proposalOf } from "../gen/app__proposal.ts";
import { consent, type Request } from "../gen/app__request.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { day, dayOf, hour, midnight } from "../src/calendar.vibe";
import { Instances } from "../src/instances.vibe";
import { client, outage, signIn } from "./cloud.vibe";
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
const tile = (n: number, plans = "(\\s*has plans)?") => new RegExp(`^(Today|${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "short" })})\\s*${new Date(midnight(n)).getDate()}${plans}$`);

async function company(key: string) {
  const response = await fetch(new URL("/fake/account", cloud), { headers: { authorization: `Bearer ${key}` } });
  const { boxes } = await response.json() as { boxes: { calendar: { externalId: string; title: string; startAt: string }[] }[] };
  return boxes[0].calendar;
}

const selectedGmailCalendar = Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(1)), (c) => c.get());
const held = async (key: string) => (await company(key)).filter((e) => e.title !== "Joan’s birthday").map((e) => ({ title: e.title, startAt: Date.parse(e.startAt) }));

async function start(down = false) {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const [eye] = await company(secret);
  const reachable = (up: boolean) => Effect.runPromise(Effect.provide(outage(cloud, secret, !up), client));
  if (down) await reachable(false);
  const eyeAt = Date.parse(eye.startAt);
  const eyeDay = dayOf(eyeAt);
  const runtime = await mountGmail(gmail, { url: cloud, key: secret });
  const run = <A,>(effect: Effect.Effect<A, unknown, Workspaces | AccountsMachine | Proposal | Instances>) => act(() => runtime.runPromise(effect));
  const card = page.getByRole("group", { name: "Calendar", exact: true });
  return {
    secret, eyeAt, eyeDay, card, run, reachable,
    agree: async (question: Ask, shows?: () => Promise<unknown>) => {
      const proposal = (event: ProposalEvent, by: "Grace" | "Person") => run(Effect.flatMap(Effect.service(Proposal), (p) => p.send(event, by)));
      const turn = Math.max((await run(Effect.flatMap(Effect.service(Proposal), (p) => p.get()))).generation, 0) + 1;
      const spoken: Request = { generation: turn, workVersion: 1, origin: "Spoken" };
      await proposal({ type: "propose", ask: question, request: spoken, now: spoken }, "Grace");
      await shows?.();
      const asked = await run(Effect.flatMap(Effect.service(Proposal), (p) => p.get()));
      const tapped: Request = { generation: turn + 1, workVersion: 1, origin: "Tapped" };
      await proposal({ type: "agree", given: consent(tapped, asked.spent + 1, proposalOf(asked)), now: tapped }, "Person");
    },
    toEyeWeek: async () => {
      await act(() => userEvent.click(card.getByText("Calendar", { exact: true })));
      await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
      for (let i = (mondayOf(eyeDay) - mondayOf(dayOf(Date.now()))) / 7; i > 0; i--) await click("Next week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(eyeDay) })));
    },
  };
}

it('Browse (spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives")', async () => {
  // spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"
  const { secret, eyeDay, card, run, reachable, agree, toEyeWeek } = await start(true);
  const person = (event: AccountEvent) => run(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson")));
  const lifecycle = (lifecycle: "SleepDevice" | "WakeDevice") => run(Effect.flatMap(Effect.service(Workspaces), (w) => w.send({ type: "changeLifecycle", lifecycle }, "Host")));

  // spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
  await expect.element(card.getByText("Nothing else today")).toBeVisible();
  await expect.element(card.getByText("Eye check with Dr. Patel")).not.toBeInTheDocument();
  await reachable(true);
  await act(() => userEvent.click(card.getByText("Calendar", { exact: true })));
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
  await act(() => userEvent.click(page.getByRole("button", { name: new RegExp(`^${new Date(midnight(eyeDay)).getDate()}\\s*Eye check`) })));
  await act(() => userEvent.click(row("Eye check with Dr\\. Patel", "Gmail")));
  await expect.element(page.getByText("Riverside Clinic")).toBeVisible();
  await click("Back to Calendar");

  // spec/app/calendars.md, "A switched-off account’s appointments and reminders show nowhere, to her or to Grace"; spec/app/calendars.md, "The connect banner shows until an email’s calendar is on or she says Not now"
  await person({ type: "setUse", id: 1, use: { mail: true, calendar: false, contacts: true } });
  await expect.element(page.getByText("Connect your email to keep your calendar up to date")).toBeVisible();
  await expect.element(row("Eye check with Dr\\. Patel")).not.toBeInTheDocument();
  await click("Not now");
  await expect.element(page.getByText("Connect your email to keep your calendar up to date")).not.toBeInTheDocument();
  await click("Close Calendar");
  await expect.element(card.getByText("Eye check with Dr. Patel")).not.toBeInTheDocument();
  await person({ type: "setUse", id: 1, use: allowedUse });
  await expect.element(card.getByText("Eye check with Dr. Patel")).toBeVisible();

  // spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/proposal.md, "An agreed question stays exactly as agreed until the calendar answers"
  await toEyeWeek();
  const gmailView = await run(selectedGmailCalendar);
  const startAt = midnight(eyeDay) + 15 * hour;
  const entry = {
    identity: { owner: gmailView.owner, calendarId: gmailView.calendarId, occurrenceId: "clinic-visit", sourceRef: "clinic", sourceAccount: 1, kind: "Appointment" as const, billRef: "", billOrigin: "", billAccount: "" },
    details: {
      title: "Doctor’s appointment", location: "Main St clinic", participant: "Dr. Patel", notes: "From the clinic’s email · Visit form attached",
      startAt, endAt: startAt + hour, timezone: gmailView.timezone, allDay: false, seriesId: "", recurrence: "Once" as const, reminderEnabled: true, leadTime: day, important: false,
    },
  };
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false, "createResponse"), client));
  await agree({ tag: "AddAsk", target: 1, review: { entry, calendarGeneration: gmailView.generation, displayTimezone: gmailView.timezone } },
    () => expect.element(row("Doctor’s appointment", "Not added yet · Grace is asking you")).toBeVisible());
  await expect.element(page.getByText("This wasn’t saved. Press Save to try again.")).toBeVisible();
  await click("Save");
  await expect.poll(async () => (await company(secret)).map((e) => e.title), atCloud).toEqual(["Eye check with Dr. Patel", "Joan’s birthday", "Doctor’s appointment"]);
  await expect.element(page.getByText("From the clinic’s email · Visit form attached")).toBeVisible();
  await click("Back to Calendar");
  await expect.element(row("Doctor’s appointment", "Gmail")).toBeVisible();

  const original = (await run(selectedGmailCalendar)).entries.find((e) => e.identity.sourceRef === entry.identity.sourceRef && e.phase === "Saved");
  if (!original) throw new Error("The added appointment has no saved source");
  expect(original.identity.sourceAccount).toBe(1);
  await click("Close Calendar");
  const events = new URL("/api/v1/eliza/google/calendar/events", cloud);
  const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
  const removed = await fetch(`${events}/${encodeURIComponent(original.identity.occurrenceId)}`, { method: "DELETE", headers });
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
const dated = (n: number) => page.getByText(`${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · 10 am to 11 am`);
const opensOn = async (title: string, n: number) => {
  await act(() => userEvent.click(row(title).first()));
  await expect.element(dated(n)).toBeVisible();
  await click("Back to Calendar");
};

it('Add, change and delete on the tablet (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { eyeDay, toEyeWeek, run, agree } = await start();
  await toEyeWeek();

  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Bridge club"));
  await act(() => userEvent.click(page.getByRole("radio", { name: "Every week" })));
  await click("Save");
  await expect.element(page.getByText("Saved to your calendar")).toBeVisible();
  await expect.element(row("Bridge club", "On this tablet").first()).toBeVisible();
  await click("Next week");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "\\s*has plans") })).toBeVisible();

  await act(() => userEvent.click(row("Bridge club").first()));
  await edit("Bridge night", "Every week");
  await click("Back to Calendar");
  await click("Previous week");
  await opensOn("Bridge night", eyeDay);

  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"; spec/app/proposal.md, "An agreed question stays exactly as agreed until the calendar answers"
  const tabletView = await run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(0)), (c) => c.get()));
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
  await edit("Bridge night", "Never");
  await expect.element(page.getByText("Doesn’t repeat")).toBeVisible();
  await click("Back to Calendar");
  await click("Previous week");
  await click("Previous week");
  await expect.poll(() => row("Bridge night").elements().length).toBe(1);
  await act(() => userEvent.click(row("Bridge night").first()));
  await click("Delete");
  await click("Delete it");
  await expect.element(page.getByText("Deleted Bridge night")).toBeVisible();
  await expect.element(row("Bridge night")).not.toBeInTheDocument();
}, journey);

it('Change and delete an appointment from email (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { secret, eyeAt, eyeDay, toEyeWeek } = await start();
  const titles = async () => (await held(secret)).map((e) => e.title);
  await toEyeWeek();
  // spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await act(() => userEvent.click(row("Eye check with Dr\\. Patel")));
  await edit("Eye check at Riverside", "Every week");
  await expect.element(page.getByText("Repeats every week")).toBeVisible();
  await expect.poll(titles, atCloud).toEqual(["Eye check at Riverside"]);
  await click("Back to Calendar");
  await click("Next week");
  await act(() => userEvent.click(row("Eye check at Riverside", "Gmail").first()));
  await click("Delete");
  await click("Delete only this one");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "") })).toBeVisible();
  expect(await held(secret)).toEqual([{ title: "Eye check at Riverside", startAt: eyeAt }]);
  await click("Next week");
  await act(() => userEvent.click(row("Eye check at Riverside", "Gmail").first()));
  await edit("Eye check at Riverside", "Never");
  await expect.element(page.getByText("Doesn’t repeat")).toBeVisible();
  await expect.poll(() => held(secret), atCloud).toEqual([{ title: "Eye check at Riverside", startAt: eyeAt }]);
  await click("Back to Calendar");
  await expect.element(row("Eye check at Riverside")).not.toBeInTheDocument();
  await click("Previous week");
  await click("Previous week");
  await act(() => userEvent.click(row("Eye check at Riverside", "Gmail")));
  await click("Delete");
  await click("Delete it");
  await expect.element(row("Eye check at Riverside")).not.toBeInTheDocument();
  await expect.poll(titles, atCloud).toEqual([]);
}, journey);

it('Delete one occurrence, then its series (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { secret, eyeDay, toEyeWeek, run, agree } = await start();
  // spec/app/calendarView.md, "The deletion question binds its selected occurrence and explicit scope"; spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await toEyeWeek();
  const gmailView = await run(selectedGmailCalendar);
  const walkAt = midnight(eyeDay) + 10 * hour;
  const walk = {
    identity: { owner: gmailView.owner, calendarId: gmailView.calendarId, occurrenceId: "walk", sourceRef: "", sourceAccount: 0, kind: "Appointment" as const, billRef: "", billOrigin: "", billAccount: "" },
    details: {
      title: "Walk with Joan", location: "", participant: "", notes: "", startAt: walkAt, endAt: walkAt + hour, timezone: gmailView.timezone, allDay: false,
      seriesId: "walk", recurrence: "Weekly" as const, reminderEnabled: false, leadTime: 0, important: false,
    },
  };
  const walks = async () => (await held(secret)).filter((e) => e.title === "Walk with Joan");
  await agree({ tag: "AddAsk", target: 1, review: { entry: walk, calendarGeneration: gmailView.generation, displayTimezone: gmailView.timezone } });
  await expect.poll(walks, atCloud).toEqual([{ title: "Walk with Joan", startAt: walkAt }]);
  await expect.element(dated(eyeDay)).toBeVisible();
  await click("Delete");
  await click("Delete only this one");
  await expect.element(page.getByText("Deleted Walk with Joan")).toBeVisible();
  await expect.poll(walks, atCloud).toEqual([{ title: "Walk with Joan", startAt: midnight(eyeDay + 7) + 10 * hour }]);
  await click("Next week");
  await act(() => userEvent.click(row("Walk with Joan", "Gmail").first()));
  await expect.element(dated(eyeDay + 7)).toBeVisible();
  await click("Delete");
  await click("Delete every one");
  await expect.element(row("Walk with Joan")).not.toBeInTheDocument();
  await expect.poll(walks, atCloud).toEqual([]);
}, journey);

it('See a due reminder (spec/app/calendarView.md, "Story: See a due reminder and open its event")', async () => {
  const { card } = await start();
  // spec/app/calendarView.md, "A shown reminder appears on Home or as a toast and See details opens its event"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
  const today = dayOf(Date.now());
  await act(() => userEvent.click(card.getByText("Calendar", { exact: true })));
  await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Pill pickup"));
  await click("Change Day");
  await click(`Today · ${new Date(midnight(today)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
  await click("Change Time");
  await click("7 am");
  await act(() => userEvent.click(page.getByRole("radio", { name: "Day before" })));
  await click("Save");
  await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect.element(row("Pill pickup", "On this tablet")).toBeVisible();
  const reminded = page.getByText("Reminder: Pill pickup today at 7 am");
  await expect.element(reminded, { timeout: 5000 }).toBeVisible();
  await click("Settings");
  await expect.element(reminded).toBeVisible();
  await click("Home");
  await expect.element(reminded).not.toBeInTheDocument();
  await expect.element(card.getByText("Today", { exact: true })).toBeVisible();
  await click("See details");
  await expect.element(page.getByText("Reminder day before")).toBeVisible();
  await click("Dismiss");
  await expect.element(reminded).not.toBeInTheDocument();
  await click("Back to Calendar");
  await click("Close Calendar");
  await expect.element(page.getByRole("button", { name: "See details" })).not.toBeInTheDocument();
}, journey);
