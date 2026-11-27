# Email across accounts

With more than one email on the tablet, `prototype/Grace Prototype.html`
shows one Email: "All inboxes" with a row for each account and its unread
count, each email tagged with where it came from, Outbox, a banner for an
account that needs her to sign in again, a "Getting your … email…" row while
a new account fills, and a From row with a "Send from" menu in the composer.
This library derives all of that from the [email accounts](./accounts.md)
registry and one [mailbox](./email.md) per account. It holds no mail: what
it shows is computed from the registry and the mailboxes, so the two never
disagree, and every mailbox keeps its own fences (generation, send fence,
retired drafts) unchanged. Its state, the mail choices, is only what Email
shows across the accounts: whether she chose Outbox. It is kept in memory
while the tablet is on, and Grace is told it.

A `MailSource` is one account's number in the registry and that account's
mailbox, as the shell keeps them. An account shows its mail only while it is
on the tablet with Email on. The shell sorts rows by the provider's date,
which the model does not keep, and composes every sentence the person or
Grace reads; the model chooses what they say.

## Story: See all my email in one place

> As Margaret with more than one email, I want one inbox with all of them,
> each email marked with where it came from, and to look at one email’s
> inbox when I choose.

### Each account’s state is read from its own mailbox and never stored twice

An account is getting its email while its first listing is under way and
nothing has arrived yet. It needs her to sign in again when its sign-in
expired, was revoked or failed; its mail already on the tablet stays
readable meanwhile. A provider that cannot be reached is not a sign-in
problem, and neither is the tablet being offline: no account’s state depends
on the internet. An account with no mailbox yet, or one still signing in, is
connecting. The message or composer on screen belongs to the first shown
account whose mailbox has one open.

```quint
import accounts as A from "./accounts"
import email as E from "./email"
import emailItem as I from "./emailItem"
import files as F from "./files"

type MailSource = { account: int, mailbox: E::Mailbox }
type AccountStatus = MailConnecting | MailReady | MailSyncing | MailNeedsSignIn | MailUnreachable
pure val noSource: MailSource = { account: 0, mailbox: E::initial }
pure def showsMail(registry: A::Accounts, account: int): bool =
  registry.accounts.some(x => x.id == account and x.use.mail)
pure def shown(registry: A::Accounts, sources: List[MailSource]): List[MailSource] =
  sources.select(s => showsMail(registry, s.account))
pure def sourceOf(sources: List[MailSource], account: int): MailSource =
  sources.select(s => s.account == account).nthOr(0, noSource)
pure def needsSignIn(mailbox: E::Mailbox): bool =
  mailbox.connection == E::Expired or mailbox.connection == E::Revoked or mailbox.connection == E::ConnectionFailed
pure def syncing(mailbox: E::Mailbox): bool =
  mailbox.connection == E::Connected and mailbox.readStatus == E::Reading and mailbox.readKind == E::Search and
  mailbox.messages.length() == 0
pure def accountStatus(mailbox: E::Mailbox): AccountStatus =
  if (needsSignIn(mailbox)) MailNeedsSignIn
  else if (syncing(mailbox)) MailSyncing
  else if (mailbox.connection == E::Connected) MailReady
  else if (mailbox.connection == E::Unavailable) MailUnreachable
  else MailConnecting
pure def isOpen(mailbox: E::Mailbox): bool = mailbox.view != E::Inbox or mailbox.composeVisible
pure def openSource(registry: A::Accounts, sources: List[MailSource]): int =
  shown(registry, sources).select(s => isOpen(s.mailbox)).nthOr(0, noSource).account
pure def lawStatusFollowsTheMailbox(mailbox: E::Mailbox): bool =
  (accountStatus(mailbox) == MailNeedsSignIn iff needsSignIn(mailbox)) and
  (accountStatus(mailbox) == MailReady implies mailbox.connection == E::Connected) and
  (accountStatus(mailbox) == MailSyncing implies mailbox.connection == E::Connected)
```

### With no account’s Email on, Email offers only Connect your email and Ask Grace

When no email on the tablet has its Email switched on, because none was
added yet, each was removed, or each one’s Email switch is off, Email shows
"Get your email on this tablet" with two choices only: Connect your email,
which opens Settings › Email & calendar, and Ask Grace to help. It has no
Write, no search and no folders
(`prototype/Grace Prototype.html:2122–2123`). Switching off the Email of the
last account that had it on brings this screen, and as soon as one account
has Email on, Email shows its folders and Write again.

```quint
type MailScreen = ConnectEmail | MailFolders
type MailChoice = ConnectChoice | AskGraceChoice | WriteChoice | SearchChoice | FolderChoice
pure def showsConnect(registry: A::Accounts): bool = A::mailAccounts(registry).length() == 0
pure def mailScreen(registry: A::Accounts): MailScreen = if (showsConnect(registry)) ConnectEmail else MailFolders
pure def mailChoices(registry: A::Accounts): List[MailChoice] =
  if (showsConnect(registry)) List(ConnectChoice, AskGraceChoice) else List(WriteChoice, SearchChoice, FolderChoice)
pure def lawConnectShowsExactlyWithoutEmail(registry: A::Accounts): bool =
  (mailScreen(registry) == ConnectEmail iff registry.accounts.every(x => not(x.use.mail))) and
  (mailScreen(registry) == ConnectEmail iff mailChoices(registry).every(c => c != WriteChoice and c != SearchChoice and c != FolderChoice))
pure def lawLastEmailOffShowsConnect(registry: A::Accounts, account: int, use: A::Use): bool =
  (A::canSetUse(registry, account, use, A::AccountPerson) and not(use.mail) and
    A::mailAccounts(registry).every(x => x.id == account)) implies
    mailScreen(A::setUse(registry, account, use, A::AccountPerson)) == ConnectEmail
```

### The Home Email card says No email added yet, Last updated only while it can’t update, or how many are new

With no account’s Email on, the Home Email card shows faded rows where its
emails would be and says "No email added yet", and Home’s banner asks her to
add email ([Notices](./notices.md)). Otherwise, while the card can’t update,
because the tablet is offline or a shown account needs her to sign in again,
it keeps the email it has and says "Last updated" with when it last did; the
banner says why, so the card has no note or button of its own. Only then does
it say "Last updated". Otherwise it shows "N new", the unread count of the
shown accounts’ inboxes, or "All caught up". Its rows come from what Grace is
shown of the inboxes: the unread ones when there are any, else every inbox
row; the shell shows the first two in the list’s newest-first order
(`prototype/Grace Prototype.html:1946–1949`). A hidden account’s unread email
is never counted and never shown. Tapping the card while offline is the
notices’ concern, not this card’s. The first shown account that needs her to
sign in again is the one Home’s banner names, and no email added is the
banner’s Add email.

```quint
type HomeMailStatus = NoEmailAdded | LastUpdated | NewCount({ count: int }) | AllCaughtUp
pure def signedOut(registry: A::Accounts, sources: List[MailSource]): List[MailSource] =
  shown(registry, sources).select(s => needsSignIn(s.mailbox))
pure def homeSignIn(registry: A::Accounts, sources: List[MailSource]): int =
  signedOut(registry, sources).nthOr(0, noSource).account
pure def homeStatus(registry: A::Accounts, sources: List[MailSource], online: bool): HomeMailStatus =
  val count = unreadIn(registry, shown(registry, sources), 0)
  if (showsConnect(registry)) NoEmailAdded
  else if (not(online) or signedOut(registry, sources).length() > 0) LastUpdated
  else if (count > 0) NewCount({ count: count })
  else AllCaughtUp
pure def noEmailAdded(status: HomeMailStatus): bool = match status { | NoEmailAdded => true | _ => false }
pure def lastUpdated(status: HomeMailStatus): bool = match status { | LastUpdated => true | _ => false }
pure def homeRows(registry: A::Accounts, sources: List[MailSource]): List[Row] =
  val inbox = mailContext(registry, sources).select(r => r.record.folder == I::InboxFolder)
  val unread = inbox.select(r => r.record.unread)
  if (unread.length() > 0) unread else inbox
pure def lawHomeAgreesWithEmail(registry: A::Accounts, sources: List[MailSource], online: bool): bool =
  val status = homeStatus(registry, sources, online)
  (noEmailAdded(status) iff mailScreen(registry) == ConnectEmail) and
  (lastUpdated(status) iff (mailScreen(registry) == MailFolders and
    (not(online) or signedOut(registry, sources).length() > 0)))
pure def lawHomeCountsOnlyShownMail(registry: A::Accounts, sources: List[MailSource], online: bool): bool =
  homeStatus(registry, sources, online) == homeStatus(registry, shown(registry, sources), online) and
  homeRows(registry, sources).every(r => showsMail(registry, r.account) and r.record.folder == I::InboxFolder)
pure def lawBannerNamesASignedOutShownAccount(registry: A::Accounts, sources: List[MailSource]): bool =
  val account = homeSignIn(registry, sources)
  account != 0 implies signedOut(registry, sources).some(s => s.account == account and showsMail(registry, account))
```

### All inboxes is the union of the shown accounts’ inboxes

With two or more accounts whose Email is on, Inbox reads "All inboxes" and
each of them has a row under it with its name, colour, unread count and
whether it needs her to sign in again. A folder shows, from every shown
account whose mailbox has that folder chosen, the messages its current
listing returned, each tagged with its account; a mailbox still on another
folder shows nothing rather than the wrong rows. Choosing an account’s row
shows that account’s inbox only. The unread count of All inboxes adds up the
shown accounts’ inbox unread counts.

```quint
type Row = { account: int, record: I::MessageRecord }
type InboxLabel = OneInbox | AllInboxes
type AccountRow = { id: int, name: str, colour: int, unread: int, needsSignIn: bool }
pure def allInboxes(registry: A::Accounts): bool = A::mailAccounts(registry).length() >= 2
pure def inboxLabel(registry: A::Accounts): InboxLabel = if (allInboxes(registry)) AllInboxes else OneInbox
pure def filtered(registry: A::Accounts, account: int, folder: I::Folder): bool =
  folder != I::InboxFolder or registry.inboxFilter == 0 or registry.inboxFilter == account
pure def sourceRows(registry: A::Accounts, source: MailSource, folder: I::Folder): List[Row] =
  if (showsMail(registry, source.account) and source.mailbox.folder == folder and filtered(registry, source.account, folder))
    E::listedMessages(source.mailbox).select(r => r.folder == folder).listMap(r => { account: source.account, record: r })
  else List()
pure def folderRows(registry: A::Accounts, sources: List[MailSource], folder: I::Folder): List[Row] =
  sources.foldl(List(), (rows, s) => rows.concat(sourceRows(registry, s, folder)))
pure def sourceUnread(registry: A::Accounts, source: MailSource): int =
  if (showsMail(registry, source.account)) E::folderUnread(source.mailbox, I::InboxFolder) else 0
pure def unreadIn(registry: A::Accounts, sources: List[MailSource], account: int): int =
  if (account == 0) sources.foldl(0, (n, s) => n + sourceUnread(registry, s))
  else if (showsMail(registry, account)) E::folderUnread(sourceOf(sources, account).mailbox, I::InboxFolder)
  else 0
pure def accountRows(registry: A::Accounts, sources: List[MailSource]): List[AccountRow] =
  if (not(allInboxes(registry))) List()
  else A::mailAccounts(registry).listMap(x => { id: x.id, name: x.name, colour: x.colour,
    unread: unreadIn(registry, sources, x.id), needsSignIn: needsSignIn(sourceOf(sources, x.id).mailbox) })
pure def lawFolderRowsComeFromShownAccounts(registry: A::Accounts, sources: List[MailSource], folder: I::Folder): bool =
  folderRows(registry, sources, folder).every(r => showsMail(registry, r.account) and r.record.folder == folder)
pure def lawAllInboxesKeepsEachAccountsRows(registry: A::Accounts, sources: List[MailSource], at: int, record: I::MessageRecord): bool =
  val source = sources.nthOr(at, noSource)
  val applies = registry.inboxFilter == 0 and at >= 0 and at < sources.length() and showsMail(registry, source.account) and
    source.mailbox.folder == I::InboxFolder and E::listedMessages(source.mailbox).includes(record) and
    record.folder == I::InboxFolder
  applies implies
    folderRows(registry, sources, I::InboxFolder).includes({ account: source.account, record: record })
pure def lawOneInboxShowsOnlyThatAccount(registry: A::Accounts, sources: List[MailSource]): bool =
  registry.inboxFilter != 0 implies folderRows(registry, sources, I::InboxFolder).every(r => r.account == registry.inboxFilter)
```

### Drafts counts the shown accounts’ saved drafts

The Drafts row’s count adds up each shown account’s count of saved drafts,
which its mailbox keeps from the provider whichever folder is open, so it is
right before Drafts was ever listed. A hidden account’s drafts are not
counted.

```quint
pure def draftsIn(registry: A::Accounts, sources: List[MailSource]): int =
  shown(registry, sources).foldl(0, (n, s) => n + s.mailbox.draftsTotal)
pure def lawDraftsCountOnlyShownMail(registry: A::Accounts, sources: List[MailSource]): bool =
  draftsIn(registry, sources) == draftsIn(registry, shown(registry, sources))
```

### Outbox gathers the shown accounts’ waiting email, and an account with unsent email stays

Outbox lists each shown account’s email waiting to go and shows only while
it has any. An account’s unsent email is what waits in its Outbox plus a send
whose result is not yet settled and saved, whether or not its Email is on;
that number is what removing the account waits for.

```quint
type OutboxRow = { account: int, queued: E::QueuedSend }
pure def sourceOutbox(registry: A::Accounts, source: MailSource): List[OutboxRow] =
  if (showsMail(registry, source.account)) source.mailbox.outbox.listMap(q => { account: source.account, queued: q })
  else List()
pure def outboxRows(registry: A::Accounts, sources: List[MailSource]): List[OutboxRow] =
  sources.foldl(List(), (rows, s) => rows.concat(sourceOutbox(registry, s)))
pure def outboxCount(registry: A::Accounts, sources: List[MailSource]): int = outboxRows(registry, sources).length()
pure def unsent(sources: List[MailSource], account: int): int =
  val box = sourceOf(sources, account).mailbox
  box.outbox.length() + (if (E::heldSend(box)) 1 else 0)
pure def lawWaitingEmailIsCounted(sources: List[MailSource], account: int): bool =
  val box = sourceOf(sources, account).mailbox
  unsent(sources, account) > 0 iff (box.outbox.length() > 0 or E::heldSend(box))
```

### Choosing Outbox shows its waiting email, and an emptied Outbox gives way to the folder

Outbox is not a provider’s folder: choosing it shows the Outbox rows instead
of a folder’s. Once the provider confirms the last waiting email was sent,
the list shows the folder the mailboxes have chosen again and the Outbox row
disappears (the prototype leaves an empty Outbox list on screen instead). The
mail choices keep that she chose Outbox until she chooses a folder or an
account’s inbox, so an email that waits again later shows in Outbox once
more, or until Email closes (`leaveEmail`): Email opens again on the folder,
as the prototype starts each opening of Email afresh. What it shows is
decided here. While Outbox shows, Grace can point at each waiting email, as
at the rows of a folder.

```quint
type MailChoices = { outboxChosen: bool }
pure val initial: MailChoices = { outboxChosen: false }
pure def chooseOutbox(choices: MailChoices): MailChoices = { ...choices, outboxChosen: true }
pure def chooseFolderList(choices: MailChoices): MailChoices = { ...choices, outboxChosen: false }
pure def leaveEmail(choices: MailChoices): MailChoices = { ...choices, outboxChosen: false }
pure def showsOutbox(registry: A::Accounts, sources: List[MailSource], choices: MailChoices): bool =
  choices.outboxChosen and outboxCount(registry, sources) > 0
pure def sentEverywhere(sources: List[MailSource], account: int, operationId: str): List[MailSource] =
  sources.listMap(s => if (s.account == account)
    { ...s, mailbox: E::queuedResult(s.mailbox, operationId, E::Sent, "provider", true, E::MailConnector) } else s)
pure def lawLastSentEmailLeavesOutbox(registry: A::Accounts, sources: List[MailSource], account: int, operationId: str): bool =
  outboxRows(registry, sources).every(r => r.account == account and r.queued.operationId == operationId) implies
    not(showsOutbox(registry, sentEverywhere(sources, account, operationId), chooseOutbox(initial)))
```

### Each account’s banner shows its own state, and offline is not a broken account

While the tablet is offline, Email says "No internet right now" first; she
can still read, and what she sends waits in Outbox. Its Fix Wi-Fi asks Grace
for help, as the prototype does (`prototype/Grace Prototype.html:2394`):
Grace opens and walks her through Wi-Fi, pointing at what to tap, on a turn
that may act but never consents. The Home banner's Fix Wi-Fi opens the
written steps on the Wi-Fi page instead ([Notices](./notices.md)). Each shown account that
needs her to sign in again has its own banner naming it, which adds "Your
other email is fine." when another shown account is not broken. Each shown
account getting its email has a "Getting your <Name> email…" row. Being
offline adds its banner and changes no other.

```quint
type BannerKind = OfflineBanner | SignInBanner | SyncingRow
type MailBanner = { kind: BannerKind, account: int, othersFine: bool }
pure val offlineBanner: MailBanner = { kind: OfflineBanner, account: 0, othersFine: false }
pure def sourceBanners(registry: A::Accounts, sources: List[MailSource], source: MailSource): List[MailBanner] =
  if (not(showsMail(registry, source.account))) List()
  else if (needsSignIn(source.mailbox))
    List({ kind: SignInBanner, account: source.account,
      othersFine: sources.some(o => o.account != source.account and showsMail(registry, o.account) and not(needsSignIn(o.mailbox))) })
  else if (syncing(source.mailbox)) List({ kind: SyncingRow, account: source.account, othersFine: false })
  else List()
pure def accountBanners(registry: A::Accounts, sources: List[MailSource]): List[MailBanner] =
  sources.foldl(List(), (shown, s) => shown.concat(sourceBanners(registry, sources, s)))
pure def banners(registry: A::Accounts, sources: List[MailSource], online: bool): List[MailBanner] =
  (if (online) List() else List(offlineBanner)).concat(accountBanners(registry, sources))
pure def lawSignInBannerNamesABrokenAccount(registry: A::Accounts, sources: List[MailSource], online: bool): bool =
  banners(registry, sources, online).every(b => b.kind == SignInBanner implies
    (showsMail(registry, b.account) and sources.some(s => s.account == b.account and needsSignIn(s.mailbox))))
pure def lawOfflineIsNotABrokenAccount(registry: A::Accounts, sources: List[MailSource]): bool =
  banners(registry, sources, false) == List(offlineBanner).concat(banners(registry, sources, true)) and
  banners(registry, sources, true).every(b => b.kind != OfflineBanner)
```

### Grace is shown only what Margaret can see

Grace is shown the inbox of every shown account, and the message open in a
shown account’s mailbox when it is in another folder; never mail of an
account whose Email is off or that was removed, and never a message deleted
for good. Which details of each she reads (sender, subject, unread,
attachments, the scam flag, the open message’s body) is the shell’s
rendering of these rows.

```quint
pure def seen(record: I::MessageRecord): bool = record.loaded and record.folder != I::PurgedFolder
pure def openRecords(mailbox: E::Mailbox): List[I::MessageRecord] =
  if (E::selectedMessageIsCurrent(mailbox) and mailbox.folder != I::InboxFolder) List(E::messageRecord(mailbox, mailbox.messageRef))
  else List()
pure def contextRows(registry: A::Accounts, source: MailSource): List[Row] =
  if (showsMail(registry, source.account))
    source.mailbox.messages.select(r => r.folder == I::InboxFolder).concat(openRecords(source.mailbox))
      .select(r => seen(r)).listMap(r => { account: source.account, record: r })
  else List()
pure def mailContext(registry: A::Accounts, sources: List[MailSource]): List[Row] =
  sources.foldl(List(), (rows, s) => rows.concat(contextRows(registry, s)))
pure def lawGraceSeesNoHiddenMail(registry: A::Accounts, sources: List[MailSource]): bool =
  mailContext(registry, sources).every(r => showsMail(registry, r.account) and seen(r.record))
```

### Grace is told what Margaret did with her email, and being told authorizes nothing

What Grace is told of an account’s mail is derived from its mailbox before
and after one event: that an email was opened, that the provider confirmed
an email sent, that an email went to Outbox to wait, that an email left
Outbox as sent, or that the provider moved an email to Trash at her or
Grace’s request. A queued email is never told as sent. Nothing changed tells
nothing. Being told is a turn of the host, never hers, so it asks Grace to
do nothing.

```quint
type MailNews = NoMailNews | OpenedEmail | SentEmail | QueuedEmail | OutboxSent | TrashedEmail
type MailTold = { news: MailNews, account: int, ref: str }
pure def undoable(mailbox: E::Mailbox): List[I::MessageRecord] =
  mailbox.messages.select(r =>
    r.folder == I::TrashFolder and r.status == I::ChangeIdle and r.undoRevision != -1 and r.undoRevision == r.revision)
pure def told(account: int, before: E::Mailbox, after: E::Mailbox): MailTold =
  val quiet = { news: NoMailNews, account: account, ref: "" }
  val trashed = undoable(after).select(r => not(undoable(before).some(o => o.identity == r.identity)))
  if (before.sendStatus != E::Sent and after.sendStatus == E::Sent) { ...quiet, news: SentEmail }
  else if (after.outbox.length() > before.outbox.length()) { ...quiet, news: QueuedEmail }
  else if (after.outboxSent > before.outboxSent) { ...quiet, news: OutboxSent }
  else if (undoable(after).length() > undoable(before).length())
    { ...quiet, news: TrashedEmail, ref: trashed.nthOr(0, I::initial).identity.ref }
  else if (after.view == E::Message and after.messageRef != "" and
      (before.messageRef != after.messageRef or before.view == E::Inbox))
    { ...quiet, news: OpenedEmail, ref: after.messageRef }
  else quiet
pure def lawToldIsDerived(account: int, mailbox: E::Mailbox): bool =
  told(account, mailbox, mailbox).news == NoMailNews
pure def lawSentIsToldOnlyWhenSent(account: int, before: E::Mailbox, after: E::Mailbox): bool =
  (told(account, before, after).news == SentEmail implies after.sendStatus == E::Sent) and
  (told(account, before, after).news == OpenedEmail implies
    (after.view == E::Message and told(account, before, after).ref == after.messageRef))
```

### A switched-off or removed account shows nothing anywhere

An account whose Email is off, or that was removed, has no row in any
folder, Outbox or the account rows, no unread count, no banner, no From
choice, nothing open on screen and nothing in what Grace is shown. Its
mailbox and its Outbox stay as they are, and turning Email back on shows
them again. A send that was already in flight still settles in its own
mailbox, but an account-scoped notice shows only while that same mailbox
belongs to a current account whose Email is on.

```quint
pure def lawHiddenAccountShowsNothing(registry: A::Accounts, sources: List[MailSource], folder: I::Folder, online: bool, account: int): bool =
  (account != 0 and not(showsMail(registry, account))) implies
    (folderRows(registry, sources, folder).every(r => r.account != account) and
      outboxRows(registry, sources).every(r => r.account != account) and
      accountRows(registry, sources).every(r => r.id != account) and
      unreadIn(registry, sources, account) == 0 and
      banners(registry, sources, online).every(b => b.account != account) and
      fromChoices(registry, sources).every(x => x.id != account) and
      openSource(registry, sources) != account and
      mailContext(registry, sources).every(r => r.account != account))
```

## Story: Send from the right address

> As Margaret, I want a reply to go from the address the email came to, and a
> new email from the one I last used with that person, and to change it if I
> want.

### From offers each account that has Email on and can send

A reply is written in the mailbox of the account the email came to, so it
goes from that address. A new email starts from the account last used with
that recipient, else the one that has sent the most
([accounts](./accounts.md)), when that account can send now; otherwise from
the first that can. The From row shows only when there are two choices or
more. Names in the recipient picker come only from accounts whose Contacts
is on.

```quint
pure def sendsFrom(mailbox: E::Mailbox): bool = mailbox.connection == E::Connected and mailbox.canSend
pure def fromChoices(registry: A::Accounts, sources: List[MailSource]): List[A::Account] =
  A::mailAccounts(registry).select(x => sendsFrom(sourceOf(sources, x.id).mailbox))
pure def startFrom(registry: A::Accounts, sources: List[MailSource], recipient: str): int =
  val preferred = A::defaultFrom(registry, recipient)
  if (fromChoices(registry, sources).some(x => x.id == preferred)) preferred
  else fromChoices(registry, sources).nthOr(0, A::noAccount).id
pure def contactAccounts(registry: A::Accounts): List[int] =
  registry.accounts.select(x => x.use.contacts).listMap(x => x.id)
pure def lawStartFromIsAChoice(registry: A::Accounts, sources: List[MailSource], recipient: str): bool =
  val start = startFrom(registry, sources, recipient)
  start == 0 or fromChoices(registry, sources).some(x => x.id == start)
```

### Writing starts at Who is it to?, and Cc and Bcc show once opened or used

Write, Forward and Share from Files open the recipient picker for To before
the composer (`prototype/Grace Prototype.html:2009–2011`). That first
picker’s Back reads "Inbox" and discards the new email. Write opens it in the
account a new email starts from, and the first person she picks there moves
an email with nothing attached to the account that person starts from
(previous rule), as changing From does (next rule). A picker opened from
the composer, with + next to To, Cc or Bcc, reads "New email" and goes back
to the composer keeping the whole draft, even after she removed its To. Cc and Bcc rows show once she taps Add next to
"Cc/Bcc" or the draft already has a copy or a hidden copy. Whether the picker
is open, which row it fills and whether she tapped Add are the mailbox’s,
kept with its draft ([email](./email.md)); only the words typed in its
search are the screen’s own.

```quint
type PickerBack = DiscardToInbox | BackToComposer
pure def pickerBack(mailbox: E::Mailbox): PickerBack =
  if (mailbox.choosing == E::PickNewEmail) DiscardToInbox else BackToComposer
pure def showsCopies(mailbox: E::Mailbox): bool =
  mailbox.ccOpen or mailbox.draft.cc.size() > 0 or mailbox.draft.bcc.size() > 0
```

### Changing From moves a draft never saved, whole and unapproved, and a saved draft stays

Choosing another From for an open draft that was never saved closes it in
the old account and opens the same recipients, subject, words and
attachments as a new email in the chosen one, which must be another account
of hers that can send and has its composer free. The shell applies it as the
events of the person’s own taps: Discard in the old mailbox, then a new
email, its content and each attachment in the chosen one. A reply moved this
way becomes a new email, because the reply belongs to the account that
received the message. Nothing moved is approved: she taps Send again. A draft
already saved belongs to its account’s provider and stays where it is.

```quint
type DraftMove = MovedDraft({ emptied: E::Mailbox, opened: E::Mailbox }) | DraftStays
pure def sameContent(one: E::DraftContent, other: E::DraftContent): bool =
  one.to == other.to and one.subject == other.subject and one.body == other.body and
  one.cc.subseteq(other.cc) and other.cc.subseteq(one.cc) and one.bcc.subseteq(other.bcc) and other.bcc.subseteq(one.bcc)
pure def draftMovable(drafting: E::Mailbox, chosen: E::Mailbox): bool =
  drafting.composeVisible and drafting.draftId == "" and F::validCatalog(drafting.draftAttachments) and
  E::canDiscardDraft(drafting, true, E::MailUser) and E::canStartDraft(chosen, false, E::MailUser) and
  chosen.owner == drafting.owner and chosen.account != drafting.account and sendsFrom(chosen)
pure def moveDraft(drafting: E::Mailbox, chosen: E::Mailbox): DraftMove =
  val written = E::editDraft(E::startDraft(chosen, false, E::MailUser), drafting.draft, E::MailUser)
  if (not(draftMovable(drafting, chosen))) DraftStays
  else MovedDraft({ emptied: E::discardDraft(drafting, true, E::MailUser),
    opened: drafting.draftAttachments.foldl(written, (m, f) => E::attachAsset(m, m.owner, f, m.revision, true, E::MailHost)) })
pure def lawMovedDraftKeepsContent(drafting: E::Mailbox, chosen: E::Mailbox): bool =
  val draftMove = moveDraft(drafting, chosen)
  match draftMove {
    | MovedDraft(x) => sameContent(x.opened.draft, drafting.draft) and x.opened.draftAttachments == drafting.draftAttachments and
        x.opened.replyTo == "" and x.opened.composeVisible and not(x.emptied.composeVisible) and x.emptied.sendStatus == E::NoDraft
    | DraftStays => true
  }
pure def lawMovedDraftIsUnapproved(drafting: E::Mailbox, chosen: E::Mailbox): bool =
  val draftMove = moveDraft(drafting, chosen)
  match draftMove {
    | MovedDraft(x) => x.opened.approvedRevision == -1 and x.opened.sendStatus == E::Composing and
        x.opened.draftId == "" and x.emptied.approvedRevision == -1
    | DraftStays => true
  }
pure def lawSavedDraftStays(drafting: E::Mailbox, chosen: E::Mailbox): bool =
  val draftMove = moveDraft(drafting, chosen)
  drafting.draftId != "" implies (match draftMove { | DraftStays => true | MovedDraft(x) => false })
```

### Simulation samples are real mailboxes and registries

Two accounts, Gmail (1) and Outlook (2), reached from the empty registry and
from `E::initial` by the events the shell sends: sign-in, connecting,
listing, the provider's drafts count, opening, a draft, Outbox, sending,
Trash, lost sign-in and Email switched off on the only account.

```quint
pure val sampleAttachment: F::SavedFile = { ...F::samplePhoto, origin: "gmail", account: "margaret@gmail.com" }
pure val gmailConnected: E::Mailbox =
  E::authorize(E::connect(E::initial, "margaret", "gmail", "margaret@gmail.com", E::MailUser), 1, true, true, true, E::MailConnector)
pure val outlookConnected: E::Mailbox =
  E::authorize(E::connect(E::initial, "margaret", "outlook", "margaret@outlook.com", E::MailUser), 1, true, true, true, E::MailConnector)
pure val gmailSyncing: E::Mailbox = E::readMail(gmailConnected, E::Search, "", true, E::MailUser)
pure val outlookSyncing: E::Mailbox = E::readMail(outlookConnected, E::Search, "", true, E::MailUser)
pure val firstListing: E::ReadReceipt = { generation: 2, succeeded: true, assets: List(), suspicion: "" }
pure val gmailListed: E::Mailbox =
  E::readResult(E::receiveMessage(gmailSyncing, E::listingScope(gmailSyncing),
    { seed: { identity: E::messageIdentity(gmailSyncing, "clinic"), folder: I::InboxFolder, unread: true, answered: false }, revision: -1, evidence: "provider" },
    E::MailConnector), firstListing, E::MailConnector)
pure val outlookListed: E::Mailbox =
  E::readResult(E::receiveMessage(outlookSyncing, E::listingScope(outlookSyncing),
    { seed: { identity: E::messageIdentity(outlookSyncing, "susan"), folder: I::InboxFolder, unread: true, answered: false }, revision: -1, evidence: "provider" },
    E::MailConnector), firstListing, E::MailConnector)
pure val gmailOpen: E::Mailbox =
  E::readResult(E::readMail(gmailListed, E::OpenMessage, "clinic", true, E::MailUser),
    { generation: 3, succeeded: true, assets: List(), suspicion: "" }, E::MailConnector)
pure val gmailRead: E::Mailbox =
  E::completeMessageChange(gmailOpen, { identity: E::messageIdentity(gmailOpen, "clinic"), revision: 1, result: I::ChangeIdle, evidence: "provider" }, E::MailConnector)
pure val gmailTrashing: E::Mailbox = E::changeSelectedMessage(gmailRead, { ref: "clinic", revision: 1 }, I::TrashMessage, E::MailUser)
pure val gmailTrashed: E::Mailbox =
  E::completeMessageChange(gmailTrashing, { identity: E::messageIdentity(gmailTrashing, "clinic"), revision: 2, result: I::ChangeIdle, evidence: "provider" }, E::MailConnector)
pure val sampleContent: E::DraftContent = { to: "susan@example.com", cc: Set(), bcc: Set(), subject: "Sunday", body: "See you on Sunday." }
pure val gmailComposing: E::Mailbox = E::editDraft(E::startDraft(gmailListed, false, E::MailUser), sampleContent, E::MailUser)
pure val gmailAttached: E::Mailbox = E::attachAsset(gmailComposing, "margaret", sampleAttachment, gmailComposing.revision, true, E::MailHost)
pure val gmailSaving: E::Mailbox = E::preserveDraft(gmailComposing, "draft1", E::MailUser)
pure val gmailQueued: E::Mailbox =
  E::queueSend(E::confirmVisibleSend(gmailComposing, gmailComposing.revision, E::MailUser), "send1", true, true, false, E::MailHost)
pure val gmailOutboxSent: E::Mailbox =
  E::queuedResult(E::dispatchQueued(gmailQueued, "send1", true, E::MailHost), "send1", E::Sent, "provider", true, E::MailConnector)
pure val gmailSending: E::Mailbox =
  E::sendDraft(E::confirmVisibleSend(gmailComposing, gmailComposing.revision, E::MailUser), "send2", true, true, E::MailHost)
pure val gmailSent: E::Mailbox = E::sendResult(gmailSending, "send2", E::Sent, "provider", true, E::MailConnector)
pure val gmailDraftsCounted: E::Mailbox = E::countDrafts(gmailListed, gmailListed.generation, 2, E::MailConnector)
pure val gmailExpired: E::Mailbox = E::endConnection(gmailListed, E::Expired, E::MailConnector)
pure val outlookExpired: E::Mailbox = E::endConnection(outlookListed, E::Expired, E::MailConnector)
pure val gmailUnreachable: E::Mailbox = E::endConnection(gmailListed, E::Unavailable, E::MailConnector)
pure val oneAccount: A::Accounts =
  A::sheetResult(A::chooseProvider(A::initial, A::Gmail, A::AccountPerson),
    { attempt: 1, outcome: A::Allowed, address: "margaret@gmail.com", granted: A::allowedUse }, "Gmail", A::AccountConnector)
pure val twoAccounts: A::Accounts =
  A::sheetResult(A::chooseProvider(A::addAccount(A::goBack(oneAccount, A::AccountPerson), A::AccountPerson), A::Outlook, A::AccountPerson),
    { attempt: 2, outcome: A::Allowed, address: "margaret@outlook.com", granted: A::allowedUse }, "Outlook", A::AccountConnector)
pure val registryValues = Set(A::initial, oneAccount, twoAccounts,
  A::setUse(oneAccount, 1, { mail: false, calendar: true, contacts: true }, A::AccountPerson),
  A::setUse(twoAccounts, 2, { mail: false, calendar: true, contacts: false }, A::AccountPerson),
  A::filterInbox(twoAccounts, 1, A::AccountPerson),
  A::removeAccount(A::requestRemoval(twoAccounts, 2, A::AccountPerson), 2, 0, A::AccountPerson))
pure val mailboxValues = Set(E::initial, gmailSyncing, gmailListed, gmailOpen, gmailRead, gmailTrashed, gmailComposing,
  gmailAttached, gmailSaving, gmailQueued, gmailOutboxSent, gmailSent, gmailExpired, gmailUnreachable, gmailDraftsCounted,
  outlookSyncing, outlookListed, outlookExpired)
pure val beforeValues = Set(gmailListed, gmailOpen, gmailRead, gmailComposing, gmailQueued)
pure val afterValues = Set(gmailOpen, gmailTrashed, gmailQueued, gmailOutboxSent, gmailSent, gmailRead)
pure val draftingValues = Set(gmailComposing, gmailAttached, gmailSaving, gmailQueued, gmailListed)
pure val chosenValues = Set(outlookListed, outlookSyncing, outlookExpired, gmailListed)
pure val sourcesValues = Set(List(),
  List({ account: 1, mailbox: gmailListed }),
  List({ account: 1, mailbox: gmailListed }, { account: 2, mailbox: outlookSyncing }),
  List({ account: 1, mailbox: gmailDraftsCounted }, { account: 2, mailbox: outlookListed }),
  List({ account: 1, mailbox: gmailExpired }, { account: 2, mailbox: outlookListed }),
  List({ account: 1, mailbox: gmailOpen }, { account: 2, mailbox: outlookExpired }),
  List({ account: 1, mailbox: gmailQueued }, { account: 2, mailbox: outlookListed }),
  List({ account: 1, mailbox: gmailTrashed }, { account: 2, mailbox: outlookListed }),
  List({ account: 1, mailbox: gmailUnreachable }, { account: 2, mailbox: outlookExpired }))
pure val recordValues = Set(gmailListed.messages.nthOr(0, I::initial), outlookListed.messages.nthOr(0, I::initial),
  gmailTrashed.messages.nthOr(0, I::initial), I::initial)
pure val accountValues = Set(0, 1, 2, 3)
pure val atValues = Set(-1, 0, 1, 2)
pure val operationIdValues = Set("send1", "send2")
```
