// spec/app/setup.md, "Story: Read the Google mail and calendar I connected"
import { Button, CalendarEventRow, EmptyState, MailMessageRow, PageHeading, PageText, RetryNotice } from "@repo/ui";
import { Effect, Exit, Stream } from "effect";
import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { useMachine } from "../gen/app__setup.react.ts";
import { mayReadManaged } from "../gen/app__setup.ts";
import { ManagedReads, type EventRow, type ReadView } from "./managedReads.vibe";
import { useRuntime } from "./useApp.ts";

const calendarDay = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const clock = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

function day(value: string) {
  return calendarDay.format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
}

function start(event: EventRow) {
  return event.isAllDay ? "All day" : clock.format(new Date(event.startAt));
}

const managedState = Stream.unwrap(Effect.map(ManagedReads, (reads) => reads.state));

/** Grace's hosted read view for an Inbox or the primary Google calendar. */
export function ManagedRead({ view }: { view: ReadView }) {
  const runtime = useRuntime();
  const account = useMachine(runtime).state;
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(managedState, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  const snapshot = useSyncExternalStore(subscribe, () => runtime.runSync(Effect.flatMap(ManagedReads, (reads) => reads.get())));
  const run = (command: Parameters<ManagedReads.Shape["send"]>[0]) => startTransition(async () => {
    setFailed(false);
    const result = await runtime.runPromiseExit(Effect.flatMap(ManagedReads, (reads) => reads.send(command)));
    if (!Exit.isSuccess(result) || !result.value) setFailed(true);
  });
  const signedIn = account?.graceAccount.tag === "GraceSignedIn" ? account.graceAccount : undefined;
  const authorized = signedIn !== undefined && account !== undefined &&
    mayReadManaged(signedIn, account.googleLink, view === "Email" ? "ManagedEmail" : "ManagedCalendar");

  if (snapshot.kind === "waiting" && snapshot.view === view) {
    if (snapshot.reason === "native") {
      return <EmptyState title={view === "Email" ? "Open email on Grace’s website" : "Open your calendar on Grace’s website"}>
        <Button variant="prominent" size="pill" loading={pending} onClick={() => run({ kind: "openHosted" })}>Open Grace</Button>
        {failed && <RetryNotice role="alert">Grace’s website couldn’t open.</RetryNotice>}
      </EmptyState>;
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
    snapshot.accountId !== signedIn?.accountId || (snapshot.kind === "mail") !== (view === "Email")) {
    return <PageText role="status">{view === "Email" ? "Opening your inbox…" : "Opening your calendar…"}</PageText>;
  }

  const back = <Button variant="capsule" size="pill" onClick={() => run({ kind: "back" })}>{view === "Email" ? "Back to Inbox" : "Back to calendar"}</Button>;
  const more = snapshot.next === null ? null :
    <Button variant="capsule" size="pill" loading={pending} onClick={() => run({ kind: "more" })}>Load more</Button>;
  const problem = failed && <RetryNotice role="alert">Grace couldn’t open that. Try again.</RetryNotice>;

  if (snapshot.kind === "mail") {
    const selected = snapshot.selected;
    return selected ? (
      <section data-sensitive="true" className="flex flex-col items-start gap-4">
        {back}
        <PageHeading>{selected.message.subject || "No subject"}</PageHeading>
        <PageText>{selected.message.from || "Unknown sender"}</PageText>
        <PageText tone="secondary">{day(selected.message.receivedAt)}</PageText>
        <PageText className="w-full whitespace-pre-wrap">{selected.bodyTextAvailable ? selected.bodyText : "This email has no plain-text preview."}</PageText>
      </section>
    ) : (
      <section data-sensitive="true" className="flex flex-col gap-4" aria-busy={pending || undefined}>
        <PageHeading>Inbox</PageHeading>
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

  const event = snapshot.selected;
  return event ? (
    <section data-sensitive="true" className="flex flex-col items-start gap-4">
      {back}
      <PageHeading>{event.title || "Untitled appointment"}</PageHeading>
      <PageText>{day(event.startAt)} · {start(event)}</PageText>
      {event.location && <PageText>{event.location}</PageText>}
      {event.description && <PageText className="w-full whitespace-pre-wrap">{event.description}</PageText>}
    </section>
  ) : (
    <section data-sensitive="true" className="flex flex-col gap-4" aria-busy={pending || undefined}>
      <PageHeading>Upcoming</PageHeading>
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
