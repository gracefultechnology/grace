# Email

Email uses the same account, consent, private-data and interruption rules as
browser assistance. `prototype/Grace Prototype.html:1996–2038,2317–2346` is
the source for Inbox, Sent, Drafts and Trash, message and attachment readers,
recipient selection, composing, replying, forwarding and draft preservation.
The earlier PRD's ACC-01–06 supply connector/read requirements. Provider
authentication, durable draft storage and uncertain-send recovery below make
the prototype's simulated success explicit production requirements.
[Message lifecycle](./emailItem.md) defines folder, unread and trash changes.
This mailbox owns those actual records in one canonical registry keyed by message
reference; selection is a reference into that registry, never a second message copy.

Each machine belongs to one mailbox. A mailbox registry keeps separate machines
for separate owner/provider/account identities; selecting another mailbox does
not copy credentials, messages, drafts or permissions. Authentication and message
contents come from provider adapters, never a fabricated login form. Message
and attachment references identify provider records; rendered content is
sanitized and cannot authorize actions. Passwords, tokens and sign-in codes
never enter this state. `generation` fences callbacks after reconnect or revoke.
The host authenticates `MailUser`, `MailAssistant`, `MailConnector` and
`MailHost` before supplying `by`; provider results, persistence facts and user
consent are never accepted from planner-controlled event JSON. `MailAssistant`
is Grace's own request, relayed by the host. From any screen she may list,
search and open mail; start a new email to a contact the connector resolved,
address a draft that has no recipient yet, fill an empty body, forward, and
save a draft; move a message to Trash, restore it, undo that move, and mark it
unread. She never approves, sends, deletes for good or follows a link.

## Story: Connect the mailbox I choose

> As a user, I want to choose and connect my email account, know when access
> fails or expires, and disconnect it without changing another account.

### A mailbox starts disconnected with no selected message or outgoing draft

```quint
import files as F from "./files"
import emailItem as I from "./emailItem"

type MailActor = MailUser | MailAssistant | MailConnector | MailHost
type Connection = Disconnected | Authorizing | Connected | Expired | Revoked | Unavailable | ConnectionFailed
type MailView = Inbox | Message | Attachment
type ReadStatus = ReadIdle | Reading | ReadFailed
type ReadKind = Search | OpenMessage | OpenAttachment
type ReadReceipt = { generation: int, succeeded: bool, assets: List[F::SavedFile], suspicion: str }
type SendStatus = NoDraft | Composing | Reviewing | Sending | Sent | SendFailed | SendUnknown
type DraftStorage = DraftUnstored | DraftSaving | DraftDeleting | DraftSaved | DraftStoreFailed
type DraftContent = { to: str, cc: Set[str], bcc: Set[str], subject: str, body: str }
type DraftSnapshot = { id: str, version: int, content: DraftContent, attachments: List[F::SavedFile], replyTo: str }
type ComposeChoice = NoChoice | PickNewEmail | PickTo | PickCc | PickBcc | ChoosePhoto | ChooseFile
type MessageTarget = { ref: str, revision: int }
type Bill = { ref: str, sourceRef: str, origin: str, account: str, confirmed: bool }
type Warning = { ref: str, generation: int, evidence: str }
type LinkStatus = NoLink | LinkHeld | LinkReleased
type LinkRequest = { ref: str, link: str, status: LinkStatus }
type ListingScope = { owner: str, provider: str, account: str, folder: I::Folder, query: str, generation: int }
type OutboxStatus = Waiting | Dispatching | DispatchUnknown | DispatchFailed
type QueuedSend = { operationId: str, snapshot: DraftSnapshot, status: OutboxStatus, evidence: str }
type Mailbox = {
  owner: str, provider: str, account: str, generation: int,
  connection: Connection, canRead: bool, canSend: bool,
  view: MailView, folder: I::Folder, query: str, readStatus: ReadStatus, readKind: ReadKind,
  requestedRef: str, messageRef: str, attachmentRef: str,
  messages: List[I::MessageRecord], messageRefs: Set[str], assets: List[F::SavedFile],
  draft: DraftContent, autoSubject: str, replyTo: str,
  draftAttachments: List[F::SavedFile], draftId: str, draftVersion: int, retiredDrafts: str -> int, composeVisible: bool, draftStorage: DraftStorage, storedRevision: int, draftRequest: int,
  choosing: ComposeChoice, ccOpen: bool, sentDrafts: Set[str],
  revision: int, approvedRevision: int, sendStatus: SendStatus,
  operationId: str, issuedSends: Set[str], sendEvidence: str, sendResultSaved: bool,
  outbox: List[QueuedSend], outboxSent: int, draftsTotal: int,
  bill: Bill, warning: Warning, link: LinkRequest
}
pure val noRetiredDrafts: str -> int = Map()
pure val emptyContent: DraftContent = { to: "", cc: Set(), bcc: Set(), subject: "", body: "" }
pure val noBill: Bill = { ref: "", sourceRef: "", origin: "", account: "", confirmed: false }
pure val noWarning: Warning = { ref: "", generation: -1, evidence: "" }
pure val noLink: LinkRequest = { ref: "", link: "", status: NoLink }
pure val initial: Mailbox = {
  owner: "", provider: "", account: "", generation: 0,
  connection: Disconnected, canRead: false, canSend: false,
  view: Inbox, folder: I::InboxFolder, query: "", readStatus: ReadIdle, readKind: Search,
  requestedRef: "", messageRef: "", attachmentRef: "",
  messages: List(), messageRefs: Set(), assets: List(),
  draft: emptyContent, autoSubject: "", replyTo: "",
  draftAttachments: List(), draftId: "", draftVersion: 0, retiredDrafts: Map(), composeVisible: false, draftStorage: DraftUnstored, storedRevision: -1, draftRequest: 0,
  choosing: NoChoice, ccOpen: false, sentDrafts: Set(),
  revision: 0, approvedRevision: -1, sendStatus: NoDraft,
  operationId: "", issuedSends: Set(), sendEvidence: "", sendResultSaved: false,
  outbox: List(), outboxSent: 0, draftsTotal: 0,
  bill: noBill, warning: noWarning, link: noLink
}
pure def messageRecord(m: Mailbox, ref: str): I::MessageRecord =
  val found = m.messages.select(record => record.identity.ref == ref)
  if (found.length() == 1) found.nthOr(0, I::initial) else I::initial
pure def hasMessage(m: Mailbox, ref: str): bool = m.messages.some(record => record.identity.ref == ref)
pure def putMessage(records: List[I::MessageRecord], record: I::MessageRecord): List[I::MessageRecord] =
  records.select(old => old.identity.ref != record.identity.ref).append(record)
pure def messageIdentity(m: Mailbox, ref: str): I::MessageIdentity =
  { owner: m.owner, provider: m.provider, account: m.account, ref: ref }
pure def changingFolder(record: I::MessageRecord): bool =
  record.pending == I::TrashMessage or record.pending == I::RestoreMessage or record.pending == I::PurgeMessage
pure def availableMessage(m: Mailbox, ref: str): bool =
  ref != "" and messageRecord(m, ref).loaded and messageRecord(m, ref).identity == messageIdentity(m, ref) and
  messageRecord(m, ref).folder == m.folder and messageRecord(m, ref).folder != I::PurgedFolder and
  not(changingFolder(messageRecord(m, ref)))
pure def selectedMessageIsCurrent(m: Mailbox): bool = m.view != Inbox and availableMessage(m, m.messageRef)
pure def unresolved(m: Mailbox): bool = m.sendStatus == Sending or m.sendStatus == SendUnknown
pure def terminalUnsaved(m: Mailbox): bool = (m.sendStatus == Sent or m.sendStatus == SendFailed) and not(m.sendResultSaved)
pure def heldSend(m: Mailbox): bool = unresolved(m) or terminalUnsaved(m)
```

### Official authentication binds the chosen identity and the current request

Beginning or retrying authentication invalidates old read callbacks. Reconnecting
an existing mailbox keeps the same identity. A different account gets a different
mailbox machine. Only a verified official callback with granted read capability
establishes a readable connection; send permission is separate.

Discovered by the proof: the selected account identity must already exist while
authorization is pending, not only after the connection succeeds. Otherwise a
successful callback could establish a connection without an owner or account.
Discovered by the proof: an account identity stays bound while any Outbox entry
remains, even if the connection ends. Otherwise a connector result could mark a
draft for deletion without knowing which mailbox holds it.

```quint
pure def canConnect(m: Mailbox, owner: str, provider: str, account: str, by: MailActor): bool =
  (by == MailUser) and m.connection != Authorizing and m.connection != Connected and
  owner != "" and provider != "" and account != "" and
  (m.owner == "" or (m.owner == owner and m.provider == provider and m.account == account))
pure def connect(m: Mailbox, owner: str, provider: str, account: str, by: MailActor): Mailbox =
  { ...m, owner: owner, provider: provider, account: account,
    generation: m.generation + 1, connection: Authorizing,
    canRead: false, canSend: false, readStatus: ReadIdle, view: Inbox, folder: I::InboxFolder, query: "",
    messageRef: "", attachmentRef: "", messageRefs: Set(), assets: List(),
    bill: noBill, warning: noWarning, link: noLink }
pure def canAuthorize(m: Mailbox, generation: int, verified: bool, readGranted: bool, by: MailActor): bool =
  (by == MailConnector) and m.connection == Authorizing and generation == m.generation and verified and readGranted
pure def authorize(m: Mailbox, generation: int, verified: bool, readGranted: bool, sendGranted: bool, by: MailActor): Mailbox =
  { ...m, connection: Connected, canRead: true, canSend: sendGranted }
pure def canEndConnection(m: Mailbox, resultStatus: Connection, by: MailActor): bool =
  ((by == MailConnector or (by == MailUser and resultStatus == Disconnected))) and m.connection != Disconnected and resultStatus != Connected and resultStatus != Authorizing
pure def endConnection(m: Mailbox, resultStatus: Connection, by: MailActor): Mailbox =
  { ...m, connection: resultStatus, generation: m.generation + 1,
    canRead: false, canSend: false, readStatus: ReadIdle,
    approvedRevision: -1, sendStatus: fencedSend(m), outbox: fenceQueue(m.outbox) }
pure def alwaysConnectedIdentity(m: Mailbox): bool =
  (m.connection == Connected implies
    (m.owner != "" and m.provider != "" and m.account != "" and m.canRead)) and
  (m.connection != Connected implies (not(m.canRead) and not(m.canSend)))
pure def alwaysAccountIdentityIsBound(m: Mailbox): bool =
  (m.connection != Disconnected or m.outbox.length() > 0) implies
    (m.owner != "" and m.provider != "" and m.account != "")
pure def alwaysGenerationAndRevision(m: Mailbox): bool =
  m.generation >= 0 and m.revision >= 0 and m.approvedRevision >= -1 and m.draftRequest >= 0
pure def sometimesConnected(m: Mailbox): bool = m.connection == Connected
pure def sometimesRevoked(m: Mailbox): bool = m.connection == Revoked
```

## Story: Read an email and its original attachment

> As a user, I want to find an email, open the message I selected, and inspect
> its attachment without giving unrelated content permission to act for me.

### Each search or content read needs current access and the user's choice

Only message references returned by this mailbox's current authenticated search
can be opened. Attachment references come only from the complete descriptor manifest returned
atomically with the selected message and its current response generation.
A successful body read must include every original attachment, including a
valid empty manifest; partial metadata is not a successful message read. The
connector supplies that completeness fact, validated against provider identity.
Until then Reply, Forward and attachment export remain unavailable. Reconnecting clears cached selection authority;
late metadata cannot populate another account or another read generation.
A metadata search is distinct from opening a body or attachment. Search text may
be empty to show the inbox. An attachment read retains its parent message. An
error preserves the previous view and can be retried explicitly. Returning to
the inbox is a local navigation action and does not read the provider again.

Discovered by the proof: a pending content read retains the validated selection
that started it. Without that fact, a successful result could open an empty
message or attachment even though the request guard validated its reference.

Mail already on the tablet stays readable while the account's sign-in has
expired or been revoked: "Your Gmail emails are still here. New ones arrive
once you sign in." (`prototype/Grace Prototype.html:2119`). The connector then
answers listings, searches and opens from the tablet's copy, and new mail waits
for the person to sign in again. `readable` is that fact: a live connection
with read access, or a bound mailbox whose sign-in expired or was revoked.
Only reading follows it. Every change sent to the provider, Reply, Forward,
attachment export, a bill and a link still need the live connection.

```quint
pure def canReadMail(m: Mailbox, kind: ReadKind, ref: str, approved: bool, by: MailActor): bool =
  (by == MailUser) and readable(m) and approved and m.readStatus != Reading and
  (kind == Search or (ref != "" and
    ((kind == OpenMessage and m.messageRefs.contains(ref) and availableMessage(m, ref)) or
      (kind == OpenAttachment and selectedMessageIsCurrent(m) and m.assets.some(asset => asset.sourceRef == ref)))))
pure def readMail(m: Mailbox, kind: ReadKind, ref: str, approved: bool, by: MailActor): Mailbox =
  { ...m, readStatus: Reading, readKind: kind, requestedRef: ref, generation: m.generation + 1,
    query: if (kind == Search) ref else m.query,
    messageRefs: if (kind == Search) Set() else m.messageRefs }
pure def retainedOnly(m: Mailbox): bool = (m.connection == Expired or m.connection == Revoked) and m.owner != ""
pure def readable(m: Mailbox): bool = (m.connection == Connected and m.canRead) or retainedOnly(m)
pure def assistedView(kind: ReadKind, m: Mailbox): Mailbox =
  if (kind == Search and m.folder != I::InboxFolder) { ...clearSelection(true, m), folder: I::InboxFolder, query: "", messageRefs: Set() }
  else m
pure def listingScope(m: Mailbox): ListingScope = {
  owner: m.owner, provider: m.provider, account: m.account, folder: m.folder, query: m.query, generation: m.generation
}
pure def canReceiveMessage(m: Mailbox, scope: ListingScope, listing: I::MetadataReceipt, by: MailActor): bool =
  by == MailConnector and readable(m) and m.readStatus == Reading and m.readKind == Search and
  scope == listingScope(m) and listing.seed.identity == messageIdentity(m, listing.seed.identity.ref) and
  I::validIdentity(listing.seed.identity) and listing.seed.folder == m.folder and listing.seed.folder != I::PurgedFolder and listing.evidence != "" and
  (if (hasMessage(m, listing.seed.identity.ref))
    (I::canRefreshMetadata(messageRecord(m, listing.seed.identity.ref), listing, I::MessageProvider) or
      (availableMessage(m, listing.seed.identity.ref) and
        (messageRecord(m, listing.seed.identity.ref).status == I::ChangePending or messageRecord(m, listing.seed.identity.ref).status == I::ChangeUnknown) and
        listing.revision == messageRecord(m, listing.seed.identity.ref).revision))
    else listing.revision == -1 and I::canLoadMessage(I::initial, listing.seed, I::MessageProvider))
pure def receiveMessage(m: Mailbox, scope: ListingScope, listing: I::MetadataReceipt, by: MailActor): Mailbox =
  val record = messageRecord(m, listing.seed.identity.ref)
  { ...m, messageRefs: m.messageRefs.union(Set(listing.seed.identity.ref)),
    messages: if (not(hasMessage(m, listing.seed.identity.ref))) putMessage(m.messages, I::loadMessage(I::initial, listing.seed, I::MessageProvider))
      else if (I::canRefreshMetadata(record, listing, I::MessageProvider)) putMessage(m.messages, I::refreshMetadata(record, listing, I::MessageProvider))
      else m.messages }
pure def canReadResult(m: Mailbox, readReceipt: ReadReceipt, by: MailActor): bool =
  by == MailConnector and readable(m) and m.readStatus == Reading and readReceipt.generation == m.generation and
  (readReceipt.suspicion != "" implies (readReceipt.succeeded and m.readKind == OpenMessage)) and
  (if (readReceipt.succeeded and m.readKind == OpenMessage)
    F::validCatalog(readReceipt.assets) and readReceipt.assets.every(asset => asset.origin == m.provider and
      asset.account == m.account and asset.container == m.requestedRef)
    else readReceipt.assets == List())
pure def readResult(m: Mailbox, readReceipt: ReadReceipt, by: MailActor): Mailbox =
  { ...m, readStatus: if (readReceipt.succeeded) ReadIdle else ReadFailed,
    messages: if (readReceipt.succeeded and m.readKind == OpenMessage and
      I::canChangeMessage(messageRecord(m, m.requestedRef), I::ReadMessage, I::MessageUser))
      putMessage(m.messages, I::changeMessage(messageRecord(m, m.requestedRef), I::ReadMessage, I::MessageUser)) else m.messages,
    view: if (not(readReceipt.succeeded)) m.view else if (m.readKind == Search) Inbox
      else if (m.readKind == OpenMessage) Message else Attachment,
    messageRef: if (readReceipt.succeeded and m.readKind == OpenMessage) m.requestedRef else m.messageRef,
    attachmentRef: if (readReceipt.succeeded and m.readKind == OpenAttachment) m.requestedRef
      else if (readReceipt.succeeded and m.readKind == OpenMessage) "" else m.attachmentRef,
    assets: if (readReceipt.succeeded and m.readKind == OpenMessage) readReceipt.assets else m.assets,
    warning: if (not(readReceipt.succeeded and m.readKind == OpenMessage)) m.warning
      else if (readReceipt.suspicion == "") noWarning
      else { ref: m.requestedRef, generation: m.generation, evidence: readReceipt.suspicion },
    link: if (readReceipt.succeeded and m.readKind == OpenMessage) noLink else m.link,
    bill: if (readReceipt.succeeded) noBill else m.bill }
pure def canShowInbox(m: Mailbox, by: MailActor): bool = (by == MailUser) and (m.view != Inbox or m.readStatus != ReadIdle)
pure def showInbox(m: Mailbox, by: MailActor): Mailbox =
  { ...m, view: Inbox, readStatus: ReadIdle, generation: m.generation + 1 }
pure def alwaysReadAccess(m: Mailbox): bool =
  m.readStatus == Reading implies readable(m)
pure def alwaysReadSelectionIsBound(m: Mailbox): bool =
  m.readStatus == Reading implies
    ((m.readKind == OpenMessage implies (m.requestedRef != "" and m.messageRefs.contains(m.requestedRef))) and
      (m.readKind == OpenAttachment implies
        (m.requestedRef != "" and selectedMessageIsCurrent(m) and m.assets.some(asset => asset.sourceRef == m.requestedRef))))
pure def alwaysSelectedContent(m: Mailbox): bool =
  (m.view == Message implies m.messageRef != "") and
  (m.view == Attachment implies (m.messageRef != "" and m.attachmentRef != ""))
pure def sometimesReadAttachment(m: Mailbox): bool = m.view == Attachment
pure def sometimesReadFailure(m: Mailbox): bool = m.readStatus == ReadFailed
pure def sometimesReadWhileSignInExpired(m: Mailbox): bool = retainedOnly(m) and m.readStatus == Reading and m.readKind == OpenMessage
```

### Grace's mail actions run the person's own guards and never approve, send, delete for good or open a link

When the person asks, Grace lists, searches and opens mail from any screen
(`prototype/Grace Prototype.html:2244,2277–2280`), writes or answers an email
for the person to check, and tidies it. Each of her actions is one
`assistMail` event naming what she does, and each runs exactly the guard and
transition the person's own tap would, so she can do nothing the person could
not do on that screen. The host supplies `asked`, the person's current request;
this spec refuses her without it but cannot itself establish it.

- Listing, search and open read like the person's own. Her search covers
  Inbox, as the prototype's does: from another folder it first returns to
  Inbox, clearing the selection and query as choosing a folder does.
- She starts a new email only to a recipient the connector resolved from the
  person's contacts (`Recipient.verified`), and gives an existing draft a
  recipient only while it has none and is not a reply. Nothing she writes is
  ever taken as an address.
- She fills a body only while it is empty, so she never writes over words the
  person typed; she forwards the message on screen, with no recipient, and
  saves a draft as Back would.
- She moves the message on screen to Trash, restores it, undoes her own move
  while its Undo is offered, and marks it unread. She acts only on the message
  that is open, so the person sees what she is about to move.
- She never approves, sends, deletes for good or opens a link: no arm of
  `assistMail` reaches those transitions, and `lawGraceNeverRaisesApproval`
  checks every arm. When the person is already sending an email, Grace can
  look at or move an open message while the same send operation continues.

This departs from the prototype on purpose in two places. The prototype's open
and search drop an open composer (`prototype/Grace Prototype.html:2278–2279`);
here she is refused while a composer is open, so she never discards what the
person is writing. The prototype's search always clears the open message; here
a search from Inbox keeps the selection reference and its success returns to
the list, where the selection is not shown, and only a search from another
folder clears it. She never opens an attachment for herself.

```quint
type Recipient = { address: str, verified: bool }
type MailAssist =
  AssistSearch({ query: str }) | AssistOpen({ ref: str }) | AssistList |
  AssistNewEmail({ recipient: Recipient, subject: str, body: str }) | AssistAddress({ recipient: Recipient }) |
  AssistFill({ body: str }) | AssistForward({ content: DraftContent }) | AssistSaveDraft({ draftId: str }) |
  AssistTrash({ target: MessageTarget }) | AssistRestore({ target: MessageTarget }) |
  AssistUndoTrash({ target: MessageTarget }) | AssistMarkUnread({ target: MessageTarget })
pure def canAssistMail(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): bool =
  by == MailAssistant and asked and (match assist {
    | AssistSearch(x) => not(m.composeVisible) and canReadMail(assistedView(Search, m), Search, x.query, true, MailUser)
    | AssistOpen(x) => not(m.composeVisible) and canReadMail(m, OpenMessage, x.ref, true, MailUser)
    | AssistList => not(m.composeVisible) and canShowInbox(m, MailUser)
    | AssistNewEmail(x) => x.recipient.verified and x.recipient.address != "" and canStartDraft(m, false, MailUser)
    | AssistAddress(x) => x.recipient.verified and x.recipient.address != "" and canEditDraft(m, MailUser) and
        m.draft.to == "" and m.replyTo == ""
    | AssistFill(x) => x.body != "" and canEditDraft(m, MailUser) and m.draft.body == ""
    | AssistForward(x) => canForwardMessage(m, MailUser)
    | AssistSaveDraft(x) => canPreserveDraft(m, x.draftId, MailUser)
    | AssistTrash(x) => canChangeSelectedMessage(m, x.target, I::TrashMessage, MailUser)
    | AssistRestore(x) => canChangeSelectedMessage(m, x.target, I::RestoreMessage, MailUser)
    | AssistUndoTrash(x) => canUndoMessageTrash(m, x.target, MailUser)
    | AssistMarkUnread(x) => canChangeSelectedMessage(m, x.target, I::UnreadMessage, MailUser)
  })
pure def assistMail(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): Mailbox = match assist {
  | AssistSearch(x) => readMail(assistedView(Search, m), Search, x.query, true, MailUser)
  | AssistOpen(x) => readMail(m, OpenMessage, x.ref, true, MailUser)
  | AssistList => showInbox(m, MailUser)
  | AssistNewEmail(x) => editDraft(startDraft(m, false, MailUser),
      { ...emptyContent, to: x.recipient.address, subject: x.subject, body: x.body }, MailUser)
  | AssistAddress(x) => editDraft(m, { ...m.draft, to: x.recipient.address }, MailUser)
  | AssistFill(x) => editDraft(m, { ...m.draft, body: x.body }, MailUser)
  | AssistForward(x) => forwardMessage(m, x.content, MailUser)
  | AssistSaveDraft(x) => preserveDraft(m, x.draftId, MailUser)
  | AssistTrash(x) => changeSelectedMessage(m, x.target, I::TrashMessage, MailUser)
  | AssistRestore(x) => changeSelectedMessage(m, x.target, I::RestoreMessage, MailUser)
  | AssistUndoTrash(x) => undoMessageTrash(m, x.target, MailUser)
  | AssistMarkUnread(x) => changeSelectedMessage(m, x.target, I::UnreadMessage, MailUser)
}
pure def lawGraceActsOnlyWhenAsked(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): bool =
  (not(asked) or by != MailAssistant) implies not(canAssistMail(m, assist, asked, by))
pure def lawGraceNeverRaisesApproval(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): bool =
  val after = assistMail(m, assist, asked, by)
  canAssistMail(m, assist, asked, by) implies
    ((after.approvedRevision == -1 or after.approvedRevision == m.approvedRevision) and
      (after.sendStatus == Sending implies (m.sendStatus == Sending and after.operationId == m.operationId)) and
      after.outbox.listMap(q => q.operationId) == m.outbox.listMap(q => q.operationId) and
      after.outbox.listMap(q => q.status) == m.outbox.listMap(q => q.status) and
      after.issuedSends.subseteq(m.issuedSends) and m.issuedSends.subseteq(after.issuedSends) and
      (after.link == m.link or after.link == noLink) and
      after.messages.every(r => r.pending != I::PurgeMessage or
        m.messages.some(o => o.identity == r.identity and o.pending == I::PurgeMessage)))
pure def lawGraceReadKeepsTheDraft(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): bool =
  val after = assistMail(m, assist, asked, by)
  val reading = match assist { | AssistSearch(x) => true | AssistOpen(x) => true | AssistList => true | _ => false }
  (reading and canAssistMail(m, assist, asked, by)) implies
    (after.revision == m.revision and after.draftVersion == m.draftVersion and
      after.sendStatus == m.sendStatus and after.draftId == m.draftId)
```

### Switching folders clears the old query and starts a scoped listing

Inbox, Sent, Drafts and Trash share this mailbox's current folder and query,
and a mailbox whose sign-in expired can still switch between them, listing
from the tablet's copy.
The `Inbox` view name means the message list in any of those folders. Choosing
a different folder cancels the previous content read, clears its selection and
search, and requests that folder's listing. An empty successful listing is
distinct from loading or failure. Search covers the chosen folder; provider
results must echo the exact owner, account, folder, query and generation.
Opening a Drafts row resumes its saved draft through `restoreDraft`; other rows
use the message reader. The message registry owns unread and Trash metadata,
so folder changes never fabricate a read, delete or restore operation.

The list shows `listedMessages`: the registry's records that the current listing
returned, and nothing else, so a search result is always the current query's.
A folder's unread badge is `folderUnread`, emailItem's `unreadCount` over this
mailbox's records in that folder.

```quint
pure def canChooseFolder(m: Mailbox, folder: I::Folder, by: MailActor): bool =
  by == MailUser and readable(m) and
  folder != I::PurgedFolder and folder != m.folder
pure def chooseFolder(m: Mailbox, folder: I::Folder, by: MailActor): Mailbox = {
  ...m, folder: folder, query: "", view: Inbox, readStatus: Reading, readKind: Search,
  requestedRef: "", generation: m.generation + 1, messageRef: "", attachmentRef: "",
  messageRefs: Set(), assets: List(), bill: noBill, warning: noWarning, link: noLink
}
pure def listedMessages(m: Mailbox): List[I::MessageRecord] =
  m.messages.select(record => m.messageRefs.contains(record.identity.ref))
pure def folderUnread(m: Mailbox, folder: I::Folder): int =
  I::unreadCount(m.messages, messageIdentity(m, ""), folder)
pure def alwaysMessageRegistry(m: Mailbox): bool =
  m.messages.every(record => record.loaded and record.identity == messageIdentity(m, record.identity.ref) and
    I::validMessageRecord(record) and m.messages.select(other => other.identity.ref == record.identity.ref).length() == 1)
pure def alwaysListedMessagesAreCurrent(m: Mailbox): bool =
  m.messageRefs.forall(ref => availableMessage(m, ref))
pure def alwaysSelectionUsesCanonicalMessage(m: Mailbox): bool =
  (m.view != Inbox implies selectedMessageIsCurrent(m)) and
  (m.messageRef != "" implies (messageRecord(m, m.messageRef).loaded and messageRecord(m, m.messageRef).folder != I::PurgedFolder))
pure def alwaysFolderIsVisible(m: Mailbox): bool = m.folder != I::PurgedFolder
pure def alwaysSearchMatchesQuery(m: Mailbox): bool =
  (m.readStatus == Reading and m.readKind == Search) implies m.requestedRef == m.query
pure def lawStaleListingIsRejected(m: Mailbox, scope: ListingScope, listing: I::MetadataReceipt, by: MailActor): bool =
  scope != listingScope(m) implies not(canReceiveMessage(m, scope, listing, by))
pure def sometimesTrashFolder(m: Mailbox): bool = m.folder == I::TrashFolder
pure def sometimesDraftsFolder(m: Mailbox): bool = m.folder == I::DraftsFolder
```

### Drafts shows the provider's count of saved drafts, whichever folder is open

The Drafts row in the folder list shows how many drafts the account has
saved (`prototype/Grace Prototype.html:2030–2038`), before she ever opens Drafts.
The mailbox keeps that number as the provider reports it: the connector
reports the account's draft count with each listing, and again after a draft
is saved, deleted or removed after its email went, for the mailbox's current
read generation; a count from an earlier generation is refused, and the
connector then counts again for the generation that replaced it, so opening
an email while a count is on its way never leaves an old number. The count is
never negative. Reporting it changes nothing else in the mailbox.

```quint
pure def canCountDrafts(m: Mailbox, generation: int, total: int, by: MailActor): bool =
  by == MailConnector and readable(m) and generation == m.generation and total >= 0
pure def countDrafts(m: Mailbox, generation: int, total: int, by: MailActor): Mailbox = { ...m, draftsTotal: total }
pure def alwaysDraftCountIsNonnegative(m: Mailbox): bool = m.draftsTotal >= 0
pure def lawStaleDraftCountIsRefused(m: Mailbox, generation: int, total: int, by: MailActor): bool =
  (generation != m.generation or total < 0) implies not(canCountDrafts(m, generation, total, by))
pure def sometimesDraftsCountedElsewhere(m: Mailbox): bool = m.draftsTotal > 0 and m.folder != I::DraftsFolder
```

### Selected-message changes update the same canonical record and invalidate stale actions

The mailbox registry owns every loaded message lifecycle. Listing metadata may create
an unseen record or refresh the same settled identity at its exact captured
record revision. It never replaces a pending operation or purge tombstone. Opening an unread message requests its read flag atomically
with the successful body read. The connector dispatches that exact pending
operation and returns its identity, revision and evidence through
`completeMessageChange`; rendered content cannot fabricate the receipt.

Delete, Restore, Delete forever and Mark unread use the current selected record
and revision. They return to the list immediately. Delete, Restore and Delete
forever remove that row while its provider operation is pending; Mark unread
keeps it listed, since the message stays in its folder. Other messages remain readable. Undo names the original
message and successful Trash revision, so a later toast cannot restore another
message. Unknown outcomes retain the same pending operation for reconciliation;
no duplicate mutation is issued. A failed operation can reappear on an explicit
fresh listing. Every callback is checked against the same immutable mailbox and
per-message operation revision even after the user opens another message.

Undo appears only after the provider acknowledges the move to Trash, never while
it is pending, and stays available until the toast closes (six seconds in
`prototype/Grace Prototype.html:1826`), the next listing refresh, or another
change to that message, whichever comes first. The host reports the toast
closing, by its timer or the person's dismissal, through `closeUndoToast`,
which withdraws that Undo and nothing else.

Successful moves and purges cannot leave a stale Reply, Forward, attachment,
link or bill-source action. The affected selection and any content read are invalidated
atomically; unrelated selected messages and their reads survive. Reconnect and
restart preserve the canonical registry and its revisions, so old callbacks cannot
become current through reloading a record. The store persists each registry update
and pending operation atomically before the connector performs its effect.

```quint
pure def canChangeSelectedMessage(m: Mailbox, target: MessageTarget, change: I::MessageChange, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and m.readStatus == ReadIdle and
  selectedMessageIsCurrent(m) and target.ref == m.messageRef and target.revision == messageRecord(m, target.ref).revision and
  change != I::ReadMessage and I::canChangeMessage(messageRecord(m, target.ref), change, I::MessageUser)
pure def clearSelection(affected: bool, m: Mailbox): Mailbox =
  if (affected) { ...m, generation: m.generation + 1, view: Inbox, readStatus: ReadIdle, requestedRef: "",
    messageRef: "", attachmentRef: "", assets: List(), bill: noBill, warning: noWarning, link: noLink }
  else m
pure def changeSelectedMessage(m: Mailbox, target: MessageTarget, change: I::MessageChange, by: MailActor): Mailbox =
  clearSelection(true, { ...m, messages: putMessage(m.messages, I::changeMessage(messageRecord(m, target.ref), change, I::MessageUser)),
    messageRefs: if (change == I::UnreadMessage) m.messageRefs else m.messageRefs.exclude(Set(target.ref)) })
pure def canUndoMessageTrash(m: Mailbox, target: MessageTarget, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and
  messageRecord(m, target.ref).identity == messageIdentity(m, target.ref) and
  I::canUndoTrash(messageRecord(m, target.ref), target.revision, I::MessageUser)
pure def undoMessageTrash(m: Mailbox, target: MessageTarget, by: MailActor): Mailbox =
  val affected = m.messageRef == target.ref or (m.readStatus == Reading and m.readKind == OpenMessage and m.requestedRef == target.ref)
  clearSelection(affected, { ...m, messages: putMessage(m.messages, I::undoTrash(messageRecord(m, target.ref), target.revision, I::MessageUser)),
    messageRefs: m.messageRefs.exclude(Set(target.ref)) })
pure def canCloseUndoToast(m: Mailbox, target: MessageTarget, by: MailActor): bool =
  (by == MailHost or by == MailUser) and messageRecord(m, target.ref).identity == messageIdentity(m, target.ref) and
  I::canCloseUndo(messageRecord(m, target.ref), target.revision, I::MessageUser)
pure def closeUndoToast(m: Mailbox, target: MessageTarget, by: MailActor): Mailbox =
  { ...m, messages: putMessage(m.messages, I::closeUndo(messageRecord(m, target.ref), target.revision, I::MessageUser)) }
pure def lawClosedToastCannotUndo(m: Mailbox, target: MessageTarget, by: MailActor): bool =
  canCloseUndoToast(m, target, by) implies not(canUndoMessageTrash(closeUndoToast(m, target, by), target, MailUser))
pure def canCompleteMessageChange(m: Mailbox, messageReceipt: I::ChangeReceipt, by: MailActor): bool =
  by == MailConnector and m.connection == Connected and m.canRead and
  messageReceipt.identity == messageIdentity(m, messageReceipt.identity.ref) and
  I::canCompleteChange(messageRecord(m, messageReceipt.identity.ref), messageReceipt, I::MessageProvider)
pure def completeMessageChange(m: Mailbox, messageReceipt: I::ChangeReceipt, by: MailActor): Mailbox =
  val ref = messageReceipt.identity.ref
  val record = messageRecord(m, ref)
  val folderChange = changingFolder(record)
  val affected = folderChange and (m.messageRef == ref or (m.readStatus == Reading and m.readKind == OpenMessage and m.requestedRef == ref))
  clearSelection(affected, { ...m, messages: putMessage(m.messages, I::completeChange(record, messageReceipt, I::MessageProvider)),
    messageRefs: if (folderChange) m.messageRefs.exclude(Set(ref)) else m.messageRefs })
pure def stepMessageRecordsAreRetained(before: Mailbox, after: Mailbox): bool =
  before.messages.every(prior => after.messages.some(record => record.identity == prior.identity and
    record.revision >= prior.revision and (prior.folder == I::PurgedFolder implies record.folder == I::PurgedFolder)))
pure def lawMovedSelectionCannotReply(m: Mailbox, target: MessageTarget, change: I::MessageChange, header: ReplyHeader, by: MailActor): bool =
  canChangeSelectedMessage(m, target, change, by) implies
    (not(canReplyToMessage(changeSelectedMessage(m, target, change, by), header, MailConnector)) and
      not(canReplyToMessage(changeSelectedMessage(m, target, change, by), header, MailHost)))
pure def lawStaleMessageReceiptIsRejected(m: Mailbox, messageReceipt: I::ChangeReceipt, by: MailActor): bool =
  messageReceipt.revision != messageRecord(m, messageReceipt.identity.ref).revision implies
    not(canCompleteMessageChange(m, messageReceipt, by))
pure def sometimesMessageTrashPending(m: Mailbox): bool =
  m.messages.some(record => record.pending == I::TrashMessage)
pure def sometimesMessagePurged(m: Mailbox): bool =
  m.messages.some(record => record.folder == I::PurgedFolder)
pure def sometimesMessageMarkedUnread(m: Mailbox): bool =
  m.messages.some(record => record.pending == I::UnreadMessage and m.messageRefs.contains(record.identity.ref))
```

### A bill handoff retains verified source identity and never starts a payment

Extraction creates a candidate. Only a user-confirmed bill and independently
verified destination/account become a handoff. Opening another message or attachment, or returning a search result,
clears that handoff. The caller passes these references to the shared payment
ledger under the unique provider invoice/cycle identity; calendar occurrence IDs
do not split the ledger for the same bill. Reading an email supplies neither
payment consent nor evidence that the bill is paid.

Discovered by a guarded trace: a verified replacement candidate for the same
message could arrive between displaying a bill and receiving the person's
confirmation. A bare yes then confirmed the replacement instead. Confirmation
now carries the exact displayed mailbox/message identity, read generation and
provider bill identity. Every field must still match. The read generation keeps
its existing meaning: receipt of another candidate does not pretend to start a
new provider read. An identical candidate for the same source remains the same
choice; a different source, account, invoice, origin or read generation needs a
fresh displayed confirmation. The host authenticates the complete person's
choice; planner or connector identity cannot supply it.

The connector names the message it read. Grace keeps that reference with the
bill and checks it against the current selection before confirmation and
handoff. An older stored candidate without a verified source is cleared
without disturbing the mailbox or its outgoing sends. A message Grace flags
as a scam never becomes a bill source (next rule).

```quint
type BillSelection = { source: I::MessageIdentity, generation: int, billRef: str, origin: str, account: str }
pure def billSelection(m: Mailbox): BillSelection = {
  source: messageIdentity(m, m.bill.sourceRef), generation: m.generation,
  billRef: m.bill.ref, origin: m.bill.origin, account: m.bill.account
}
pure def canReceiveBill(m: Mailbox, generation: int, ref: str, billRef: str, origin: str, billAccount: str, verified: bool, by: MailActor): bool =
  by == MailConnector and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and selectedMessageIsCurrent(m) and m.readStatus == ReadIdle and
  generation == m.generation and ref == m.messageRef and ref != "" and billRef != "" and origin != "" and billAccount != "" and verified and
  m.warning.evidence == ""
pure def receiveBill(m: Mailbox, generation: int, ref: str, billRef: str, origin: str, billAccount: str, verified: bool, by: MailActor): Mailbox =
  { ...m, bill: { ref: billRef, sourceRef: ref, origin: origin, account: billAccount, confirmed: false } }
pure def canConfirmBill(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and selectedMessageIsCurrent(m) and m.readStatus == ReadIdle and
  m.bill.ref != "" and m.bill.sourceRef == m.messageRef and confirmed and selection == billSelection(m)
pure def confirmBill(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): Mailbox =
  { ...m, bill: { ...m.bill, confirmed: true } }
pure def lawStaleBillSelectionCannotConfirm(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): bool =
  selection != billSelection(m) implies not(canConfirmBill(m, selection, confirmed, by))
pure def lawConfirmationKeepsDisplayedBill(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): bool =
  canConfirmBill(m, selection, confirmed, by) implies
    billSelection(confirmBill(m, selection, confirmed, by)) == selection
pure def billReady(m: Mailbox): bool =
  m.bill.confirmed and m.bill.sourceRef == m.messageRef and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and m.readStatus == ReadIdle and selectedMessageIsCurrent(m)
pure def alwaysBillProvenance(m: Mailbox): bool =
  (m.bill.ref != "" implies (m.messageRef != "" and m.bill.sourceRef == m.messageRef and m.bill.origin != "" and m.bill.account != "")) and
  (m.bill.confirmed implies m.bill.ref != "")
pure def sometimesBillReady(m: Mailbox): bool = billReady(m)
```

### A scam warning needs current evidence and holds that message's links

The message reader shows "Grace thinks this email is a scam. Don't tap its
links." above a suspicious message, with the sender's real address
(`prototype/Grace Prototype.html:1960–1961`). The warning comes only from the
connector's classifier evidence in the read that opened that message, bound to
its reference and read generation; rendered text cannot raise or clear it.
Opening another message, choosing a folder, moving the message or reconnecting
clears it, and a fresh read of the same message, including reopening it from
the list, brings fresh evidence or none. Returning to the list hides it without
clearing it: the warning shows only beside the message on screen, and a link
held behind it cannot be confirmed from the list.

Links in a flagged message never open from a single tap. The prototype draws the
link as plain text (`prototype/Grace Prototype.html:1962`); here a tap holds it
behind the warning, and only the person's separate confirmation of that same
link releases it to the host, which hands it to the Browser. The mailbox must
still be connected with read access when she confirms. Cancel drops it.
A link in an unflagged message is released at once. Grace never taps a link
(`prototype/Grace Prototype.html:2107`): only the person opens or confirms one.
A flagged message cannot become a bill source, so a scam's payment request never
reaches the payment ledger.

```quint
pure def showsScamWarning(m: Mailbox): bool =
  selectedMessageIsCurrent(m) and m.warning.evidence != "" and m.warning.ref == m.messageRef
pure def canOpenLink(m: Mailbox, link: str, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and m.readStatus == ReadIdle and m.view == Message and
  selectedMessageIsCurrent(m) and link != "" and m.link.status == NoLink
pure def openLink(m: Mailbox, link: str, by: MailActor): Mailbox =
  { ...m, link: { ref: m.messageRef, link: link, status: if (m.warning.evidence != "") LinkHeld else LinkReleased } }
pure def canConfirmLink(m: Mailbox, link: str, confirmed: bool, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and confirmed and
  m.link.status == LinkHeld and m.link.link == link and m.readStatus == ReadIdle and selectedMessageIsCurrent(m)
pure def confirmLink(m: Mailbox, link: str, confirmed: bool, by: MailActor): Mailbox =
  { ...m, link: { ...m.link, status: LinkReleased } }
pure def canCancelLink(m: Mailbox, by: MailActor): bool = by == MailUser and m.link.status == LinkHeld
pure def cancelLink(m: Mailbox, by: MailActor): Mailbox = { ...m, link: noLink }
pure def canLinkOpened(m: Mailbox, link: str, by: MailActor): bool =
  by == MailHost and m.link.status == LinkReleased and m.link.link == link
pure def linkOpened(m: Mailbox, link: str, by: MailActor): Mailbox = { ...m, link: noLink }
pure def alwaysScamWarningIsCurrent(m: Mailbox): bool =
  m.warning.evidence != "" implies
    (m.messageRef != "" and m.warning.ref == m.messageRef and m.warning.generation >= 0 and m.warning.generation <= m.generation)
pure def alwaysLinkBelongsToSelection(m: Mailbox): bool =
  m.link.status != NoLink implies (m.messageRef != "" and m.link.ref == m.messageRef and m.link.link != "")
pure def alwaysFlaggedMessageIsNoBillSource(m: Mailbox): bool =
  m.warning.evidence != "" implies m.bill.ref == ""
pure def stepFlaggedLinkWaitsForConfirmation(before: Mailbox, after: Mailbox): bool =
  (before.warning.evidence != "" and before.link.status != LinkReleased and after.link.status == LinkReleased) implies
    (before.link.status == LinkHeld and after.link.link == before.link.link)
pure def sometimesScamWarningShown(m: Mailbox): bool = showsScamWarning(m)
pure def sometimesFlaggedLinkHeld(m: Mailbox): bool = m.link.status == LinkHeld
```

## Story: Write or reply and confirm before sending

> As a user, I want to review the actual recipient and message, correct them,
> and know whether the provider accepted my email without sending it twice.

### A draft is editable and a reply stays attached to its source message

The draft belongs to a chosen mailbox, including while that mailbox is offline;
an unbound mailbox cannot create or persist a draft. The draft contains
sanitized message content, never credentials or tokens.
Switching screens or disconnecting does not discard it. A hidden draft may be
replaced only after its exact contents are durably saved; a failed or unsaved
hidden draft remains recoverable and cannot be silently overwritten. `startDraft`
opens only a new, unaddressed message; a reply opens only through
`replyToMessage` (next rule), so there is one reply path. No reply is sent
merely by selecting an email. Trash exposes Restore and Delete forever, so
reply and forwarding are unavailable until that message is restored.

```quint
pure def composerFree(m: Mailbox): bool =
  m.owner != "" and m.provider != "" and m.account != "" and
  not(heldSend(m)) and not(draftStoreBusy(m)) and
  (m.sendStatus == NoDraft or m.sendStatus == Sent or (not(m.composeVisible) and m.draftStorage == DraftSaved))
pure def replyable(m: Mailbox): bool =
  composerFree(m) and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and
  selectedMessageIsCurrent(m) and m.readStatus == ReadIdle
pure def openComposer(replyTo: str, m: Mailbox): Mailbox =
  { ...m, sendStatus: Composing, draft: emptyContent, autoSubject: "",
    draftAttachments: List(), draftId: "", draftVersion: 0, composeVisible: true, draftStorage: DraftUnstored, storedRevision: -1,
    replyTo: replyTo, revision: m.revision + 1, choosing: NoChoice, ccOpen: false,
    approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def canStartDraft(m: Mailbox, reply: bool, by: MailActor): bool =
  by == MailUser and not(reply) and composerFree(m)
pure def startDraft(m: Mailbox, reply: bool, by: MailActor): Mailbox = { ...openComposer("", m), choosing: PickNewEmail }
pure def canEditDraft(m: Mailbox, by: MailActor): bool =
  (by == MailUser) and not(terminalUnsaved(m)) and not(draftStoreBusy(m)) and m.composeVisible and
  (m.sendStatus == Composing or m.sendStatus == Reviewing or m.sendStatus == SendFailed)
pure def editDraft(m: Mailbox, content: DraftContent, by: MailActor): Mailbox =
  { ...m, draft: content,
    choosing: if (pickingRecipient(m.choosing) and not(sameRecipients(content, m.draft))) NoChoice else m.choosing,
    draftStorage: DraftUnstored, draftVersion: m.draftVersion + 1, sendResultSaved: false,
    revision: m.revision + 1, approvedRevision: -1, sendStatus: Composing }
pure def canReviewDraft(m: Mailbox, by: MailActor): bool =
  (by == MailUser) and not(draftStoreBusy(m)) and m.composeVisible and m.sendStatus == Composing and m.draft.to != ""
pure def reviewDraft(m: Mailbox, by: MailActor): Mailbox =
  { ...m, sendStatus: Reviewing, approvedRevision: -1 }
pure def canApproveDraft(m: Mailbox, revision: int, by: MailActor): bool =
  (by == MailUser) and m.sendStatus == Reviewing and revision == m.revision and
  m.connection == Connected and m.canSend
pure def approveDraft(m: Mailbox, revision: int, by: MailActor): Mailbox =
  { ...m, approvedRevision: revision }
pure def canDiscardDraft(m: Mailbox, confirmed: bool, by: MailActor): bool =
  (by == MailUser) and not(terminalUnsaved(m)) and not(draftStoreBusy(m)) and m.composeVisible and
  (m.sendStatus == Composing or m.sendStatus == Reviewing or m.sendStatus == SendFailed) and confirmed
pure def discardDraft(m: Mailbox, confirmed: bool, by: MailActor): Mailbox =
  { ...m,
    draft: if (m.draftId == "") emptyContent else m.draft,
    autoSubject: if (m.draftId == "") "" else m.autoSubject,
    replyTo: if (m.draftId == "") "" else m.replyTo,
    draftAttachments: if (m.draftId == "") List() else m.draftAttachments,
    sendStatus: if (m.draftId == "") NoDraft else Composing,
    composeVisible: false, choosing: NoChoice, ccOpen: false, draftStorage: if (m.draftId == "") DraftUnstored else DraftDeleting,
    storedRevision: m.revision, draftRequest: m.draftRequest + 1, approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def draftStoreBusy(m: Mailbox): bool = m.draftStorage == DraftSaving or m.draftStorage == DraftDeleting
pure def currentDraft(m: Mailbox): DraftSnapshot = {
  id: m.draftId, version: m.draftVersion, content: m.draft,
  attachments: m.draftAttachments, replyTo: m.replyTo
}
```

### The composer remembers who she is choosing for, Cc and Bcc, and where she attaches from

What the composer is asking her is the mailbox's, so Grace is told it too
(`prototype/Grace Prototype.html:2228`): the recipient picker and which row
it fills, whether she tapped Add next to "Cc/Bcc", and whether she is
choosing a photo or a file to attach (lines 2016–2021, 2329–2340). Write,
Forward (Grace's too) and Share from Files open the new email at its
recipient picker (`PickNewEmail`). Otherwise only the person opens or closes
them, only while she can edit the draft: + next to To, Cc or Bcc opens the
picker for that row, and Back closes it. Choosing or giving a recipient
closes the picker, and attaching closes the photo or file chooser. Every way
the composer closes forgets them, so a draft opened again starts at the
composer itself. The words typed into the picker's search are the screen's
own.

```quint
pure def pickingRecipient(choice: ComposeChoice): bool =
  choice == PickNewEmail or choice == PickTo or choice == PickCc or choice == PickBcc
pure def choosingAttachment(choice: ComposeChoice): bool = choice == ChoosePhoto or choice == ChooseFile
pure def sameRecipients(one: DraftContent, other: DraftContent): bool =
  one.to == other.to and one.cc.subseteq(other.cc) and other.cc.subseteq(one.cc) and
    one.bcc.subseteq(other.bcc) and other.bcc.subseteq(one.bcc)
pure def canOpenChooser(m: Mailbox, choice: ComposeChoice, by: MailActor): bool =
  canEditDraft(m, by) and choice != NoChoice and choice != PickNewEmail and m.choosing == NoChoice
pure def openChooser(m: Mailbox, choice: ComposeChoice, by: MailActor): Mailbox =
  { ...m, choosing: choice, ccOpen: m.ccOpen or choice == PickCc or choice == PickBcc }
pure def canCloseChooser(m: Mailbox, by: MailActor): bool = by == MailUser and m.composeVisible and m.choosing != NoChoice
pure def closeChooser(m: Mailbox, by: MailActor): Mailbox = { ...m, choosing: NoChoice }
pure def canShowCopies(m: Mailbox, by: MailActor): bool = canEditDraft(m, by) and not(m.ccOpen)
pure def showCopies(m: Mailbox, by: MailActor): Mailbox = { ...m, ccOpen: true }
pure def alwaysChoosingNeedsComposer(m: Mailbox): bool =
  not(m.composeVisible) implies (m.choosing == NoChoice and not(m.ccOpen))
pure def stepOnlyThePersonOpensAChooser(before: Mailbox, via: str, after: Mailbox): bool =
  (after.choosing != NoChoice and after.choosing != before.choosing) implies
    (via == "openChooser" or ((via == "startDraft" or via == "forwardMessage" or via == "forwardAttachment" or via == "assistMail") and
      after.choosing == PickNewEmail))
pure def sometimesChoosingWhoToWriteTo(m: Mailbox): bool = m.composeVisible and m.choosing == PickNewEmail
pure def sometimesChoosingAFile(m: Mailbox): bool = m.composeVisible and m.choosing == ChooseFile
```

### A reply is addressed to the selected message's verified reply-to

Reply opens the composer already addressed, with the "Re:" subject and no
recipient picker (`prototype/Grace Prototype.html:2197`). The connector reads the
reply address of the message on screen; its header names the message it was
read from and the read generation it belongs to, and is accepted only when that
is the open message at the current read generation. The host then dispatches
`replyToMessage`. The prototype
addresses every reply to the sender (`m.from`,
`prototype/Grace Prototype.html:2142,2197`); this spec deliberately follows the
message's own reply-to header instead, which may name a different address, as
mail clients do, and the connector supplies whichever address that header
names. The recipient therefore never arrives as an edit the person
did not make, and a header from an earlier read or from another message cannot
address the reply.
The automatic subject is remembered, so it alone does not make the composer
worth keeping (`prototype/Grace Prototype.html:2199`).

```quint
type ReplyHeader = { ref: str, generation: int, address: str, subject: str, verified: bool }
pure def canReplyToMessage(m: Mailbox, header: ReplyHeader, by: MailActor): bool =
  (by == MailConnector or by == MailHost) and m.view == Message and replyable(m) and
  header.ref == m.messageRef and header.generation == m.generation and header.verified and header.address != ""
pure def replyToMessage(m: Mailbox, header: ReplyHeader, by: MailActor): Mailbox =
  { ...openComposer(m.messageRef, m), draft: { ...emptyContent, to: header.address, subject: header.subject },
    autoSubject: header.subject }
pure def lawReplyIsAddressedFromVerifiedHeader(m: Mailbox, header: ReplyHeader, by: MailActor): bool =
  canReplyToMessage(m, header, by) implies
    (replyToMessage(m, header, by).draft.to == header.address and replyToMessage(m, header, by).replyTo == m.messageRef and
      header.verified and header.ref == m.messageRef and header.generation == m.generation)
pure def sometimesReplyAddressed(m: Mailbox): bool = m.composeVisible and m.replyTo != "" and m.draft.to != ""
```

### Grace's reply is a draft that only the person can approve and send

When the person asks Grace to answer the email on screen, Grace writes the body
in the person's voice and the reply opens with her words in it; she points at
Send and never sends (`prototype/Grace Prototype.html:2244,2280`). Her request
first opens an ordinary reply through `replyToMessage`, so the connector, not
Grace, supplies its recipient and subject from the verified header; Grace then
adds only the body to that open, still empty draft (`assistMail` with
`AssistFill`). She cannot change who it goes to, and she never writes over
words the person typed. Unlike the prototype, which builds the whole reply from
Grace's request in one step (`prototype/Grace Prototype.html:2280`), nothing
Grace sends can address an email. Her draft is visible in the composer, at a
new revision and with no approval. Only the person's Send tap
(`confirmVisibleSend`) or explicit approval (`approveDraft`) at that exact
revision approves a draft, and only an approved current revision is dispatched
or queued, so a draft Grace wrote reaches Sending or Outbox only after the
person approved exactly what she sees.

```quint
pure def lawGraceReplyIsUnapproved(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): bool =
  val after = assistMail(m, assist, asked, by)
  val filling = match assist { | AssistFill(x) => true | _ => false }
  (filling and canAssistMail(m, assist, asked, by)) implies
    (after.approvedRevision == -1 and after.composeVisible and after.sendStatus == Composing and after.revision > m.revision)
pure def lawGraceReplyKeepsTheAddress(m: Mailbox, assist: MailAssist, asked: bool, by: MailActor): bool =
  val after = assistMail(m, assist, asked, by)
  match assist {
    | AssistFill(x) => canAssistMail(m, assist, asked, by) implies
        (after.draft.to == m.draft.to and after.draft.cc.subseteq(m.draft.cc) and m.draft.cc.subseteq(after.draft.cc) and
          after.draft.bcc.subseteq(m.draft.bcc) and m.draft.bcc.subseteq(after.draft.bcc) and
          after.draft.subject == m.draft.subject and after.draft.body == x.body and after.replyTo == m.replyTo)
    | _ => true
  }
pure def stepOnlyThePersonApproves(before: Mailbox, via: str, after: Mailbox): bool =
  (after.approvedRevision != -1 and after.approvedRevision != before.approvedRevision) implies
    (via == "confirmVisibleSend" or via == "approveDraft")
pure def stepSendingNeedsCurrentApproval(before: Mailbox, via: str, after: Mailbox): bool =
  (after.sendStatus == Sending and before.sendStatus != Sending) implies
    (via == "sendDraft" and before.approvedRevision == before.revision)
pure def sometimesGraceReplyOpen(m: Mailbox): bool =
  m.composeVisible and m.replyTo != "" and m.draft.to != "" and m.draft.body != "" and m.approvedRevision == -1
```

### Only the current approved draft may dispatch and an unknown send cannot retry

The adapter validates recipient syntax and persists the operation identifier
before dispatch. A verified provider acknowledgment establishes Sent; it does not claim
the recipient read or received it. A verified non-send establishes SendFailed.
Timeout, disconnect or crash leaves SendUnknown. Reconciliation must inspect the
same operation and produce actual provider evidence; it cannot treat a missing
confirmation as proof of failure. A failed draft requires edit/review/approval
again. The operation identifier is fresh across persisted sends; `issuedSends` retains
used identifiers even after a draft is discarded. `operationId` identifies the
current attempt. A provider-confirmed Sent/SendFailed result remains visible
when saving its evidence fails; `sendResultSaved == false` then reports a local
save failure, not an unknown provider outcome. The exact draft and operation
stay fixed until persistence succeeds. `persistSendResult` retries that local
write without submitting another email. Only its durable Sent receipt retires
the draft. Restart after losing unsaved terminal evidence reconciles from the
already-durable send intent as SendUnknown. Discovered by restart review:
terminal evidence still belongs to an issued operation, and unsaved Sent must
not have retired its draft; those facts preserve the unknown-send fence after
a process loses the unsaved result.

```quint
pure def canSendDraft(m: Mailbox, operationId: str, recipientValid: bool, persisted: bool, by: MailActor): bool =
  (by == MailHost) and not(draftStoreBusy(m)) and m.connection == Connected and m.canSend and m.sendStatus == Reviewing and
  m.approvedRevision == m.revision and operationId != "" and not(m.issuedSends.contains(operationId)) and recipientValid and persisted
pure def sendDraft(m: Mailbox, operationId: str, recipientValid: bool, persisted: bool, by: MailActor): Mailbox =
  { ...m, sendStatus: Sending, operationId: operationId, issuedSends: m.issuedSends.union(Set(operationId)), sendEvidence: "", sendResultSaved: false, approvedRevision: -1 }
pure def canSendResult(m: Mailbox, operationId: str, resultStatus: SendStatus, evidence: str, persisted: bool, by: MailActor): bool =
  (by == MailConnector) and unresolved(m) and operationId == m.operationId and
  (resultStatus == SendUnknown or ((resultStatus == Sent or resultStatus == SendFailed) and evidence != ""))
pure def sendResult(m: Mailbox, operationId: str, resultStatus: SendStatus, evidence: str, persisted: bool, by: MailActor): Mailbox =
  { ...m, sendStatus: resultStatus, sendResultSaved: resultStatus != SendUnknown and persisted,
    retiredDrafts: if (resultStatus == Sent and persisted) retireCurrentDraft(m) else m.retiredDrafts, composeVisible: if (resultStatus == Sent) false else m.composeVisible,
    sentDrafts: if (resultStatus == Sent and persisted) sentDraft(m) else m.sentDrafts,
    choosing: if (resultStatus == Sent) NoChoice else m.choosing, ccOpen: if (resultStatus == Sent) false else m.ccOpen,
    sendEvidence: if (resultStatus == SendUnknown) "" else evidence }
pure def canPersistSendResult(m: Mailbox, operationId: str, by: MailActor): bool =
  by == MailHost and terminalUnsaved(m) and operationId == m.operationId
pure def persistSendResult(m: Mailbox, operationId: str, persisted: bool, by: MailActor): Mailbox =
  { ...m, sendResultSaved: persisted,
    retiredDrafts: if (persisted and m.sendStatus == Sent) retireCurrentDraft(m) else m.retiredDrafts,
    sentDrafts: if (persisted and m.sendStatus == Sent) sentDraft(m) else m.sentDrafts }
pure def alwaysResultPersistenceHasTerminal(m: Mailbox): bool =
  m.sendResultSaved implies (m.sendStatus == Sent or m.sendStatus == SendFailed)
pure def sometimesResultSaveFailed(m: Mailbox): bool = terminalUnsaved(m)
pure def canInterrupt(m: Mailbox, by: MailActor): bool = ((by == MailUser or by == MailHost)) and (m.readStatus == Reading or m.sendStatus == Sending or m.sendStatus == Reviewing)
pure def interrupt(m: Mailbox, by: MailActor): Mailbox =
  { ...m, readStatus: ReadIdle, generation: m.generation + 1, approvedRevision: -1, sendStatus: fencedSend(m),
    outbox: fenceQueue(m.outbox) }
pure def fencedSend(m: Mailbox): SendStatus =
  if (m.sendStatus == Sending) SendUnknown else if (m.sendStatus == Reviewing) Composing else m.sendStatus
pure def alwaysSendHasRecipient(m: Mailbox): bool =
  (m.sendStatus == Reviewing or unresolved(m) or m.sendStatus == Sent or m.sendStatus == SendFailed)
    implies m.draft.to != ""
pure def alwaysSendEvidence(m: Mailbox): bool =
  (unresolved(m) implies (m.operationId != "" and m.issuedSends.contains(m.operationId))) and
  ((m.sendStatus == Sent or m.sendStatus == SendFailed) implies
    (m.operationId != "" and m.issuedSends.contains(m.operationId) and m.sendEvidence != ""))
pure def alwaysApprovalIsCurrent(m: Mailbox): bool =
  m.approvedRevision != -1 implies (m.sendStatus == Reviewing and m.approvedRevision == m.revision)
pure def stepUnresolvedDraftIsFixed(before: Mailbox, after: Mailbox): bool =
  heldSend(before) implies
    (after.draft.to == before.draft.to and after.draft.subject == before.draft.subject and
      after.draft.body == before.draft.body and after.draft.cc.subseteq(before.draft.cc) and before.draft.cc.subseteq(after.draft.cc) and
      after.draft.bcc.subseteq(before.draft.bcc) and before.draft.bcc.subseteq(after.draft.bcc) and after.draftAttachments == before.draftAttachments and
      after.operationId == before.operationId and after.draftId == before.draftId and after.draftVersion == before.draftVersion)
pure def sometimesSent(m: Mailbox): bool = m.sendStatus == Sent
pure def sometimesUncertain(m: Mailbox): bool = m.sendStatus == SendUnknown
pure def sometimesSendFailed(m: Mailbox): bool = m.sendStatus == SendFailed
```

### An email sent while offline waits in Outbox and goes once, by itself, when the tablet is back online

When the person taps Send while the tablet cannot reach her email company, the
email waits in Outbox and goes by itself when the tablet is back online
(`prototype/Grace Prototype.html:2118,2342`). The person's Send approves the
exact draft as always; the host then persists the send intent with a fresh
operation identifier, as for a direct send, and `queueSend` puts a snapshot of
that approved draft in Outbox and closes the composer, which is free for
another email. Queueing needs the same current approval as sending, so a draft
changed after Send must be approved again, and the queued snapshot is never
edited. Being offline is not a connection state: the account is still
connected, and only the host knows whether the provider is reachable.

When the tablet is online again the host dispatches each waiting entry
(`dispatchQueued`), and only the connector's answer for that same operation
settles it (`queuedResult`). A durably recorded Sent takes it out of Outbox. A
failure the provider confirmed keeps it in Outbox as failed, and the person can
reopen it in the composer to change and send again (`reopenQueued`). An
unknown outcome, an unsaved result, or a lost connection, interruption or
restart while it is being dispatched marks it unknown, and an unknown entry is
never dispatched again: only the provider's answer for that operation settles
it, so an email in Outbox goes at most once. That waiting entries go by
themselves is the host's duty, since reachability is not in this state.

The prototype moves Outbox mail to Sent the moment the tablet is online
(`prototype/Grace Prototype.html:2193`) and tells Grace the email was sent when
it was only queued (line 2342); here it leaves Outbox only on the provider's
evidence, and queued is never reported as sent.

```quint
pure val noSnapshot: DraftSnapshot = { id: "", version: 0, content: emptyContent, attachments: List(), replyTo: "" }
pure val noQueued: QueuedSend = { operationId: "", snapshot: noSnapshot, status: Waiting, evidence: "" }
pure def isQueued(outbox: List[QueuedSend], operationId: str): bool = outbox.some(q => q.operationId == operationId)
pure def queuedIn(outbox: List[QueuedSend], operationId: str): QueuedSend =
  outbox.select(q => q.operationId == operationId).nthOr(0, noQueued)
pure def withStatus(outbox: List[QueuedSend], operationId: str, queueStatus: OutboxStatus, evidence: str): List[QueuedSend] =
  outbox.listMap(q => if (q.operationId == operationId) { ...q, status: queueStatus, evidence: evidence } else q)
pure def fenceQueue(outbox: List[QueuedSend]): List[QueuedSend] =
  outbox.listMap(q => if (q.status == Dispatching) { ...q, status: DispatchUnknown } else q)
pure def withoutQueued(outbox: List[QueuedSend], operationId: str): List[QueuedSend] =
  outbox.select(q => q.operationId != operationId)
pure def canQueueSend(m: Mailbox, operationId: str, recipientValid: bool, persisted: bool, reachable: bool, by: MailActor): bool =
  by == MailHost and not(reachable) and not(draftStoreBusy(m)) and m.sendStatus == Reviewing and
  m.approvedRevision == m.revision and m.connection == Connected and m.canSend and
  operationId != "" and not(m.issuedSends.contains(operationId)) and recipientValid and persisted
pure def queueSend(m: Mailbox, operationId: str, recipientValid: bool, persisted: bool, reachable: bool, by: MailActor): Mailbox =
  { ...m, outbox: m.outbox.append({ operationId: operationId, snapshot: currentDraft(m), status: Waiting, evidence: "" }),
    issuedSends: m.issuedSends.union(Set(operationId)), retiredDrafts: retireCurrentDraft(m),
    choosing: NoChoice, ccOpen: false, draft: emptyContent, autoSubject: "", replyTo: "", draftAttachments: List(), draftId: "", draftVersion: 0,
    composeVisible: false, sendStatus: NoDraft, approvedRevision: -1, draftStorage: DraftUnstored, storedRevision: -1,
    operationId: "", sendEvidence: "", sendResultSaved: false }
pure def canDispatchQueued(m: Mailbox, operationId: str, reachable: bool, by: MailActor): bool =
  by == MailHost and reachable and m.connection == Connected and m.canSend and
  isQueued(m.outbox, operationId) and queuedIn(m.outbox, operationId).status == Waiting
pure def dispatchQueued(m: Mailbox, operationId: str, reachable: bool, by: MailActor): Mailbox =
  { ...m, outbox: withStatus(m.outbox, operationId, Dispatching, "") }
pure def canQueuedResult(m: Mailbox, operationId: str, resultStatus: SendStatus, evidence: str, persisted: bool, by: MailActor): bool =
  by == MailConnector and isQueued(m.outbox, operationId) and
  (queuedIn(m.outbox, operationId).status == Dispatching or queuedIn(m.outbox, operationId).status == DispatchUnknown) and
  (resultStatus == SendUnknown or ((resultStatus == Sent or resultStatus == SendFailed) and evidence != ""))
pure def queuedResult(m: Mailbox, operationId: str, resultStatus: SendStatus, evidence: str, persisted: bool, by: MailActor): Mailbox =
  val sentId = queuedIn(m.outbox, operationId).snapshot.id
  if (resultStatus == Sent and persisted) { ...m, outbox: withoutQueued(m.outbox, operationId), outboxSent: m.outboxSent + 1,
    sentDrafts: if (sentId == "") m.sentDrafts else m.sentDrafts.union(Set(sentId)) }
  else if (resultStatus == SendFailed and persisted) { ...m, outbox: withStatus(m.outbox, operationId, DispatchFailed, evidence) }
  else { ...m, outbox: withStatus(m.outbox, operationId, DispatchUnknown, "") }
pure def canReopenQueued(m: Mailbox, operationId: str, by: MailActor): bool =
  by == MailUser and isQueued(m.outbox, operationId) and queuedIn(m.outbox, operationId).status == DispatchFailed and
  composerFree(m) and
  not(draftRetired(m, queuedIn(m.outbox, operationId).snapshot.id, queuedIn(m.outbox, operationId).snapshot.version + 1))
pure def reopenQueued(m: Mailbox, operationId: str, by: MailActor): Mailbox =
  val queued = queuedIn(m.outbox, operationId).snapshot
  { ...m, outbox: withoutQueued(m.outbox, operationId),
    draftId: queued.id, draftVersion: queued.version + 1, draft: queued.content, autoSubject: "",
    draftAttachments: queued.attachments, replyTo: queued.replyTo, composeVisible: true,
    sendStatus: Composing, draftStorage: DraftUnstored, storedRevision: -1, revision: m.revision + 1,
    approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def alwaysQueuedSendsAreIssued(m: Mailbox): bool =
  m.outboxSent >= 0 and
  m.outbox.every(q => q.operationId != "" and m.issuedSends.contains(q.operationId) and q.snapshot.content.to != "" and
    q.snapshot.version >= 0 and q.snapshot.attachments.every(a => F::validFile(a)) and
    (q.status == DispatchFailed implies q.evidence != "") and
    m.outbox.select(o => o.operationId == q.operationId).length() == 1)
pure def stepQueueNeedsCurrentApproval(before: Mailbox, via: str, after: Mailbox): bool =
  after.outbox.length() > before.outbox.length() implies
    (via == "queueSend" and before.sendStatus == Reviewing and before.approvedRevision == before.revision)
pure def stepQueuedSendGoesOnce(before: Mailbox, after: Mailbox): bool =
  after.outbox.every(q =>
    (queuedIn(after.outbox, q.operationId).status == Waiting or queuedIn(after.outbox, q.operationId).status == Dispatching) implies
      (not(isQueued(before.outbox, q.operationId)) or queuedIn(before.outbox, q.operationId).status == Waiting or
        queuedIn(before.outbox, q.operationId).status == queuedIn(after.outbox, q.operationId).status))
pure def sometimesOutboxWaiting(m: Mailbox): bool = m.outbox.some(q => q.status == Waiting) and m.sendStatus == NoDraft
pure def sometimesQueuedSent(m: Mailbox): bool = m.outboxSent > 0
pure def sometimesQueuedUnknown(m: Mailbox): bool = m.outbox.some(q => q.status == DispatchUnknown)
pure def sometimesQueuedFailed(m: Mailbox): bool = m.outbox.some(q => q.status == DispatchFailed)
```

### The visible Send button approves exactly the composer the user sees

Selecting recipients uses arbitrary contact/email identities, not the prototype's
sample contacts. To, Cc, Bcc, subject, body and every attachment are included in
the reviewed revision. Changing any of them invalidates consent. The manual Send
button invokes `confirmVisibleSend` and then dispatches internally; it does not
add an extra review screen. Assisted sending uses `reviewDraft` and explicit
`approveDraft` of the exact content. Empty subject or body is valid, including an
attachment-only email, so the earlier nonempty-body rule is corrected to require
a recipient. All recipient addresses still undergo provider syntax validation.

```quint
pure def canConfirmVisibleSend(m: Mailbox, revision: int, by: MailActor): bool =
  by == MailUser and m.composeVisible and not(draftStoreBusy(m)) and
  (m.sendStatus == Composing or m.sendStatus == Reviewing) and m.draft.to != "" and
  revision == m.revision and m.connection == Connected and m.canSend
pure def confirmVisibleSend(m: Mailbox, revision: int, by: MailActor): Mailbox =
  { ...m, sendStatus: Reviewing, approvedRevision: revision }
```

### Back preserves the exact draft and storage failure leaves it recoverable

Discovered by the generated transition review: a whole-mailbox clearing helper
would itself become a public unguarded event, bypassing unresolved-send
protection. Clearing is confined to the authorized discard and acknowledged
draft-deletion transitions. Discovered by callback review: revision alone does
not distinguish Save and Discard of the same content; the request serial must
also match before acknowledging either operation.

Back and closing the app request persistence of a draft worth keeping (next
rule). Persistence binds the mailbox, stable draft ID
and revision plus a monotonic request serial; stale acknowledgments cannot
save newer edits or confuse a prior Save with a subsequent Discard. The store
atomically fences writes by that serial and retains deletion tombstones, so a
delayed older Save cannot resurrect a deleted draft after restart. The composer may
close while storage is pending but another draft cannot overwrite it. Failure
reopens the recoverable draft. Saving gives the provider each attachment's own
bytes, a photo taken on the tablet or a file from Files included, so the saved
draft holds them. Reopening Drafts reads the selected provider draft
and restores all recipients and attachments as that draft's own, so a saved
draft can be open in the composer again and sends with what it holds. Discard of an existing draft awaits durable deletion; the
single Discard tap is the user's authorization.

```quint
pure def canPreserveDraft(m: Mailbox, draftId: str, by: MailActor): bool =
  canEditDraft(m, by) and worthPreserving(m) and draftId != "" and not(draftRetired(m, draftId, m.draftVersion)) and
  (m.draftId == "" or m.draftId == draftId)
pure def preserveDraft(m: Mailbox, draftId: str, by: MailActor): Mailbox =
  { ...m, draftId: draftId, draftStorage: DraftSaving, storedRevision: m.revision, draftRequest: m.draftRequest + 1,
    composeVisible: false, choosing: NoChoice, ccOpen: false, sendStatus: Composing, approvedRevision: -1, sendResultSaved: false }
pure def canDraftStoreResult(m: Mailbox, draftId: str, revision: int, request: int, by: MailActor): bool =
  by == MailHost and draftStoreBusy(m) and draftId == m.draftId and revision == m.storedRevision and request == m.draftRequest
pure def draftStoreResult(m: Mailbox, draftId: str, revision: int, request: int, persisted: bool, by: MailActor): Mailbox =
  val deleting = persisted and m.draftStorage == DraftDeleting
  { ...m, retiredDrafts: if (deleting) retireCurrentDraft(m) else m.retiredDrafts,
    draft: if (deleting) emptyContent else m.draft,
    autoSubject: if (deleting) "" else m.autoSubject,
    replyTo: if (deleting) "" else m.replyTo,
    draftAttachments: if (deleting) List() else m.draftAttachments,
    draftStorage: if (not(persisted)) DraftStoreFailed
      else if (m.draftStorage == DraftDeleting) DraftUnstored else DraftSaved,
    sendStatus: if (persisted and m.draftStorage == DraftDeleting) NoDraft else Composing,
    draftId: if (persisted and m.draftStorage == DraftDeleting) "" else m.draftId,
    composeVisible: not(persisted) }
pure def canRestoreDraft(m: Mailbox, snapshot: DraftSnapshot, generation: int, verified: bool, by: MailActor): bool =
  by == MailConnector and m.connection == Connected and m.canRead and m.view == Message and selectedMessageIsCurrent(m) and m.folder == I::DraftsFolder and
  m.readStatus == ReadIdle and generation == m.generation and verified and
  snapshot.id == m.messageRef and snapshot.id != "" and snapshot.version >= 0 and
  not(draftRetired(m, snapshot.id, snapshot.version)) and snapshot.attachments.every(a => F::validFile(a)) and
  not(heldSend(m)) and not(draftStoreBusy(m)) and not(m.composeVisible)
pure def restoreDraft(m: Mailbox, snapshot: DraftSnapshot, generation: int, verified: bool, by: MailActor): Mailbox =
  { ...m, draftId: snapshot.id, draftVersion: snapshot.version, draft: snapshot.content, autoSubject: "",
    draftAttachments: snapshot.attachments, replyTo: snapshot.replyTo, composeVisible: true,
    sendStatus: Composing, draftStorage: DraftSaved, revision: m.revision + 1, storedRevision: m.revision + 1,
    approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def alwaysDraftHasAccount(m: Mailbox): bool =
  m.sendStatus != NoDraft implies (m.owner != "" and m.provider != "" and m.account != "")
pure def alwaysDraftStoreHasRevision(m: Mailbox): bool =
  draftStoreBusy(m) implies (m.draftId != "" and m.storedRevision == m.revision and
    m.sendStatus == Composing and not(m.composeVisible))
pure def sometimesDraftSaved(m: Mailbox): bool = m.draftStorage == DraftSaved
pure def sometimesDraftStorageFailed(m: Mailbox): bool = m.draftStorage == DraftStoreFailed
pure def sometimesSavedDraftReopened(m: Mailbox): bool = m.composeVisible and m.draftStorage == DraftSaved
```

### Back and Close keep a composer worth keeping and close an empty one

A composer is worth keeping when it already has a stored draft, a body, an
attachment, or a subject the person typed rather than the automatic "Re:" or
"Fwd:" one. The prototype's Back (`prototype/Grace Prototype.html:2199`) keeps a
body, an attachment, or a typed subject on a new message only. This spec
departs from it in three ways, on purpose. A subject the person typed is kept
on a reply too, where the prototype drops any reply subject (`!c.replyTo`), so
words the person wrote are never lost. A composer reopened from a stored draft
counts even when emptied, so closing it never silently abandons that stored
draft; only Discard removes it. Back and Close both use this one test, so a
typed subject is kept on Close too, where the prototype's Close
(`prototype/Grace Prototype.html:2156`) would drop it. A
composer worth keeping is preserved (`preserveDraft`); any other closes without
being stored (`closeEmptyComposer`), as the prototype drops it. A composer worth
keeping never ends with no draft except through the person's Discard: at once
for one never stored, or once the store acknowledges deleting a saved one; or
through the person's Send, when its approved snapshot goes to Outbox.

```quint
pure def worthPreserving(m: Mailbox): bool =
  m.draftId != "" or m.draft.body != "" or m.draftAttachments.length() > 0 or
  (m.draft.subject != "" and m.draft.subject != m.autoSubject)
pure def canCloseEmptyComposer(m: Mailbox, by: MailActor): bool = canEditDraft(m, by) and not(worthPreserving(m))
pure def closeEmptyComposer(m: Mailbox, by: MailActor): Mailbox =
  { ...m, draft: emptyContent, autoSubject: "", replyTo: "", draftAttachments: List(), sendStatus: NoDraft,
    composeVisible: false, choosing: NoChoice, ccOpen: false, draftStorage: DraftUnstored, approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def stepWorthyComposerIsNotDropped(before: Mailbox, via: str, after: Mailbox): bool =
  (before.sendStatus != NoDraft and after.sendStatus == NoDraft and worthPreserving(before)) implies
    (via == "discardDraft" or via == "queueSend" or (via == "draftStoreResult" and before.draftStorage == DraftDeleting))
```

### Sending or discarding retires the completed draft revision without hiding newer work

A stable draft ID has a monotonic provider/store version, separate from the
composer's local consent revision. Editing any recipients, text or attachments
increments its draft version. Restoring uses the provider's verified version;
provider/store adapters serialize versions for that ID and never reuse a
version for different content. Saves and deletes compare the exact requested
draft version; a concurrent newer version produces a conflict/failure, never an
unconditional overwrite or deletion. The mailbox retains only the highest retired
version per draft ID. Durably recorded Sent, acknowledged deletion after Discard,
or putting the approved draft in Outbox retires that version and all older
snapshots; a failed Outbox entry reopens at the next version. Sending, uncertainty, failure and
merely navigating away never retire anything. A later legitimate version with
the same ID remains eligible to restore. Retirement is persisted with the
terminal result before the UI reports completion.

This closes the prototype's Drafts → Send/Discard lifecycle without treating a
stale listing or read as a new unsent draft. The Drafts list uses `draftRetired`
when version metadata is available; opening always checks the exact snapshot.
Mailbox ownership scopes the registry, so another account's same draft ID is
independent. `revision` orders local edits for exact-content approval;
`draftVersion` is the provider/store version of this draft's contents;
`draftRequest` is the operation serial that distinguishes Save from Discard even
when content is unchanged. None substitutes for another.

Startup hydrates this mailbox's durable state before dispatching `restartMailbox`;
`initial` is only for a mailbox with no history. Restart preserves account binding,
retired versions, drafts and issued operation IDs. An older saved mailbox without a
draft count starts with the initial count until the provider reports one. An
already stored count survives restart. Restart invalidates read callbacks
and approvals and reconciles any in-flight send as unknown. Pending draft writes
retain their request serial for store reconciliation; restart does not pretend
they succeeded or clear their tombstones.

```quint
pure def retiredVersion(m: Mailbox, draftId: str): int = m.retiredDrafts.getOr(draftId, -1)
pure def draftRetired(m: Mailbox, draftId: str, version: int): bool = version <= retiredVersion(m, draftId)
pure def retireCurrentDraft(m: Mailbox): str -> int =
  if (m.draftId == "") m.retiredDrafts else
    m.retiredDrafts.put(m.draftId, if (m.draftVersion > retiredVersion(m, m.draftId)) m.draftVersion else retiredVersion(m, m.draftId))
pure def canRestartMailbox(m: Mailbox, by: MailActor): bool = by == MailHost
pure def restartMailbox(m: Mailbox, by: MailActor): Mailbox =
  { ...clearSelection(true, endConnection(m, Disconnected, MailUser)), messageRefs: Set(),
    sendStatus: if (terminalUnsaved(m)) SendUnknown else fencedSend(m),
    sendEvidence: if (terminalUnsaved(m)) "" else m.sendEvidence }
pure def stepMailboxIdentityIsFixed(before: Mailbox, after: Mailbox): bool =
  before.owner != "" implies (after.owner == before.owner and after.provider == before.provider and after.account == before.account)
pure def alwaysRetirementHasMailbox(m: Mailbox): bool =
  m.retiredDrafts != noRetiredDrafts implies (m.owner != "" and m.provider != "" and m.account != "")
pure def lawRestartRetainsDraftHistory(m: Mailbox, by: MailActor): bool =
  restartMailbox(m, by).retiredDrafts == m.retiredDrafts and
  restartMailbox(m, by).draftId == m.draftId and restartMailbox(m, by).draftVersion == m.draftVersion and
  restartMailbox(m, by).draftRequest == m.draftRequest and restartMailbox(m, by).operationId == m.operationId and
  (terminalUnsaved(m) implies restartMailbox(m, by).sendStatus == SendUnknown)
pure def alwaysDraftVersions(m: Mailbox): bool =
  m.draftVersion >= 0
pure def alwaysEditableDraftIsNotRetired(m: Mailbox): bool =
  (m.draftId != "" and m.sendStatus != NoDraft and (m.sendStatus != Sent or not(m.sendResultSaved))) implies
    not(draftRetired(m, m.draftId, m.draftVersion))
pure def stepRetirementRequiresCompletion(before: Mailbox, via: str, after: Mailbox): bool =
  before.retiredDrafts != after.retiredDrafts implies
    ((heldSend(before) and after.sendStatus == Sent and after.sendResultSaved) or
      (before.draftStorage == DraftDeleting and after.sendStatus == NoDraft) or
      (via == "queueSend" and after.outbox.length() > before.outbox.length()))
pure def lawRetiredSnapshotCannotRestore(m: Mailbox, snapshot: DraftSnapshot, generation: int, verified: bool, by: MailActor): bool =
  draftRetired(m, snapshot.id, snapshot.version) implies not(canRestoreDraft(m, snapshot, generation, verified, by))
pure def lawNewerSnapshotIsEligible(m: Mailbox, snapshot: DraftSnapshot, generation: int, verified: bool, by: MailActor): bool =
  by == MailConnector and m.connection == Connected and m.canRead and m.view == Message and selectedMessageIsCurrent(m) and m.folder == I::DraftsFolder and
  m.readStatus == ReadIdle and generation == m.generation and verified and snapshot.id == m.messageRef and snapshot.id != "" and
  snapshot.version >= 0 and snapshot.version > retiredVersion(m, snapshot.id) and snapshot.attachments.every(a => F::validFile(a)) and
  not(heldSend(m)) and not(draftStoreBusy(m)) and not(m.composeVisible) implies
    canRestoreDraft(m, snapshot, generation, verified, by)
pure def lawRetiringCurrentVersion(m: Mailbox): bool =
  m.draftId != "" and m.draftVersion >= 0 implies retireCurrentDraft(m).getOr(m.draftId, -1) >= m.draftVersion
pure def lawRetirementPreservesOtherDrafts(m: Mailbox, draftId: str): bool =
  draftId != m.draftId implies retireCurrentDraft(m).getOr(draftId, -1) == retiredVersion(m, draftId)
pure def lawRetirementPreservesValidVersion(m: Mailbox, draftId: str): bool =
  m.draftVersion >= 0 and retiredVersion(m, draftId) >= -1 implies retireCurrentDraft(m).getOr(draftId, -1) >= -1
pure def sometimesDraftRetired(m: Mailbox): bool = m.draftId != "" and retiredVersion(m, m.draftId) >= 0
```

### Sending a saved draft takes it out of Drafts

A draft she saved, or reopened from Drafts, leaves the provider's Drafts once
its email goes, as in the prototype (`prototype/Grace Prototype.html:2342`):
only once the provider's Sent is durably recorded, for an email sent at once
or one that waited in Outbox, is its draft ID put in `sentDrafts`; sending,
waiting in Outbox, uncertainty or failure never removes it. While the tablet is online the host
asks the provider to delete each one, asking again after a failure the next
time it works the mailbox (the tablet coming back online, a listing, a send,
or every half minute), until it
is deleted or the provider says it is already gone, then forgets it
(`forgetSentDraft`), and Drafts is counted again. An expired sign-in keeps it until she signs in again. A failed Outbox
email reopened in the composer was never sent, so its draft is still there to
save again.

```quint
pure def sentDraft(m: Mailbox): Set[str] = if (m.draftId == "") m.sentDrafts else m.sentDrafts.union(Set(m.draftId))
pure def canForgetSentDraft(m: Mailbox, draftId: str, by: MailActor): bool = by == MailHost and m.sentDrafts.contains(draftId)
pure def forgetSentDraft(m: Mailbox, draftId: str, by: MailActor): Mailbox = { ...m, sentDrafts: m.sentDrafts.exclude(Set(draftId)) }
pure def stepDraftIsRemovedOnlyOnceItsEmailWent(before: Mailbox, via: str, after: Mailbox): bool =
  not(after.sentDrafts.subseteq(before.sentDrafts)) implies
    (((via == "sendResult" or via == "persistSendResult") and after.sendStatus == Sent and after.sendResultSaved) or
      (via == "queuedResult" and after.outboxSent > before.outboxSent))
pure def alwaysSentDraftsHaveMailbox(m: Mailbox): bool =
  m.sentDrafts.size() > 0 implies (m.owner != "" and m.provider != "" and m.account != "" and not(m.sentDrafts.contains("")))
pure def sometimesSentDraftAwaitsRemoval(m: Mailbox): bool = m.sentDrafts.size() > 0
```

### Attachment actions preserve exact asset and message identity

The gallery shows the selected photo and moves only within this message's
ordered photos; after it moves past the first photo, Back still returns to its
message. PDF Back returns to its message. Save one, Save all, Forward and
Files sharing carry immutable source/content IDs. File names are
labels. The atomic message-read manifest supplies all assets in provider order, with
unique immutable IDs and sources. Forwarding a whole message always copies this
complete manifest; individual-attachment forwarding copies only the selection,
so a new draft can carry exactly the attachment on screen. Camera, Photos and file-picker results require an explicit user selection
and a trusted host grant for this owner; no sample photo is injected. Canceling
any picker leaves the draft unchanged. Its result must match the exact composer
revision captured at launch, so a delayed result cannot attach to a later draft. Forwarding copies sanitized selected
content and attachments into a new editable draft and never sends it.

When adding a file and preparing the message for delivery, the connector
checks which formats and filenames the provider accepts. The draft can
carry up to ten attachments with different filenames, ignoring case.
An older draft with an incompatible attachment stays editable. Its
attachments are never renamed or converted during delivery.

Saving is dispatched to [Files](./files.md). `mayExportAttachments`
is the source authorization check before the host constructs its `FileImport`;
only Files' durable acknowledgment permits “Saved to Files”. There is no Print:
the prototype offers none. Preview uses actual content, pages and errors, not the
prototype's fixed two-page sample. Dangerous links/content cannot authorize an
action, including when a scam warning is displayed.

```quint
pure def canForwardMessage(m: Mailbox, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and selectedMessageIsCurrent(m) and
  m.folder != I::TrashFolder and m.readStatus == ReadIdle and m.messageRef != "" and canStartDraft(m, false, by)
pure def forwardMessage(m: Mailbox, content: DraftContent, by: MailActor): Mailbox =
  { ...startDraft(m, false, by), draft: { ...emptyContent, subject: content.subject, body: content.body },
    autoSubject: content.subject, draftAttachments: m.assets }
pure def canForwardAttachment(m: Mailbox, by: MailActor): bool =
  canForwardMessage(m, by) and m.view == Attachment and m.assets.some(a => a.sourceRef == m.attachmentRef)
pure def forwardAttachment(m: Mailbox, content: DraftContent, by: MailActor): Mailbox =
  { ...startDraft(m, false, by), draft: { ...emptyContent, subject: content.subject, body: content.body },
    autoSubject: content.subject, draftAttachments: selectedAssets(m, Set(m.attachmentRef)) }
pure def photoAssets(m: Mailbox): List[F::SavedFile] = m.assets.select(a => a.kind == F::Photo)
pure def photoPosition(m: Mailbox): int =
  photoAssets(m).foldl(F::noPhotoCursor, (r, a) => { at: r.at + 1, found: if (a.sourceRef == m.attachmentRef) r.at else r.found }).found
pure def photoRefAt(m: Mailbox, direction: int): str =
  photoAssets(m).nthOr(photoPosition(m) + direction, F::emptyFile).sourceRef
pure def canMovePhoto(m: Mailbox, direction: int, by: MailActor): bool =
  m.view == Attachment and photoPosition(m) >= 0 and (direction == -1 or direction == 1) and
  photoPosition(m) + direction >= 0 and photoPosition(m) + direction < photoAssets(m).length() and
  canReadMail(m, OpenAttachment, photoRefAt(m, direction), true, by)
pure def movePhoto(m: Mailbox, direction: int, by: MailActor): Mailbox =
  readMail(m, OpenAttachment, photoRefAt(m, direction), true, by)
pure def canBackToMessage(m: Mailbox, by: MailActor): bool =
  by == MailUser and m.view == Attachment
pure def backToMessage(m: Mailbox, by: MailActor): Mailbox =
  { ...m, view: Message, readStatus: ReadIdle, generation: m.generation + 1, attachmentRef: "" }
pure def selectedAssets(m: Mailbox, refs: Set[str]): List[F::SavedFile] =
  m.assets.select(a => refs.contains(a.sourceRef))
pure def mayExportAttachments(m: Mailbox, refs: Set[str]): bool =
  m.connection == Connected and m.canRead and m.readStatus == ReadIdle and selectedMessageIsCurrent(m) and
  refs.size() > 0 and refs.forall(ref => m.assets.some(a => a.sourceRef == ref))
pure def canAttachAsset(m: Mailbox, owner: str, asset: F::SavedFile, draftRevision: int, selected: bool, by: MailActor): bool =
  by == MailHost and owner == m.owner and m.owner != "" and draftRevision == m.revision and selected and F::validFile(asset) and
  canEditDraft(m, MailUser) and m.draftAttachments.every(a => a.id != asset.id and not(F::sameSource(a, asset)))
pure def attachAsset(m: Mailbox, owner: str, asset: F::SavedFile, draftRevision: int, selected: bool, by: MailActor): Mailbox =
  { ...m, draftAttachments: m.draftAttachments.append(asset), draftVersion: m.draftVersion + 1, revision: m.revision + 1,
    choosing: if (choosingAttachment(m.choosing)) NoChoice else m.choosing,
    approvedRevision: -1, sendStatus: Composing, draftStorage: DraftUnstored, sendResultSaved: false }
pure def lawStalePickerCannotAttach(m: Mailbox, owner: str, asset: F::SavedFile, draftRevision: int, selected: bool, by: MailActor): bool =
  draftRevision != m.revision implies not(canAttachAsset(m, owner, asset, draftRevision, selected, by))
pure def canRemoveAsset(m: Mailbox, assetId: str, by: MailActor): bool =
  canEditDraft(m, by) and m.draftAttachments.some(a => a.id == assetId)
pure def removeAsset(m: Mailbox, assetId: str, by: MailActor): Mailbox =
  { ...m, draftAttachments: m.draftAttachments.select(a => a.id != assetId), draftVersion: m.draftVersion + 1,
    revision: m.revision + 1, approvedRevision: -1, sendStatus: Composing, draftStorage: DraftUnstored, sendResultSaved: false }
pure def alwaysDraftAssetsAreValid(m: Mailbox): bool = m.draftAttachments.every(a => F::validFile(a))
pure def alwaysMessageAssetsAreBound(m: Mailbox): bool =
  m.assets.every(a => F::validFile(a) and a.origin == m.provider and a.account == m.account and a.container == m.messageRef)
pure def sometimesDraftHasAttachment(m: Mailbox): bool = m.draftAttachments.length() > 0
pure def sometimesBackFromLaterPhoto(m: Mailbox): bool =
  m.view == Message and m.readStatus == ReadIdle and m.readKind == OpenAttachment and
  photoAssets(m).some(a => a.sourceRef == m.requestedRef) and photoAssets(m).nthOr(0, F::emptyFile).sourceRef != m.requestedRef
pure def sometimesForwardedViewedAttachment(m: Mailbox): bool =
  m.composeVisible and m.view == Attachment and m.draftVersion == 0 and
  m.draftAttachments.length() == 1 and m.draftAttachments == selectedAssets(m, Set(m.attachmentRef))
```

### A mailbox is valid when it meets every rule above

`validMailbox` gathers this spec's `always` rules beside them, so a spec that
composes a mailbox, such as [Handoffs](./handoffs.md), checks the whole list
and gains each new rule without copying it.

```quint
pure def validMailbox(m: Mailbox): bool =
  alwaysConnectedIdentity(m) and alwaysAccountIdentityIsBound(m) and alwaysGenerationAndRevision(m) and
  alwaysReadAccess(m) and alwaysReadSelectionIsBound(m) and alwaysSelectedContent(m) and
  alwaysMessageRegistry(m) and alwaysListedMessagesAreCurrent(m) and
  alwaysSelectionUsesCanonicalMessage(m) and alwaysFolderIsVisible(m) and alwaysSearchMatchesQuery(m) and
  alwaysBillProvenance(m) and alwaysScamWarningIsCurrent(m) and alwaysLinkBelongsToSelection(m) and
  alwaysFlaggedMessageIsNoBillSource(m) and alwaysResultPersistenceHasTerminal(m) and
  alwaysSendHasRecipient(m) and alwaysSendEvidence(m) and alwaysApprovalIsCurrent(m) and
  alwaysDraftHasAccount(m) and alwaysDraftStoreHasRevision(m) and alwaysRetirementHasMailbox(m) and
  alwaysDraftVersions(m) and alwaysEditableDraftIsNotRetired(m) and alwaysDraftAssetsAreValid(m) and
  alwaysMessageAssetsAreBound(m) and alwaysQueuedSendsAreIssued(m) and alwaysChoosingNeedsComposer(m) and
  alwaysSentDraftsHaveMailbox(m)
```

### Simulation samples cover message and attachment lifecycles

These are samples only, never limits on account names, message counts, provider
support or content length. The real registry supplies any valid identity.
The random walks use one coherent mailbox and current callback combinations
to reach complete read, mutation, send and recovery paths. The simulator tries
every sample of an event before it gives the event up, and an event it cannot
take costs it a try of each, so each set holds the callbacks a walk can meet
and few others. Listing callbacks cover the read generations of the first
listings of each folder, read results cover generations up to 10 with a
message of photos and a document and one of photos only, and the
person's taps carry their own choice (`approved`, `confirmed`, `selected`),
the host's verified facts and the connector's grants, as the host supplies
them; the rules refusing their absence are proved for every value. Grace's
actions cover each kind once, with a recipient the connector did not resolve,
and the message moves with every current revision. Queued sends reach Outbox,
dispatch and every result. The universal rules cover arbitrary identities and
collections; separate guarded witness checks exercise competing accounts,
stale callbacks, rejection and multiple messages.

```quint
pure val ownerValues = Set("ownerA")
pure val providerValues = Set("providerA")
pure val accountValues = Set("accountA")
pure val refValues = Set("messageA", "attachmentA")
pure val folderValues = Set(I::InboxFolder, I::DraftsFolder, I::TrashFolder, I::PurgedFolder)
pure val changeValues = Set(I::UnreadMessage, I::TrashMessage, I::RestoreMessage, I::PurgeMessage)
pure val sampleGenerations = Set(2, 3, 4, 5, 6, 7, 8, 9, 10)
pure def sampleListing(folder: I::Folder, unread: bool, revision: int): I::MetadataReceipt =
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: folder, unread: unread, answered: false },
    revision: revision, evidence: "providerMetadata" }
pure val listingValues = Set(sampleListing(I::InboxFolder, true, -1), sampleListing(I::InboxFolder, false, 0),
  sampleListing(I::DraftsFolder, false, -1), sampleListing(I::TrashFolder, false, -1))
pure val targetValues = Set(0, 1, 2).map(r => { ref: "messageA", revision: r }).union(Set({ ref: "missing", revision: 0 }))
pure val messageReceiptValues = Set(1, 2, 3).map(r => { identity: I::messageIdentity, revision: r, result: I::ChangeIdle, evidence: "providerReceipt" })
  .union(Set(1, 2, 3).map(r => { identity: I::messageIdentity, revision: r, result: I::ChangeUnknown, evidence: "" }))
  .union(Set({ identity: I::messageIdentity, revision: 1, result: I::ChangeFailed, evidence: "providerReceipt" },
    { identity: I::noIdentity, revision: 0, result: I::ChangeIdle, evidence: "" }))
pure val sampleScope: ListingScope = { owner: "ownerA", provider: "providerA", account: "accountA", folder: I::InboxFolder, query: "", generation: 2 }
pure val scopeValues = Set(2, 3, 4, 5, 6, 7).map(g => { ...sampleScope, query: "messageA", generation: g })
  .union(Set(2, 3, 4, 5).map(g => { ...sampleScope, folder: I::DraftsFolder, generation: g }))
  .union(Set(2, 3, 4, 5).map(g => { ...sampleScope, folder: I::TrashFolder, generation: g }))
pure val mailContent: DraftContent = { to: "recipient@example.test", cc: Set("copy@example.test"), bcc: Set(), subject: "Subject", body: "Message" }
pure val contentValues = Set(mailContent, { ...mailContent, bcc: Set("hidden@example.test"), body: "" })
pure val operationIdValues = Set("sendA", "sendB")
pure val evidenceValues = Set("providerEvidence")
pure val selectedBill: BillSelection = {
  source: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" },
  generation: 3, billRef: "billA", origin: "https://biller.example", account: "billerAccount"
}
pure val selectionValues = Set(3, 4, 5).map(g => { ...selectedBill, generation: g })
  .union(Set({ ...selectedBill, billRef: "otherInvoice" }, { ...selectedBill, source: { ...selectedBill.source, ref: "otherMessage" } },
    { ...selectedBill, account: "otherBillerAccount" }))
pure val billRefValues = Set("billA")
pure val originValues = Set("https://biller.example")
pure val billAccountValues = Set("billerAccount")
pure val draftIdValues = Set("draftA")
pure val choiceValues = Set(PickTo, PickCc, PickBcc, ChoosePhoto, ChooseFile, NoChoice, PickNewEmail)
pure val generationValues = Set(1, 3, 4, 5)
pure val revisionValues = Set(1, 2, 3)
pure val requestValues = Set(1, 2)
pure val totalValues = Set(0, 2)
pure val draftRevisionValues = Set(1, 2, 3)
pure val verifiedValues = Set(true)
pure val readGrantedValues = Set(true)
pure val recipientValidValues = Set(true)
pure val approvedValues = Set(true)
pure val confirmedValues = Set(true)
pure val selectedValues = Set(true)
pure val assetIdValues = Set("photo", "missing")
pure val mailAsset: F::SavedFile = { ...F::samplePhoto, origin: "providerA", account: "accountA", container: "messageA", sourceRef: "attachmentA" }
pure val assetValues = Set(mailAsset, F::samplePdf)
pure val readReceiptValues = {
  val secondPhoto = { ...mailAsset, id: "photoB", sourceRef: "attachmentB", contentRef: "photo-content-b" }
  val completeManifest = List(mailAsset, secondPhoto, { ...F::samplePdf, origin: "providerA", account: "accountA", container: "messageA", sourceRef: "attachmentPdf" })
  sampleGenerations.map(g => { generation: g, succeeded: true, assets: List(), suspicion: "" })
    .union(Set(3, 4, 5, 6, 7, 8).map(g => { generation: g, succeeded: true, assets: completeManifest, suspicion: "" }))
    .union(Set(3, 4, 5, 6, 7, 8).map(g => { generation: g, succeeded: true, assets: List(mailAsset, secondPhoto), suspicion: "" }))
    .union(Set(3, 5, 7).map(g => { generation: g, succeeded: true, assets: List(), suspicion: "classifierScam" }))
    .union(Set(2, 5).map(g => { generation: g, succeeded: false, assets: List(), suspicion: "" }))
}
pure val snapshotValues = Set(
  { id: "messageA", version: 1, content: mailContent, attachments: List(), replyTo: "" },
  { id: "messageA", version: 2, content: mailContent, attachments: List(mailAsset), replyTo: "" })
pure val directionValues = Set(-1, 1)
pure val headerValues = Set(3, 4, 5, 6).map(g => { ref: "messageA", generation: g, address: "sender@example.test", subject: "Re: Subject", verified: true })
  .union(Set({ ref: "messageA", generation: 3, address: "", subject: "Re: Subject", verified: true },
    { ref: "messageA", generation: 3, address: "sender@example.test", subject: "Re: Subject", verified: false },
    { ref: "missing", generation: 3, address: "sender@example.test", subject: "Re: Subject", verified: true }))
pure val linkValues = Set("https://acc0unt-help.example/confirm")
pure val refsValues = Set(Set("attachmentA"), Set("attachmentPdf"), Set("attachmentA", "attachmentPdf"), Set("missing"), Set())
pure val resolvedRecipient: Recipient = { address: "recipient@example.test", verified: true }
pure val assistValues = Set(
  AssistSearch({ query: "messageA" }), AssistOpen({ ref: "messageA" }),
  AssistList, AssistNewEmail({ recipient: resolvedRecipient, subject: "Subject", body: "Message" }),
  AssistNewEmail({ recipient: { ...resolvedRecipient, verified: false }, subject: "Subject", body: "Message" }),
  AssistAddress({ recipient: resolvedRecipient }), AssistFill({ body: "Thank you, I will be there." }),
  AssistForward({ content: { ...emptyContent, subject: "Fwd: Subject", body: "Message" } }), AssistSaveDraft({ draftId: "draftA" }))
  .union(targetValues.filter(t => t.ref != "missing").map(t => AssistTrash({ target: t })))
  .union(targetValues.filter(t => t.ref != "missing").map(t => AssistRestore({ target: t })))
  .union(targetValues.filter(t => t.ref != "missing").map(t => AssistUndoTrash({ target: t })))
  .union(targetValues.filter(t => t.ref != "missing").map(t => AssistMarkUnread({ target: t })))
pure val weight_connect = 50
pure val weight_authorize = 50
pure val weight_readMail = 30
pure val weight_readResult = 40
pure val weight_receiveMessage = 60
pure val weight_chooseFolder = 4
pure val weight_changeSelectedMessage = 30
pure val weight_completeMessageChange = 30
pure val weight_undoMessageTrash = 80
pure val weight_closeUndoToast = 80
pure val weight_receiveBill = 15
pure val weight_confirmBill = 80
pure val weight_openLink = 15
pure val weight_confirmLink = 100
pure val weight_cancelLink = 60
pure val weight_linkOpened = 60
pure val weight_replyToMessage = 15
pure val weight_forwardMessage = 10
pure val weight_restoreDraft = 100
pure val weight_movePhoto = 100
pure val weight_backToMessage = 100
pure val weight_forwardAttachment = 100
pure val weight_startDraft = 3
pure val weight_assistMail = 4
pure val weight_editDraft = 20
pure val weight_reviewDraft = 4
pure val weight_approveDraft = 20
pure val weight_confirmVisibleSend = 30
pure val weight_sendDraft = 40
pure val weight_sendResult = 20
pure val weight_persistSendResult = 60
pure val weight_queueSend = 40
pure val weight_dispatchQueued = 40
pure val weight_queuedResult = 20
pure val weight_reopenQueued = 100
pure val weight_preserveDraft = 20
pure val weight_draftStoreResult = 20
pure val weight_discardDraft = 3
pure val weight_closeEmptyComposer = 6
pure val weight_attachAsset = 4
pure val weight_removeAsset = 10
```
