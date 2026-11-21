# The vocabulary of a task

Paying a bill and booking a visit are two kinds of one task. A task has a kind, a subject that names what it is about, and the terms the person chooses. The terms of each kind are one variant of a single sum, because a spec has no type parameters and no opaque function another spec can import: the ledger and the preparation compare terms whole and never read a kind's own fields.

## Story: Name a task and its terms

> As a person asking Grace to pay a bill or book a visit, I want every task to name exactly what it is about and what I agreed to, so that an answer about one task can never act on another.

### A valid subject names a kind of task, its owner, website, account and reference

Four actors take part in a task: the person, the trusted host that reads the place the task is about, the store, and the actuator that types for Grace. The empty subject is the sentinel of an ordinary task, one with no commitment. A valid subject has a kind other than ordinary and every identity field filled, so a booking can never be taken for a bill.

```quint
type TaskActor = Person | Host | Store | Actuator
type TaskKind = Ordinary | BillPay | AppointmentBooking
type Subject = { kind: TaskKind, owner: str, origin: str, account: str, ref: str }
pure val emptyKey: Subject = { kind: Ordinary, owner: "", origin: "", account: "", ref: "" }
pure def validKey(key: Subject): bool =
  key.kind != Ordinary and key.owner != "" and key.origin != "" and key.account != "" and key.ref != ""
```

### Terms are none, a payment or a booking, each complete

A payment names a positive amount, a fee that is not negative, its currency, a day and the funding it is paid from. A booking names its service and a slot that is a start and a positive length; a cost is known only when the booking is priced, and a cost above zero names its currency. The booking lists the supported kinds of personal detail shared with the provider: name, phone or address. The review holds only those labels. The person's actual details stay out of the review record. A report handed to review carries the subject, the terms, their revision and the evidence they were read from.

```quint
type Proposal = { amount: int, fee: int, currency: str, day: int, funding: str }
type Slot = { start: int, minutes: int, venue: str }
type Booking = { service: str, slot: Slot, priced: bool, cost: int, currency: str, shares: List[str], acceptsClash: bool }
type Terms = NoTerms | PayTerms({ pay: Proposal }) | BookTerms({ book: Booking })
type ReviewReport = { key: Subject, proposal: Terms, revision: int, evidence: str }
pure def validProposal(proposal: Proposal): bool =
  proposal.amount > 0 and proposal.fee >= 0 and proposal.currency != "" and proposal.day > 0 and proposal.funding != ""
pure val bookingDetails = Set("name", "phone", "address")
pure def validBooking(booking: Booking): bool =
  booking.service != "" and booking.slot.start > 0 and booking.slot.minutes > 0 and booking.cost >= 0 and
  (booking.priced or booking.cost == 0) and (booking.cost > 0 implies booking.currency != "") and
  booking.shares.every(detail => bookingDetails.contains(detail))
pure def validTerms(kind: TaskKind, terms: Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(x) => kind == BillPay and validProposal(x.pay)
  | BookTerms(x) => kind == AppointmentBooking and validBooking(x.book)
}
pure def hasTerms(terms: Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(x) => true
  | BookTerms(x) => true
}
pure val payValues = Set(
  { amount: 8420, fee: 0, currency: "USD", day: 1, funding: "bank-ref" },
  { amount: 0, fee: 0, currency: "", day: 0, funding: "" })
pure val bookValues = Set(
  { service: "follow-up", slot: { start: 10, minutes: 30, venue: "clinic" }, priced: false, cost: 0, currency: "", shares: List("name", "phone"), acceptsClash: false },
  { service: "follow-up", slot: { start: 10, minutes: 30, venue: "clinic" }, priced: false, cost: 0, currency: "", shares: List("a private value"), acceptsClash: false },
  { service: "", slot: { start: 0, minutes: 0, venue: "" }, priced: false, cost: 5, currency: "", shares: List(""), acceptsClash: true })
```

### Bill terms are exactly the valid payment proposals

```quint
pure def lawBillTermsAreExactlyValidProposals(pay: Proposal): bool =
  validTerms(BillPay, PayTerms({ pay: pay })) iff validProposal(pay)
```

### Terms of one kind are never valid for another

```quint
pure def lawTermsNeverCrossKinds(pay: Proposal, book: Booking, kind: TaskKind): bool =
  (validTerms(kind, PayTerms({ pay: pay })) implies kind == BillPay) and
  (validTerms(kind, BookTerms({ book: book })) implies kind == AppointmentBooking)
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
