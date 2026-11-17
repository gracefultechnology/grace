// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"; spec/app/calendar.md, "Story: Add and correct an appointment or bill reminder"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"; spec/app/calendars.md, "Tags show only when an email’s calendar is on"; spec/app/calendars.md, "The connect banner shows until an email’s calendar is on or she says Not now"; spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"
import { Banner, BannerButton, CalendarApp, type CalendarAppProps, CalendarDeleteDialog, type CalendarEventItem, CalendarGlyph, type HomeEvent } from "@repo/ui";
import { Exit } from "effect";
import { useState } from "react";
import type { Accounts } from "../gen/app__accounts.ts";
import type { Calendar as Entry, EntryDetails, Recurrence } from "../gen/app__calendar.ts";
import { type CalendarSource, type CalRow, connectBanner, dayRows, openSelected, rowTag, tabletKey, upcoming } from "../gen/app__calendars.ts";
import { type Event as CalendarEvent, entryAt, selectedOccurrence } from "../gen/app__calendarView.ts";
import type { Pending } from "../gen/app__proposal.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import { dayOf, horizon, hour, midnight, navigation, shownDays } from "./calendar.vibe";
import { type CalendarInstance, useAccounts, useProposal, useWorkspace, WithCalendars } from "./useApp.ts";

type Covered = { inert?: boolean; "aria-hidden"?: boolean };

const repeats: Record<Recurrence, string> = { Once: "Never", Weekly: "Every week", Monthly: "Every month" };
const repeatLines: Record<Recurrence, string> = { Once: "Doesn’t repeat", Weekly: "Repeats every week", Monthly: "Repeats every month" };
const reminders = { No: 0, "Day before": 24 * hour, "1 hour before": hour } as const;
type Reminder = keyof typeof reminders;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const calendarKeys = (registry: Accounts) => [tabletKey, ...registry.accounts.map((a) => a.id)];
const sourcesOf = (views: readonly CalendarInstance[]): CalendarSource[] => views.map((v) => ({ key: v.key, view: v.state }));
const byStart = (a: CalRow, b: CalRow) => a.details.startAt - b.details.startAt;
const dateOf = (n: number) => new Date(midnight(n));
const say = (n: number, options: Intl.DateTimeFormatOptions) => dateOf(n).toLocaleDateString("en-US", options);

export function timeLabel(at: number) {
  const t = new Date(at);
  const h = t.getHours(), m = t.getMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

function relative(n: number, today: number) {
  const ahead = n - today;
  return ahead === 0 ? "Today" : ahead === 1 ? "Tomorrow" : ahead > 1 && ahead < 7 ? say(n, { weekday: "long" }) : longDate(n);
}

const longDate = (n: number) => say(n, { weekday: "long", month: "long", day: "numeric" });

const short = (n: number, today: number) => (n === today ? "Today" : weekdays[(dateOf(n).getDay() + 6) % 7]);
const whoWhere = (d: EntryDetails) => (d.participant ? [d.participant, d.location.split(" · ")[0]].filter(Boolean).join(" · ") : d.location);
const reminderOf = (d: EntryDetails): Reminder => (!d.reminderEnabled ? "No" : d.leadTime >= 24 * hour ? "Day before" : "1 hour before");
const reminderLine = (d: EntryDetails) => ({ No: "No reminder", "Day before": "Reminder day before", "1 hour before": "Reminder 1 hour before" })[reminderOf(d)];
const span = (d: EntryDetails) => `${timeLabel(d.startAt)} to ${timeLabel(d.endAt)}`;

function period(mode: "WeekView" | "MonthView", anchor: number) {
  if (mode === "MonthView") return say(anchor, { month: "long", year: "numeric" });
  const days = shownDays(mode, anchor);
  const [first, last] = [dateOf(days[0]), dateOf(days[6])];
  return first.getMonth() === last.getMonth()
    ? `${say(days[0], { month: "long" })} ${first.getDate()} – ${last.getDate()}`
    : `${say(days[0], { month: "short", day: "numeric" })} – ${say(days[6], { month: "short", day: "numeric" })}`;
}

export function homeEvents(registry: Accounts, views: readonly CalendarInstance[], now: number): HomeEvent[] {
  const today = dayOf(now);
  return upcoming(registry, sourcesOf(views), now, now + horizon).sort(byStart).slice(0, 3).map((r, i) => ({
    id: `${r.key}/${r.identity.occurrenceId}`, weekday: short(dayOf(r.details.startAt), today).toUpperCase(), time: timeLabel(r.details.startAt),
    title: r.details.title, detail: whoWhere(r.details) || undefined, next: i === 0,
  }));
}

export function nextAppointment(registry: Accounts, views: readonly CalendarInstance[], now: number): string | undefined {
  const [next] = upcoming(registry, sourcesOf(views), now, now + horizon).sort(byStart);
  return next && `${relative(dayOf(next.details.startAt), dayOf(now))}: ${next.details.title}, ${timeLabel(next.details.startAt)}`;
}

/** @model spec/app/calendars.md */
export function Calendar(props: Covered) {
  const { accounts } = useAccounts();
  const { proposal } = useProposal();
  if (!accounts || !proposal) return null;
  return (
    <WithCalendars keys={calendarKeys(accounts)}>
      {(views) => <Shown registry={accounts} pending={proposal} views={views} {...props} />}
    </WithCalendars>
  );
}

function Shown({ registry, pending, views, ...props }: Covered & { registry: Accounts; pending: Pending; views: readonly CalendarInstance[] }) {
  const { can, send } = useWorkspace();
  const accounts = useAccounts();
  const lead = views.find((v) => v.key === tabletKey);
  if (!lead) return null;
  const sources = sourcesOf(views);
  const now = Date.now();
  const today = dayOf(now);
  const w = lead.state.window;
  const fire = (event: WorkspaceEvent) => () => { if (can(event)) void send(event); };
  const act = (box: CalendarInstance, event: CalendarEvent) => () => { if (box.can(event)) void box.send(event); };
  const go = (kind: Parameters<typeof navigation>[1], chosen = today) => act(lead, { type: "navigate", report: navigation(w, kind, chosen) });
  const name = (key: number) => (key === tabletKey ? "On this tablet" : registry.accounts.find((a) => a.id === key)?.name ?? "");
  const rows = (from: number, until: number) => dayRows(registry, sources, pending, midnight(from), midnight(until)).sort(byStart);
  const item = (r: CalRow): CalendarEventItem => ({
    id: `${r.key}/${r.identity.occurrenceId}`, title: r.details.title, dayLabel: short(dayOf(r.details.startAt), today), startLabel: timeLabel(r.details.startAt),
    who: r.details.participant || undefined, where: r.details.location || undefined, important: r.details.important, draft: r.draft,
    repeat: r.details.recurrence === "Once" ? undefined : repeats[r.details.recurrence],
    tag: rowTag(registry, r.key) === -1 ? undefined : name(r.key),
  });
  const selected = w.selectedDay;
  const browsing: CalendarAppProps = {
    view: w.mode === "MonthView" ? "month" : "week",
    banner: connectBanner(registry) ? (
      <Banner tone="dark" icon={<CalendarGlyph name="calendar" size={26} strokeWidth={2} />} title="Connect your email to keep your calendar up to date"
        line="Appointments from your email show up here automatically."
        actions={<BannerButton onClick={fire({ type: "chooseSettingsPage", page: "EmailCalendarSettings" })}>Connect email</BannerButton>}
        onDismiss={() => { if (accounts.can({ type: "dismissBanner" })) void accounts.send({ type: "dismissBanner" }); }} />
    ) : undefined,
    nav: {
      period: period(w.mode, w.anchorDay), onPrevious: go("Earlier"), onNext: go("Later"), onModeChange: (mode) => { if ((mode === "month") !== (w.mode === "MonthView")) go("SwitchMode")(); },
      previousLabel: w.mode === "MonthView" ? "Previous month" : "Previous week", nextLabel: w.mode === "MonthView" ? "Next month" : "Next week",
    },
    week: shownDays("WeekView", w.anchorDay).map((n) => ({
      key: String(n), weekday: short(n, today), day: String(dateOf(n).getDate()), today: n === today, selected: n === selected, busy: rows(n, n + 1).length > 0,
    })),
    month: {
      weekdays,
      days: shownDays("MonthView", w.anchorDay).map((n) => {
        const outside = dateOf(n).getMonth() !== dateOf(w.anchorDay).getMonth();
        const [first] = outside ? [] : rows(n, n + 1);
        return {
          key: String(n), day: String(dateOf(n).getDate()), outside, today: n === today, selected: n === selected,
          event: first?.details.title.replace(/’s appointment$| appointment$/, ""), important: first?.details.important,
        };
      }),
    },
    onSelectDay: (key) => go("SelectDay", Number(key))(),
    dayHeading: relative(selected, today),
    dayEvents: rows(selected, selected + 1).map(item),
    upcoming: upcoming(registry, sources, midnight(selected + 1), midnight(selected + 15)).sort(byStart).slice(0, 4).map(item),
    onOpenEvent: (id) => {
      const [key, ...rest] = id.split("/");
      const box = views.find((v) => v.key === Number(key));
      if (box) void openOn(box, rest.join("/"));
    },
    onToday: go("Today"),
    onAdd: () => {
      const v = lead.state;
      const day = Math.max(selected, today);
      const startAt = midnight(day) + 10 * hour;
      act(lead, {
        type: "createOccurrence",
        entry: {
          identity: { owner: v.owner, calendarId: v.calendarId, occurrenceId: `tablet-${crypto.randomUUID()}`, sourceRef: "", kind: "Appointment", billRef: "", billOrigin: "", billAccount: "" },
          details: {
            title: "", location: "", participant: "", notes: "", startAt, endAt: startAt + hour, timezone: v.timezone, allDay: false,
            seriesId: "", recurrence: "Once", reminderEnabled: true, leadTime: hour, important: false,
          },
        },
      })();
    },
    onClose: fire({ type: "visit", destination: "Home" }),
    closeLabel: "Close Calendar",
    ...props,
  };

  const open = views.find((v) => v.key === openSelected(registry, sources));
  if (!open) return <CalendarApp {...browsing} />;
  const entry = selectedOccurrence(open.state);
  if (entry.phase === "Editing") return <Form key={`${open.key}/${entry.identity.occurrenceId}`} box={open} entry={entry} today={today} browsing={browsing} />;
  const d = entry.committed;
  const deletion = open.state.deletion;
  const id = entry.identity.occurrenceId;
  return (
    <>
      <CalendarApp {...browsing} view="detail" onBack={act(open, { type: "backToCalendar" })}
        event={{
          title: d.title, when: `${longDate(dayOf(d.startAt))} · ${span(d)}`, where: d.location || undefined, who: d.participant || undefined,
          reminder: reminderLine(d), repeat: repeatLines[d.recurrence], note: d.notes || undefined,
          onEdit: act(open, { type: "changeOccurrence", id, command: { tag: "BeginEditing" } }), onDelete: act(open, { type: "requestDeletion" }),
        }} />
      <CalendarDeleteDialog open={deletion !== "NoDeletion"} title={`Delete ${d.title}?`}
        description={d.recurrence === "Once" ? `${longDate(dayOf(d.startAt))} at ${timeLabel(d.startAt)}.` : `It repeats ${repeats[d.recurrence].toLowerCase()}.`}
        repeating={d.recurrence !== "Once"} pending={deletion === "DeletionPending"}
        error={deletion === "DeletionFailed" ? "This wasn’t deleted. Choose again to try again." : undefined}
        onOpenChange={(opened) => { if (!opened) act(open, { type: "keepOccurrence" })(); }}
        onKeep={act(open, { type: "keepOccurrence" })}
        onDelete={(scope) => act(open, { type: "approveDeletion", scope: scope === "series" ? "EntireSeries" : "ThisOccurrence" })()} />
    </>
  );
}

async function openOn(box: CalendarInstance, id: string) {
  const v = box.state;
  const opening: CalendarEvent = { type: "openCalendar", owner: v.owner, calendarId: v.calendarId, timezone: v.timezone };
  if (!v.opened && box.can(opening)) await box.send(opening);
  await box.send({ type: "openOccurrence", id });
}

type Fields = { title: string; where: string; startAt: number; recurrence: Recurrence; reminder: Reminder };

function Form({ box, entry, today, browsing }: { box: CalendarInstance; entry: Entry; today: number; browsing: CalendarAppProps }) {
  const id = entry.identity.occurrenceId;
  const [fields, setFields] = useState<Fields>(() => ({
    title: entry.draft.title, where: entry.draft.location, startAt: entry.draft.startAt, recurrence: entry.draft.recurrence, reminder: reminderOf(entry.draft),
  }));
  const [pick, setPick] = useState<"day" | "time" | null>(null);
  const details = (f: Fields): EntryDetails => ({
    ...entry.draft, title: f.title, location: f.where, startAt: f.startAt, endAt: f.startAt + entry.draft.endAt - entry.draft.startAt, recurrence: f.recurrence,
    seriesId: entry.committed.seriesId || (f.recurrence === "Once" ? "" : entry.draft.seriesId || id),
    reminderEnabled: f.reminder !== "No", leadTime: reminders[f.reminder],
  });
  const changing = (f: Fields): CalendarEvent => ({ type: "changeOccurrence", id, command: { tag: "ChangeDetails", details: details(f) } });
  const change = (next: Partial<Fields>) => {
    const f = { ...fields, ...next };
    setFields(f);
    if (box.can(changing(f))) void box.send(changing(f));
  };
  const save = async () => {
    const changed = await box.send(changing(fields));
    const revision = Exit.isSuccess(changed) ? entryAt(changed.value, id).revision : entry.revision;
    await box.send({ type: "changeOccurrence", id, command: { tag: "ApproveEntry", revision } });
  };
  const start = new Date(fields.startAt);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const at = (n: number, m: number) => midnight(n) + m * 60 * 1000;
  const days = Array.from({ length: 21 }, (_, i) => today + i);
  const times = Array.from({ length: 25 }, (_, i) => 7 * 60 + 30 * i);
  const saving = entry.approvedRevision !== -1;
  return (
    <CalendarApp {...browsing} view="form" onBack={() => { const cancel: CalendarEvent = { type: "changeOccurrence", id, command: { tag: "CancelEditing" } }; if (box.can(cancel)) void box.send(cancel); }}
      canSave={fields.title.trim() !== "" && !saving} onSave={() => void save()}
      saveStatus={saving ? "saving" : entry.storageError === "SaveFailure" ? "failed" : undefined}
      form={{
        heading: entry.hasSaved ? "Edit appointment" : "New appointment",
        title: fields.title, onTitleChange: (title) => change({ title }), where: fields.where, onWhereChange: (where) => change({ where }),
        day: {
          value: longDate(dayOf(fields.startAt)), selected: String(dayOf(fields.startAt)), open: pick === "day",
          onOpenChange: (o) => setPick(o ? "day" : null),
          choices: days.map((n) => ({ value: String(n), label: n - today < 7 ? `${relative(n, today)} · ${say(n, { month: "short", day: "numeric" })}` : longDate(n) })),
          onPick: (n) => { setPick(null); change({ startAt: at(Number(n), minutes) }); },
        },
        time: {
          value: span(details(fields)), selected: String(minutes), open: pick === "time", onOpenChange: (o) => setPick(o ? "time" : null),
          choices: times.map((m) => ({ value: String(m), label: timeLabel(at(today, m)) })),
          onPick: (m) => { setPick(null); change({ startAt: at(dayOf(fields.startAt), Number(m)) }); },
        },
        repeat: { options: Object.values(repeats), value: repeats[fields.recurrence], onChange: (v) => change({ recurrence: (Object.keys(repeats) as Recurrence[]).find((r) => repeats[r] === v) ?? "Once" }) },
        remind: { options: Object.keys(reminders), value: fields.reminder, onChange: (v) => change({ reminder: (Object.keys(reminders) as Reminder[]).find((r) => r === v) ?? "No" }) },
      }} />
  );
}
