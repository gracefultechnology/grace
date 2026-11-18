// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { allowedUse, chooseProvider, initial, sheetResult } from "../gen/app__accounts.ts";
import { type Event as ProposalEvent, Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import { proposalOf } from "../gen/app__proposal.ts";
import { consent, type Request } from "../gen/app__request.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { day, dayOf, hour, midnight } from "../src/calendar.vibe";
import { Instances } from "../src/instances.vibe";
import { client, signIn } from "./cloud.vibe";
import "../src/main.css";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });

const cloud = inject("cloud");
const gmail = "owner@grace.test";
const click = (name: string | RegExp) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
const row = (title: string, tag?: string) => page.getByRole("button", { name: new RegExp(`${title}${tag ? `.*${tag}` : ""}`) });
const mondayOf = (n: number) => n - ((new Date(n * day).getUTCDay() + 6) % 7);
const tile = (n: number, plans = "(\\s*has plans)?") => new RegExp(`^(Today|${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "short" })})\\s*${new Date(midnight(n)).getDate()}${plans}$`);

async function company(key: string) {
  const response = await fetch(`${cloud}/fake/account`, { headers: { authorization: `Bearer ${key}` } });
  const { boxes } = await response.json() as { boxes: { calendar: { externalId: string; title: string; startAt: string }[] }[] };
  return boxes[0].calendar;
}

const held = async (key: string) => (await company(key)).map((e) => ({ title: e.title, startAt: Date.parse(e.startAt) }));

function kept(): Accounts {
  const chosen = chooseProvider(initial, "Gmail", "AccountPerson");
  return sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address: gmail, granted: allowedUse }, "Gmail", "AccountConnector");
}

async function start() {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const [eye] = await company(secret);
  const eyeAt = Date.parse(eye.startAt);
  const eyeDay = dayOf(eyeAt);
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(kept()));
  const runtime = ManagedRuntime.make(application(undefined, undefined, { url: cloud, key: secret }));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  const run = <A,>(effect: Effect.Effect<A, unknown, Workspaces | AccountsMachine | Proposal | Instances>) => act(() => runtime.runPromise(effect));
  const card = page.getByRole("button", { name: /^Calendar/ });
  return {
    secret, eyeAt, eyeDay, card, run,
    toEyeWeek: async () => {
      await act(() => userEvent.click(card));
      await expect.element(page.getByRole("heading", { name: "Today" })).toBeVisible();
      for (let i = (mondayOf(eyeDay) - mondayOf(dayOf(Date.now()))) / 7; i > 0; i--) await click("Next week");
      await act(() => userEvent.click(page.getByRole("button", { name: tile(eyeDay) })));
    },
    stop: async () => {
      await act(() => Promise.resolve(root.unmount()));
      await runtime.dispose();
      localStorage.clear();
    },
  };
}

it('Browse (spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"; spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence")', async () => {
  const { secret, eyeDay, card, run, toEyeWeek, stop } = await start();
  const person = (event: AccountEvent) => run(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson")));
  const lifecycle = (lifecycle: "SleepDevice" | "WakeDevice") => run(Effect.flatMap(Effect.service(Workspaces), (w) => w.send({ type: "changeLifecycle", lifecycle }, "Host")));
  const ask = (event: ProposalEvent, by: "Grace" | "Person") => run(Effect.flatMap(Effect.service(Proposal), (p) => p.send(event, by)));

  // spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
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
  const gmailView = await run(Effect.flatMap(Effect.flatMap(Effect.service(Instances), (s) => s.calendar(1)), (c) => c.get()));
  const startAt = midnight(eyeDay) + 15 * hour;
  const entry = {
    identity: { owner: gmailView.owner, calendarId: gmailView.calendarId, occurrenceId: "clinic-visit", sourceRef: "clinic", kind: "Appointment" as const, billRef: "", billOrigin: "", billAccount: "" },
    details: {
      title: "Doctor’s appointment", location: "Main St clinic", participant: "Dr. Patel", notes: "From the clinic’s email · Visit form attached",
      startAt, endAt: startAt + hour, timezone: gmailView.timezone, allDay: false, seriesId: "", recurrence: "Once" as const, reminderEnabled: true, leadTime: day, important: false,
    },
  };
  const spoken: Request = { generation: 1, workVersion: 1, origin: "Spoken" };
  await ask({ type: "propose", ask: { tag: "AddAsk", target: 1, review: { entry, calendarGeneration: gmailView.generation, displayTimezone: gmailView.timezone } }, request: spoken, now: spoken }, "Grace");
  await expect.element(row("Doctor’s appointment", "Not added yet · Grace is asking you")).toBeVisible();
  const asked = await run(Effect.flatMap(Effect.service(Proposal), (p) => p.get()));
  const tapped: Request = { generation: 2, workVersion: 1, origin: "Tapped" };
  await ask({ type: "agree", given: consent(tapped, 1, proposalOf(asked)), now: tapped }, "Person");
  await expect.poll(async () => (await company(secret)).map((e) => e.title)).toEqual(["Eye check with Dr. Patel", "Joan’s birthday", "Doctor’s appointment"]);
  await act(() => userEvent.click(row("Doctor’s appointment", "Gmail")));
  await expect.element(page.getByText("From the clinic’s email · Visit form attached")).toBeVisible();
  await click("Back to Calendar");
  await stop();
});

it('Add, change and delete (spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event")', async () => {
  const { secret, eyeAt, eyeDay, toEyeWeek, stop } = await start();
  const titles = async () => (await company(secret)).map((e) => e.title).filter((t) => t !== "Joan’s birthday");
  const edit = async (title: string, repeats: string) => {
    await click("Edit");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), title));
    await act(() => userEvent.click(page.getByRole("radio", { name: repeats })));
    await click("Save");
  };
  const opensOn = async (title: string, n: number) => {
    await act(() => userEvent.click(row(title).first()));
    await expect.element(page.getByText(`${new Date(midnight(n)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · 10 am to 11 am`)).toBeVisible();
    await click("Back to Calendar");
  };
  await toEyeWeek();

  // spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"
  await click("Add");
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "What" }), "Bridge club"));
  await act(() => userEvent.click(page.getByRole("radio", { name: "Every week" })));
  await click("Save");
  await expect.element(row("Bridge club", "On this tablet").first()).toBeVisible();
  await click("Next week");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "\\s*has plans") })).toBeVisible();

  await act(() => userEvent.click(row("Bridge club").first()));
  await edit("Bridge night", "Every week");
  await click("Back to Calendar");
  await click("Previous week");
  await opensOn("Bridge night", eyeDay);

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
  await expect.element(row("Bridge night")).not.toBeInTheDocument();

  // spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"
  await act(() => userEvent.click(row("Eye check with Dr\\. Patel")));
  await edit("Eye check at Riverside", "Every week");
  await expect.element(page.getByText("Repeats every week")).toBeVisible();
  await expect.poll(titles).toEqual(["Eye check at Riverside"]);
  await click("Back to Calendar");
  await click("Next week");
  await act(() => userEvent.click(row("Eye check at Riverside", "Gmail").first()));
  await click("Delete");
  await click("Delete only this one");
  await expect.element(page.getByRole("button", { name: tile(eyeDay + 7, "") })).toBeVisible();
  expect(await held(secret)).toEqual([{ title: "Eye check at Riverside", startAt: eyeAt }]);
  await click("Next week");
  await act(() => userEvent.click(row("Eye check at Riverside", "Gmail").first()));
  await click("Delete");
  await click("Delete every one");
  await expect.element(row("Eye check at Riverside")).not.toBeInTheDocument();
  await expect.poll(titles).toEqual([]);
  await click("Previous week");
  await click("Previous week");
  await expect.element(row("Eye check at Riverside")).not.toBeInTheDocument();
  await stop();
});
