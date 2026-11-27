# Email messages and folders

`prototype/Grace Prototype.html:1996–2038,2317–2346` supplies Inbox, Sent, Drafts,
Trash, search, unread indicators, delete, undo, restore and Delete forever.
This child model defines one provider message's metadata and mutation status.
[Email](./email.md) owns its canonical per-message registry, account access, content
reading and the current composer. Runtime message changes pass through that
mailbox owner; no separate mutable child copy can outlive its selected message.
Rendered text, avatars and sample contacts are not message identity.

A row the person has answered reads "You replied: …" in place of its subject
(`prototype/Grace Prototype.html:1998`). `answered` is the provider's own
answered flag, carried by each listing and refresh. The prototype marks the row
the instant Send is tapped (`prototype/Grace Prototype.html:2342`); here it
appears when the provider reports it, deliberately, so a send that failed or is
still unknown never shows as a reply.

The mailbox owner checks current account access and exact message identity
before passing `MessageUser` or `MessageProvider`; its receipt route addresses
the canonical registry entry even when another message is now selected. Provider changes below require real receipts;
the prototype's instant local array changes are not remote confirmation. Trash
retention follows the provider's actual policy, never a universal 30-day timer.

## Story: Find and open the email I intend

> As a user, I want the correct folder, useful unread counts and search results
> that open my own message, including saved drafts.

### Message identity is bound once and empty records cannot be displayed

```quint
type MessageActor = MessageUser | MessageProvider
type Folder = InboxFolder | SentFolder | DraftsFolder | TrashFolder | PurgedFolder
type MessageChange = NoMessageChange | ReadMessage | UnreadMessage | TrashMessage | RestoreMessage | PurgeMessage
type ChangeStatus = ChangeIdle | ChangePending | ChangeUnknown | ChangeFailed
type MessageIdentity = { owner: str, provider: str, account: str, ref: str }
type MessageRecord = {
  identity: MessageIdentity, loaded: bool, folder: Folder, previousFolder: Folder,
  unread: bool, answered: bool, revision: int, pending: MessageChange, status: ChangeStatus,
  undoRevision: int
}
type MessageSeed = { identity: MessageIdentity, folder: Folder, unread: bool, answered: bool }
type MetadataReceipt = { seed: MessageSeed, revision: int, evidence: str }
type ChangeReceipt = { identity: MessageIdentity, revision: int, result: ChangeStatus, evidence: str }
pure val noIdentity: MessageIdentity = { owner: "", provider: "", account: "", ref: "" }
pure val initial: MessageRecord = {
  identity: noIdentity, loaded: false, folder: InboxFolder, previousFolder: InboxFolder,
  unread: false, answered: false, revision: 0, pending: NoMessageChange, status: ChangeIdle,
  undoRevision: -1
}
pure def validIdentity(identity: MessageIdentity): bool =
  identity.owner != "" and identity.provider != "" and identity.account != "" and identity.ref != ""
pure def canLoadMessage(m: MessageRecord, seed: MessageSeed, by: MessageActor): bool =
  by == MessageProvider and not(m.loaded) and validIdentity(seed.identity) and seed.folder != PurgedFolder
pure def loadMessage(m: MessageRecord, seed: MessageSeed, by: MessageActor): MessageRecord =
  { ...m, loaded: true, identity: seed.identity, folder: seed.folder, unread: seed.unread, answered: seed.answered }
pure def canRefreshMetadata(m: MessageRecord, metadata: MetadataReceipt, by: MessageActor): bool =
  by == MessageProvider and m.loaded and m.folder != PurgedFolder and
  (m.status == ChangeIdle or m.status == ChangeFailed) and metadata.seed.identity == m.identity and
  metadata.revision == m.revision and metadata.evidence != ""
pure def refreshMetadata(m: MessageRecord, metadata: MetadataReceipt, by: MessageActor): MessageRecord =
  { ...m, folder: metadata.seed.folder, unread: metadata.seed.unread, answered: metadata.seed.answered,
    previousFolder: if (metadata.seed.folder == TrashFolder and m.folder != TrashFolder) m.folder else m.previousFolder,
    revision: m.revision + 1, status: ChangeIdle, pending: NoMessageChange, undoRevision: -1 }
pure def visibleIn(m: MessageRecord, identity: MessageIdentity, folder: Folder): bool =
  m.loaded and m.identity.owner == identity.owner and m.identity.provider == identity.provider and
  m.identity.account == identity.account and m.folder == folder and folder != PurgedFolder
pure def visibleMessages(entries: List[MessageRecord], identity: MessageIdentity, folder: Folder): List[MessageRecord] =
  entries.select(m => visibleIn(m, identity, folder))
pure def unreadCount(entries: List[MessageRecord], identity: MessageIdentity, folder: Folder): int =
  visibleMessages(entries, identity, folder).select(m => m.unread).length()
pure def alwaysMessageIdentity(m: MessageRecord): bool = m.loaded implies validIdentity(m.identity)
pure def alwaysPurgedIsLoaded(m: MessageRecord): bool = m.folder == PurgedFolder implies m.loaded
pure def alwaysMessageRevision(m: MessageRecord): bool = m.revision >= 0 and m.undoRevision >= -1
pure def stepMessageIdentityIsFixed(before: MessageRecord, after: MessageRecord): bool =
  before.loaded implies after.identity == before.identity
pure def sometimesMessageLoaded(m: MessageRecord): bool = m.loaded
```

### Folder and search results remain scoped to the current mailbox and query

A scoped provider refresh can change folder/unread metadata only for the same
immutable message identity and exact current record revision, with provider
evidence and no pending or unknown mutation. It increments the revision to
fence earlier callbacks. A purged record never refreshes back into existence.
The mailbox owner also checks the listing request's generation and query;
expected record revisions are captured when that request starts, never rebuilt
from a later state when its callback arrives.

Switching folders clears search and selection. Search covers sender, subject and
body in that folder; provider/local-index text normalization is an adapter duty.
Search results are Email's `listedMessages`: only records the current listing,
fenced by its scope, returned. No results and an empty folder have different
copy; both are successful empty lists. Search failure preserves the error and a
retry path in Email's read lifecycle. Duplicate source IDs never select an
arbitrary message: Email's `messageRecord` refuses ambiguity.

```quint
pure def lawAnotherOwnerCannotAppear(m: MessageRecord, identity: MessageIdentity, folder: Folder): bool =
  m.identity.owner != identity.owner implies not(visibleIn(m, identity, folder))
```

## Story: Delete a message and recover it safely

> As a user, I want Delete to move the selected message to Trash, Undo or Restore
> to recover it, and Delete forever to remove only the selected trash message.

### Only an authorized current selection can begin a provider mutation

Discovered by the proof: a settled or failed request must clear its pending
operation. Without that fact, an unloaded record could carry a phantom pending
restore and loading Inbox metadata could violate the operation's folder binding.

Opening an unread message requests the read flag. Mark unread requests the
unread flag back on a read message outside Trash, as a provider change with its
own receipt like any other; reading is opening, so there is no separate mark
read. Delete records its previous
folder. Restore returns there; imported trash with no previous-folder metadata
returns to Inbox. The prototype's Delete forever tap is final user intent, not
an extra invented confirmation dialog. Each request is scoped to a stable
message and increasing revision. Pending or uncertain requests cannot be
reissued; reconciliation queries that same operation before another mutation.
Undo names the revision of an acknowledged move to Trash, so it is offered only
after that acknowledgment, never while the move is pending, and any later refresh
or change of the message withdraws it, as does closing the Undo toast
(`closeUndo`), which changes nothing else about the message. Provider evidence is checked on each
receipt and kept by the adapter, not in the record.

```quint
pure def canChangeMessage(m: MessageRecord, change: MessageChange, by: MessageActor): bool =
  by == MessageUser and m.loaded and m.folder != PurgedFolder and
  (m.status == ChangeIdle or m.status == ChangeFailed) and
  ((change == ReadMessage and m.unread) or
    (change == UnreadMessage and not(m.unread) and m.folder != TrashFolder) or
    (change == TrashMessage and m.folder != TrashFolder) or
    ((change == RestoreMessage or change == PurgeMessage) and m.folder == TrashFolder))
pure def changeMessage(m: MessageRecord, change: MessageChange, by: MessageActor): MessageRecord =
  { ...m, pending: change, status: ChangePending, revision: m.revision + 1, undoRevision: -1 }
pure def canUndoTrash(m: MessageRecord, revision: int, by: MessageActor): bool =
  by == MessageUser and m.folder == TrashFolder and m.status == ChangeIdle and
  m.undoRevision == revision and revision == m.revision
pure def undoTrash(m: MessageRecord, revision: int, by: MessageActor): MessageRecord =
  changeMessage(m, RestoreMessage, by)
pure def canCloseUndo(m: MessageRecord, revision: int, by: MessageActor): bool =
  by == MessageUser and m.undoRevision != -1 and m.undoRevision == revision
pure def closeUndo(m: MessageRecord, revision: int, by: MessageActor): MessageRecord =
  { ...m, undoRevision: -1 }
pure def canCompleteChange(m: MessageRecord, receipt: ChangeReceipt, by: MessageActor): bool =
  by == MessageProvider and (m.status == ChangePending or m.status == ChangeUnknown) and
  receipt.identity == m.identity and receipt.revision == m.revision and
  (receipt.result == ChangeUnknown or ((receipt.result == ChangeIdle or receipt.result == ChangeFailed) and receipt.evidence != ""))
pure def completeChange(m: MessageRecord, receipt: ChangeReceipt, by: MessageActor): MessageRecord =
  val succeeded = receipt.result == ChangeIdle
  { ...m, status: receipt.result,
    folder: if (not(succeeded)) m.folder else if (m.pending == TrashMessage) TrashFolder
      else if (m.pending == RestoreMessage) m.previousFolder else if (m.pending == PurgeMessage) PurgedFolder else m.folder,
    previousFolder: if (succeeded and m.pending == TrashMessage) m.folder else m.previousFolder,
    unread: if (succeeded and m.pending == ReadMessage) false else if (succeeded and m.pending == UnreadMessage) true else m.unread,
    undoRevision: if (succeeded and m.pending == TrashMessage) m.revision else -1,
    pending: if (receipt.result == ChangeUnknown) m.pending else NoMessageChange }
pure def alwaysSettledHasNoPendingChange(m: MessageRecord): bool =
  (m.status == ChangeIdle or m.status == ChangeFailed) implies m.pending == NoMessageChange
pure def alwaysPendingChangeIsBound(m: MessageRecord): bool =
  (m.status == ChangePending or m.status == ChangeUnknown) implies
    (m.loaded and m.folder != PurgedFolder and m.pending != NoMessageChange and m.revision > 0)
pure def alwaysPendingChangeMatchesFolder(m: MessageRecord): bool =
  (m.pending == TrashMessage implies m.folder != TrashFolder) and
  ((m.pending == RestoreMessage or m.pending == PurgeMessage) implies m.folder == TrashFolder)
pure def alwaysPreviousFolderIsRecoverable(m: MessageRecord): bool =
  m.previousFolder != TrashFolder and m.previousFolder != PurgedFolder
pure def alwaysUndoNamesCurrentTrash(m: MessageRecord): bool =
  m.undoRevision != -1 implies
    (m.folder == TrashFolder and m.loaded and m.status == ChangeIdle and m.undoRevision == m.revision)
pure def stepPurgedNeverReappears(before: MessageRecord, after: MessageRecord): bool =
  before.folder == PurgedFolder implies after.folder == PurgedFolder
pure def sometimesTrash(m: MessageRecord): bool = m.loaded and m.folder == TrashFolder
pure def sometimesPurged(m: MessageRecord): bool = m.folder == PurgedFolder
pure def sometimesUncertain(m: MessageRecord): bool = m.status == ChangeUnknown
pure def sometimesMutationFailed(m: MessageRecord): bool = m.status == ChangeFailed
pure def sometimesMarkedUnread(m: MessageRecord): bool = m.pending == UnreadMessage and m.status == ChangePending
```

### A message record is valid when it meets every rule above

`validMessageRecord` gathers this spec's `always` rules beside them, for the
[Email](./email.md) registry that holds many records.

```quint
pure def validMessageRecord(m: MessageRecord): bool =
  alwaysMessageIdentity(m) and alwaysPurgedIsLoaded(m) and alwaysMessageRevision(m) and
  alwaysSettledHasNoPendingChange(m) and alwaysPendingChangeIsBound(m) and
  alwaysPendingChangeMatchesFolder(m) and alwaysPreviousFolderIsRecoverable(m) and
  alwaysUndoNamesCurrentTrash(m)
```

### Simulation exercises identities, folder changes, stale receipts and uncertainty

```quint
pure val messageIdentity: MessageIdentity = { owner: "ownerA", provider: "providerA", account: "accountA", ref: "messageA" }
pure val identityValues = Set(noIdentity, messageIdentity, { ...messageIdentity, owner: "ownerB" })
pure val seedValues = Set({ identity: messageIdentity, folder: InboxFolder, unread: true, answered: false },
  { identity: messageIdentity, folder: SentFolder, unread: false, answered: false },
  { identity: messageIdentity, folder: DraftsFolder, unread: false, answered: false },
  { identity: messageIdentity, folder: TrashFolder, unread: false, answered: false })
pure val metadataValues = Set(
  { seed: { identity: messageIdentity, folder: InboxFolder, unread: false, answered: false }, revision: 0, evidence: "providerMetadata" },
  { seed: { identity: messageIdentity, folder: TrashFolder, unread: false, answered: false }, revision: 1, evidence: "providerMetadata" },
  { seed: { identity: messageIdentity, folder: InboxFolder, unread: false, answered: false }, revision: 2, evidence: "providerMetadata" },
  { seed: { identity: noIdentity, folder: InboxFolder, unread: false, answered: false }, revision: 0, evidence: "" })
pure val entriesValues = Set(List(), List(initial), List(loadMessage(initial, { identity: messageIdentity, folder: InboxFolder, unread: true, answered: false }, MessageProvider)))
pure val receiptValues = Set(
  { identity: messageIdentity, revision: 1, result: ChangeIdle, evidence: "providerReceipt" },
  { identity: messageIdentity, revision: 2, result: ChangeIdle, evidence: "providerReceipt" },
  { identity: messageIdentity, revision: 3, result: ChangeIdle, evidence: "providerReceipt" },
  { identity: messageIdentity, revision: 1, result: ChangeUnknown, evidence: "" },
  { identity: messageIdentity, revision: 2, result: ChangeUnknown, evidence: "" },
  { identity: messageIdentity, revision: 1, result: ChangeFailed, evidence: "providerReceipt" },
  { identity: noIdentity, revision: 0, result: ChangeIdle, evidence: "" })
pure val weight_completeChange = 5
pure val weight_changeMessage = 4
```
