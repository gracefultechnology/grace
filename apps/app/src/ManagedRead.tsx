// spec/app/setup.md, "Story: Read the Google mail and calendar I connected"
import { Button, CalendarEventRow, EmptyState, Input, MailMessageRow, PageHeading, PageText, RetryNotice, SegmentedControl, Textarea } from "@repo/ui";
import { Effect, Exit, Stream } from "effect";
import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { useMachine } from "../gen/app__setup.react.ts";
import type { Recurrence } from "../gen/app__calendar.ts";
import { mayChangeManaged, mayReadManaged, maySendManagedMail } from "../gen/app__setup.ts";
import { keepMailDraft, localMailDraft, ManagedReads, type EventRow, type LocalMailDraft, type MailReply, type ManagedWrite, type ReadView, type WriteReceipt } from "./managedReads.vibe";
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

function MailDraft({ accountId, email, grant, reply, open }: {
  accountId: string; email: string; grant: string; open?: boolean; reply?: MailReply & { source: string };
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
      setStep("Sent");
    } else setStep("Uncertain");
  });
  if (step === "Inbox" || step === "Sent") return <div className="flex flex-col items-start gap-3">
    {step === "Sent" && <PageText role="status">Gmail accepted your email.</PageText>}
    <Button variant="prominent" size="pill" onClick={() => setStep("Edit")}>
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
      <Button type="button" variant="capsule" size="pill" onClick={() => setStep("Inbox")}>Close draft</Button>
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

function AppointmentEditor({ event, seriesFor, proposal, remove, write, pending, close }: {
  event?: EventRow;
  seriesFor?: string;
  proposal?: { title: string; start: string; location: string; repeat: Recurrence };
  remove?: boolean;
  write: (command: ManagedWrite) => void;
  pending: boolean;
  close: () => void;
}) {
  const [draft, setDraft] = useState<AppointmentDraft>(() => ({
    title: proposal?.title ?? event?.title ?? "",
    start: proposal?.start ?? (event?.isAllDay ? event.startAt : dateInput(event ? new Date(event.startAt) : new Date())),
    end: proposal
      ? dateInput(new Date(new Date(proposal.start).getTime() + (event ? Date.parse(event.endAt) - Date.parse(event.startAt) : 3600000)))
      : event?.isAllDay ? event.endAt : dateInput(event ? new Date(event.endAt) : new Date(Date.now() + 3600000)),
    location: proposal?.location ?? event?.location ?? "",
  }));
  const [review, setReview] = useState<"save" | "delete" | undefined>(remove ? "delete" : undefined);
  const [repeat, setRepeat] = useState<Recurrence>(proposal?.repeat ?? "Once");
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const update = (field: keyof AppointmentDraft, value: string) => setDraft((previous) => ({ ...previous, [field]: value }));
  const start = new Date(draft.start);
  const end = new Date(draft.end);
  const allDay = event?.isAllDay === true;
  const shifted = !allDay && end > start && (dateInput(start) !== draft.start || dateInput(end) !== draft.end);
  const valid = draft.title.trim() !== "" && end > start && !shifted;
  const confirm = () => {
    if (review === "delete") {
      if (event?.etag) write({ kind: "appointment", action: "delete", id: event.externalId, version: event.etag, seriesFor });
      return;
    }
    if (!valid) return;
    const update = { title: draft.title, location: draft.location, startAt: allDay ? draft.start : start.toISOString(),
      endAt: allDay ? draft.end : end.toISOString(), ...(allDay ? { allDay } : {}) };
    if (event?.etag) write({ kind: "appointment", action: "update", id: event.externalId, version: event.etag, seriesFor, event: update });
    else if (!event) write({ kind: "appointment", action: "create", event: {
      ...update, ...(repeat === "Once" ? {} : { repeat: { frequency: repeat, timeZone } }),
    } });
  };
  if (review !== undefined) return <section className="flex flex-col items-start gap-3" aria-busy={pending || undefined}>
    <PageHeading>{review === "delete" ? "Remove this appointment?" : "Review your appointment"}</PageHeading>
    {seriesFor && <PageText>Entire series</PageText>}
    {seriesFor && event?.timezone && <PageText tone="secondary">Series time zone {event.timezone}</PageText>}
    {!event && repeat !== "Once" && <PageText>{repeatLabels[repeat]} · {timeZone}</PageText>}
    {!event && repeat === "Monthly" && start.getDate() > 28 && <PageText>Months without day {start.getDate()} are skipped.</PageText>}
    <PageText>{review === "delete" ? event?.title : draft.title}</PageText>
    {review === "delete" && event ? <PageText>{day(event.startAt)} · {event.isAllDay ? "All day" : clock.format(new Date(event.startAt))}</PageText>
      : allDay ? <PageText>{day(draft.start)} · All day, ends before {day(draft.end)}</PageText>
        : <PageText>{day(start.toISOString())} · {reviewedClock.format(start)} to {day(end.toISOString())} · {reviewedClock.format(end)}</PageText>}
    <PageText>{review === "delete" ? event?.location : draft.location}</PageText>
    <div className="flex flex-wrap gap-3">
      <Button variant="capsule" size="pill" disabled={pending} onClick={() => setReview(undefined)}>Back</Button>
      <Button variant={review === "delete" ? "warn" : "prominent"} size="pill" loading={pending} onClick={confirm}>
        {review === "delete" ? "Confirm removal" : "Confirm appointment"}
      </Button>
    </div>
  </section>;
  return <form className="flex flex-col items-start gap-3" onSubmit={(event) => {
    event.preventDefault();
    if (valid) setReview("save");
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
      {event && <Button type="button" variant="warn" size="pill" onClick={() => setReview("delete")}>Remove appointment</Button>}
      <Button type="submit" variant="prominent" size="pill" disabled={!valid}>Review appointment</Button>
    </div>
  </form>;
}

/** Grace's hosted read view for an Inbox or the primary Google calendar. */
export function ManagedRead({ view }: { view: ReadView }) {
  const runtime = useRuntime();
  const account = useMachine(runtime).state;
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<{ key: string; event?: EventRow; seriesFor?: string }>();
  const [writeNotice, setWriteNotice] = useState<{ key: string; text: string; receipt?: WriteReceipt }>();
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(managedState, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  const snapshot = useSyncExternalStore(subscribe, () => runtime.runSync(Effect.flatMap(ManagedReads, (reads) => reads.get())));
  const run = (command: Parameters<ManagedReads.Shape["send"]>[0]) => startTransition(async () => {
    setFailed(false);
    if (command.kind === "refresh") setWriteNotice(undefined);
    const result = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.send(command)));
    if (!Exit.isSuccess(result) || !result.value) setFailed(true);
  });
  const signedIn = account?.graceAccount.tag === "GraceSignedIn" ? account.graceAccount : undefined;
  const authorized = signedIn !== undefined && account !== undefined &&
    mayReadManaged(signedIn, account.googleLink, view === "Email" ? "ManagedEmail" : "ManagedCalendar");

  const link = account?.googleLink;
  const grant = link?.tag === "GoogleLinkConnected" ? link.grant : "";
  const accountId = signedIn?.accountId ?? "";
  const projection = JSON.stringify([view, accountId, grant]);
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
  const write = (action: ManagedWrite) => startTransition(async () => {
    setWriteNotice(undefined);
    const out = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.change({ accountId, grant }, action)));
    const receipt = Exit.isSuccess(out) ? out.value : undefined;
    if (action.kind === "appointment") {
      setEditor(undefined);
      await runtime.runPromise(Effect.flatMap(ManagedReads, (reads) => reads.send({ kind: "dismissProposal" })));
    }
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
        {failed && <RetryNotice role="alert">Grace’s website couldn’t open.</RetryNotice>}
      </EmptyState>;
    }
    if (snapshot.reason === "connectorUnavailable") {
      return <EmptyState title={view === "Email" ? "Google mail isn’t available right now" : "Google Calendar isn’t available right now"} role="status" />;
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

  const back = <Button variant="capsule" size="pill" onClick={() => run({ kind: "back" })}>{view === "Email" ? "Back to Inbox" : "Back to calendar"}</Button>;
  const more = snapshot.next === null ? null :
    <Button variant="capsule" size="pill" loading={pending} onClick={() => run({ kind: "more" })}>Load more</Button>;
  const problem = failed && <RetryNotice role="alert">Grace couldn’t open that. Try again.</RetryNotice>;

  if (snapshot.kind === "mail") {
    const selected = snapshot.selected;
    const suggested = snapshot.proposed?.proposal;
    const draft = suggested?.kind === "draft" ? snapshot.proposed : undefined;
    const trash = suggested?.kind === "trash" && suggested.id === selected?.message.externalId;
    return selected ? (
      <section data-sensitive="true" className="flex flex-col items-start gap-4">
        {back}
        {showNotice}
        {canTrash && selected.message.metadata?.historyId && <Button variant="warn" size="pill" loading={pending} onClick={() => {
          const version = selected.message.metadata?.historyId;
          if (version) write({ kind: "trash", id: selected.message.externalId, version });
        }}>{trash ? "Confirm move to Trash" : "Move to Trash"}</Button>}
        <PageHeading>{selected.message.subject || "No subject"}</PageHeading>
        <PageText>{selected.message.from || "Unknown sender"}</PageText>
        <PageText tone="secondary">{day(selected.message.receivedAt)}</PageText>
        <PageText className="w-full whitespace-pre-wrap">{selected.bodyTextAvailable ? selected.bodyText : "This email has no plain-text preview."}</PageText>
        {selected.reply && signedIn && link?.tag === "GoogleLinkConnected" && maySendManagedMail(signedIn, link, snapshot.accountId, grant) && (
          <MailDraft key={JSON.stringify([accountId, grant, selected.message.externalId, draft?.number])} open={draft !== undefined} accountId={accountId} email={link.email}
            grant={grant} reply={{ ...selected.reply, source: selected.message.externalId }} />
        )}
      </section>
    ) : (
      <section data-sensitive="true" className="flex flex-col gap-4" aria-busy={pending || undefined}>
        <PageHeading>Inbox</PageHeading>
        {showNotice}
        {signedIn && account?.googleLink.tag === "GoogleLinkConnected" &&
          maySendManagedMail(signedIn, account.googleLink, snapshot.accountId, account.googleLink.grant) && (
          <MailDraft key={JSON.stringify([snapshot.accountId, account.googleLink.email, account.googleLink.grant, draft?.number])} open={draft !== undefined}
            accountId={snapshot.accountId} email={account.googleLink.email} grant={account.googleLink.grant} />
        )}
        {snapshot.rows.length === 0 && <EmptyState title="Your inbox is empty." />}
        {snapshot.rows.map((row) => (
          <MailMessageRow key={row.externalId} from={{ name: row.from || "Unknown sender" }} subject={row.subject || "No subject"}
            time={day(row.receivedAt)} unread={row.isUnread} onOpen={pending ? undefined : () => run({ kind: "open", id: row.externalId })} />
        ))}
        {problem}
        {more}
      </section>
    );
  }

  const staged = snapshot.proposed;
  if (canSchedule && staged) {
    const suggestion = staged.proposal;
    if (suggestion.kind === "appointment" || suggestion.kind === "removeAppointment") {
      const series = suggestion.kind === "removeAppointment" && suggestion.series ? suggestion.id : undefined;
      const target = series ? snapshot.series : suggestion.id ? snapshot.selected : undefined;
      return <section data-sensitive="true">
        <AppointmentEditor key={staged.number} event={target} seriesFor={series} remove={suggestion.kind === "removeAppointment"}
          proposal={suggestion.kind === "appointment" ? suggestion : undefined} write={write} pending={pending} close={() => run({ kind: "dismissProposal" })} />
      </section>;
    }
  }
  if (canSchedule && exact) return <section data-sensitive="true">
    <AppointmentEditor event={exact.event} seriesFor={exact.seriesFor} write={write} pending={pending} close={() => setEditor(undefined)} />
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
      {event.description && <PageText className="w-full whitespace-pre-wrap">{event.description}</PageText>}
    </section>
  ) : (
    <section data-sensitive="true" className="flex flex-col gap-4" aria-busy={pending || undefined}>
      <PageHeading>Upcoming</PageHeading>
      {showNotice}
      {canSchedule && <Button variant="prominent" size="pill" onClick={() => setEditor({ key: projection })}>New appointment</Button>}
      {snapshot.rows.length === 0 && <EmptyState title="No upcoming appointments." />}
      {snapshot.rows.map((event) => (
        <CalendarEventRow key={event.externalId} title={event.title || "Untitled appointment"} dayLabel={day(event.startAt)}
          startLabel={start(event)} where={event.location || undefined} disabled={pending} onClick={() => run({ kind: "open", id: event.externalId })} />
      ))}
      {problem}
      {more}
    </section>
  );
}
