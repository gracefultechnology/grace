# The calendar entry a booked visit proposes

When a [commitment](./commitment.md) to book a visit ends confirmed and its outcome is saved, Grace offers to add the visit to the person's calendar. This library is that offer: whether a commitment may propose an entry, and the entry it proposes. It reads the booked terms of the commitment, never the facts the visit was read from, and names no kind library. The entry it proposes is only a proposal: it enters the calendar through the [calendar view](./calendarView.md)'s own confirmed appointment, with the person's yes to that exact entry, and nothing here writes to the calendar.

## Story: Add my booked visit to my calendar

> As a person who booked a visit with Grace, I want her to offer it for my calendar at exactly the time I booked, and only once the booking is confirmed and saved, so that my calendar never shows a visit that may not have happened.

### Only a booking confirmed by its provider and saved proposes a calendar entry

A commitment proposes an entry only when it books a visit for a whole subject (owner, website, account and reference), its terms are a whole booking, its outcome is positive (scheduled, accepted or completed) and that outcome is saved exactly as observed. An outcome still unknown or pending, a failed or returned booking, an outcome not yet saved and a paid bill propose nothing.

Discovered by the proof: without a whole subject the proposed entry would have no owner or occurrence, and the calendar would refuse it.

```quint
import task as T from "./task"
import commitment as CM from "./commitment"
import calendar as C from "./calendar"
import calendarView as CV from "./calendarView"
pure def recordAllowed(booked: CM::Commitment): bool =
  T::validKey(booked.key) and T::recordsInCalendar(booked.key.kind) and T::validTerms(booked.key.kind, booked.proposal) and
  CM::positiveOutcome(booked.result) and not(CM::outcomeNeedsSave(booked))
pure def lawUnsavedOrUncertainOutcomeRecordsNothing(booked: CM::Commitment): bool =
  (booked.result == CM::Unknown or booked.result == CM::Pending or CM::outcomeNeedsSave(booked) or
    not(T::recordsInCalendar(booked.key.kind))) implies not(recordAllowed(booked))
pure val bookedVisit: CM::Commitment = {
  ...CM::initial, key: CM::bookingKey, proposal: CM::bookingTerms, stage: CM::Resolved, result: CM::Scheduled,
  revision: 3, evidence: "confirmation-email", attempt: 1, dispatched: true, reference: "confirmation",
  durable: { result: CM::Scheduled, evidence: "confirmation-email", reference: "confirmation" }
}
pure val bookedValues = Set(bookedVisit,
  { ...bookedVisit, result: CM::Accepted, durable: { ...bookedVisit.durable, result: CM::Accepted } },
  { ...bookedVisit, durable: { result: CM::Unknown, evidence: "portal", reference: "" } },
  { ...bookedVisit, stage: CM::Checking, result: CM::Pending, reference: "",
    durable: { result: CM::Pending, evidence: "confirmation-email", reference: "" } },
  { ...bookedVisit, stage: CM::Checking, result: CM::Unknown, reference: "",
    durable: { result: CM::Unknown, evidence: "confirmation-email", reference: "" } },
  { ...bookedVisit, result: CM::Returned, reference: "", durable: { result: CM::Returned, evidence: "confirmation-email", reference: "" } },
  { ...bookedVisit, key: CM::exampleKey, proposal: CM::exampleTerms },
  { ...bookedVisit, proposal: T::NoTerms })
```

### The proposed entry is an appointment at exactly the booked time

The entry is an appointment of the person who booked, in the calendar she chooses, with the visit's reference as its occurrence and the provider's confirmation as its source. It is titled with the booked service, placed at the booked venue, starts at the booked start, an instant as the calendar counts it in milliseconds, and ends the booked number of minutes later, in the time zone she chooses. It happens once and reminds her an hour before. Given a calendar and a time zone, it is an entry the calendar accepts.

```quint
pure val minuteLength = 60000
pure val reminderLead = 3600000
pure val noSlot: T::Slot = { start: 0, minutes: 0, venue: "" }
pure def bookedService(booked: CM::Commitment): str =
  val terms = booked.proposal
  match terms {
    | NoTerms => ""
    | PayTerms(x) => ""
    | BookTerms(x) => x.book.service
    | WalkthroughTerms(x) => ""
  }
pure def bookedSlot(booked: CM::Commitment): T::Slot =
  val terms = booked.proposal
  match terms {
    | NoTerms => noSlot
    | PayTerms(x) => noSlot
    | BookTerms(x) => x.book.slot
    | WalkthroughTerms(x) => noSlot
  }
pure def appointmentFor(booked: CM::Commitment, calendarId: str, timezone: str): CV::EntrySeed = {
  identity: { ...C::noIdentity, owner: booked.key.owner, calendarId: calendarId, occurrenceId: booked.key.ref,
    sourceRef: booked.reference, kind: C::Appointment },
  details: { ...C::noDetails, title: bookedService(booked), location: bookedSlot(booked).venue,
    startAt: bookedSlot(booked).start, endAt: bookedSlot(booked).start + bookedSlot(booked).minutes * minuteLength,
    timezone: timezone, recurrence: C::Once, reminderEnabled: true, leadTime: reminderLead }
}
pure def lawRecordCarriesTheBookedTime(booked: CM::Commitment, calendarId: str, timezone: str): bool =
  val entry = appointmentFor(booked, calendarId, timezone)
  recordAllowed(booked) implies
    entry.identity.kind == C::Appointment and entry.identity.owner == booked.key.owner and
    entry.identity.occurrenceId == booked.key.ref and entry.identity.sourceRef == booked.reference and
    entry.details.startAt == bookedSlot(booked).start and
    entry.details.endAt == bookedSlot(booked).start + bookedSlot(booked).minutes * minuteLength and
    entry.details.title == bookedService(booked) and entry.details.timezone == timezone and
    ((calendarId != "" and timezone != "") implies (C::validIdentity(entry.identity) and C::validDetails(entry.details)))
```
