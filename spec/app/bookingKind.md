# Booking a visit, as one kind of task

What makes a task an appointment booking: the facts read from the provider's signed-in booking portal and from her calendar, when they are whole, where the visit stands, which booking fits it, what Grace may type for it and which booking she may suggest. The [registry of kinds](./taskKinds.md) is the only reader of a visit's own fields; the [preparation](./prep.md) and the [commitment](./commitment.md) never read them. The preparation and its [review](./taskBridge.md) import this library only so that the visit's types can be named. Grace books only on a portal the person is signed in to, as every task's access step requires, and never books a visit that asks for payment to book: she explains and the person may book it herself.

## Story: Read a visit and judge a booking against it

> As a person booking a visit, I want the times the provider offers and what my calendar says about them kept exactly, a clash never taken without my word, only the details the form asks for shared, and a booking accepted only if it fits that visit.

### A visit's facts name the service and its offered times, and whole facts keep a price that is not shown apart from free

The facts name the service, the practitioner, the time zone of the offered times, each offered time as a start, a positive length and a place, whether the website shows a price and the price, what personal details the form asks for, whether this visit is already booked, whether online booking is open and whether booking asks for a payment first. They also hold what her calendar said: whether it was read, which offered times clash with something already on it, and the reference of the calendar read. Whole facts have a service and a time zone, offered times that start and last, a price that is zero unless one is shown and in a currency when above zero, no unnamed detail asked, a calendar reference when the calendar was read, no clash when it was not, and clashes only among the offered times.

```quint
import task as T from "./task"
type VisitFacts = {
  service: str, practitioner: str, timezone: str, slots: List[T::Slot],
  priced: bool, cost: int, currency: str, asks: List[str],
  alreadyBooked: bool, bookingOpen: bool, prepayment: bool,
  diaryRead: bool, busy: List[T::Slot], diaryRef: str
}
pure def validVisit(facts: VisitFacts): bool =
  facts.service != "" and facts.timezone != "" and facts.slots.every(s => s.start > 0 and s.minutes > 0) and
  facts.cost >= 0 and (facts.priced or facts.cost == 0) and (facts.cost > 0 implies facts.currency != "") and
  facts.asks.every(a => a != "") and (facts.diaryRead implies facts.diaryRef != "") and
  (not(facts.diaryRead) implies facts.busy.length() == 0) and facts.busy.every(s => facts.slots.includes(s))
pure val sampleClashSlot: T::Slot = { start: 10, minutes: 30, venue: "clinic" }
pure val sampleOpenSlot: T::Slot = { start: 14, minutes: 30, venue: "clinic" }
pure val sampleVisit: VisitFacts = {
  service: "follow-up", practitioner: "Dr. Patel", timezone: "America/New_York",
  slots: List(sampleClashSlot, sampleOpenSlot), priced: false, cost: 0, currency: "", asks: List("name", "phone"),
  alreadyBooked: false, bookingOpen: true, prepayment: false,
  diaryRead: true, busy: List(sampleClashSlot), diaryRef: "calendar"
}
pure val factsValues = Set(sampleVisit,
  { ...sampleVisit, alreadyBooked: true },
  { ...sampleVisit, prepayment: true, priced: true, cost: 2500, currency: "USD" },
  { ...sampleVisit, bookingOpen: false },
  { ...sampleVisit, slots: List(), busy: List() },
  { ...sampleVisit, diaryRead: false, busy: List(), diaryRef: "" },
  { ...sampleVisit, asks: List("name", "insurance number") },
  { ...sampleVisit, priced: true, cost: 4000, currency: "USD", busy: List() },
  { ...sampleVisit, service: "", cost: 5 })
```

### A visit is already booked, can be booked, or cannot be booked online for a stated reason

A visit already booked is under way and is looked into before anything new. A visit never has nothing to do. It can be booked online only when booking is open, no payment is asked first, at least one time is offered and the form asks only for details Grace can share: name, phone or address. Otherwise the reason says which is missing, a payment asked first before anything else.

```quint
pure def underWay(facts: VisitFacts): bool = facts.alreadyBooked
pure def asksOnlySharable(facts: VisitFacts): bool = facts.asks.every(a => T::bookingDetails.contains(a))
pure def bookable(facts: VisitFacts): bool =
  facts.bookingOpen and not(facts.prepayment) and facts.slots.length() > 0 and asksOnlySharable(facts)
pure def whyNot(facts: VisitFacts): str =
  if (facts.prepayment) "This visit asks for payment to book"
  else if (not(facts.bookingOpen)) "Online booking is unavailable"
  else if (facts.slots.length() == 0) "No times are offered"
  else if (not(asksOnlySharable(facts))) "The form asks for details Grace cannot share" else ""
```

### A booking fits a visit only for one of its offered times, at its price, sharing exactly the details asked, after her calendar was read

The booking is valid, for the visit's service, at one of the offered times, with the price shown or no price, and shares exactly the details the form asks for. A visit already booked or one that cannot be booked online takes no booking.

```quint
pure def bookingFits(facts: VisitFacts, book: T::Booking): bool =
  bookable(facts) and not(facts.alreadyBooked) and T::validBooking(book) and book.service == facts.service and
  facts.slots.includes(book.slot) and book.priced == facts.priced and book.cost == facts.cost and
  book.currency == facts.currency and book.shares.every(a => facts.asks.includes(a)) and
  facts.asks.every(a => book.shares.includes(a)) and facts.diaryRead and
  (facts.busy.includes(book.slot) implies book.acceptsClash)
pure def lawUnreadDiaryNeverFits(facts: VisitFacts, book: T::Booking): bool =
  not(facts.diaryRead) implies not(bookingFits(facts, book))
pure def lawOnlyAskedDetailsAreShared(facts: VisitFacts, book: T::Booking): bool =
  bookingFits(facts, book) implies book.shares.every(a => facts.asks.includes(a))
```

### A time that clashes with her calendar is booked only with her word that the clash is fine

Her [preparation](./prep.md) accepts a clash only from her explicit answer for the offered slot, current visit version and the calendar read that identified it. The choice carries that approval forward to review.

```quint
pure def lawAClashNeedsHerWord(facts: VisitFacts, book: T::Booking): bool =
  (bookingFits(facts, book) and facts.busy.includes(book.slot)) implies book.acceptsClash
```

### A visit that asks for payment to book is never booked by Grace

Grace explains that the visit asks for a payment and stops; the person may book it herself.

```quint
pure def lawAVisitThatAsksForMoneyIsNotBooked(facts: VisitFacts, book: T::Booking): bool =
  facts.prepayment implies not(bookingFits(facts, book))
```

### Grace fills a booking's form with the chosen time and the kinds of detail asked only

The values of her details come from her saved details when the form is filled, never from the review; the price is read back from the form, never typed by Grace.

```quint
type VisitFill = { slot: T::Slot, details: List[str] }
pure def visitFill(book: T::Booking): VisitFill = { slot: book.slot, details: book.shares }
```

### A booking is suggested only when her calendar was read and exactly one offered time is free

The suggestion is that free time, for the visit's service and price, sharing the details asked, with no clash to accept.

```quint
pure def freeSlots(facts: VisitFacts): List[T::Slot] = facts.slots.select(s => not(facts.busy.includes(s)))
pure def onlyFreeSlot(facts: VisitFacts): bool = facts.diaryRead and freeSlots(facts).length() == 1
pure def suggestedBooking(facts: VisitFacts): T::Booking =
  { service: facts.service, slot: freeSlots(facts).nthOr(0, { start: 0, minutes: 0, venue: "" }), priced: facts.priced,
    cost: facts.cost, currency: facts.currency, shares: facts.asks, acceptsClash: false }
pure def lawAnUnreadCalendarIsNeverSuggestedOver(facts: VisitFacts): bool =
  not(facts.diaryRead) implies not(onlyFreeSlot(facts))
pure def lawTheSuggestedTimeIsOfferedAndFree(facts: VisitFacts): bool =
  onlyFreeSlot(facts) implies (facts.slots.includes(suggestedBooking(facts).slot) and
    not(facts.busy.includes(suggestedBooking(facts).slot)) and not(suggestedBooking(facts).acceptsClash))
```
