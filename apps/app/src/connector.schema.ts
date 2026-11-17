// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/email.md, "Story: Read an email and its original attachment"; spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"
import { Schema } from "effect"

const optional = Schema.optionalKey
const Text = Schema.String
const Flag = Schema.Boolean
const Texts = Schema.Array(Text)
const NullableText = Schema.NullOr(Text)

export const WireAttachment = Schema.Struct({ id: Text, name: Text, mimeType: Text, pages: Schema.Int })
export const WireMessage = Schema.Struct({
  externalId: Text, subject: Text, from: Text, fromEmail: NullableText, replyTo: NullableText, to: Texts, snippet: Text,
  receivedAt: Text, isUnread: Flag, labels: Texts, metadata: Schema.Struct({ historyId: Text }), attachments: optional(Schema.Array(WireAttachment)),
})
export const Listing = Schema.Struct({ messages: Schema.Array(WireMessage) })
export const ReadResponse = Schema.Struct({ message: WireMessage, bodyText: Text })
export const Grants = Schema.Array(Schema.Struct({ id: Text, email: Text }))
export const Prepared = Schema.Struct({
  receipt: Schema.Struct({
    requestId: Text, reviewDigest: Text, state: Schema.Literals(["prepared", "succeeded", "failed"]),
    providerResult: Schema.NullOr(Schema.Struct({ messageId: Text, labelIds: Texts, historyId: Text })),
  }),
})
export const Sent = Schema.Struct({ messageId: Text })
export const DraftSaved = Schema.Struct({ draftId: Text })
export const ContactList = Schema.Struct({ contacts: Schema.Array(Schema.Struct({ name: Text, email: Text })) })
export const Extras = Schema.Struct({
  sourceRef: optional(Text), participant: optional(Text), recurrence: optional(Schema.Literals(["Once", "Weekly", "Monthly"])),
  seriesId: optional(Text), reminderMinutes: optional(Schema.Int), important: optional(Flag),
})
export const WireEvent = Schema.Struct({
  externalId: Text, title: Text, description: Text, location: Text, startAt: Text, endAt: Text, isAllDay: Flag, timezone: NullableText, metadata: Extras,
})
export const Feed = Schema.Struct({ events: Schema.Array(WireEvent) })
export const Session = Schema.Struct({ sessionId: Text, pageUrl: Text })
export const SessionOutcome = Schema.Struct({
  status: Schema.Literals(["allowed", "cancelled", "refused"]), address: optional(Text),
  granted: optional(Schema.Struct({ mail: Flag, calendar: Flag, contacts: Flag })),
})
export const OtherCheck = Schema.Struct({ outcome: Schema.Literals(["allowed", "passwordRefused", "needsServers", "refused"]), address: Text })
