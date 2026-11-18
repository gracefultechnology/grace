// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/email.md, "Story: Read an email and its original attachment"; spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/calendarView.md, "Story: Browse my calendar and open an exact occurrence"
import { Schema } from "effect"

const optional = Schema.optionalKey
const Text = Schema.String
const Flag = Schema.Boolean
const Texts = Schema.Array(Text)
const NullableText = Schema.NullOr(Text)

export const WireAttachment = Schema.Struct({
  partId: Text, attachmentId: NullableText, filename: Text, mimeType: Text, size: Schema.Number, pages: optional(Schema.Int),
})
export const WireMessage = Schema.Struct({
  externalId: Text, subject: Text, from: Text, fromEmail: NullableText, replyTo: NullableText, to: Texts, snippet: Text,
  receivedAt: Text, isUnread: Flag, labels: Texts,
  metadata: Schema.Struct({ historyId: NullableText, messageIdHeader: optional(NullableText), referencesHeader: optional(NullableText) }),
})
export const Listing = Schema.Struct({ messages: Schema.Array(WireMessage) })
export const ReadResponse = Schema.Struct({ message: WireMessage, bodyText: Text, attachments: optional(Schema.Array(WireAttachment)) })
export const Grants = Schema.Array(Schema.Struct({
  connectionId: NullableText, connected: Flag, identity: Schema.NullOr(Schema.Struct({ email: optional(NullableText) })),
}))
export const Refusal = Schema.Struct({ code: optional(Text) })
export const Operation = Schema.Struct({
  receipt: Schema.Struct({
    requestId: Text, reviewDigest: Text, state: Schema.Literals(["prepared", "dispatched", "succeeded", "rejected", "outcome-unknown"]),
    rejectionCode: NullableText, providerResult: Schema.NullOr(Schema.Struct({ messageId: optional(Text), historyId: optional(NullableText) })),
  }),
})
export const DraftSaved = Schema.Struct({ draftId: Text })
export const AttachmentContent = Schema.Struct({ mimeType: Text, dataBase64: Text })
export const DraftRead = Schema.Struct({
  id: Text, messageId: Text,
  content: Schema.Struct({ to: Texts, cc: Texts, bcc: Texts, subject: Text, bodyText: Text, plainText: Flag, threaded: Flag, attachmentCount: Schema.Int }),
})
export const ContactList = Schema.Struct({ contacts: Schema.Array(Schema.Struct({ name: Text, email: Text })) })
export const WireEvent = Schema.Struct({
  externalId: Text, title: Text, description: Text, location: Text, startAt: Text, endAt: Text, isAllDay: Flag, timezone: NullableText,
  attendees: Schema.Array(Schema.Struct({ email: NullableText, displayName: NullableText, self: Flag })),
})
export const Feed = Schema.Struct({ events: Schema.Array(WireEvent) })
export const Stored = Schema.Struct({ event: WireEvent })
export const Session = Schema.Struct({ sessionId: Text, pageUrl: Text })
export const SessionOutcome = Schema.Struct({
  status: Schema.Literals(["allowed", "cancelled", "refused"]), address: optional(Text),
  granted: optional(Schema.Struct({ mail: Flag, calendar: Flag, contacts: Flag })),
})
export const OtherCheck = Schema.Struct({ outcome: Schema.Literals(["allowed", "passwordRefused", "needsServers", "refused"]), address: Text })
