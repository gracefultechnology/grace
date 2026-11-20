// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"
import { Effect } from "effect";
import { act } from "react";
import { expect, inject, it, onTestFinished } from "vitest";
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
const ringed = (title: string) => row(title).first().element().nextElementSibling?.className.includes("animate-guide-pulse-ok") ?? false;
const monthTitle = (n: number, ahead: number) => { const d = new Date(midnight(n)); return new Date(d.getFullYear(), d.getMonth() + ahead, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
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
    useCalendar: async (on: boolean) => {
      await click("Settings");
      await act(() => userEvent.click(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Email & calendar" })));
      await act(() => userEvent.click(page.getByRole("button", { name: new RegExp(gmail) })));
      await act(() => userEvent.click(page.getByRole("switch", { name: "Calendar" })));
      await expect.element(page.getByRole("switch", { name: "Calendar" })).toHaveAttribute("aria-checked", String(on));
      await click("Close Settings");
    },
  };
}

it('Browse (spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"; spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence")', async () => {
  const { secret, eyeDay, card, run, reachable, agree, toEyeWeek, useCalendar } = await start(true);
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
  await useCalendar(false);
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
  await useCalendar(true);
  await expect.element(card.getByText("Eye check with Dr. Patel")).toBeVisible();

  // spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/calendarView.md, "Coming up lists saved events after the selected day"; spec/app/proposal.md, "An agreed question stays exactly as agreed until the calendar answers"
  await toEyeWeek();
  await expect.element(row("Eye check with Dr\\. Patel", "Gmail")).toBeVisible();
  const gmailView = await run(selectedGmailCalendar);
  const startAt = midnight(eyeDay) + 15 * hour;
  const entry = {
    identity: { owner: gmailView.owner, calendarId: gmailView.calendarId, occurrenceId: "clinic-visit", sourceRef: "clinic", kind: "Appointment" as const, billRef: "", billOrigin: "", billAccount: "" },
    details: {
      title: "Doctor’s appointment", location: "Main St clinic", participant: "Dr. Patel", notes: "From the clinic’s email · Visit form attached",
      startAt, endAt: startAt + hour, timezone: gmailView.timezone, allDay: false, seriesId: "", recurrence: "Once" as const, reminderEnabled: true, leadTime: day, important: false,
    },
  };
  await agree({ tag: "AddAsk", target: 1, review: { entry, calendarGeneration: gmailView.generation, displayTimezone: gmailView.timezone } },
    async () => {
      await expect.element(row("Doctor’s appointment", "Not added yet · Grace is asking you")).toBeVisible();
      await click("Previous week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(mondayOf(eyeDay) - 7) })));
      await expect.element(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
      await expect.element(row("Eye check with Dr\\. Patel", "Gmail")).toBeVisible();
      await expect.element(row("Doctor’s appointment")).not.toBeInTheDocument();
      await click("Next week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(eyeDay) })));
    });
  await expect.poll(async () => (await company(secret)).map((e) => e.title), atCloud).toEqual(["Eye check with Dr. Patel", "Joan’s birthday", "Doctor’s appointment"]);
  await expect.element(page.getByText("From the clinic’s email · Visit form attached")).toBeVisible();
  await click("Back to Calendar");
  await expect.element(row("Doctor’s appointment", "Gmail")).toBeVisible();
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
  const tablet = () => run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(0)), (c) => c.get()));
  await toEyeWeek();

  // spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Lunch with Joan"));
  await click("Back to Calendar");
  await expect.element(page.getByRole("heading", { name: new Date(midnight(eyeDay)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) })).toBeVisible();
  await expect.element(row("Lunch with Joan")).not.toBeInTheDocument();
  expect((await tablet()).entries.filter((c) => c.hasSaved)).toEqual([]);

  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"; spec/app/calendars.md, "Grace is told what changed in a calendar, and being told authorizes nothing"
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Bridge club"));
  await act(() => userEvent.click(page.getByRole("radio", { name: "Every week" })));
  await click("Save");
  await expect.element(page.getByText("Saved to your calendar")).toBeVisible();
  await expect.element(row("Bridge club", "On this tablet").first()).toBeVisible();
  await expect.poll(() => ringed("Bridge club")).toBe(true);
  await click("Next week");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "\\s*has plans") })).toBeVisible();

  await act(() => userEvent.click(row("Bridge club").first()));
  await edit("Bridge night", "Every week");
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
  await edit("Bridge night", "Never");
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

it('Delete the first and then every appointment of a repeating email series (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { secret, eyeDay, toEyeWeek, run, agree } = await start();
  // spec/app/calendarView.md, "The deletion question binds its selected occurrence and explicit scope"; spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await toEyeWeek();
  const gmailView = await run(selectedGmailCalendar);
  const walkAt = midnight(eyeDay) + 10 * hour;
  const walk = {
    identity: { owner: gmailView.owner, calendarId: gmailView.calendarId, occurrenceId: "walk", sourceRef: "", kind: "Appointment" as const, billRef: "", billOrigin: "", billAccount: "" },
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
  await expect.element(page.getByText("Deleted Walk with Joan"), atCloud).toBeVisible();
  await expect.poll(walks, atCloud).toEqual([{ title: "Walk with Joan", startAt: midnight(eyeDay + 7) + 10 * hour }]);
  await click("Next week");
  await act(() => userEvent.click(row("Walk with Joan", "Gmail").first()));
  await expect.element(dated(eyeDay + 7)).toBeVisible();
  await click("Delete");
  await click("Delete every one");
  await expect.element(row("Walk with Joan")).not.toBeInTheDocument();
  await expect.poll(walks, atCloud).toEqual([]);
}, journey);

it('See a due reminder (spec/app/calendarView.md, "Story: See a due reminder and open its event"; spec/app/notices.md, "Story: See what needs me on Home")', async () => {
  const { card } = await start();
  const network = { online: true };
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => network.online });
  onTestFinished(() => { Reflect.deleteProperty(navigator, "onLine"); });
  const reach = (online: boolean) => act(() => {
    network.online = online;
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
  // spec/app/calendarView.md, "A shown reminder appears on Home or as a toast and See details opens its event"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
  const today = dayOf(Date.now());
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
  await act(() => userEvent.click(card.getByText("Calendar", { exact: true })));
  await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await addToday("Pill pickup", "7 am");
  await addToday("Tea with Joan", "8 am");
  await expect.element(reminded("Pill pickup", "7 am"), { timeout: 15000 }).toBeVisible();
  await click("Settings");
  await expect.element(reminded("Pill pickup", "7 am")).toBeVisible();
  await click("Home");
  await expect.element(reminded("Pill pickup", "7 am"), { timeout: 15000 }).not.toBeInTheDocument();
  await expect.element(card.getByText("Today", { exact: true })).toBeVisible();
  await click("Dismiss");
  await click("Settings");
  await expect.element(reminded("Tea with Joan", "8 am")).toBeVisible();
  await expect.element(reminded("Pill pickup", "7 am")).not.toBeInTheDocument();
  await click("Home");
  // spec/app/notices.md, "Home shows one banner: the connection first, then the first reminder to come due"
  await reach(false);
  await expect.element(page.getByText("Not connected to the internet")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "See details" })).not.toBeInTheDocument();
  await reach(true);
  await expect.element(page.getByText("Not connected to the internet")).not.toBeInTheDocument();
  await click("See details");
  await expect.element(page.getByText(/8 am to 9 am/)).toBeVisible();
  await expect.element(page.getByText(/^Reminder day before/)).toBeVisible();
  await click("Dismiss");
  await expect.element(reminded("Tea with Joan", "8 am")).not.toBeInTheDocument();
  await click("Back to Calendar");
  await click("Close Calendar");
  await expect.element(page.getByRole("button", { name: "See details" })).not.toBeInTheDocument();
}, journey);
