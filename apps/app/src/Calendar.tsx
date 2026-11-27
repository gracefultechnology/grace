// spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"; spec/app/calendarView.md, "Story: Delete this occurrence or the whole repeating event"; spec/app/calendarView.md, "Owned occurrence actions preserve one identity and one reminder lifecycle"; spec/app/calendarView.md, "The form opens its Day or its Time list, one at a time"; spec/app/calendar.md, "Story: Add and correct an appointment or bill reminder"; spec/app/calendar.md, "Story: See a reminder and choose what to do"; spec/app/calendars.md, "Story: See every calendar together and know where each appointment lives"; spec/app/calendars.md, "Tags show only when an email’s calendar is on"; spec/app/calendars.md, "The connect banner shows until an email’s calendar is on or she says Not now"; spec/app/calendars.md, "While Grace asks, the appointment shows on its day as not added yet"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"; spec/app/calendarView.md, "A shown reminder appears on Home or as a toast and See details opens its event"; spec/app/calendars.md, "Grace is told what changed in a calendar, and being told authorizes nothing"; spec/app/workspace.md, "Guidance is visible only on its current surface and target"; spec/app/calendarView.md, "A change at the company names the revision it read and never overwrites a newer one"
import { Banner, BannerButton, CalendarApp, type CalendarAppProps, CalendarDeleteDialog, type CalendarEventItem, CalendarGlyph } from "@repo/ui";
import { Effect, Exit } from "effect";
import { useMemo, useState } from "react";
import type { Accounts, Event as AccountEvent } from "../gen/app__accounts.ts";
import type { Calendar as Entry, EntryDetails, Recurrence } from "../gen/app__calendar.ts";
import { type CalendarSource, type CalRow, connectBanner, dayRows, openSelected, overlaps, rowTag, tabletKey, upcoming } from "../gen/app__calendars.ts";
import { type Event as CalendarEvent, type FormPicker, keepsRepetition, type ViewWindow, selectedOccurrence, shownPicker } from "../gen/app__calendarView.ts";
import type { Pending } from "../gen/app__proposal.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import { adding, CalendarNews, dayOf, editingPlan, hour, instant, midnight, minutesOf, navigation, shownDays, timeLabel } from "./calendar.vibe";
import { createDayStarts } from "./calendarWindow.vibe";
import type { HomeCards } from "./managedReads.vibe";
import { type CalendarInstance, useAccounts, useCalendarActions, useCalendarKeys, useCalendarNote, useProposal, useRecoveredCalendarDrafts, useRuntime, useWorkspace, WithCalendars } from "./useApp.ts";

type Covered = { inert?: boolean; "aria-hidden"?: boolean };

const repeats: Record<Recurrence, string> = { Once: "Never", Weekly: "Every week", Monthly: "Every month" };
const repeatLines: Record<Recurrence, string> = { Once: "Doesn’t repeat", Weekly: "Repeats every week", Monthly: "Repeats every month" };
const reminders: readonly (readonly [string, number])[] = [["Day before", 24 * hour], ["1 hour before", hour]];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const snoozeFor = 10 * 60 * 1000;
const shortWeekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const shortTime = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

export type HostedAppointment = HomeCards["events"][number];

export const appointmentWeekday = (date: Date) => shortWeekday.format(date).toUpperCase();

export function hostedAppointmentDate({ isAllDay, startAt }: HostedAppointment): Date {
  return new Date(isAllDay && startAt.length === 10 ? `${startAt}T12:00:00` : startAt);
}

export function hostedAppointmentDisplay(event: HostedAppointment) {
  const date = hostedAppointmentDate(event);
  return { date, time: event.isAllDay ? "All day" : shortTime.format(date) };
}

const monthYearFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const monthLongFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
const monthShortDayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const weekdayLongFmt = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const longDateFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

const formatLongDate = (n: number) => longDateFmt.format(new Date(midnight(n)));
const formatRelative = (n: number, today: number) => {
  const ahead = n - today;
  if (ahead === 0) return "Today";
  if (ahead === 1) return "Tomorrow";
  if (ahead > 1 && ahead < 7) return weekdayLongFmt.format(new Date(midnight(n)));
  return formatLongDate(n);
};

const sourcesOf = (views: readonly CalendarInstance[]): CalendarSource[] => views.map((v) => ({ key: v.key, view: v.state }));
const byStart = (a: CalRow, b: CalRow) => a.details.startAt - b.details.startAt;
const dateOf = (n: number) => new Date(midnight(n));

const short = (n: number, today: number) => (n === today ? "Today" : weekdays[(dateOf(n).getDay() + 6) % 7]);
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
const lead = (minutes: number) => minutes === 24 * 60 ? "day" : minutes % (24 * 60) === 0 ? plural(minutes / (24 * 60), "day") : minutes % 60 === 0 ? plural(minutes / 60, "hour") : plural(minutes, "minute");
const leadLabel = (leadTime: number) => reminders.find(([, at]) => at === leadTime)?.[0] ?? (leadTime === 0 ? "When it starts" : `${lead(Math.round(leadTime / 60_000))} before`);
const reminderLine = (d: EntryDetails) => (!d.reminderEnabled ? "No reminder" : d.leadTime === 0 ? "Reminder when it starts" : `Reminder ${lead(Math.round(d.leadTime / 60_000))} before`);
const withKept = (offered: number[], kept: number[]) => [...new Set([...offered, ...kept])].sort((x, y) => x - y);
const span = (d: EntryDetails) => `${timeLabel(d.startAt)} to ${timeLabel(d.endAt)}`;

function period(mode: "WeekView" | "MonthView", anchor: number) {
  if (mode === "MonthView") return monthYearFmt.format(dateOf(anchor));
  const days = shownDays(mode, anchor);
  const first = dateOf(days[0]);
  const last = dateOf(days[6]);
  return first.getMonth() === last.getMonth()
    ? `${monthLongFmt.format(first)} ${first.getDate()} – ${last.getDate()}`
    : `${monthShortDayFmt.format(first)} – ${monthShortDayFmt.format(last)}`;
}

const emptyMonth = { weekdays, days: [] };
const emptyWeek: CalendarAppProps["week"] = [];

export function calendarGrid(w: ViewWindow, today: number, firstEvent: (from: number, until: number) => { title: string; important?: boolean } | undefined,
  go: (kind: Parameters<typeof navigation>[1], day?: number) => (() => void) | undefined): Pick<CalendarAppProps, "nav" | "week" | "month" | "onSelectDay" | "dayHeading"> {
  const switchMode = go("SwitchMode");
  const isMonth = w.mode === "MonthView";
  const anchorMonth = isMonth ? dateOf(w.anchorDay).getMonth() : -1;
  return {
    nav: {
      period: period(w.mode, w.anchorDay), onPrevious: go("Earlier"), onNext: go("Later"),
      onModeChange: switchMode && ((mode) => { if ((mode === "month") !== isMonth) switchMode(); }),
      previousLabel: isMonth ? "Previous month" : "Previous week", nextLabel: isMonth ? "Next month" : "Next week",
    },
    week: isMonth ? emptyWeek : shownDays("WeekView", w.anchorDay).map((n) => ({
      key: String(n), weekday: short(n, today), day: String(dateOf(n).getDate()), today: n === today, selected: n === w.selectedDay, busy: firstEvent(n, n + 1) !== undefined,
    })),
    month: isMonth ? {
      weekdays,
      days: shownDays("MonthView", w.anchorDay).map((n) => {
        const d = dateOf(n);
        const outside = d.getMonth() !== anchorMonth;
        const first = outside ? undefined : firstEvent(n, n + 1);
        return {
          key: String(n), day: String(d.getDate()), outside, today: n === today, selected: n === w.selectedDay,
          event: first?.title.replace(/’s appointment$| appointment$/, ""), important: first?.important,
        };
      }),
    } : emptyMonth,
    onSelectDay: go("SelectDay", w.selectedDay) && ((key) => go("SelectDay", Number(key))?.()),
    dayHeading: formatRelative(w.selectedDay, today),
  };
}

const offer = (box: CalendarInstance, event: CalendarEvent) => (box.can(event) ? () => void box.send(event) : undefined);

const eventRow = (target: string) => {
  const named = /^event:(\d+):(.+)$/.exec(target);
  return named ? `${named[1]}/${named[2]}` : undefined;
};

const emptyBrowsing: Pick<CalendarAppProps, "view" | "nav" | "week" | "month" | "dayHeading" | "dayEvents" | "upcoming"> = {
  view: "week",
  nav: { period: "" },
  week: emptyWeek,
  month: emptyMonth,
  dayHeading: "",
  dayEvents: [],
  upcoming: [],
};

function bucketRows(rows: readonly CalRow[], minDay: number, maxDay: number): Map<number, CalRow[]> {
  const sorted = [...rows].sort(byStart);
  const buckets = new Map<number, CalRow[]>();
  const startOfDay = createDayStarts();
  for (const row of sorted) {
    const first = Math.max(minDay, dayOf(row.details.startAt) - 1);
    const last = Math.min(maxDay, dayOf(Math.max(row.details.startAt, row.details.endAt - 1)) + 1);
    for (let d = first; d <= last; d++) {
      if (overlaps(row.details, startOfDay(d), startOfDay(d + 1))) {
        const list = buckets.get(d);
        if (list) list.push(row);
        else buckets.set(d, [row]);
      }
    }
  }
  return buckets;
}

/** @model spec/app/calendars.md */
export function Calendar({ now, ...props }: Covered & { now: number }) {
  const { accounts, can, send } = useAccounts();
  const keys = useCalendarKeys();
  const { proposal } = useProposal();
  if (!accounts || !proposal) return null;
  return (
    <WithCalendars keys={keys}>
      {(views) => <Shown registry={accounts} canAccount={can} sendAccount={send} pending={proposal} views={views} now={now} {...props} />}
    </WithCalendars>
  );
}

type ShownProps = Covered & {
  registry: Accounts;
  canAccount: (event: AccountEvent) => boolean;
  sendAccount: (event: AccountEvent) => Promise<unknown>;
  pending: Pending;
  views: readonly CalendarInstance[];
  now: number;
};

function Shown({ registry, canAccount, sendAccount, pending, views, now, ...props }: ShownProps) {
  const { workspace, can, send, guide: graceGuide } = useWorkspace();
  const recoveredDrafts = useRecoveredCalendarDrafts();
  const note = useCalendarNote();
  const actions = useCalendarActions();
  const lead = views.find((v) => v.key === tabletKey);
  const sources = useMemo(() => sourcesOf(views), [views]);
  const openKey = openSelected(registry, sources);
  const open = openKey === -1 ? undefined : views.find((v) => v.key === openKey);
  const today = dayOf(now);
  const w = lead?.state.window;

  const browsingData = useMemo(() => {
    if (!lead || !w || open) return undefined;
    const shownRows = dayRows(registry, sources, pending);
    const days = shownDays(w.mode, w.anchorDay);
    const minDay = Math.min(days[0] ?? w.selectedDay, w.selectedDay);
    const maxDay = Math.max(days.at(-1) ?? w.selectedDay, w.selectedDay);
    const buckets = bucketRows(shownRows, minDay, maxDay);
    const names = new Map(registry.accounts.map((a) => [a.id, a.name]));
    const name = (key: number) => (key === tabletKey ? "On this tablet" : names.get(key) ?? "");
    const item = (r: CalRow): CalendarEventItem => ({
      id: `${r.key}/${r.identity.occurrenceId}`,
      title: r.details.title,
      dayLabel: short(dayOf(r.details.startAt), today),
      startLabel: timeLabel(r.details.startAt),
      who: r.details.participant || undefined,
      where: r.details.location || undefined,
      important: r.details.important,
      draft: r.draft,
      repeat: r.details.recurrence === "Once" ? undefined : repeats[r.details.recurrence],
      tag: rowTag(registry, r.key) === -1 ? undefined : name(r.key),
    });
    const selected = w.selectedDay;
    const dayEvents = (buckets.get(selected) ?? []).map(item);
    const upcomingEvents = w.mode === "MonthView"
      ? []
      : upcoming(registry, sources, midnight(selected + 1), midnight(selected + 15)).sort(byStart).slice(0, 4).map(item);
    return { buckets, dayEvents, upcomingEvents };
  }, [lead, w, open, registry, sources, pending, today]);

  if (!lead || !w) return null;
  const fire = (event: WorkspaceEvent) => (can(event) ? () => void send(event) : undefined);
  const closeProps = { onClose: fire({ type: "visit", destination: "Home" }), closeLabel: "Close Calendar", ...props };

  if (open) {
    const entry = selectedOccurrence(open.state);
    if (entry.phase === "Editing") {
      const recovery = workspace?.plan.saveRecovery;
      const sameCalendar = recovery?.tag === "GuidedSaveReconcile" && !recovery.occurrence && !entry.hasSaved &&
        Boolean(entry.identity.sourceRef) && entry.identity.owner === recovery.owner && entry.identity.calendarId === recovery.calendar;
      const uncertain = sameCalendar && (recoveredDrafts?.task !== workspace?.assistant.taskId ||
        recoveredDrafts?.occurrences.includes(entry.identity.occurrenceId));
      return <Form key={`${open.key}/${entry.identity.occurrenceId}`} box={open} entry={entry} today={today} closeProps={closeProps} uncertain={Boolean(uncertain)} />;
    }
    const d = entry.committed;
    const deletion = open.state.deletion;
    const id = entry.identity.occurrenceId;
    const showing = entry.reminder === "ReminderShown";
    const reminderCommand = (command: Extract<CalendarEvent, { type: "changeOccurrence" }>["command"]) => (showing ? offer(open, { type: "changeOccurrence", id, command }) : undefined);
    const calendarName = open.key === tabletKey ? "On this tablet" : registry.accounts.find((a) => a.id === open.key)?.name ?? "";
    return (
      <>
        <CalendarApp {...emptyBrowsing} {...closeProps} view="detail" onBack={offer(open, { type: "backToCalendar" })}
          event={{
            title: d.title, when: `${formatLongDate(dayOf(d.startAt))} · ${span(d)}`, where: d.location || undefined, who: d.participant || undefined,
            reminder: reminderLine(d), repeat: repeatLines[d.recurrence], note: d.notes || undefined,
            notice: entry.storageError === "ChangedElsewhere" ? `${calendarName} has a newer version of this appointment, so the tablet didn’t change it. This is how it is now.` : undefined,
            onDismissReminder: reminderCommand({ tag: "DismissReminder" }), onSnoozeReminder: reminderCommand({ tag: "SnoozeReminder", until: now + snoozeFor }),
            onEdit: actions && editingPlan(open.state, id) ? () => actions.edit(open.key, id) : undefined, onDelete: offer(open, { type: "requestDeletion" }),
          }} />
        <CalendarDeleteDialog open={deletion !== "NoDeletion"} title={`Delete ${d.title}?`}
          description={d.recurrence === "Once" ? `${formatLongDate(dayOf(d.startAt))} at ${timeLabel(d.startAt)}.` : `It repeats ${repeats[d.recurrence].toLowerCase()}.`}
          repeating={d.recurrence !== "Once"} pending={deletion === "DeletionPending"}
          error={deletion === "DeletionFailed" ? "This wasn’t deleted. Choose again to try again." : undefined}
          onOpenChange={(opened) => { if (!opened) offer(open, { type: "keepOccurrence" })?.(); }}
          onKeep={offer(open, { type: "keepOccurrence" })}
          onDelete={(scope) => offer(open, { type: "approveDeletion", scope: scope === "series" ? "EntireSeries" : "ThisOccurrence" })?.()} />
      </>
    );
  }

  const go = (kind: Parameters<typeof navigation>[1], chosen = today) => offer(lead, { type: "navigate", report: navigation(w, kind, chosen) });
  const selected = w.selectedDay;
  const connect = fire({ type: "chooseSettingsPage", page: "EmailCalendarSettings" });
  const addOn = Math.max(selected, today);
  const guide = note?.row ? { kind: "confirm" as const, targetId: note.row } : graceGuide(eventRow);
  const buckets = browsingData?.buckets;

  return (
    <CalendarApp
      view={w.mode === "MonthView" ? "month" : "week"}
      banner={connectBanner(registry) ? (
        <Banner tone="dark" icon={<CalendarGlyph name="calendar" size={26} strokeWidth={2} />} title="Connect your email to keep your calendar up to date"
          line="Appointments from your email show up here automatically."
          actions={connect && <BannerButton onClick={connect}>Connect email</BannerButton>}
          onDismiss={canAccount({ type: "dismissBanner" }) ? () => void sendAccount({ type: "dismissBanner" }) : undefined} />
      ) : undefined}
      {...calendarGrid(w, today, (from) => buckets?.get(from)?.[0]?.details, go)}
      dayEvents={browsingData?.dayEvents ?? []}
      upcoming={browsingData?.upcomingEvents ?? []}
      onOpenEvent={(id) => {
        const [key, ...rest] = id.split("/");
        const box = views.find((v) => v.key === Number(key));
        if (box) offer(box, { type: "openOccurrence", id: rest.join("/") })?.();
      }}
      onToday={go("Today")}
      onAdd={actions && lead.can(adding(lead.state, addOn, "tablet-new")) ? () => actions.add(addOn) : undefined}
      guide={guide}
      {...closeProps}
    />
  );
}

const emptyChoices: { value: string; label: string }[] = [];

type LocalField = { readonly value: string; readonly source: string; readonly inflight: number };

function reconcileField(local: LocalField | undefined, remote: string): { value: string; next: LocalField | undefined } {
  if (!local) return { value: remote, next: undefined };
  if (local.inflight > 0) return { value: local.value, next: local };
  if (remote === local.value.trim()) {
    return { value: local.value, next: local.value === remote ? undefined : { value: local.value, source: remote, inflight: 0 } };
  }
  if (remote === local.source) return { value: local.value, next: local };
  return { value: remote, next: undefined };
}

function Form({ box, entry, today, closeProps, uncertain }: {
  box: CalendarInstance;
  entry: Entry;
  today: number;
  closeProps: Covered & { onClose?: () => void; closeLabel: string };
  uncertain: boolean;
}) {
  const runtime = useRuntime();
  const { owner, calendarId, occurrenceId: id } = entry.identity;
  const d = entry.draft;
  const [titleDraft, setTitleDraft] = useState<LocalField>();
  const [whereDraft, setWhereDraft] = useState<LocalField>();
  const resolvedTitle = reconcileField(titleDraft, d.title);
  if (resolvedTitle.next !== titleDraft) setTitleDraft(resolvedTitle.next);
  const resolvedWhere = reconcileField(whereDraft, d.location);
  if (resolvedWhere.next !== whereDraft) setWhereDraft(resolvedWhere.next);
  const title = resolvedTitle.value;
  const where = resolvedWhere.value;
  const pick = shownPicker(box.state);
  const toggle = (picker: FormPicker) => (opened: boolean) => offer(box, { type: opened ? "showPicker" : "hidePicker", picker })?.();
  const startingAt = (startAt: number) => ({ startAt, endAt: startAt + d.endAt - d.startAt });
  const sendChange = (next: Partial<EntryDetails>) => {
    const details = { ...d, title: title.trim(), location: where.trim(), ...next };
    const recurring = details.recurrence !== "Once";
    const event: CalendarEvent = {
      type: "changeOccurrence", id,
      command: { tag: "ChangeDetails", details: { ...details, seriesId: entry.committed.seriesId || (recurring ? d.seriesId || id : "") } },
    };
    return box.can(event) ? box.send(event) : undefined;
  };
  const change = (next: Partial<EntryDetails>) => { void sendChange(next); };
  const editText = (
    typed: string,
    remote: string,
    setField: typeof setTitleDraft,
    patch: Partial<EntryDetails>,
  ) => {
    const sending = sendChange(patch);
    if (!sending) return;
    setField((prev) => ({ value: typed, source: prev?.source ?? remote, inflight: (prev?.inflight ?? 0) + 1 }));
    void sending.then((exit) => {
      setField((prev) => {
        if (!prev) return undefined;
        const inflight = Math.max(0, prev.inflight - 1);
        if (inflight === 0 && !Exit.isSuccess(exit)) return undefined;
        return { ...prev, inflight };
      });
    });
  };
  const approve: CalendarEvent = { type: "changeOccurrence", id, command: { tag: "ApproveEntry", revision: entry.revision } };
  const minutes = minutesOf(d.startAt);
  const chosenDay = dayOf(d.startAt);
  const committedStartAt = entry.hasSaved ? entry.committed.startAt : undefined;
  const startOn = (day: number, minute: number) => {
    if (dayOf(d.startAt) === day && minutesOf(d.startAt) === minute) return d.startAt;
    if (committedStartAt !== undefined && dayOf(committedStartAt) === day && minutesOf(committedStartAt) === minute) return committedStartAt;
    return instant(day, minute);
  };

  const dayChoices = useMemo(() => {
    if (pick !== "DayPicker") return emptyChoices;
    const keptDays = committedStartAt !== undefined ? [dayOf(d.startAt), dayOf(committedStartAt)] : [dayOf(d.startAt)];
    const days = withKept(Array.from({ length: 21 }, (_, i) => today + i), keptDays);
    return days.map((n) => {
      const long = formatLongDate(n);
      const rel = formatRelative(n, today);
      return { value: String(n), label: rel === long ? long : `${rel} · ${monthShortDayFmt.format(dateOf(n))}` };
    });
  }, [pick, today, d.startAt, committedStartAt]);

  const timeChoices = useMemo(() => {
    if (pick !== "TimePicker") return emptyChoices;
    const keptMinutes = committedStartAt !== undefined ? [minutesOf(d.startAt), minutesOf(committedStartAt)] : [minutesOf(d.startAt)];
    return withKept(Array.from({ length: 25 }, (_, i) => 7 * 60 + 30 * i), keptMinutes).flatMap((minute) => {
      const at = dayOf(d.startAt) === chosenDay && minutesOf(d.startAt) === minute
        ? d.startAt
        : committedStartAt !== undefined && dayOf(committedStartAt) === chosenDay && minutesOf(committedStartAt) === minute
          ? committedStartAt
          : instant(chosenDay, minute);
      return minutesOf(at) === minute ? [{ value: String(at), label: timeLabel(at) }] : [];
    });
  }, [pick, chosenDay, d.startAt, committedStartAt]);

  const repeatable = keepsRepetition(box.state) ? (Object.keys(repeats) as Recurrence[]) : [entry.hasSaved ? entry.committed.recurrence : "Once"];
  const leads = withKept(reminders.map(([, at]) => at), [entry.committed, d].filter((r) => r.reminderEnabled).map((r) => r.leadTime)).reverse();
  const back = offer(box, { type: "changeOccurrence", id, command: { tag: "CancelEditing" } });
  const checkCalendar = () => void runtime.runPromise(Effect.flatMap(CalendarNews, (news) => news.openRecoveredSaveList(owner, calendarId)));
  return (
    <CalendarApp {...emptyBrowsing} {...closeProps} view="form" onBack={uncertain && back ? checkCalendar : back}
      canSave={!uncertain && box.can(approve)} onSave={uncertain ? undefined : offer(box, approve)}
      saveStatus={uncertain ? "failed" : entry.approvedRevision !== -1 ? "saving" : entry.storageError === "SaveFailure" ? "failed" : undefined}
      saveError={uncertain ? "This appointment may already be saved. Go back to Calendar to check." : undefined}
      form={{
        heading: entry.hasSaved ? "Edit appointment" : "New appointment",
        title, onTitleChange: (typed) => editText(typed, d.title, setTitleDraft, { title: typed.trim() }),
        where, onWhereChange: (typed) => editText(typed, d.location, setWhereDraft, { location: typed.trim() }),
        day: {
          value: formatLongDate(chosenDay), selected: String(chosenDay), open: pick === "DayPicker",
          onOpenChange: toggle("DayPicker"),
          choices: dayChoices,
          onPick: (n) => { toggle("DayPicker")(false); change(startingAt(startOn(Number(n), minutes))); },
        },
        time: {
          value: span(d), selected: String(d.startAt), open: pick === "TimePicker", onOpenChange: toggle("TimePicker"),
          choices: timeChoices,
          onPick: (at) => { toggle("TimePicker")(false); change(startingAt(Number(at))); },
        },
        repeat: { options: repeatable.map((r) => repeats[r]), value: repeats[d.recurrence], onChange: (v) => change({ recurrence: repeatable.find((r) => repeats[r] === v) ?? "Once" }) },
        remind: {
          options: ["No", ...leads.map(leadLabel)], value: d.reminderEnabled ? leadLabel(d.leadTime) : "No",
          onChange: (v) => { const at = leads.find((l) => leadLabel(l) === v); change({ reminderEnabled: at !== undefined, leadTime: at ?? 0 }); },
        },
        important: { checked: d.important, onCheckedChange: (important) => change({ important }) },
      }} />
  );
}
