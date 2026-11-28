# The vocabulary of a task

Paying a bill, booking a visit and completing a guided website walkthrough are kinds of one task. A task has a kind, a subject that names what it is about, and the terms the person chooses. The terms of each kind are one variant of a single sum, because a spec has no type parameters and no opaque function another spec can import: the ledger and the preparation compare terms whole and never read a kind's own fields.

## Story: Name a task and its terms

> As a person asking Grace to pay a bill, book a visit or walk me through a website task, I want every task to name exactly what it is about and what I agreed to, so that an answer about one task can never act on another.

### A valid subject names a kind of task, its owner, website, account and reference

Four actors take part in a task: the person, the trusted host that reads the place the task is about, the store, and the actuator that types for Grace. The empty subject is the sentinel of an ordinary task, one with no commitment. A valid subject has a kind other than ordinary and every identity field filled, so one kind of task can never be taken for another.

```quint
type TaskActor = Person | Host | Store | Actuator
type TaskKind = Ordinary | BillPay | AppointmentBooking | WebWalkthrough
type Subject = { kind: TaskKind, owner: str, origin: str, account: str, ref: str }
pure val emptyKey: Subject = { kind: Ordinary, owner: "", origin: "", account: "", ref: "" }
pure def validKey(key: Subject): bool =
  key.kind != Ordinary and key.owner != "" and key.origin != "" and key.account != "" and key.ref != ""
```

### Terms are none, a payment, a booking or a website walkthrough, each complete

A payment names a positive amount, a fee that is not negative, its currency, a day and the funding it is paid from. A booking names its service and a slot that is a start and a positive length; a cost is known only when the booking is priced, and a cost above zero names its currency. A website walkthrough names its plain-language summary, the reviewed website control reference, whether a cost is shown and its amount and currency, whether it opts into a recurring commitment (such as automatic payments or a subscription), and the supported kinds of personal detail shared with the website. Both bookings and website walkthroughs list only the supported detail labels: name, phone or address. The person's actual details stay out of the review record. A report handed to review carries the subject, the terms, their revision and the evidence they were read from.

```quint
type Proposal = { amount: int, fee: int, currency: str, day: int, funding: str }
type Slot = { start: int, minutes: int, venue: str }
type Booking = { service: str, slot: Slot, priced: bool, cost: int, currency: str, shares: List[str], acceptsClash: bool }
type Walkthrough = { summary: str, targetRef: str, priced: bool, cost: int, currency: str, recurring: bool, shares: List[str] }
type Terms = NoTerms | PayTerms({ pay: Proposal }) | BookTerms({ book: Booking }) | WalkthroughTerms({ walkthrough: Walkthrough })
type ReviewReport = { key: Subject, proposal: Terms, revision: int, evidence: str }
pure def validProposal(proposal: Proposal): bool =
  proposal.amount > 0 and proposal.fee >= 0 and proposal.currency != "" and proposal.day > 0 and proposal.funding != ""
pure val bookingDetails = Set("name", "phone", "address")
pure def validBooking(booking: Booking): bool =
  booking.service != "" and booking.slot.start > 0 and booking.slot.minutes > 0 and booking.cost >= 0 and
  (booking.priced or booking.cost == 0) and (booking.cost > 0 implies booking.currency != "") and
  booking.shares.every(detail => bookingDetails.contains(detail))
pure def validWalkthrough(walkthrough: Walkthrough): bool =
  walkthrough.summary != "" and walkthrough.targetRef != "" and walkthrough.cost >= 0 and
  (walkthrough.priced or walkthrough.cost == 0) and (walkthrough.cost > 0 implies walkthrough.currency != "") and
  walkthrough.shares.every(detail => bookingDetails.contains(detail))
pure def validTerms(kind: TaskKind, terms: Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(x) => kind == BillPay and validProposal(x.pay)
  | BookTerms(x) => kind == AppointmentBooking and validBooking(x.book)
  | WalkthroughTerms(x) => kind == WebWalkthrough and validWalkthrough(x.walkthrough)
}
pure def hasTerms(terms: Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(x) => true
  | BookTerms(x) => true
  | WalkthroughTerms(x) => true
}
pure val payValues = Set(
  { amount: 8420, fee: 0, currency: "USD", day: 1, funding: "bank-ref" },
  { amount: 0, fee: 0, currency: "", day: 0, funding: "" })
pure val bookValues = Set(
  { service: "follow-up", slot: { start: 10, minutes: 30, venue: "clinic" }, priced: false, cost: 0, currency: "", shares: List("name", "phone"), acceptsClash: false },
  { service: "follow-up", slot: { start: 10, minutes: 30, venue: "clinic" }, priced: false, cost: 0, currency: "", shares: List("a private value"), acceptsClash: false },
  { service: "", slot: { start: 0, minutes: 0, venue: "" }, priced: false, cost: 5, currency: "", shares: List(""), acceptsClash: true })
pure val walkthroughValues = Set(
  { summary: "Place one-time order", targetRef: "place-order", priced: true, cost: 1499, currency: "USD", recurring: false, shares: List("name", "address") },
  { summary: "Send message to care team", targetRef: "send-message", priced: false, cost: 0, currency: "", recurring: false, shares: List() },
  { summary: "Enroll in automatic payments", targetRef: "enroll-autopay", priced: false, cost: 0, currency: "", recurring: true, shares: List("a private value") },
  { summary: "", targetRef: "", priced: false, cost: 5, currency: "", recurring: false, shares: List("") })
```

### Bill terms are exactly the valid payment proposals

```quint
pure def lawBillTermsAreExactlyValidProposals(pay: Proposal): bool =
  validTerms(BillPay, PayTerms({ pay: pay })) iff validProposal(pay)
```

### Website walkthrough terms are exactly the valid walkthrough proposals

```quint
pure def lawWalkthroughTermsAreExactlyValidWalkthroughs(walkthrough: Walkthrough): bool =
  validTerms(WebWalkthrough, WalkthroughTerms({ walkthrough: walkthrough })) iff validWalkthrough(walkthrough)
```

### Terms of one kind are never valid for another

```quint
pure def lawTermsNeverCrossKinds(pay: Proposal, book: Booking, walkthrough: Walkthrough, kind: TaskKind): bool =
  (validTerms(kind, PayTerms({ pay: pay })) implies kind == BillPay) and
  (validTerms(kind, BookTerms({ book: book })) implies kind == AppointmentBooking) and
  (validTerms(kind, WalkthroughTerms({ walkthrough: walkthrough })) implies kind == WebWalkthrough)
```

### An outcome is accepted from the website, or for a booking also from an email

A task's outcome is read on the website it was done on. A booking may also be confirmed by an email; nothing else is a place an outcome comes from.

```quint
type TaskPlace = OnWebsite | InEmail | InCalendar | InFiles | InConversation
pure def outcomePlaceAllowed(kind: TaskKind, place: TaskPlace): bool =
  place == OnWebsite or (kind == AppointmentBooking and place == InEmail)
```

### Only a booking is recorded in the calendar

```quint
pure def recordsInCalendar(kind: TaskKind): bool = kind == AppointmentBooking
```

### A bill is never settled from a message

An outcome for a bill is accepted only from the website it was paid on.

```quint
pure def lawABillIsNeverSettledFromAMessage(place: TaskPlace): bool =
  outcomePlaceAllowed(BillPay, place) implies place == OnWebsite
```
