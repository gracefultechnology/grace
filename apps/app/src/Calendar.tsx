// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"; spec/app/calendar.md, "Story: Add and correct an appointment or bill reminder"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"; spec/app/calendars.md, "Tags show only when an email’s calendar is on"; spec/app/calendars.md, "The connect banner shows until an email’s calendar is on or she says Not now"; spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"; spec/app/calendarView.md, "A shown reminder appears on Home or as a toast and See details opens its event"; spec/app/calendars.md, "Grace is told what changed in a calendar, and being told authorizes nothing"
import { Banner, BannerButton, BellIcon, Button, CalendarApp, type CalendarAppProps, CalendarDeleteDialog, type CalendarEventItem, CalendarGlyph, type HomeEvent, Toast } from "@repo/ui";
import { Option } from "effect";
import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Accounts } from "../gen/app__accounts.ts";
import type { Calendar as Entry, EntryDetails, Recurrence } from "../gen/app__calendar.ts";
import { type CalendarSource, type CalRow, connectBanner, dayRows, openSelected, overlaps, rowTag, shownReminders, tabletKey, upcoming } from "../gen/app__calendars.ts";
import { type CalendarView, type Event as CalendarEvent, enabled, entryAt, selectedOccurrence } from "../gen/app__calendarView.ts";
import type { Pending } from "../gen/app__proposal.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import { anchorOf, dayOf, horizon, hour, instant, midnight, navigation, shownDays } from "./calendar.vibe";
import { type CalendarInstance, useAccounts, useCalendarNote, useProposal, useWorkspace, WithCalendars } from "./useApp.ts";

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

const opening = (v: CalendarView): CalendarEvent => ({ type: "openCalendar", owner: v.owner, calendarId: v.calendarId, timezone: v.timezone });

async function openFrom(views: readonly CalendarInstance[], r: CalRow, visit: () => void, opens: (v: CalendarView) => CalendarEvent) {
  const lead = views.find((v) => v.key === tabletKey);
  const box = views.find((v) => v.key === r.key);
  if (!lead || !box) return;
  for (const b of new Set([lead, box])) {
    const v = await b.current();
    if (!v.opened && enabled(v, opening(v), "ViewUser")) await b.send(opening(v));
  }
  const day = { type: "navigate", report: navigation((await lead.current()).window, "SelectDay", dayOf(r.details.startAt)) } as const;
  if (enabled(await lead.current(), day, "ViewUser")) await lead.send(day);
  const open = opens(await box.current());
  if (!enabled(await box.current(), open, "ViewUser")) return;
  await box.send(open);
  visit();
}

const occurrence = (id: string) => (): CalendarEvent => ({ type: "openOccurrence", id });
const reminding = (id: string) => (v: CalendarView): CalendarEvent => ({ type: "openReminder", id, owner: v.owner, calendarId: v.calendarId, timezone: v.timezone });

function dueReminder(registry: Accounts, views: readonly CalendarInstance[]) {
  const [due] = shownReminders(registry, sourcesOf(views)).sort(byStart);
  const box = due && views.find((v) => v.key === due.key);
  if (!due || !box) return undefined;
  const dismiss: CalendarEvent = { type: "changeOccurrence", id: due.identity.occurrenceId, command: { tag: "DismissReminder" } };
  return { due, canDismiss: box.can(dismiss), onDismiss: () => { if (box.can(dismiss)) void box.send(dismiss); } };
}

export function reminderToast(registry: Accounts, views: readonly CalendarInstance[], now: number, above?: number): ReactNode {
  const shown = dueReminder(registry, views);
  if (!shown) return undefined;
  const d = shown.due.details;
  return (
    <Toast key={`reminder/${shown.due.key}/${shown.due.identity.occurrenceId}`} placement="screen" above={above}>
      <span>{`Reminder: ${d.title} ${relative(dayOf(d.startAt), dayOf(now)).toLowerCase()} at ${timeLabel(d.startAt)}`}</span>
      <Button variant="plain" size="compact" className="bg-glass/14 font-bold text-frame-lilac active:bg-glass/24" disabled={!shown.canDismiss} onClick={shown.onDismiss}>Dismiss</Button>
    </Toast>
  );
}

async function editSeries(box: CalendarInstance, id: string) {
  const v = await box.current();
  const target = anchorOf(v, entryAt(v, id).committed.seriesId)?.identity.occurrenceId ?? id;
  const open = { type: "openOccurrence", id: target } as const;
  if (target !== id && enabled(v, open, "ViewUser")) await box.send(open);
  const begin: CalendarEvent = { type: "changeOccurrence", id: target, command: { tag: "BeginEditing" } };
  if (!enabled(await box.current(), begin, "ViewUser")) return;
  await box.send(begin);
  const { draft, committed } = entryAt(await box.current(), target);
  if (draft.startAt === committed.startAt) return;
  const own: CalendarEvent = { type: "changeOccurrence", id: target, command: { tag: "ChangeDetails", details: { ...draft, startAt: committed.startAt, endAt: committed.startAt + draft.endAt - draft.startAt } } };
  if (enabled(await box.current(), own, "ViewUser")) await box.send(own);
}

export function homeCalendar(registry: Accounts, views: readonly CalendarInstance[], now: number, visit: (() => void) | undefined): { events: HomeEvent[]; status: string } {
  const today = dayOf(now);
  const sources = sourcesOf(views);
  const events = upcoming(registry, sources, now, now + horizon).sort(byStart).slice(0, 3).map((r) => ({
    id: `${r.key}/${r.identity.occurrenceId}`, weekday: short(dayOf(r.details.startAt), today).toUpperCase(), time: timeLabel(r.details.startAt),
    title: r.details.title, detail: whoWhere(r.details) || undefined, next: r.details.important,
    onClick: visit && ((e: { stopPropagation: () => void }) => { e.stopPropagation(); void openFrom(views, r, visit, occurrence(r.identity.occurrenceId)); }),
  }));
  return { events, status: upcoming(registry, sources, midnight(today), midnight(today + 1)).length > 0 ? "Today" : "Nothing else today" };
}

export function homeReminder(registry: Accounts, views: readonly CalendarInstance[], now: number, visit: (() => void) | undefined): ReactNode {
  const shown = dueReminder(registry, views);
  if (!shown) return undefined;
  const { due } = shown;
  const d = due.details;
  const when = `${relative(dayOf(d.startAt), dayOf(now))} at ${timeLabel(d.startAt)}`;
  return (
    <Banner icon={<span className="flex text-alert"><BellIcon className="size-7.5" /></span>} title={d.title}
      line={[when, d.location.split(" · ")[0]].filter(Boolean).join(" · ")}
      actions={
        <>
          {visit && <Button variant="prominent" size="compact" onClick={() => void openFrom(views, due, visit, reminding(due.identity.occurrenceId))}>See details</Button>}
          <Button variant="plain" size="compact-icon" aria-label="Dismiss" disabled={!shown.canDismiss} onClick={shown.onDismiss}>
            <X aria-hidden size={24} strokeWidth={1.75} />
          </Button>
        </>
      } />
  );
}

export function nextAppointment(registry: Accounts, views: readonly CalendarInstance[], now: number): string | undefined {
  const [next] = upcoming(registry, sourcesOf(views), now, now + horizon).sort(byStart);
  return next && `${relative(dayOf(next.details.startAt), dayOf(now))}: ${next.details.title}, ${timeLabel(next.details.startAt)}`;
}

/** @model spec/app/calendars.md */
export function Calendar({ now, ...props }: Covered & { now: number }) {
  const { accounts } = useAccounts();
  const { proposal } = useProposal();
  if (!accounts || !proposal) return null;
  return (
    <WithCalendars keys={calendarKeys(accounts)}>
      {(views) => <Shown registry={accounts} pending={proposal} views={views} now={now} {...props} />}
    </WithCalendars>
  );
}

function Shown({ registry, pending, views, now, ...props }: Covered & { registry: Accounts; pending: Pending; views: readonly CalendarInstance[]; now: number }) {
  const { can, send } = useWorkspace();
  const accounts = useAccounts();
  const note = useCalendarNote();
  const lead = views.find((v) => v.key === tabletKey);
  if (!lead) return null;
  const toast = note ? <Toast key={note.id} placement="screen">{note.text}</Toast> : reminderToast(registry, views, now);
  const sources = sourcesOf(views);
  const today = dayOf(now);
  const w = lead.state.window;
  const fire = (event: WorkspaceEvent) => () => { if (can(event)) void send(event); };
  const act = (box: CalendarInstance, event: CalendarEvent) => () => { if (box.can(event)) void box.send(event); };
  const go = (kind: Parameters<typeof navigation>[1], chosen = today) => act(lead, { type: "navigate", report: navigation(w, kind, chosen) });
  const name = (key: number) => (key === tabletKey ? "On this tablet" : registry.accounts.find((a) => a.id === key)?.name ?? "");
  const shownRows = dayRows(registry, sources, pending);
  const rows = (from: number, until: number) => shownRows.filter((r) => overlaps(r.details, midnight(from), midnight(until))).sort(byStart);
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
      const open: CalendarEvent = { type: "openOccurrence", id: rest.join("/") };
      if (box?.can(open)) void box.send(open);
    },
    onToday: go("Today"),
    onAdd: () => {
      const v = lead.state;
      const day = Math.max(selected, today);
      const startAt = instant(day, 10 * 60);
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
    guide: note?.row ? { kind: "confirm", targetId: note.row } : undefined,
    ...props,
  };

  const open = views.find((v) => v.key === openSelected(registry, sources));
  if (!open) return <><CalendarApp {...browsing} />{toast}</>;
  const entry = selectedOccurrence(open.state);
  if (entry.phase === "Editing") return <><Form key={`${open.key}/${entry.identity.occurrenceId}`} box={open} entry={entry} today={today} browsing={browsing} />{toast}</>;
  const d = entry.committed;
  const deletion = open.state.deletion;
  const id = entry.identity.occurrenceId;
  return (
    <>
      <CalendarApp {...browsing} view="detail" onBack={act(open, { type: "backToCalendar" })}
        event={{
          title: d.title, when: `${longDate(dayOf(d.startAt))} · ${span(d)}`, where: d.location || undefined, who: d.participant || undefined,
          reminder: reminderLine(d), repeat: repeatLines[d.recurrence], note: d.notes || undefined,
          onEdit: () => void editSeries(open, id), onDelete: act(open, { type: "requestDeletion" }),
        }} />
      <CalendarDeleteDialog open={deletion !== "NoDeletion"} title={`Delete ${d.title}?`}
        description={d.recurrence === "Once" ? `${longDate(dayOf(d.startAt))} at ${timeLabel(d.startAt)}.` : `It repeats ${repeats[d.recurrence].toLowerCase()}.`}
        repeating={d.recurrence !== "Once"} pending={deletion === "DeletionPending"}
        error={deletion === "DeletionFailed" ? "This wasn’t deleted. Choose again to try again." : undefined}
        onOpenChange={(opened) => { if (!opened) act(open, { type: "keepOccurrence" })(); }}
        onKeep={act(open, { type: "keepOccurrence" })}
        onDelete={(scope) => act(open, { type: "approveDeletion", scope: scope === "series" ? "EntireSeries" : "ThisOccurrence" })()} />
      {toast}
    </>
  );
}

type Texts = { title: string; where: string };

function Form({ box, entry, today, browsing }: { box: CalendarInstance; entry: Entry; today: number; browsing: CalendarAppProps }) {
  const id = entry.identity.occurrenceId;
  const d = entry.draft;
  const [texts, setTexts] = useState<Texts>({ title: d.title, where: d.location });
  const [pick, setPick] = useState<"day" | "time" | null>(null);
  const startingAt = (startAt: number) => ({ startAt, endAt: startAt + d.endAt - d.startAt });
  const change = (next: Partial<EntryDetails>, typed: Texts = texts) => {
    const details = { ...d, ...next, title: typed.title.trim(), location: typed.where.trim() };
    const recurring = details.recurrence !== "Once";
    const event: CalendarEvent = {
      type: "changeOccurrence", id,
      command: { tag: "ChangeDetails", details: { ...details, seriesId: entry.committed.seriesId || (recurring ? d.seriesId || id : "") } },
    };
    if (box.can(event)) void box.send(event);
  };
  const type = (next: Partial<Texts>) => {
    const typed = { ...texts, ...next };
    setTexts(typed);
    change({}, typed);
  };
  const approve: CalendarEvent = { type: "changeOccurrence", id, command: { tag: "ApproveEntry", revision: entry.revision } };
  const save = async () => {
    if (!box.can(approve)) return;
    await box.send(approve);
    if (entry.hasSaved) return;
    const after = await box.settled(id);
    if (Option.isNone(after) || entryAt(after.value, id).phase !== "Saved") return;
    const shown: CalendarEvent = { type: "navigate", report: navigation(after.value.window, "SelectDay", dayOf(d.startAt)) };
    if (enabled(after.value, shown, "ViewUser")) await box.send(shown);
  };
  const start = new Date(d.startAt);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const days = Array.from({ length: 21 }, (_, i) => today + i);
  const times = Array.from({ length: 25 }, (_, i) => 7 * 60 + 30 * i);
  const cancel: CalendarEvent = { type: "changeOccurrence", id, command: { tag: "CancelEditing" } };
  return (
    <CalendarApp {...browsing} view="form" onBack={() => { if (box.can(cancel)) void box.send(cancel); }}
      canSave={box.can(approve)} onSave={() => void save()}
      saveStatus={entry.approvedRevision !== -1 ? "saving" : entry.storageError === "SaveFailure" ? "failed" : undefined}
      form={{
        heading: entry.hasSaved ? "Edit appointment" : "New appointment",
        title: texts.title, onTitleChange: (title) => type({ title }), where: texts.where, onWhereChange: (where) => type({ where }),
        day: {
          value: longDate(dayOf(d.startAt)), selected: String(dayOf(d.startAt)), open: pick === "day",
          onOpenChange: (o) => setPick(o ? "day" : null),
          choices: days.map((n) => ({ value: String(n), label: n - today < 7 ? `${relative(n, today)} · ${say(n, { month: "short", day: "numeric" })}` : longDate(n) })),
          onPick: (n) => { setPick(null); change(startingAt(instant(Number(n), minutes))); },
        },
        time: {
          value: span(d), selected: String(minutes), open: pick === "time", onOpenChange: (o) => setPick(o ? "time" : null),
          choices: times.map((m) => ({ value: String(m), label: timeLabel(instant(today, m)) })),
          onPick: (m) => { setPick(null); change(startingAt(instant(dayOf(d.startAt), Number(m)))); },
        },
        repeat: { options: Object.values(repeats), value: repeats[d.recurrence], onChange: (v) => change({ recurrence: (Object.keys(repeats) as Recurrence[]).find((r) => repeats[r] === v) ?? "Once" }) },
        remind: {
          options: Object.keys(reminders), value: reminderOf(d),
          onChange: (v) => { const r = (Object.keys(reminders) as Reminder[]).find((k) => k === v) ?? "No"; change({ reminderEnabled: r !== "No", leadTime: reminders[r] }); },
        },
      }} />
  );
}
