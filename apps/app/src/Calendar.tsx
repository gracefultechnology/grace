// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"; spec/app/calendarView.md, "The form opens its Day or its Time list, one at a time"; spec/app/calendar.md, "Story: Add and correct an appointment or bill reminder"; spec/app/calendar.md, "Story: See a reminder and choose what to do"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"; spec/app/calendars.md, "Tags show only when an email’s calendar is on"; spec/app/calendars.md, "The connect banner shows until an email’s calendar is on or she says Not now"; spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"; spec/app/calendarView.md, "A shown reminder appears on Home or as a toast and See details opens its event"; spec/app/calendars.md, "Grace is told what changed in a calendar, and being told authorizes nothing"; spec/app/workspace.md, "Guidance is visible only on its current surface and target"
import { Banner, BannerButton, CalendarApp, type CalendarAppProps, CalendarDeleteDialog, type CalendarEventItem, CalendarGlyph, type HomeEvent } from "@repo/ui";
import { Effect, Option } from "effect";
import type { Accounts } from "../gen/app__accounts.ts";
import type { Calendar as Entry, EntryDetails, Recurrence } from "../gen/app__calendar.ts";
import { type CalendarSource, type CalRow, connectBanner, dayRows, openSelected, overlaps, rowTag, shownReminders, tabletKey, upcoming } from "../gen/app__calendars.ts";
import { type Event as CalendarEvent, type FormPicker, keepsRepetition, type ViewWindow, selectedOccurrence, shownPicker } from "../gen/app__calendarView.ts";
import type { Pending } from "../gen/app__proposal.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import { adding, CalendarNews, dayOf, editingPlan, horizon, hour, instant, longDate, midnight, minutesOf, navigation, type Opening, openingPlan, relative, say, shownDays, timeLabel } from "./calendar.vibe";
import type { ReminderNotice } from "./Notices.tsx";
import { type CalendarInstance, useAccounts, useCalendarNote, useDraft, useProposal, useRecoveredCalendarDrafts, useRuntime, useWorkspace, WithCalendars } from "./useApp.ts";

type Covered = { inert?: boolean; "aria-hidden"?: boolean };

const repeats: Record<Recurrence, string> = { Once: "Never", Weekly: "Every week", Monthly: "Every month" };
const repeatLines: Record<Recurrence, string> = { Once: "Doesn’t repeat", Weekly: "Repeats every week", Monthly: "Repeats every month" };
const reminders: readonly (readonly [string, number])[] = [["Day before", 24 * hour], ["1 hour before", hour]];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const snoozeFor = 10 * 60 * 1000;

export const calendarKeys = (registry: Accounts) => [tabletKey, ...registry.accounts.map((a) => a.id)];
const sourcesOf = (views: readonly CalendarInstance[]): CalendarSource[] => views.map((v) => ({ key: v.key, view: v.state }));
const byStart = (a: CalRow, b: CalRow) => a.details.startAt - b.details.startAt;
const dateOf = (n: number) => new Date(midnight(n));

const short = (n: number, today: number) => (n === today ? "Today" : weekdays[(dateOf(n).getDay() + 6) % 7]);
const whoWhere = (d: EntryDetails) => (d.participant ? [d.participant, d.location.split(" · ")[0]].filter(Boolean).join(" · ") : d.location);
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
const lead = (minutes: number) => minutes === 24 * 60 ? "day" : minutes % (24 * 60) === 0 ? plural(minutes / (24 * 60), "day") : minutes % 60 === 0 ? plural(minutes / 60, "hour") : plural(minutes, "minute");
const leadLabel = (leadTime: number) => reminders.find(([, at]) => at === leadTime)?.[0] ?? (leadTime === 0 ? "When it starts" : `${lead(Math.round(leadTime / 60_000))} before`);
const reminderLine = (d: EntryDetails) => (!d.reminderEnabled ? "No reminder" : d.leadTime === 0 ? "Reminder when it starts" : `Reminder ${lead(Math.round(d.leadTime / 60_000))} before`);
const withKept = (offered: number[], kept: number[]) => [...new Set([...offered, ...kept])].sort((x, y) => x - y);
const span = (d: EntryDetails) => `${timeLabel(d.startAt)} to ${timeLabel(d.endAt)}`;

function period(mode: "WeekView" | "MonthView", anchor: number) {
  if (mode === "MonthView") return say(anchor, { month: "long", year: "numeric" });
  const days = shownDays(mode, anchor);
  const [first, last] = [dateOf(days[0]), dateOf(days[6])];
  return first.getMonth() === last.getMonth()
    ? `${say(days[0], { month: "long" })} ${first.getDate()} – ${last.getDate()}`
    : `${say(days[0], { month: "short", day: "numeric" })} – ${say(days[6], { month: "short", day: "numeric" })}`;
}

export function calendarGrid(w: ViewWindow, today: number, firstEvent: (from: number, until: number) => { title: string; important?: boolean } | undefined,
  go: (kind: Parameters<typeof navigation>[1], day?: number) => (() => void) | undefined): Pick<CalendarAppProps, "nav" | "week" | "month" | "onSelectDay" | "dayHeading"> {
  const switchMode = go("SwitchMode");
  return {
    nav: {
      period: period(w.mode, w.anchorDay), onPrevious: go("Earlier"), onNext: go("Later"),
      onModeChange: switchMode && ((mode) => { if ((mode === "month") !== (w.mode === "MonthView")) switchMode(); }),
      previousLabel: w.mode === "MonthView" ? "Previous month" : "Previous week", nextLabel: w.mode === "MonthView" ? "Next month" : "Next week",
    },
    week: shownDays("WeekView", w.anchorDay).map((n) => ({
      key: String(n), weekday: short(n, today), day: String(dateOf(n).getDate()), today: n === today, selected: n === w.selectedDay, busy: firstEvent(n, n + 1) !== undefined,
    })),
    month: {
      weekdays,
      days: shownDays("MonthView", w.anchorDay).map((n) => {
        const outside = dateOf(n).getMonth() !== dateOf(w.anchorDay).getMonth();
        const first = outside ? undefined : firstEvent(n, n + 1);
        return {
          key: String(n), day: String(dateOf(n).getDate()), outside, today: n === today, selected: n === w.selectedDay,
          event: first?.title.replace(/’s appointment$| appointment$/, ""), important: first?.important,
        };
      }),
    },
    onSelectDay: go("SelectDay", w.selectedDay) && ((key) => go("SelectDay", Number(key))?.()),
    dayHeading: relative(w.selectedDay, today),
  };
}

export function useCalendarActions() {
  const runtime = useRuntime();
  const news = Option.getOrUndefined(runtime.runSync(Effect.serviceOption(CalendarNews)));
  return news && {
    open: (key: number, id: string, how: Opening) => void runtime.runPromise(news.open(key, id, how)),
    edit: (key: number, id: string) => void runtime.runPromise(news.edit(key, id)),
    add: (day: number) => void runtime.runPromise(news.add(day)),
    reminderAt: news.reminderAt,
  };
}

export type CalendarActions = NonNullable<ReturnType<typeof useCalendarActions>>;

const offer = (box: CalendarInstance, event: CalendarEvent) => (box.can(event) ? () => void box.send(event) : undefined);

function opens(views: readonly CalendarInstance[], r: CalRow, how: Opening) {
  const lead = views.find((v) => v.key === tabletKey);
  const box = views.find((v) => v.key === r.key);
  return !!lead && !!box && openingPlan(lead.state, box.state, lead === box, dayOf(r.details.startAt), how, r.identity.occurrenceId) !== undefined;
}

export function homeCalendar(registry: Accounts, views: readonly CalendarInstance[], now: number, actions: CalendarActions | undefined): { events: HomeEvent[]; status: string } {
  const today = dayOf(now);
  const sources = sourcesOf(views);
  const events = upcoming(registry, sources, now, now + horizon).sort(byStart).slice(0, 3).map((r) => ({
    id: `${r.key}/${r.identity.occurrenceId}`, weekday: short(dayOf(r.details.startAt), today).toUpperCase(), time: timeLabel(r.details.startAt),
    title: r.details.title, detail: whoWhere(r.details) || undefined, next: r.details.important,
    onClick: actions && opens(views, r, "Occurrence") ? (e: { stopPropagation: () => void }) => { e.stopPropagation(); actions.open(r.key, r.identity.occurrenceId, "Occurrence"); } : undefined,
  }));
  return { events, status: upcoming(registry, sources, midnight(today), midnight(today + 1)).length > 0 ? "Today" : "Nothing else today" };
}

export function reminderNotice(registry: Accounts, views: readonly CalendarInstance[], now: number, actions: CalendarActions | undefined, visiting: boolean) {
  const due = shownReminders(registry, sourcesOf(views));
  return (subject: string): ReminderNotice | undefined => {
    const shown = actions?.reminderAt(subject);
    const r = shown && due.find((c) => c.key === shown.key && c.identity.occurrenceId === shown.id);
    const box = r && views.find((v) => v.key === r.key);
    if (!r || !box) return undefined;
    const d = r.details;
    const day = relative(dayOf(d.startAt), dayOf(now));
    const at = ` at ${timeLabel(d.startAt)}`;
    return {
      title: d.title, line: [day + at, d.location.split(" · ")[0]].filter(Boolean).join(" · "),
      toast: `${d.title} ${day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day}${at}`,
      seeDetails: visiting && opens(views, r, "Reminder"), dismiss: box.can({ type: "changeOccurrence", id: r.identity.occurrenceId, command: { tag: "DismissReminder" } }),
    };
  };
}

export function nextAppointment(registry: Accounts, views: readonly CalendarInstance[], now: number): string | undefined {
  const [next] = upcoming(registry, sourcesOf(views), now, now + horizon).sort(byStart);
  return next && `${relative(dayOf(next.details.startAt), dayOf(now))}: ${next.details.title}, ${timeLabel(next.details.startAt)}`;
}

const eventRow = (target: string) => {
  const named = /^event:(\d+):(.+)$/.exec(target);
  return named ? `${named[1]}/${named[2]}` : undefined;
};

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
  const { workspace, can, send, guide: graceGuide } = useWorkspace();
  const recoveredDrafts = useRecoveredCalendarDrafts();
  const accounts = useAccounts();
  const note = useCalendarNote();
  const actions = useCalendarActions();
  const lead = views.find((v) => v.key === tabletKey);
  if (!lead) return null;
  const sources = sourcesOf(views);
  const today = dayOf(now);
  const w = lead.state.window;
  const fire = (event: WorkspaceEvent) => (can(event) ? () => void send(event) : undefined);
  const go = (kind: Parameters<typeof navigation>[1], chosen = today) => offer(lead, { type: "navigate", report: navigation(w, kind, chosen) });
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
  const connect = fire({ type: "chooseSettingsPage", page: "EmailCalendarSettings" });
  const addOn = Math.max(selected, today);
  const guide = note?.row ? { kind: "confirm" as const, targetId: note.row } : graceGuide(eventRow);
  const browsing: CalendarAppProps = {
    view: w.mode === "MonthView" ? "month" : "week",
    banner: connectBanner(registry) ? (
      <Banner tone="dark" icon={<CalendarGlyph name="calendar" size={26} strokeWidth={2} />} title="Connect your email to keep your calendar up to date"
        line="Appointments from your email show up here automatically."
        actions={connect && <BannerButton onClick={connect}>Connect email</BannerButton>}
        onDismiss={accounts.can({ type: "dismissBanner" }) ? () => void accounts.send({ type: "dismissBanner" }) : undefined} />
    ) : undefined,
    ...calendarGrid(w, today, (from, until) => rows(from, until)[0]?.details, go),
    dayEvents: rows(selected, selected + 1).map(item),
    upcoming: upcoming(registry, sources, midnight(selected + 1), midnight(selected + 15)).sort(byStart).slice(0, 4).map(item),
    onOpenEvent: (id) => {
      const [key, ...rest] = id.split("/");
      const box = views.find((v) => v.key === Number(key));
      if (box) offer(box, { type: "openOccurrence", id: rest.join("/") })?.();
    },
    onToday: go("Today"),
    onAdd: actions && lead.can(adding(lead.state, addOn, "tablet-new")) ? () => actions.add(addOn) : undefined,
    onClose: fire({ type: "visit", destination: "Home" }),
    closeLabel: "Close Calendar",
    guide,
    ...props,
  };

  const open = views.find((v) => v.key === openSelected(registry, sources));
  if (!open) return <CalendarApp {...browsing} />;
  const entry = selectedOccurrence(open.state);
  if (entry.phase === "Editing") {
    const recovery = workspace?.plan.saveRecovery;
    const sameCalendar = recovery?.tag === "GuidedSaveReconcile" && !recovery.occurrence && !entry.hasSaved &&
      Boolean(entry.identity.sourceRef) && entry.identity.owner === recovery.owner && entry.identity.calendarId === recovery.calendar;
    const uncertain = sameCalendar && (recoveredDrafts?.task !== workspace?.assistant.taskId ||
      recoveredDrafts?.occurrences.includes(entry.identity.occurrenceId));
    return <Form key={`${open.key}/${entry.identity.occurrenceId}`} box={open} entry={entry} today={today} browsing={browsing} uncertain={Boolean(uncertain)} />;
  }
  const d = entry.committed;
  const deletion = open.state.deletion;
  const id = entry.identity.occurrenceId;
  const showing = entry.reminder === "ReminderShown";
  const reminderCommand = (command: Extract<CalendarEvent, { type: "changeOccurrence" }>["command"]) => (showing ? offer(open, { type: "changeOccurrence", id, command }) : undefined);
  return (
    <>
      <CalendarApp {...browsing} view="detail" onBack={offer(open, { type: "backToCalendar" })}
        event={{
          title: d.title, when: `${longDate(dayOf(d.startAt))} · ${span(d)}`, where: d.location || undefined, who: d.participant || undefined,
          reminder: reminderLine(d), repeat: repeatLines[d.recurrence], note: d.notes || undefined,
          onDismissReminder: reminderCommand({ tag: "DismissReminder" }), onSnoozeReminder: reminderCommand({ tag: "SnoozeReminder", until: now + snoozeFor }),
          onEdit: actions && editingPlan(open.state, id) ? () => actions.edit(open.key, id) : undefined, onDelete: offer(open, { type: "requestDeletion" }),
        }} />
      <CalendarDeleteDialog open={deletion !== "NoDeletion"} title={`Delete ${d.title}?`}
        description={d.recurrence === "Once" ? `${longDate(dayOf(d.startAt))} at ${timeLabel(d.startAt)}.` : `It repeats ${repeats[d.recurrence].toLowerCase()}.`}
        repeating={d.recurrence !== "Once"} pending={deletion === "DeletionPending"}
        error={deletion === "DeletionFailed" ? "This wasn’t deleted. Choose again to try again." : undefined}
        onOpenChange={(opened) => { if (!opened) offer(open, { type: "keepOccurrence" })?.(); }}
        onKeep={offer(open, { type: "keepOccurrence" })}
        onDelete={(scope) => offer(open, { type: "approveDeletion", scope: scope === "series" ? "EntireSeries" : "ThisOccurrence" })?.()} />
    </>
  );
}

function Form({ box, entry, today, browsing, uncertain }: { box: CalendarInstance; entry: Entry; today: number; browsing: CalendarAppProps; uncertain: boolean }) {
  const runtime = useRuntime();
  const { owner, calendarId, occurrenceId: id } = entry.identity;
  const d = entry.draft;
  const [typedTitle, setTitle] = useDraft(d.title, true);
  const [typedWhere, setWhere] = useDraft(d.location, true);
  const title = typedTitle.trim() === d.title ? typedTitle : d.title;
  const where = typedWhere.trim() === d.location ? typedWhere : d.location;
  const pick = shownPicker(box.state);
  const toggle = (picker: FormPicker) => (opened: boolean) => offer(box, { type: opened ? "showPicker" : "hidePicker", picker })?.();
  const startingAt = (startAt: number) => ({ startAt, endAt: startAt + d.endAt - d.startAt });
  const change = (next: Partial<EntryDetails>) => {
    const details = { ...d, title: title.trim(), location: where.trim(), ...next };
    const recurring = details.recurrence !== "Once";
    offer(box, {
      type: "changeOccurrence", id,
      command: { tag: "ChangeDetails", details: { ...details, seriesId: entry.committed.seriesId || (recurring ? d.seriesId || id : "") } },
    })?.();
  };
  const approve: CalendarEvent = { type: "changeOccurrence", id, command: { tag: "ApproveEntry", revision: entry.revision } };
  const minutes = minutesOf(d.startAt);
  const chosenDay = dayOf(d.startAt);
  const kept = entry.hasSaved ? [d.startAt, entry.committed.startAt] : [d.startAt];
  const startOn = (day: number, minute: number) => kept.find((at) => dayOf(at) === day && minutesOf(at) === minute) ?? instant(day, minute);
  const days = withKept(Array.from({ length: 21 }, (_, i) => today + i), kept.map(dayOf));
  const times = withKept(Array.from({ length: 25 }, (_, i) => 7 * 60 + 30 * i), kept.map(minutesOf)).flatMap((minute) => {
    const at = startOn(chosenDay, minute);
    return minutesOf(at) === minute ? [{ value: String(at), label: timeLabel(at) }] : [];
  });
  const repeatable = keepsRepetition(box.state) ? (Object.keys(repeats) as Recurrence[]) : [entry.hasSaved ? entry.committed.recurrence : "Once"];
  const leads = withKept(reminders.map(([, at]) => at), [entry.committed, d].filter((r) => r.reminderEnabled).map((r) => r.leadTime)).reverse();
  const back = offer(box, { type: "changeOccurrence", id, command: { tag: "CancelEditing" } });
  const checkCalendar = () => void runtime.runPromise(Effect.flatMap(CalendarNews, (news) => news.openRecoveredSaveList(owner, calendarId)));
  return (
    <CalendarApp {...browsing} view="form" onBack={uncertain && back ? checkCalendar : back}
      canSave={!uncertain && box.can(approve)} onSave={uncertain ? undefined : offer(box, approve)}
      saveStatus={uncertain ? "failed" : entry.approvedRevision !== -1 ? "saving" : entry.storageError === "SaveFailure" ? "failed" : undefined}
      saveError={uncertain ? "This appointment may already be saved. Go back to Calendar to check." : undefined}
      form={{
        heading: entry.hasSaved ? "Edit appointment" : "New appointment",
        title, onTitleChange: (typed) => { setTitle(typed); change({ title: typed.trim() }); },
        where, onWhereChange: (typed) => { setWhere(typed); change({ location: typed.trim() }); },
        day: {
          value: longDate(chosenDay), selected: String(chosenDay), open: pick === "DayPicker",
          onOpenChange: toggle("DayPicker"),
          choices: days.map((n) => ({ value: String(n), label: relative(n, today) === longDate(n) ? longDate(n) : `${relative(n, today)} · ${say(n, { month: "short", day: "numeric" })}` })),
          onPick: (n) => { toggle("DayPicker")(false); change(startingAt(startOn(Number(n), minutes))); },
        },
        time: {
          value: span(d), selected: String(d.startAt), open: pick === "TimePicker", onOpenChange: toggle("TimePicker"),
          choices: times,
          onPick: (at) => { toggle("TimePicker")(false); change(startingAt(Number(at))); },
        },
        repeat: { options: repeatable.map((r) => repeats[r]), value: repeats[d.recurrence], onChange: (v) => change({ recurrence: repeatable.find((r) => repeats[r] === v) ?? "Once" }) },
        remind: {
          options: ["No", ...leads.map(leadLabel)], value: d.reminderEnabled ? leadLabel(d.leadTime) : "No",
          onChange: (v) => { const at = leads.find((l) => leadLabel(l) === v); change({ reminderEnabled: at !== undefined, leadTime: at ?? 0 }); },
        },
      }} />
  );
}
