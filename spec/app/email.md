# Email

Email uses the same account, consent, private-data and interruption rules as
browser assistance. `prototype/Grace Prototype.html:1933–1971,2179–2208` is
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
is Grace's own request, relayed by the host: it can search, open and propose a
reply, never approve, send, delete or follow a link.

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
type MessageTarget = { ref: str, revision: int }
type Bill = { ref: str, origin: str, account: str, confirmed: bool }
type Warning = { ref: str, generation: int, evidence: str }
type LinkStatus = NoLink | LinkHeld | LinkReleased
type LinkRequest = { ref: str, link: str, status: LinkStatus }
type ListingScope = { owner: str, provider: str, account: str, folder: I::Folder, query: str, generation: int }
type Mailbox = {
  owner: str, provider: str, account: str, generation: int,
  connection: Connection, canRead: bool, canSend: bool,
  view: MailView, folder: I::Folder, query: str, readStatus: ReadStatus, readKind: ReadKind,
  requestedRef: str, messageRef: str, attachmentRef: str,
  messages: List[I::MessageRecord], messageRefs: Set[str], assets: List[F::SavedFile],
  draft: DraftContent, autoSubject: str, replyTo: str,
  draftAttachments: List[F::SavedFile], draftId: str, draftVersion: int, retiredDrafts: str -> int, composeVisible: bool, draftStorage: DraftStorage, storedRevision: int, draftRequest: int,
  revision: int, approvedRevision: int, sendStatus: SendStatus,
  operationId: str, issuedSends: Set[str], sendEvidence: str, sendResultSaved: bool,
  bill: Bill, warning: Warning, link: LinkRequest
}
pure val noRetiredDrafts: str -> int = Map()
pure val emptyContent: DraftContent = { to: "", cc: Set(), bcc: Set(), subject: "", body: "" }
pure val noBill: Bill = { ref: "", origin: "", account: "", confirmed: false }
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
  revision: 0, approvedRevision: -1, sendStatus: NoDraft,
  operationId: "", issuedSends: Set(), sendEvidence: "", sendResultSaved: false,
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
    approvedRevision: -1, sendStatus: fencedSend(m) }
pure def alwaysConnectedIdentity(m: Mailbox): bool =
  (m.connection == Connected implies
    (m.owner != "" and m.provider != "" and m.account != "" and m.canRead)) and
  (m.connection != Connected implies (not(m.canRead) and not(m.canSend)))
pure def alwaysAccountIdentityIsBound(m: Mailbox): bool =
  m.connection != Disconnected implies (m.owner != "" and m.provider != "" and m.account != "")
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

Grace can search and open for the person (`prototype/Grace Prototype.html:2107,2117,2140–2141`).
Her search and open run the same read with the same guards, only while Email is
on screen and only when the person asked. Both are facts the host supplies with
her request: `visible`, which the workspace must grant only while Email is the
page shown beside Grace compact, and `asked`, the person's request; this spec
refuses her read without them but cannot itself establish them. Her search
covers Inbox, as the prototype's does: from another folder it first returns to
Inbox, clearing the selection and query as choosing a folder does.

This departs from the prototype on purpose in three places. The prototype's
search switches to the Email page when it is not on screen
(`prototype/Grace Prototype.html:2141`); here Grace never acts on a hidden page,
so she is refused instead. The prototype's open and search drop an open
composer (`prototype/Grace Prototype.html:2140–2141`); here she is refused while
a composer is open, so she never discards what the person is writing. The
prototype's search always clears the open message; here a search from Inbox
keeps the selection reference and its success returns to the list, where the
selection is not shown, and only a search from another folder clears it. She
never opens an attachment for herself.

```quint
pure def canReadMail(m: Mailbox, kind: ReadKind, ref: str, approved: bool, by: MailActor): bool =
  (by == MailUser) and m.connection == Connected and m.canRead and approved and m.readStatus != Reading and
  (kind == Search or (ref != "" and
    ((kind == OpenMessage and m.messageRefs.contains(ref) and availableMessage(m, ref)) or
      (kind == OpenAttachment and selectedMessageIsCurrent(m) and m.assets.some(asset => asset.sourceRef == ref)))))
pure def readMail(m: Mailbox, kind: ReadKind, ref: str, approved: bool, by: MailActor): Mailbox =
  { ...m, readStatus: Reading, readKind: kind, requestedRef: ref, generation: m.generation + 1,
    query: if (kind == Search) ref else m.query,
    messageRefs: if (kind == Search) Set() else m.messageRefs }
pure def assistedView(kind: ReadKind, m: Mailbox): Mailbox =
  if (kind == Search and m.folder != I::InboxFolder) { ...clearSelection(true, m), folder: I::InboxFolder, query: "", messageRefs: Set() }
  else m
pure def canAssistReadMail(m: Mailbox, kind: ReadKind, ref: str, visible: bool, asked: bool, by: MailActor): bool =
  by == MailAssistant and visible and asked and kind != OpenAttachment and m.readStatus != Reading and
  not(m.composeVisible) and canReadMail(assistedView(kind, m), kind, ref, true, MailUser)
pure def assistReadMail(m: Mailbox, kind: ReadKind, ref: str, visible: bool, asked: bool, by: MailActor): Mailbox =
  readMail(assistedView(kind, m), kind, ref, true, MailUser)
pure def lawAssistantReadKeepsTheDraft(m: Mailbox, kind: ReadKind, ref: str, visible: bool, asked: bool, by: MailActor): bool =
  canAssistReadMail(m, kind, ref, visible, asked, by) implies
    (assistReadMail(m, kind, ref, visible, asked, by).revision == m.revision and
      assistReadMail(m, kind, ref, visible, asked, by).draftVersion == m.draftVersion and
      assistReadMail(m, kind, ref, visible, asked, by).sendStatus == m.sendStatus and
      assistReadMail(m, kind, ref, visible, asked, by).draftId == m.draftId)
pure def listingScope(m: Mailbox): ListingScope = {
  owner: m.owner, provider: m.provider, account: m.account, folder: m.folder, query: m.query, generation: m.generation
}
pure def canReceiveMessage(m: Mailbox, scope: ListingScope, listing: I::MetadataReceipt, by: MailActor): bool =
  by == MailConnector and m.connection == Connected and m.canRead and m.readStatus == Reading and m.readKind == Search and
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
  by == MailConnector and m.connection == Connected and m.readStatus == Reading and readReceipt.generation == m.generation and
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
  m.readStatus == Reading implies (m.connection == Connected and m.canRead)
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
```

### Switching folders clears the old query and starts a scoped listing

Inbox, Sent, Drafts and Trash share this mailbox's current folder and query.
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
  by == MailUser and m.connection == Connected and m.canRead and
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

### Selected-message changes update the same canonical record and invalidate stale actions

The mailbox registry owns every loaded message lifecycle. Listing metadata may create
an unseen record or refresh the same settled identity at its exact captured
record revision. It never replaces a pending operation or purge tombstone. Opening an unread message requests its read flag atomically
with the successful body read. The connector dispatches that exact pending
operation and returns its identity, revision and evidence through
`completeMessageChange`; rendered content cannot fabricate the receipt.

Delete, Restore and Delete forever use the current selected record and revision.
They return to the list immediately and remove that row while its provider
operation is pending. Other messages remain readable. Undo names the original
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
    messageRefs: m.messageRefs.exclude(Set(target.ref)) })
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
  canChangeSelectedMessage(m, target, change, by) implies not(canReplyToMessage(changeSelectedMessage(m, target, change, by), header, MailConnector))
pure def lawStaleMessageReceiptIsRejected(m: Mailbox, messageReceipt: I::ChangeReceipt, by: MailActor): bool =
  messageReceipt.revision != messageRecord(m, messageReceipt.identity.ref).revision implies
    not(canCompleteMessageChange(m, messageReceipt, by))
pure def sometimesMessageTrashPending(m: Mailbox): bool =
  m.messages.some(record => record.pending == I::TrashMessage)
pure def sometimesMessagePurged(m: Mailbox): bool =
  m.messages.some(record => record.folder == I::PurgedFolder)
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

The bill belongs to the selected message: its source is always `messageRef`,
so it holds no separate source reference. A message Grace flags as a scam never
becomes a bill source (next rule).

```quint
type BillSelection = { source: I::MessageIdentity, generation: int, billRef: str, origin: str, account: str }
pure def billSelection(m: Mailbox): BillSelection = {
  source: messageIdentity(m, m.messageRef), generation: m.generation,
  billRef: m.bill.ref, origin: m.bill.origin, account: m.bill.account
}
pure def canReceiveBill(m: Mailbox, generation: int, billRef: str, origin: str, billAccount: str, verified: bool, by: MailActor): bool =
  by == MailConnector and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and selectedMessageIsCurrent(m) and m.readStatus == ReadIdle and
  generation == m.generation and m.messageRef != "" and billRef != "" and origin != "" and billAccount != "" and verified and
  m.warning.evidence == ""
pure def receiveBill(m: Mailbox, generation: int, billRef: str, origin: str, billAccount: str, verified: bool, by: MailActor): Mailbox =
  { ...m, bill: { ref: billRef, origin: origin, account: billAccount, confirmed: false } }
pure def canConfirmBill(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): bool =
  by == MailUser and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and selectedMessageIsCurrent(m) and m.readStatus == ReadIdle and
  m.bill.ref != "" and confirmed and selection == billSelection(m)
pure def confirmBill(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): Mailbox =
  { ...m, bill: { ...m.bill, confirmed: true } }
pure def lawStaleBillSelectionCannotConfirm(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): bool =
  selection != billSelection(m) implies not(canConfirmBill(m, selection, confirmed, by))
pure def lawConfirmationKeepsDisplayedBill(m: Mailbox, selection: BillSelection, confirmed: bool, by: MailActor): bool =
  canConfirmBill(m, selection, confirmed, by) implies
    billSelection(confirmBill(m, selection, confirmed, by)) == selection
pure def billReady(m: Mailbox): bool =
  m.bill.confirmed and m.connection == Connected and m.canRead and m.folder != I::TrashFolder and m.readStatus == ReadIdle and selectedMessageIsCurrent(m)
pure def alwaysBillProvenance(m: Mailbox): bool =
  (m.bill.ref != "" implies (m.messageRef != "" and m.bill.origin != "" and m.bill.account != "")) and
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
link releases it to the host, which hands it to the Browser. Cancel drops it.
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
  by == MailUser and confirmed and m.link.status == LinkHeld and m.link.link == link and
  m.readStatus == ReadIdle and selectedMessageIsCurrent(m)
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
    replyTo: replyTo, revision: m.revision + 1,
    approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def canStartDraft(m: Mailbox, reply: bool, by: MailActor): bool =
  by == MailUser and not(reply) and composerFree(m)
pure def startDraft(m: Mailbox, reply: bool, by: MailActor): Mailbox = openComposer("", m)
pure def canEditDraft(m: Mailbox, by: MailActor): bool =
  (by == MailUser) and not(terminalUnsaved(m)) and not(draftStoreBusy(m)) and m.composeVisible and
  (m.sendStatus == Composing or m.sendStatus == Reviewing or m.sendStatus == SendFailed)
pure def editDraft(m: Mailbox, content: DraftContent, by: MailActor): Mailbox =
  { ...m, draft: content,
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
    composeVisible: false, draftStorage: if (m.draftId == "") DraftUnstored else DraftDeleting,
    storedRevision: m.revision, draftRequest: m.draftRequest + 1, approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def draftStoreBusy(m: Mailbox): bool = m.draftStorage == DraftSaving or m.draftStorage == DraftDeleting
pure def currentDraft(m: Mailbox): DraftSnapshot = {
  id: m.draftId, version: m.draftVersion, content: m.draft,
  attachments: m.draftAttachments, replyTo: m.replyTo
}
```

### A reply is addressed to the selected message's verified reply-to

Reply opens the composer already addressed, with the "Re:" subject and no
recipient picker (`prototype/Grace Prototype.html:2197`). The connector reads the
reply address of the message on screen and verifies it against the current
read's generation; the host then dispatches `replyToMessage`. The prototype
addresses every reply to the sender (`m.from`,
`prototype/Grace Prototype.html:2142,2197`); this spec deliberately follows the
message's own reply-to header instead, which may name a different address, as
mail clients do, and the connector supplies whichever address that header
names. The recipient therefore never arrives as an edit the person
did not make, and a stale header from an earlier read cannot address the reply.
The automatic subject is remembered, so it alone does not make the composer
worth keeping (`prototype/Grace Prototype.html:2199`).

```quint
type ReplyHeader = { generation: int, address: str, subject: str, verified: bool }
pure def canReplyToMessage(m: Mailbox, header: ReplyHeader, by: MailActor): bool =
  (by == MailConnector or by == MailHost) and m.view == Message and replyable(m) and
  header.generation == m.generation and header.verified and header.address != ""
pure def replyToMessage(m: Mailbox, header: ReplyHeader, by: MailActor): Mailbox =
  { ...openComposer(m.messageRef, m), draft: { ...emptyContent, to: header.address, subject: header.subject },
    autoSubject: header.subject }
pure def lawReplyIsAddressedFromVerifiedHeader(m: Mailbox, header: ReplyHeader, by: MailActor): bool =
  canReplyToMessage(m, header, by) implies
    (replyToMessage(m, header, by).draft.to == header.address and replyToMessage(m, header, by).replyTo == m.messageRef and
      header.verified and header.generation == m.generation)
pure def sometimesReplyAddressed(m: Mailbox): bool = m.composeVisible and m.replyTo != "" and m.draft.to != ""
```

### Grace's reply is a draft that only the person can approve and send

When the person asks Grace to answer the email on screen, Grace writes the body
in the person's voice and the reply opens with her words in it; she points at
Send and never sends (`prototype/Grace Prototype.html:2107,2142`). Her request
first opens an ordinary reply through `replyToMessage`, so the connector, not
Grace, supplies its recipient and subject from the verified header; Grace then
adds only the body to that open, still empty reply (`proposeReplyDraft`). She
cannot change who it goes to, and she never writes over words the person typed.
Unlike the prototype, which builds the whole reply from Grace's request in one
step (`prototype/Grace Prototype.html:2142`), nothing Grace sends can address
an email. Her draft is visible in the composer, at a new revision and with no
approval. Only the person's Send tap
(`confirmVisibleSend`) or explicit approval (`approveDraft`) at that exact
revision approves a draft, and only an approved current revision is dispatched,
so a draft Grace wrote reaches Sending only after the person approved exactly
what she sees.

```quint
pure def canProposeReplyDraft(m: Mailbox, body: str, visible: bool, asked: bool, by: MailActor): bool =
  by == MailAssistant and visible and asked and body != "" and canEditDraft(m, MailUser) and
  m.replyTo != "" and m.replyTo == m.messageRef and selectedMessageIsCurrent(m) and
  m.draft.to != "" and m.draft.body == ""
pure def proposeReplyDraft(m: Mailbox, body: str, visible: bool, asked: bool, by: MailActor): Mailbox =
  editDraft(m, { ...m.draft, body: body }, MailUser)
pure def lawGraceReplyIsUnapproved(m: Mailbox, body: str, visible: bool, asked: bool, by: MailActor): bool =
  canProposeReplyDraft(m, body, visible, asked, by) implies
    (proposeReplyDraft(m, body, visible, asked, by).approvedRevision == -1 and
      proposeReplyDraft(m, body, visible, asked, by).composeVisible and
      proposeReplyDraft(m, body, visible, asked, by).sendStatus == Composing and
      proposeReplyDraft(m, body, visible, asked, by).revision > m.revision)
pure def lawGraceReplyKeepsTheAddress(m: Mailbox, body: str, visible: bool, asked: bool, by: MailActor): bool =
  canProposeReplyDraft(m, body, visible, asked, by) implies
    (proposeReplyDraft(m, body, visible, asked, by).draft.to == m.draft.to and
      proposeReplyDraft(m, body, visible, asked, by).draft.cc.subseteq(m.draft.cc) and
      proposeReplyDraft(m, body, visible, asked, by).draft.bcc.subseteq(m.draft.bcc) and
      proposeReplyDraft(m, body, visible, asked, by).draft.subject == m.draft.subject and
      proposeReplyDraft(m, body, visible, asked, by).draft.body == body and
      proposeReplyDraft(m, body, visible, asked, by).replyTo == m.replyTo)
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
    sendEvidence: if (resultStatus == SendUnknown) "" else evidence }
pure def canPersistSendResult(m: Mailbox, operationId: str, by: MailActor): bool =
  by == MailHost and terminalUnsaved(m) and operationId == m.operationId
pure def persistSendResult(m: Mailbox, operationId: str, persisted: bool, by: MailActor): Mailbox =
  { ...m, sendResultSaved: persisted,
    retiredDrafts: if (persisted and m.sendStatus == Sent) retireCurrentDraft(m) else m.retiredDrafts }
pure def alwaysResultPersistenceHasTerminal(m: Mailbox): bool =
  m.sendResultSaved implies (m.sendStatus == Sent or m.sendStatus == SendFailed)
pure def sometimesResultSaveFailed(m: Mailbox): bool = terminalUnsaved(m)
pure def canInterrupt(m: Mailbox, by: MailActor): bool = ((by == MailUser or by == MailHost)) and (m.readStatus == Reading or m.sendStatus == Sending or m.sendStatus == Reviewing)
pure def interrupt(m: Mailbox, by: MailActor): Mailbox =
  { ...m, readStatus: ReadIdle, generation: m.generation + 1, approvedRevision: -1, sendStatus: fencedSend(m) }
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
reopens the recoverable draft. Reopening Drafts reads the selected provider draft
and restores all recipients and attachments, so a saved draft can be open in
the composer again. Discard of an existing draft awaits durable deletion; the
single Discard tap is the user's authorization.

```quint
pure def canPreserveDraft(m: Mailbox, draftId: str, by: MailActor): bool =
  canEditDraft(m, by) and worthPreserving(m) and draftId != "" and not(draftRetired(m, draftId, m.draftVersion)) and
  (m.draftId == "" or m.draftId == draftId)
pure def preserveDraft(m: Mailbox, draftId: str, by: MailActor): Mailbox =
  { ...m, draftId: draftId, draftStorage: DraftSaving, storedRevision: m.revision, draftRequest: m.draftRequest + 1,
    composeVisible: false, sendStatus: Composing, approvedRevision: -1, sendResultSaved: false }
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
for one never stored, or once the store acknowledges deleting a saved one.

```quint
pure def worthPreserving(m: Mailbox): bool =
  m.draftId != "" or m.draft.body != "" or m.draftAttachments.length() > 0 or
  (m.draft.subject != "" and m.draft.subject != m.autoSubject)
pure def canCloseEmptyComposer(m: Mailbox, by: MailActor): bool = canEditDraft(m, by) and not(worthPreserving(m))
pure def closeEmptyComposer(m: Mailbox, by: MailActor): Mailbox =
  { ...m, draft: emptyContent, autoSubject: "", replyTo: "", draftAttachments: List(), sendStatus: NoDraft,
    composeVisible: false, draftStorage: DraftUnstored, approvedRevision: -1, operationId: "", sendEvidence: "", sendResultSaved: false }
pure def stepWorthyComposerIsNotDropped(before: Mailbox, via: str, after: Mailbox): bool =
  (before.sendStatus != NoDraft and after.sendStatus == NoDraft and worthPreserving(before)) implies
    (via == "discardDraft" or (via == "draftStoreResult" and before.draftStorage == DraftDeleting))
```

### Sending or discarding retires the completed draft revision without hiding newer work

A stable draft ID has a monotonic provider/store version, separate from the
composer's local consent revision. Editing any recipients, text or attachments
increments its draft version. Restoring uses the provider's verified version;
provider/store adapters serialize versions for that ID and never reuse a
version for different content. Saves and deletes compare the exact requested
draft version; a concurrent newer version produces a conflict/failure, never an
unconditional overwrite or deletion. The mailbox retains only the highest retired
version per draft ID. Durably recorded Sent or acknowledged deletion after Discard
retires that version and all older snapshots. Sending, uncertainty, failure and
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
retired versions, drafts and issued operation IDs. It invalidates read callbacks
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
pure def stepRetirementRequiresCompletion(before: Mailbox, after: Mailbox): bool =
  before.retiredDrafts != after.retiredDrafts implies
    ((heldSend(before) and after.sendStatus == Sent and after.sendResultSaved) or
      (before.draftStorage == DraftDeleting and after.sendStatus == NoDraft))
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

### Attachment actions preserve exact asset and message identity

The gallery shows the selected photo and moves only within this message's
ordered photos; after it moves past the first photo, Back still returns to its
message. PDF Back returns to its message. Save one, Save all, Forward,
Print and Files sharing carry immutable source/content IDs. File names are
labels. The atomic message-read manifest supplies all assets in provider order, with
unique immutable IDs and sources. Forwarding a whole message always copies this
complete manifest; individual-attachment forwarding copies only the selection,
so a new draft can carry exactly the attachment on screen. Camera, Photos and file-picker results require an explicit user selection
and a trusted host grant for this owner; no sample photo is injected. Canceling
any picker leaves the draft unchanged. Its result must match the exact composer
revision captured at launch, so a delayed result cannot attach to a later draft. Forwarding copies sanitized selected
content and attachments into a new editable draft and never sends it.

Saving and printing are dispatched to [Files](./files.md). `mayExportAttachments`
is the source authorization check before the host constructs its `FileImport`;
only Files' durable acknowledgment permits “Saved to Files”. An unsaved PDF
uses Files' `ExternalPrint` boundary with the same source authorization; printing
never silently saves it to the library. Print request is
not printer success. Preview uses actual content, pages and errors, not the
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
  alwaysMessageAssetsAreBound(m)
```

### Simulation samples cover message and attachment lifecycles

These are samples only, never limits on account names, message counts, provider
support or content length. The real registry supplies any valid identity.
The random walks use one coherent mailbox and current callback combinations
to reach complete read, mutation, send and recovery paths. Listing and read
callbacks cover generations up to 12, so walks keep reading after repeated
reads and reconnects, and a Drafts row separate from the inbox message lets a
saved draft be reopened. The universal rules
cover arbitrary identities and collections; separate guarded witness checks
exercise competing accounts, stale callbacks, rejection and multiple messages.

```quint
pure val ownerValues = Set("ownerA")
pure val providerValues = Set("providerA")
pure val accountValues = Set("accountA")
pure val refValues = Set("messageA", "attachmentA", "draftA")
pure val sampleGenerations = Set(2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
pure val listingValues = Set(
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: I::InboxFolder, unread: true, answered: false }, revision: -1, evidence: "providerMetadata" },
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: I::InboxFolder, unread: false, answered: false }, revision: -1, evidence: "providerMetadata" },
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: I::DraftsFolder, unread: false, answered: false }, revision: -1, evidence: "providerMetadata" },
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: I::TrashFolder, unread: false, answered: false }, revision: -1, evidence: "providerMetadata" },
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: I::InboxFolder, unread: false, answered: false }, revision: 0, evidence: "providerMetadata" },
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }, folder: I::InboxFolder, unread: false, answered: true }, revision: 0, evidence: "providerMetadata" },
  { seed: { identity: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "draftA" }, folder: I::DraftsFolder, unread: false, answered: false }, revision: -1, evidence: "providerMetadata" })
pure val targetValues = Set({ ref: "messageA", revision: 0 }, { ref: "messageA", revision: 1 },
  { ref: "messageA", revision: 2 }, { ref: "messageA", revision: 3 }, { ref: "missing", revision: 0 })
pure val messageReceiptValues = I::receiptValues
pure val sampleScope: ListingScope = { owner: "ownerA", provider: "providerA", account: "accountA", folder: I::InboxFolder, query: "", generation: 2 }
pure val scopeValues = Set({ ...sampleScope, query: "messageA" }, { ...sampleScope, query: "attachmentA" },
  { ...sampleScope, folder: I::DraftsFolder }, { ...sampleScope, folder: I::TrashFolder },
  { ...sampleScope, folder: I::DraftsFolder, generation: 3 }, { ...sampleScope, folder: I::DraftsFolder, generation: 4 },
  { ...sampleScope, folder: I::DraftsFolder, generation: 5 },
  { ...sampleScope, folder: I::DraftsFolder, query: "messageA", generation: 4 },
  { ...sampleScope, folder: I::DraftsFolder, query: "messageA", generation: 5 },
  { ...sampleScope, folder: I::TrashFolder, generation: 3 }, { ...sampleScope, folder: I::TrashFolder, generation: 4 },
  { ...sampleScope, query: "messageA", generation: 3 })
  .union(sampleGenerations.map(g => { ...sampleScope, query: "messageA", generation: g }))
  .union(sampleGenerations.map(g => { ...sampleScope, folder: I::DraftsFolder, generation: g }))
pure val mailContent: DraftContent = { to: "recipient@example.test", cc: Set("copy@example.test"), bcc: Set(), subject: "Subject", body: "Message" }
pure val contentValues = Set(mailContent, { ...mailContent, bcc: Set("hidden@example.test"), body: "" })
pure val operationIdValues = Set("sendA", "sendB")
pure val evidenceValues = Set("providerEvidence")
pure val selectedBill: BillSelection = {
  source: { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" },
  generation: 3, billRef: "billA", origin: "https://biller.example", account: "billerAccount"
}
pure val selectionValues = Set(selectedBill,
  { ...selectedBill, generation: 4 }, { ...selectedBill, generation: 5 },
  { ...selectedBill, generation: 2 }, { ...selectedBill, billRef: "otherInvoice" },
  { ...selectedBill, source: { ...selectedBill.source, ref: "otherMessage" } },
  { ...selectedBill, account: "otherBillerAccount" })
pure val billRefValues = Set("billA")
pure val originValues = Set("https://biller.example")
pure val billAccountValues = Set("billerAccount")
pure val draftIdValues = Set("draftA", "messageA")
pure val generationValues = Set(1).union(sampleGenerations.exclude(Set(2)))
pure val revisionValues = Set(1, 2, 3)
pure val requestValues = Set(1, 2)
pure val draftRevisionValues = Set(1, 2, 3)
pure val assetIdValues = Set("photo", "missing")
pure val mailAsset: F::SavedFile = { ...F::samplePhoto, origin: "providerA", account: "accountA", container: "messageA", sourceRef: "attachmentA" }
pure val assetValues = Set(mailAsset, F::samplePdf)
pure val readReceiptValues = {
  val completeManifest = List(mailAsset, { ...mailAsset, id: "photoB", sourceRef: "attachmentB", contentRef: "photo-content-b" }, { ...F::samplePdf, origin: "providerA", account: "accountA", container: "messageA", sourceRef: "attachmentPdf" })
  Set(
    { generation: 2, succeeded: true, assets: List(), suspicion: "" },
    { generation: 2, succeeded: false, assets: List(), suspicion: "" },
    { generation: 3, succeeded: true, assets: completeManifest, suspicion: "" },
    { generation: 4, succeeded: true, assets: completeManifest, suspicion: "" },
    { generation: 5, succeeded: true, assets: completeManifest, suspicion: "" },
    { generation: 3, succeeded: true, assets: List(), suspicion: "" },
    { generation: 3, succeeded: false, assets: List(), suspicion: "" },
    { generation: 4, succeeded: true, assets: List(), suspicion: "" },
    { generation: 5, succeeded: true, assets: List(), suspicion: "" },
    { generation: 6, succeeded: true, assets: List(), suspicion: "" })
    .union(sampleGenerations.map(g => { generation: g, succeeded: true, assets: List(), suspicion: "" }))
    .union(sampleGenerations.exclude(Set(2)).map(g => { generation: g, succeeded: true, assets: completeManifest, suspicion: "" }))
    .union(sampleGenerations.exclude(Set(2)).map(g => { generation: g, succeeded: true, assets: List(), suspicion: "classifierScam" }))
}
pure val snapshotValues = Set(
  { id: "draftA", version: 1, content: mailContent, attachments: List(), replyTo: "" },
  { id: "draftA", version: 2, content: mailContent, attachments: List(mailAsset), replyTo: "" },
  { id: "messageA", version: 3, content: mailContent, attachments: List(), replyTo: "" })
pure val directionValues = Set(-1, 0, 1)
pure val headerValues = sampleGenerations.map(g => { generation: g, address: "sender@example.test", subject: "Re: Subject", verified: true })
  .union(Set({ generation: 3, address: "", subject: "Re: Subject", verified: true },
    { generation: 3, address: "sender@example.test", subject: "Re: Subject", verified: false }))
pure val bodyValues = Set("Thank you, I will be there.")
pure val linkValues = Set("https://acc0unt-help.example/confirm")
pure val refsValues = Set(Set("attachmentA"), Set("attachmentPdf"), Set("attachmentA", "attachmentPdf"), Set("missing"), Set())
pure val weight_connect = 20
pure val weight_completeMessageChange = 30
pure val weight_changeSelectedMessage = 30
pure val weight_readMail = 12
pure val weight_chooseFolder = 3
pure val weight_movePhoto = 20
pure val weight_backToMessage = 20
pure val weight_forwardAttachment = 10
pure val weight_preserveDraft = 3
pure val weight_draftStoreResult = 8
pure val weight_attachAsset = 2
pure val weight_confirmVisibleSend = 20
pure val weight_authorize = 20
pure val weight_readResult = 30
pure val weight_receiveMessage = 30
pure val weight_receiveBill = 6
pure val weight_confirmBill = 6
pure val weight_editDraft = 8
pure val weight_reviewDraft = 3
pure val weight_approveDraft = 3
pure val weight_sendDraft = 30
pure val weight_sendResult = 30
pure val weight_startDraft = 6
```
