// spec/app/setup.md, "Story: Read the Google mail and calendar I connected"; spec/app/email.md, "Story: Read an email and its original attachment"
import { Alert, BrowserDialog, BrowserDialogText, Button, CalendarEventRow, CalendarMonth, CalendarNav, CalendarWeekStrip, EmptyState, Input, MailAttachment, MailFolderNav, MailLink, MailMessageRow, PageHeading, PageText, RetryNotice, SearchField, SegmentedControl, Textarea } from "@repo/ui";
import { Effect, Exit, Stream } from "effect";
import { type ReactNode, useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { useMachine } from "../gen/app__setup.react.ts";
import type { Recurrence } from "../gen/app__calendar.ts";
import { mayChangeManaged, mayReadManaged, maySendManagedMail, skipsMonthsWithoutItsDay } from "../gen/app__setup.ts";
import { actionableMailBody, inboxTrashVersion, keepMailDraft, localMailDraft, ManagedReads, type EventRow, type LocalMailDraft, type MailReply, type ManagedFolder, type ManagedSnapshot, type ManagedWrite, type AppointmentChange, type ReadView, type WriteReceipt } from "./managedReads.vibe";
import { messageLinkParts } from "./messageLinks.vibe";
import { calendarGrid } from "./Calendar.tsx";
import { dayOf, instant, midnight } from "./calendarWindow.vibe";
import type { Navigation } from "../gen/app__calendarView.ts";
import { webOrigin } from "./graceAccount.vibe";
import { useRuntime } from "./useApp.ts";

const calendarDay = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const clock = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const reviewedClock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function day(value: string) {
  return calendarDay.format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
}

function start(event: EventRow) {
  return event.isAllDay ? "All day" : clock.format(new Date(event.startAt));
}

const managedState = Stream.unwrap(Effect.map(ManagedReads, (reads) => reads.state));

function MailDraft({ accountId, email, grant, reply, open, onEditing }: {
  accountId: string; email: string; grant: string; open?: boolean; onEditing?: (active: boolean) => Promise<void>; reply?: MailReply & { source: string };
}) {
  const runtime = useRuntime();
  const envelope = reply ? { recipient: reply.recipient, subject: reply.subject } : { recipient: "", subject: "" };
  const [draft, setDraft] = useState(() => {
    const saved = runtime.runSync(localMailDraft(accountId, email, reply?.source));
    return reply && !saved.operationId ? { ...saved, ...envelope } : saved;
  });
  const [step, setStep] = useState<"Inbox" | "Edit" | "Review" | "Uncertain" | "Sent">(draft.operationId ? "Uncertain" : open ? "Edit" : "Inbox");
  const [pending, startTransition] = useTransition();
  const [saveFailed, setSaveFailed] = useState(false);
  const update = (patch: Partial<LocalMailDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setSaveFailed(!Exit.isSuccess(runtime.runSyncExit(keepMailDraft(accountId, email, next, reply?.source))));
  };
  const send = (checkOnly: boolean) => startTransition(async () => {
    const approved = draft.operationId ? draft : { ...draft, grant, operationId: crypto.randomUUID() };
    setDraft(approved);
    const result = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.sendMail({ accountId, email, grant, draft: approved, checkOnly, replyTo: reply?.source })));
    if (Exit.isSuccess(result) && result.value) {
      setDraft({ ...envelope, text: "" });
      await onEditing?.(false);
      setStep("Sent");
    } else setStep("Uncertain");
  });
  const edit = (opened: boolean) => startTransition(async () => {
    await onEditing?.(opened);
    setStep(opened ? "Edit" : "Inbox");
  });
  if (step === "Inbox" || step === "Sent") return <div className="flex flex-col items-start gap-3">
    {step === "Sent" && <PageText role="status">Gmail accepted your email.</PageText>}
    <Button variant="prominent" size="pill" onClick={() => edit(true)}>
      {draft.text || (!reply && (draft.recipient || draft.subject)) ? "Continue draft" : reply ? "Reply" : "New email"}
    </Button>
  </div>;
  if (step === "Edit") return <form className="flex flex-col gap-3" onSubmit={(event) => {
    event.preventDefault();
    setStep("Review");
  }}>
    <PageHeading>{reply ? "Reply" : "New email"}</PageHeading>
    {reply ? <><PageText>To {draft.recipient}</PageText><PageText>Subject {draft.subject || "No subject"}</PageText></> : <>
    <label>To<Input type="email" required maxLength={254} value={draft.recipient} onChange={(event) => update({ recipient: event.target.value })} /></label>
    <label>Subject<Input maxLength={120} value={draft.subject} onChange={(event) => update({ subject: event.target.value })} /></label>
    </>}
    <label>Message<Textarea required maxLength={8192} value={draft.text}
      onChange={(event) => update({ text: event.target.value })} /></label>
    {saveFailed && <RetryNotice role="alert">This browser couldn’t keep the draft.</RetryNotice>}
    <div className="flex gap-3">
      <Button type="button" variant="capsule" size="pill" onClick={() => edit(false)}>Close draft</Button>
      <Button type="submit" variant="prominent" size="pill" disabled={!draft.text.trim()}>Review email</Button>
    </div>
  </form>;
  return <section className="flex flex-col gap-3" aria-busy={pending || undefined}>
    <PageHeading>{step === "Review" ? "Review your email" : "Check Sent in Gmail"}</PageHeading>
    <PageText>To {draft.recipient}</PageText>
    <PageText>Subject {draft.subject || "No subject"}</PageText>
    <PageText className="whitespace-pre-wrap break-words">{draft.text}</PageText>
    {step === "Review" ? (
      <div className="flex gap-3">
        <Button variant="capsule" size="pill" disabled={pending} onClick={() => setStep("Edit")}>Edit draft</Button>
        <Button variant="prominent" size="pill" loading={pending} onClick={() => send(false)}>Confirm and send</Button>
      </div>
    ) : <>
      <RetryNotice role="status">Grace couldn’t confirm whether Gmail accepted this email. Check Sent before sending another copy.</RetryNotice>
      {draft.grant === grant && <Button variant="capsule" size="pill" loading={pending} onClick={() => send(true)}>Check send status</Button>}
    </>}
  </section>;
}

type AppointmentDraft = { title: string; start: string; end: string; location: string };
const repeatLabels = { Once: "Never", Weekly: "Every week", Monthly: "Every month" } satisfies Record<Recurrence, string>;
const repeatOptions = Object.entries(repeatLabels).map(([value, label]) => ({ value, label }));

function dateInput(time: Date) {
  return new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function AppointmentEditor({ event, selectedDay, seriesFor, proposal, reviewing, review, write, pending, close }: {
  event?: EventRow;
  selectedDay: number;
  seriesFor?: string;
  proposal?: { title: string; start: string; location: string; repeat: Recurrence };
  reviewing?: AppointmentChange;
  review: (change?: AppointmentChange) => void;
  write: (command: ManagedWrite) => void;
  pending: boolean;
  close: () => void;
}) {
  const [draft, setDraft] = useState<AppointmentDraft>(() => {
    const fresh = Math.max(Date.now(), instant(selectedDay, 10 * 60));
    return {
      title: proposal?.title ?? event?.title ?? "",
      start: proposal?.start ?? (event?.isAllDay ? event.startAt : dateInput(new Date(event?.startAt ?? fresh))),
      end: proposal
        ? dateInput(new Date(new Date(proposal.start).getTime() + (event ? Date.parse(event.endAt) - Date.parse(event.startAt) : 3600000)))
        : event?.isAllDay ? event.endAt : dateInput(new Date(event?.endAt ?? fresh + 3600000)),
      location: proposal?.location ?? event?.location ?? "",
    };
  });
  const [repeat, setRepeat] = useState<Recurrence>(proposal?.repeat ?? "Once");
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const update = (field: keyof AppointmentDraft, value: string) => setDraft((previous) => ({ ...previous, [field]: value }));
  const start = new Date(draft.start);
  const end = new Date(draft.end);
  const allDay = event?.isAllDay === true;
  const shifted = !allDay && end > start && (dateInput(start) !== draft.start || dateInput(end) !== draft.end);
  const valid = draft.title.trim() !== "" && end > start && !shifted;
  const reviewSave = () => {
    const update = { title: draft.title, location: draft.location, startAt: allDay ? draft.start : start.toISOString(),
      endAt: allDay ? draft.end : end.toISOString(), ...(allDay ? { allDay } : {}) };
    if (event?.etag) review({ kind: "appointment", action: "update", id: event.externalId, version: event.etag, seriesFor, event: update });
    else if (!event) review({ kind: "appointment", action: "create", event: {
      ...update, ...(repeat === "Once" ? {} : { repeat: { frequency: repeat, timeZone } }),
    } });
  };
  if (reviewing) {
    const removing = reviewing.action === "delete";
    const shown = reviewing.action === "delete" ? event : reviewing.event;
    const repeats = reviewing.action === "create" ? reviewing.event.repeat : undefined;
    const reviewedStart = new Date(shown?.startAt ?? "");
    return <section className="flex flex-col items-start gap-3" aria-busy={pending || undefined}>
      <PageHeading>{removing ? "Remove this appointment?" : "Review your appointment"}</PageHeading>
      {reviewing.action !== "create" && reviewing.seriesFor && <PageText>Entire series</PageText>}
      {reviewing.action !== "create" && reviewing.seriesFor && event?.timezone && <PageText tone="secondary">Series time zone {event.timezone}</PageText>}
      {repeats && <PageText>{repeatLabels[repeats.frequency]} · {repeats.timeZone}</PageText>}
      {repeats && skipsMonthsWithoutItsDay(repeats.frequency, reviewedStart.getDate()) && <PageText>Months without day {reviewedStart.getDate()} are skipped.</PageText>}
      <PageText>{shown?.title}</PageText>
      {removing && event ? <PageText>{day(event.startAt)} · {event.isAllDay ? "All day" : clock.format(new Date(event.startAt))}</PageText>
        : reviewing.action !== "delete" && (reviewing.event.allDay ? <PageText>{day(reviewing.event.startAt)} · All day, ends before {day(reviewing.event.endAt)}</PageText>
          : <PageText>{day(reviewing.event.startAt)} · {reviewedClock.format(reviewedStart)} to {day(reviewing.event.endAt)} · {reviewedClock.format(new Date(reviewing.event.endAt))}</PageText>)}
      <PageText>{shown?.location}</PageText>
      <div className="flex flex-wrap gap-3">
        <Button variant="capsule" size="pill" disabled={pending} onClick={() => review(undefined)}>Back</Button>
        <Button variant={removing ? "warn" : "prominent"} size="pill" loading={pending} onClick={() => write(reviewing)}>
          {removing ? "Confirm removal" : "Confirm appointment"}
        </Button>
      </div>
    </section>;
  }
  return <form className="flex flex-col items-start gap-3" onSubmit={(event) => {
    event.preventDefault();
    if (valid) reviewSave();
  }}>
    <PageHeading>{seriesFor ? "Edit entire series" : event ? "Edit appointment" : "New appointment"}</PageHeading>
    <label>Title<Input required maxLength={160} value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>
      <label>Start<Input type={allDay ? "date" : "datetime-local"} required value={draft.start} onChange={(event) => update("start", event.target.value)} /></label>
      <label>{allDay ? "Ends before" : "End"}<Input type={allDay ? "date" : "datetime-local"} required min={draft.start} value={draft.end} onChange={(event) => update("end", event.target.value)} /></label>
    {shifted && <PageText role="status">The clock changes at that time. Choose another start or end time.</PageText>}
      <label>Location<Input maxLength={320} value={draft.location} onChange={(event) => update("location", event.target.value)} /></label>
    {!event && <fieldset><legend>Repeats</legend><SegmentedControl aria-label="Repeats" size="sm" options={repeatOptions} value={repeat}
      onValueChange={(value) => { if (value === "Once" || value === "Weekly" || value === "Monthly") setRepeat(value); }} /></fieldset>}
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="capsule" size="pill" onClick={close}>Cancel</Button>
      {event?.etag && <Button type="button" variant="warn" size="pill" onClick={() => {
        if (event.etag) review({ kind: "appointment", action: "delete", id: event.externalId, version: event.etag, seriesFor });
      }}>Remove appointment</Button>}
      <Button type="submit" variant="prominent" size="pill" disabled={!valid}>Review appointment</Button>
    </div>
  </form>;
}

const folderNames: Record<ManagedFolder, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", trash: "Trash" };

function FolderList({ mail, choose, open, busy, children }: {
  mail: Extract<ManagedSnapshot, {kind: "mail"}>;
  choose: (folder: ManagedFolder, search: string) => void;
  open: (id: string) => void;
  busy: boolean;
  children: ReactNode;
}) {
  const [search, setSearch] = useState(mail.search);
  return <section data-sensitive="true" className="grid gap-4 md:grid-cols-[minmax(10rem,15rem)_1fr]">
    <MailFolderNav folder={mail.folder} counts={mail.counts && { inbox: mail.counts.inboxUnread, drafts: mail.counts.drafts }}
      onSelect={(folder) => { if (folder !== "outbox" && folder !== mail.folder) choose(folder, ""); }} />
    <div className="flex min-w-0 flex-col gap-4" aria-busy={busy || undefined}>
      <PageHeading>{folderNames[mail.folder]}</PageHeading>
      {children}
      <SearchField label="Search email" value={search} maxLength={512} onChange={(event) => {
        const text = event.target.value;
        setSearch(text);
        choose(mail.folder, text);
      }} />
      {search === mail.search && (mail.rows.length === 0
        ? <EmptyState title={search ? "No matching emails." : mail.folder === "inbox" ? "Your inbox is empty." : "No messages in this folder."} />
        : mail.rows.map((row) => <MailMessageRow key={row.externalId} from={{ name: row.from || "Unknown sender" }} subject={row.subject || "No subject"}
          time={day(row.receivedAt)} unread={row.isUnread} onOpen={busy ? undefined : () => open(row.externalId)} />))}
    </div>
  </section>;
}

function instantOf(value: string) {
  return Date.parse(value.length === 10 ? value + "T00:00:00" : value);
}

function Agenda({ calendar, today, move, open, busy, children }: {
  calendar: Extract<ManagedSnapshot, {kind: "calendar"}>;
  today: number;
  move: (kind: Navigation, day: number) => void;
  open: (id: string) => void;
  busy: boolean;
  children: ReactNode;
}) {
  const selected = calendar.window.selectedDay;
  const events = calendar.rows.toSorted((a, b) => instantOf(a.startAt) - instantOf(b.startAt));
  const between = (first: number, until: number) => events.filter((row) => instantOf(row.startAt) < midnight(until) && instantOf(row.endAt) > midnight(first));
  const grid = calendarGrid(calendar.window, today, (from, until) => between(from, until)[0], (kind, chosen = today) => () => move(kind, chosen));
  const week = calendar.window.mode === "WeekView";
  const selectedEvents = between(selected, selected + 1);
  const upcoming = events.filter((event) => instantOf(event.startAt) >= midnight(selected + 1) && instantOf(event.startAt) < midnight(selected + 15));
  const rows = (list: readonly EventRow[]) => list.map((event) => <CalendarEventRow key={event.externalId} title={event.title || "Untitled appointment"} dayLabel={day(event.startAt)}
    startLabel={start(event)} where={event.location || undefined} disabled={busy} onClick={() => open(event.externalId)} />);
  return <section data-sensitive="true" className="flex flex-col gap-4" aria-busy={busy || undefined}>
    <div className="flex flex-wrap items-center gap-3">
      <CalendarNav {...grid.nav} mode={week ? "week" : "month"} />
      <Button variant="capsule" size="pill" onClick={() => move("Today", today)}>Today</Button>
    </div>
    {week ? <CalendarWeekStrip days={grid.week} onSelect={grid.onSelectDay} /> : <CalendarMonth {...grid.month} onSelect={grid.onSelectDay} />}
    {children}
    {week && <>
      <PageHeading>{grid.dayHeading}</PageHeading>
      {selectedEvents.length ? rows(selectedEvents) : <PageText>No appointments this day.</PageText>}
      <PageHeading>Upcoming</PageHeading>
      {upcoming.length ? rows(upcoming) : <EmptyState title="No upcoming appointments." />}
    </>}
  </section>;
}

/** Grace's hosted read view for an Inbox or the primary Google calendar. */
export function ManagedRead({ view, now }: { view: ReadView; now: number }) {
  const runtime = useRuntime();
  const account = useMachine(runtime).state;
  type ReadCommand = Parameters<ManagedReads.Shape["send"]>[0];
  const [failed, setFailed] = useState<{ key: string; text: string; retry?: Extract<ReadCommand, {kind: "mailFolder"}> }>();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<{ key: string; event?: EventRow; seriesFor?: string }>();
  const [writeNotice, setWriteNotice] = useState<{ key: string; text: string; receipt?: WriteReceipt }>();
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(managedState, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  const snapshot = useSyncExternalStore(subscribe, () => runtime.runSync(Effect.flatMap(ManagedReads, (reads) => reads.get())));
  const run = (command: ReadCommand) => startTransition(async () => {
    setFailed(undefined);
    if (command.kind === "refresh") setWriteNotice(undefined);
    const result = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.send(command)));
    if (command.kind === "reminder") setWriteNotice({ key: projection, text: Exit.isSuccess(result) && result.value
      ? command.minutes === 0 ? "Reminder removed from your Grace account." : "Reminder choice saved. Your tablet schedules it when it reconnects."
      : "Grace couldn’t save that reminder choice." });
    else if (!Exit.isSuccess(result) || !result.value) setFailed({
      key: projection, retry: command.kind === "mailFolder" ? command : undefined,
      text: command.kind === "saveAttachment" || command.kind === "savePhotos" ? "Grace couldn’t save that to Files. Try again." : "Grace couldn’t open that. Try again.",
    });
    else setFailed(undefined);
  });
  const signedIn = account?.graceAccount.tag === "GraceSignedIn" ? account.graceAccount : undefined;
  const authorized = signedIn !== undefined && account !== undefined &&
    mayReadManaged(signedIn, account.googleLink, view === "Email" ? "ManagedEmail" : "ManagedCalendar");

  const link = account?.googleLink;
  const grant = link?.tag === "GoogleLinkConnected" ? link.grant : "";
  const accountId = signedIn?.accountId ?? "";
  const projection = JSON.stringify([view, accountId, grant]);
  const selectedMail = snapshot.kind === "mail" ? snapshot.selected : undefined;
  const mailProjection = JSON.stringify([projection, selectedMail?.message.externalId, selectedMail?.historyId]);
  const notice = writeNotice?.key === projection ? writeNotice : undefined;
  const exact = editor?.key === projection ? editor : undefined;
  const canTrash = signedIn && link && mayChangeManaged(signedIn, link, accountId, grant, "ManagedTrash");
  const canSchedule = signedIn && link && mayChangeManaged(signedIn, link, accountId, grant, "ManagedAppointmentChange");
  const editSeries = (occurrenceId: string) => startTransition(async () => {
    setWriteNotice(undefined);
    const result = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.series({ accountId, grant }, occurrenceId)));
    if (Exit.isSuccess(result) && result.value) {
      setEditor({ key: projection, event: result.value, seriesFor: occurrenceId });
    } else setWriteNotice({ key: projection, text: "Grace couldn’t open the repeating appointment." });
  });
  const proposalNumber = snapshot.kind === "calendar" ? snapshot.proposed?.number : undefined;
  const review = (change?: AppointmentChange) => startTransition(async () => {
    setWriteNotice(undefined);
    await runtime.runPromise(Effect.flatMap(ManagedReads, (reads) => reads.review({ accountId, grant }, change, proposalNumber)));
  });
  const write = (action: ManagedWrite) => startTransition(async () => {
    setWriteNotice(undefined);
    const out = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.change({ accountId, grant }, action, proposalNumber)));
    const receipt = Exit.isSuccess(out) ? out.value : undefined;
    if (action.kind === "appointment" && receipt) setEditor(undefined);
    const text = !receipt ? "Grace couldn’t confirm that change. Refresh to check what Google saved."
      : action.kind === "trash" ? "Moved to Trash."
        : action.kind === "undo" ? "Message restored."
          : action.action === "delete" ? "Appointment removed." : "Appointment saved.";
    setWriteNotice({ key: projection, text, receipt: action.kind === "trash" ? receipt : undefined });
  });
  const showNotice = notice && <div className="flex flex-wrap items-center gap-3">
    <PageText role="status">{notice.text}</PageText>
    {notice.receipt?.version && <Button variant="capsule" size="pill" disabled={pending} onClick={() => {
      const receipt = notice.receipt;
      if (receipt?.version) write({ kind: "undo", id: receipt.itemId, version: receipt.version, prior: receipt.operationId });
    }}>Undo</Button>}
    <Button variant="capsule" size="pill" disabled={pending} onClick={() => setWriteNotice(undefined)}>Dismiss</Button>
  </div>;

  if (snapshot.kind === "waiting" && snapshot.view === view) {
    if (snapshot.reason === "native") {
      return <EmptyState title={view === "Email" ? "Open email on Grace’s website" : "Open your calendar on Grace’s website"}>
        <Button variant="prominent" size="pill" loading={pending} onClick={() => run({ kind: "openHosted" })}>Open Grace</Button>
        {view === "Calendar" && <Button variant="capsule" size="pill" disabled={pending}
          onClick={() => run({ kind: "enableReminders" })}>Allow tablet reminders</Button>}
        {failed && <RetryNotice role="alert">Grace couldn’t finish that request.</RetryNotice>}
      </EmptyState>;
    }
    if (snapshot.reason === "connectorUnavailable") {
      return <RetryNotice role="status" retrying={pending} onRetry={() => run({ kind: "refresh" })}>
        {view === "Email" ? "Google mail isn’t available right now" : "Google Calendar isn’t available right now"}
      </RetryNotice>;
    }
    if (snapshot.reason === "unavailable") {
      return <RetryNotice role="status" retrying={pending} onRetry={() => run({ kind: "refresh" })}>Grace couldn’t check your account.</RetryNotice>;
    }
    if (snapshot.reason !== "checking") {
      const title = snapshot.reason === "mismatch" ? "Sign in with the Grace account on your tablet" :
        snapshot.reason === "signedOut" ? "Sign in to Grace" : view === "Email" ? "Connect Google mail" : "Connect Google Calendar";
      return <EmptyState title={title}><Button variant="prominent" size="pill" disabled={pending}
        onClick={() => run({ kind: "account" })}>Go to Account</Button></EmptyState>;
    }
  }

  if (snapshot.kind === "failed" && snapshot.view === view) {
    return <RetryNotice role="status" retrying={pending} onRetry={() => run({ kind: "refresh" })}>{view === "Email" ? "Your inbox couldn’t load." : "Your calendar couldn’t load."}</RetryNotice>;
  }

  if (!authorized || (snapshot.kind !== "mail" && snapshot.kind !== "calendar") ||
    snapshot.accountId !== signedIn?.accountId || snapshot.grant !== grant || (snapshot.kind === "mail") !== (view === "Email")) {
    return <PageText role="status">{view === "Email" ? "Opening your inbox…" : "Opening your calendar…"}</PageText>;
  }

  const back = <Button variant="capsule" size="pill" onClick={() => run({ kind: "back" })}>{snapshot.kind === "mail" ? `Back to ${folderNames[snapshot.folder]}` : "Back to calendar"}</Button>;
  const more = snapshot.next === null ? null :
    <Button variant="capsule" size="pill" loading={pending} onClick={() => run({ kind: "more" })}>Load more</Button>;
  const retry = failed?.retry;
  const problem = failed && (failed.key === projection || failed.key === mailProjection) && <RetryNotice role="alert" retrying={pending} onRetry={retry && (() => run(retry))}>{failed.text}</RetryNotice>;

  if (snapshot.kind === "mail") {
    const selected = snapshot.selected;
    const follow = (href: string, choice: "open" | "confirm" | "cancel") => startTransition(async () => {
      setFailed(undefined);
      const opened = await runtime.runPromise(Effect.flatMap(ManagedReads, (reads) => reads.chooseLink(snapshot, href, choice)));
      if (!opened) setFailed({ key: mailProjection, text: "This link couldn’t open. Reopen the email to check its current contents." });
    });
    const reviewLink = snapshot.linkReview?.link;
    const canFollow = actionableMailBody(selected) && !snapshot.replying && !snapshot.attachment && !snapshot.proposed;
    const suggested = snapshot.proposed?.proposal;
    const draft = suggested?.kind === "draft" ? snapshot.proposed : undefined;
    const photos = selected?.attachments.filter((part) => part.mimeType.startsWith("image/")) ?? [];
    const trashVersion = inboxTrashVersion(snapshot);
    const trash = suggested?.kind === "trash" && suggested.id === selected?.message.externalId;
    return selected ? (
      <section data-sensitive="true" className="flex flex-col items-start gap-4">
        {back}
        {showNotice}
        {problem}
        {canTrash && trashVersion && <Button variant="warn" size="pill" loading={pending}
          onClick={() => write({ kind: "trash", id: selected.message.externalId, version: trashVersion })}>{trash ? "Confirm move to Trash" : "Move to Trash"}</Button>}
        <PageHeading>{selected.message.subject || "No subject"}</PageHeading>
        <PageText>{selected.message.from || "Unknown sender"}</PageText>
        <PageText tone="secondary">{day(selected.message.receivedAt)}</PageText>
        {selected.message.labels?.includes("SPAM") && <Alert variant="caution">Gmail marked this message as spam.{selected.message.fromEmail && ` It was sent by ${selected.message.fromEmail}.`}</Alert>}
        <PageText className="w-full whitespace-pre-wrap">{selected.bodyTextAvailable ? messageLinkParts(selected.bodyText).map((part) => {
          if (typeof part === "string") return part;
          const { href } = part;
          return href && canFollow ? <MailLink key={part.start} onOpen={() => follow(href, "open")}>{part.text}</MailLink> : part.text;
        }) : "This email has no plain-text preview."}</PageText>
        {canFollow && reviewLink && <BrowserDialog title="Open this link?" tone="caution" onEscape={() => follow(reviewLink, "cancel")} actions={<>
          <Button variant="prominent" onClick={() => follow(reviewLink, "cancel")}>Stay in email</Button>
          <Button variant="capsule" loading={pending} onClick={() => follow(reviewLink, "confirm")}>Open in Browser</Button>
        </>}><BrowserDialogText className="break-all">{reviewLink}</BrowserDialogText></BrowserDialog>}
        {selected.attachments.length > 0 && <section aria-label="Attachments" aria-busy={pending || undefined} className="flex w-full flex-col gap-3">
          {Array.from(new Map(selected.attachments.map((part) => [JSON.stringify([part.partId, part.name, part.mimeType, part.size]), part]))).map(([key, part]) => (
            <MailAttachment key={key} name={part.name}
              kind={part.mimeType === "application/pdf" ? "PDF" : part.mimeType.startsWith("image/") ? "Image" : "File"}
              detail={part.supported && selected.historyId ? undefined : "Preview and download unavailable"}
              openDisabled={pending || !part.supported || !selected.historyId}
              openLabel="Open original" onOpen={() => run({ kind: "openAttachment", partId: part.partId })} />
          ))}
          {photos.length > 1 && selected.historyId && !/Android/i.test(navigator.userAgent) && (snapshot.photosSaved
            ? <PageText role="status">{snapshot.photosSaved} photos saved to Files</PageText>
            : <Button variant="capsule" size="pill" disabled={pending || photos.some((part) => !part.supported || part.size > 5 * 1024 * 1024)}
                onClick={() => run({ kind: "savePhotos" })}>Save all photos to Files</Button>)}
          {snapshot.attachment && <section aria-label="Original attachment" className="flex flex-col items-start gap-3">
            <PageHeading>{snapshot.attachment.name}</PageHeading>
            {snapshot.attachment.mimeType.startsWith("image/") &&
              <img src={snapshot.attachment.url} alt={snapshot.attachment.name} className="max-w-full rounded-lg" />}
            {snapshot.attachment.preview && <>
              <PageText className="whitespace-pre-wrap break-words">{snapshot.attachment.preview.text}</PageText>
              {snapshot.attachment.preview.truncated && <PageText tone="secondary">Download the original for the full text.</PageText>}
            </>}
            <div className="flex flex-wrap gap-3">
              {snapshot.attachment.mimeType === "application/pdf" &&
                <Button asChild variant="capsule" size="pill">
                  <a href={snapshot.attachment.url} target="_blank" rel="noopener noreferrer">Open PDF</a>
                </Button>}
              <Button asChild variant="prominent" size="pill">
                <a href={snapshot.attachment.url} download={snapshot.attachment.name}>Download original</a>
              </Button>
              {snapshot.attachment.file && !/Android/i.test(navigator.userAgent) && (snapshot.attachment.file.saved
                ? <PageText role="status">Saved to Files</PageText>
                : <Button variant="capsule" size="pill" disabled={pending} onClick={() => run({ kind: "saveAttachment" })}>Save to Files</Button>)}
              {snapshot.attachment.deviceTransfer && /Android/i.test(navigator.userAgent) &&
                <Button variant="capsule" size="pill" asChild>
                  <a href={`${webOrigin}/android/files/import#${snapshot.attachment.deviceTransfer}`} referrerPolicy="no-referrer">Save to Grace Files</a>
                </Button>}
              <Button variant="capsule" size="pill" onClick={() => run({ kind: "closeAttachment" })}>Close attachment</Button>
            </div>
          </section>}
        </section>}
        {selected.reply && signedIn && link?.tag === "GoogleLinkConnected" && maySendManagedMail(signedIn, link, snapshot.accountId, grant) && (
          <MailDraft key={JSON.stringify([accountId, grant, selected.message.externalId, draft?.number])} open={draft !== undefined} accountId={accountId} email={link.email}
            grant={grant} onEditing={(active) => runtime.runPromise(Effect.flatMap(ManagedReads, (reads) => reads.replyVisibility(snapshot, active)))}
            reply={{ ...selected.reply, source: selected.message.externalId }} />
        )}
      </section>
    ) : (
      <FolderList key={JSON.stringify([projection, snapshot.folder])} mail={snapshot} busy={pending}
        choose={(folder, search) => run({ kind: "mailFolder", accountId, grant, folder, search })} open={(id) => run({ kind: "open", id })}>
        {showNotice}
        {signedIn && account?.googleLink.tag === "GoogleLinkConnected" &&
          maySendManagedMail(signedIn, account.googleLink, snapshot.accountId, account.googleLink.grant) && (
          <MailDraft key={JSON.stringify([snapshot.accountId, account.googleLink.email, account.googleLink.grant, draft?.number])} open={draft !== undefined}
            accountId={snapshot.accountId} email={account.googleLink.email} grant={account.googleLink.grant} />
        )}
        {problem}
        {more}
      </FolderList>
    );
  }

  const staged = snapshot.proposed;
  if (canSchedule && staged) {
    const suggestion = staged.proposal;
    if (suggestion.kind === "appointment" || suggestion.kind === "removeAppointment") {
      const series = suggestion.kind === "removeAppointment" && suggestion.series ? suggestion.id : undefined;
      const target = series ? snapshot.series : suggestion.id ? snapshot.selected : undefined;
      return <section data-sensitive="true">
        <AppointmentEditor key={staged.number} selectedDay={snapshot.window.selectedDay} event={target} seriesFor={series} reviewing={snapshot.reviewing} review={review}
          proposal={suggestion.kind === "appointment" ? suggestion : undefined} write={write} pending={pending} close={() => run({ kind: "dismissProposal" })} />
      </section>;
    }
  }
  if (canSchedule && exact) return <section data-sensitive="true">
    <AppointmentEditor selectedDay={snapshot.window.selectedDay} event={exact.event} seriesFor={exact.seriesFor} reviewing={snapshot.reviewing} review={review} write={write} pending={pending} close={() => setEditor(undefined)} />
  </section>;
  const event = snapshot.selected;
  return event ? (
    <section data-sensitive="true" className="flex flex-col items-start gap-4">
      {back}
      {showNotice}
      {canSchedule && event.etag && event.editable && <Button variant="capsule" size="pill"
        onClick={() => setEditor({ key: projection, event })}>{event.seriesId ? "Change this occurrence" : "Change appointment"}</Button>}
      {canSchedule && event.seriesId && event.editable && <Button variant="capsule" size="pill" loading={pending}
        onClick={() => editSeries(event.externalId)}>Change entire series</Button>}
      <PageHeading>{event.title || "Untitled appointment"}</PageHeading>
      <PageText>{day(event.startAt)} · {start(event)}</PageText>
      {event.location && <PageText>{event.location}</PageText>}
      {event.editable && !event.isAllDay && event.etag && <fieldset>
        <legend>Reminder on Grace</legend>
        {([["One hour before", 60], ["One day before", 1440], ["Remove reminder", 0]] as const).map(([label, minutes]) =>
          <Button key={minutes} variant="capsule" size="pill" disabled={pending} onClick={() => {
            if (event.etag) run({ kind: "reminder", id: event.externalId, version: event.etag, minutes });
          }}>{label}</Button>)}
      </fieldset>}
      {event.description && <PageText className="w-full whitespace-pre-wrap">{event.description}</PageText>}
    </section>
  ) : (
    <Agenda calendar={snapshot} today={dayOf(now)} busy={pending} move={(move, day) => run({ kind: "calendarWindow", accountId, grant, move, day })} open={(id) => run({ kind: "open", id })}>
      {showNotice}
      {canSchedule && <Button variant="prominent" size="pill" onClick={() => setEditor({ key: projection })}>New appointment</Button>}
      {problem}
      {more}
    </Agenda>
  );
}
