# Email accounts on this tablet

Settings › Email & calendar in `prototype/Grace Prototype.html` lists the
email accounts on the tablet, adds one by signing in on the email company’s
own page, checks an Other email’s servers, turns each account’s Email,
Calendar and Contacts on or off, signs in again and removes an account. This
module owns that registry and those flows, the Inbox filter of Email and the
dismissal of Calendar’s connect banner.

Each account’s mail and calendar live in their own [mailbox](./email.md) and
[calendar view](./calendarView.md), one of each per account, so an account’s
status (connected, needs sign-in, getting its email) is read from its mailbox
and never stored twice here. The provider’s sign-in page belongs to the
provider: the tablet frames it with Cancel and learns only the outcome. The
display name ("Gmail", "Gmail (margaret2)", "Riverview") is composed by the
shell, because the model has no string building; this module keeps names
distinct. Account colours, the provider list, the sign-in hosts and the
seeded demo mail in the prototype are presentation, not policy.

## Story: Connect the email I already use

> As Margaret, I want to put the email I already use on the tablet by signing
> in on my email company’s own page, so that its emails, calendar and contacts
> come to the tablet, and nobody, Grace included, sees my password.

### Accounts start empty and each address is on the tablet once

Every account has an issued number, an address, a name no other account has,
a colour from five and the From name its email goes out under. The settings page shows the account it names and
asks about removing only the account it shows, never while signing in.

```quint
type AccountActor = AccountPerson | AccountConnector | AccountHost
type Provider = Gmail | Outlook | Yahoo | ICloud | Aol | OtherEmail
type Use = { mail: bool, calendar: bool, contacts: bool }
type Account = { id: int, provider: Provider, address: str, name: str, colour: int, use: Use, sent: int, fromName: str }
type LastFrom = { recipient: str, account: int }
type AccountPage = AccountList | AddAccount | OtherEmailPage | MailServersPage | AccountDetail
type SignInStage = NotSigningIn | ProviderPage | CheckingOther | CheckingServers
type Problem = NoProblem | ListedProvider | PasswordRefused | ServersRefused | SignInUnfinished | AlreadyOnTablet | EmailWaiting
type Lookup = NotLookedUp | LookingUp | LookupFound | LookupMissed
type SignIn = { stage: SignInStage, provider: Provider, renewing: int, attempt: int, domain: str, lookup: Lookup, incoming: str, outgoing: str }
type Accounts = {
  accounts: List[Account], page: AccountPage, shown: int, signIn: SignIn, problem: Problem,
  removing: int, discarding: int, nextId: int, inboxFilter: int, bannerDismissed: bool, lastFrom: List[LastFrom]
}
pure val noSignIn: SignIn = {
  stage: NotSigningIn, provider: Gmail, renewing: 0, attempt: 0, domain: "", lookup: NotLookedUp, incoming: "", outgoing: ""
}
pure val noAccount: Account = {
  id: 0, provider: OtherEmail, address: "", name: "",
  colour: 0, use: { mail: false, calendar: false, contacts: false }, sent: 0, fromName: ""
}
pure val initial: Accounts = {
  accounts: List(), page: AccountList, shown: 0, signIn: noSignIn, problem: NoProblem,
  removing: 0, discarding: 0, nextId: 1, inboxFilter: 0, bannerDismissed: false, lastFrom: List()
}
pure def accountAt(a: Accounts, id: int): Account =
  a.accounts.foldl(noAccount, (found, x) => if (x.id == id) x else found)
pure def accountWith(a: Accounts, address: str): Account =
  a.accounts.foldl(noAccount, (found, x) => if (x.address == address) x else found)
pure def hasAccount(a: Accounts, id: int): bool = id != 0 and a.accounts.some(x => x.id == id)
pure def mailAccounts(a: Accounts): List[Account] = a.accounts.select(x => x.use.mail)
pure def alwaysOneAccountPerAddress(a: Accounts): bool =
  a.accounts.every(x => x.address != "" and a.accounts.select(y => y.address == x.address).length() == 1)
pure def alwaysIdsAreIssued(a: Accounts): bool =
  a.nextId > 0 and a.accounts.every(x =>
    x.id > 0 and x.id < a.nextId and a.accounts.select(y => y.id == x.id).length() == 1)
pure def alwaysNamesAreDistinct(a: Accounts): bool =
  a.accounts.every(x => x.name != "" and a.accounts.select(y => y.name == x.name).length() == 1)
pure def alwaysAccountsAreWellFormed(a: Accounts): bool =
  a.accounts.every(x => x.colour >= 0 and x.colour < 5 and x.sent >= 0) and
  a.signIn.attempt >= 0 and a.signIn.renewing >= 0
pure def alwaysPagesNameAnAccount(a: Accounts): bool =
  (a.page == AccountDetail implies hasAccount(a, a.shown)) and
  (a.removing != 0 implies (a.page == AccountDetail and a.shown == a.removing and a.signIn.stage == NotSigningIn)) and
  (a.problem == EmailWaiting implies a.removing != 0) and
  (a.discarding != 0 implies (a.removing != 0 and a.discarding > 0))
```

### Only the current sign-in attempt can add or renew an account

Choosing Gmail, Outlook, Yahoo, iCloud or AOL opens that company’s own page
as a new attempt; Other email opens the Other email form instead. Cancel
closes the page, and a restart closes any page left open, both as a new
attempt, so a late answer from the old one changes nothing. The page answers
Allowed with the address and what she allowed, Cancelled, or Refused when
she could not finish. Allowed adds the address as a new account and shows
it; for the same address as the account she is signing in to again it renews
that account instead, and a company’s page closed any other way leaves that
account as it was and ends signing in again; an address already on the
tablet as another account is refused with "This email is already on the
tablet." New accounts take a colour by their place in the list.

```quint
type SheetOutcome = Allowed | Cancelled | Refused
type SheetReport = { attempt: int, outcome: SheetOutcome, address: str, granted: Use }
pure def nextAttempt(s: SignIn): SignIn = { ...noSignIn, attempt: s.attempt + 1 }
pure def closed(s: SignIn): SignIn =
  { ...s, stage: NotSigningIn, renewing: if (s.stage == ProviderPage) 0 else s.renewing }
pure def canAddAccount(a: Accounts, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage == NotSigningIn and a.removing == 0 and
  a.page == AccountList and a.accounts.length() > 0
pure def addAccount(a: Accounts, by: AccountActor): Accounts =
  { ...a, page: AddAccount, problem: NoProblem, signIn: { ...a.signIn, renewing: 0 } }
pure def canChooseProvider(a: Accounts, provider: Provider, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage == NotSigningIn and a.removing == 0 and
  (a.page == AddAccount or (a.page == AccountList and a.accounts.length() == 0))
pure def chooseProvider(a: Accounts, provider: Provider, by: AccountActor): Accounts =
  if (provider == OtherEmail) { ...a, page: OtherEmailPage, problem: NoProblem, signIn: { ...nextAttempt(a.signIn), provider: OtherEmail } }
  else { ...a, problem: NoProblem, signIn: { ...nextAttempt(a.signIn), stage: ProviderPage, provider: provider } }
pure def canCancelSignIn(a: Accounts, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage != NotSigningIn
pure def cancelSignIn(a: Accounts, by: AccountActor): Accounts =
  { ...a, problem: NoProblem, signIn: { ...closed(a.signIn), attempt: a.signIn.attempt + 1 } }
pure def canRestartAccounts(a: Accounts, by: AccountActor): bool = by == AccountHost
pure def restartAccounts(a: Accounts, by: AccountActor): Accounts =
  { ...a, page: AccountList, shown: 0, removing: 0, discarding: 0, problem: NoProblem, bannerDismissed: false, signIn: nextAttempt(a.signIn) }
pure def freshName(a: Accounts, name: str): bool = name != "" and not(a.accounts.some(x => x.name == name))
pure def offServers(s: SignIn): SignIn = { ...s, lookup: NotLookedUp, incoming: "", outgoing: "" }
pure def admitted(provider: Provider, a: Accounts, address: str, name: str, use: Use, fromName: str): Accounts =
  val existing = accountWith(a, address)
  val finished = offServers({ ...a.signIn, stage: NotSigningIn })
  if (existing.id != 0 and existing.id != a.signIn.renewing) { ...a, signIn: closed(a.signIn), problem: AlreadyOnTablet }
  else if (existing.id != 0) {
    ...a, signIn: { ...finished, domain: "" }, page: AccountDetail, shown: existing.id, problem: NoProblem,
    accounts: a.accounts.listMap(x => if (x.id == existing.id and fromName != "") { ...x, fromName: fromName } else x)
  }
  else {
    ...a, signIn: { ...finished, renewing: 0, domain: "" }, page: AccountDetail, shown: a.nextId, nextId: a.nextId + 1, problem: NoProblem,
    accounts: a.accounts.append({ id: a.nextId, provider: provider, address: address, name: name,
      colour: a.accounts.length() % 5, use: use, sent: 0, fromName: fromName })
  }
pure def admits(a: Accounts, address: str, name: str): bool =
  address != "" and (accountWith(a, address).id == 0 implies freshName(a, name))
pure def canSheetResult(a: Accounts, sheet: SheetReport, name: str, by: AccountActor): bool =
  by == AccountConnector and a.signIn.stage == ProviderPage and sheet.attempt == a.signIn.attempt and
  (sheet.outcome == Allowed implies admits(a, sheet.address, name))
pure def sheetResult(a: Accounts, sheet: SheetReport, name: str, by: AccountActor): Accounts =
  if (sheet.outcome == Allowed) admitted(a.signIn.provider, a, sheet.address, name, sheet.granted, "")
  else { ...a, signIn: closed(a.signIn), problem: if (sheet.outcome == Refused) SignInUnfinished else NoProblem }
pure def lawStaleSignInCannotConnect(a: Accounts, sheet: SheetReport, name: str, by: AccountActor): bool =
  sheet.attempt != a.signIn.attempt implies not(canSheetResult(a, sheet, name, by))
pure def lawAnotherAccountsAddressIsRefused(a: Accounts, sheet: SheetReport, name: str, by: AccountActor): bool =
  (canSheetResult(a, sheet, name, by) and sheet.outcome == Allowed and accountWith(a, sheet.address).id != 0 and
    accountWith(a, sheet.address).id != a.signIn.renewing) implies
    sheetResult(a, sheet, name, by).accounts == a.accounts and sheetResult(a, sheet, name, by).problem == AlreadyOnTablet
pure def stepAccountsGrowOnlyFromASignIn(before: Accounts, via: str, after: Accounts): bool =
  after.accounts.every(x => before.accounts.some(y => y.id == x.id) or
    via == "sheetResult" or via == "otherResult" or via == "serversResult")
pure def stepAttemptNeverMovesBack(before: Accounts, after: Accounts): bool =
  after.signIn.attempt >= before.signIn.attempt and after.nextId >= before.nextId
pure def sometimesProviderPageOpen(a: Accounts): bool = a.signIn.stage == ProviderPage
pure def sometimesSignInUnfinished(a: Accounts): bool = a.problem == SignInUnfinished
pure def sometimesAlreadyOnTablet(a: Accounts): bool = a.problem == AlreadyOnTablet
pure def sometimesTwoAccounts(a: Accounts): bool = a.accounts.length() >= 2
```

### An address at a listed company goes to that company’s own page

On the Other email form the shell hands the part of the address after the @
to this module. An address at Gmail, Outlook, Hotmail, Live, MSN, Yahoo,
iCloud, me.com, mac.com or AOL is sent back with "This is a Yahoo address.
Go back and choose Yahoo, so you can sign in on Yahoo’s own page.", naming
that company, with "an" before a company whose name starts with a vowel
sound ("an Outlook", "an iCloud", "an AOL address"), and nothing is sent to
any server.

```quint
type ListedDomain = { domain: str, provider: Provider }
pure val listedDomains: List[ListedDomain] = List(
  { domain: "gmail.com", provider: Gmail }, { domain: "googlemail.com", provider: Gmail },
  { domain: "outlook.com", provider: Outlook }, { domain: "hotmail.com", provider: Outlook },
  { domain: "live.com", provider: Outlook }, { domain: "msn.com", provider: Outlook },
  { domain: "yahoo.com", provider: Yahoo }, { domain: "icloud.com", provider: ICloud },
  { domain: "me.com", provider: ICloud }, { domain: "mac.com", provider: ICloud }, { domain: "aol.com", provider: Aol })
pure val unlistedDomain: ListedDomain = { domain: "", provider: OtherEmail }
pure def providerOf(domain: str): Provider =
  listedDomains.foldl(unlistedDomain, (found, d) => if (d.domain == domain) d else found).provider
pure def canSubmitOther(a: Accounts, domain: str, by: AccountActor): bool =
  by == AccountPerson and a.page == OtherEmailPage and a.signIn.stage == NotSigningIn and domain != ""
pure def submitOther(a: Accounts, domain: str, by: AccountActor): Accounts =
  if (providerOf(domain) != OtherEmail)
    { ...a, problem: ListedProvider, signIn: { ...a.signIn, domain: domain } }
  else
    { ...a, problem: NoProblem, signIn: { ...a.signIn, stage: CheckingOther, provider: OtherEmail, attempt: a.signIn.attempt + 1, domain: domain } }
pure def lawListedDomainIsRedirected(a: Accounts, domain: str, by: AccountActor): bool =
  (canSubmitOther(a, domain, by) and providerOf(domain) != OtherEmail) implies
    (submitOther(a, domain, by).signIn.stage == NotSigningIn and submitOther(a, domain, by).problem == ListedProvider and
      submitOther(a, domain, by).signIn.attempt == a.signIn.attempt and
      providerOf(submitOther(a, domain, by).signIn.domain) == providerOf(domain))
pure def sometimesListedProvider(a: Accounts): bool =
  a.problem == ListedProvider and a.page == OtherEmailPage and providerOf(a.signIn.domain) != OtherEmail
pure val domainValues = Set("riverview.net", "gmail.com", "outlook.com")
```

### Other email connects through its own servers, asking for them when the tablet cannot find them

The connector checks the address and password the shell hands it straight
from the form. It answers Allowed, a refused password ("That password didn’t
work…"), that it needs the mail servers, or Refused. Needing servers opens
Mail settings for the same domain; Connect there is a new attempt. An Other
email starts with Email and Contacts on and Calendar off. Signing in again
to an Other email uses the same form and renews that account.

The name she gives on that form is the account’s From name: her email from
that account goes out under it, and signing in again changes it to the name
she gives then. The form starts with the From name of the account she is
signing in to again, otherwise with the name of her Grace account. An Other
email is never added without a From name; a company’s account has none here,
because the company’s own page keeps her name. A previously saved Other
account without a From name stays on the tablet with its existing email and
an unknown name until she next signs in to it.

```quint
type OtherOutcome = OtherAllowed | OtherPasswordRefused | OtherNeedsServers | OtherRefused
type OtherReport = { attempt: int, outcome: OtherOutcome, address: str }
pure val otherUse: Use = { mail: true, calendar: false, contacts: true }
pure def canOtherResult(a: Accounts, check: OtherReport, name: str, fromName: str, by: AccountActor): bool =
  by == AccountConnector and a.signIn.stage == CheckingOther and check.attempt == a.signIn.attempt and
  (check.outcome == OtherAllowed implies (admits(a, check.address, name) and fromName != ""))
pure def otherResult(a: Accounts, check: OtherReport, name: str, fromName: str, by: AccountActor): Accounts =
  val finished = { ...a.signIn, stage: NotSigningIn }
  if (check.outcome == OtherAllowed) admitted(OtherEmail, a, check.address, name, otherUse, fromName)
  else if (check.outcome == OtherNeedsServers) { ...a, page: MailServersPage, signIn: offServers(finished), problem: NoProblem }
  else { ...a, signIn: finished, problem: if (check.outcome == OtherPasswordRefused) PasswordRefused else SignInUnfinished }
pure def canSubmitServers(a: Accounts, by: AccountActor): bool =
  by == AccountPerson and a.page == MailServersPage and a.signIn.stage == NotSigningIn
pure def submitServers(a: Accounts, by: AccountActor): Accounts = {
  ...a, problem: NoProblem,
  signIn: { ...a.signIn, stage: CheckingServers, attempt: a.signIn.attempt + 1,
    lookup: if (a.signIn.lookup == LookingUp) NotLookedUp else a.signIn.lookup }
}
pure def canServersResult(a: Accounts, check: OtherReport, name: str, fromName: str, by: AccountActor): bool =
  by == AccountConnector and a.signIn.stage == CheckingServers and check.attempt == a.signIn.attempt and
  (check.outcome == OtherAllowed implies (admits(a, check.address, name) and fromName != ""))
pure def serversResult(a: Accounts, check: OtherReport, name: str, fromName: str, by: AccountActor): Accounts =
  val finished = { ...a.signIn, stage: NotSigningIn }
  if (check.outcome == OtherAllowed) admitted(OtherEmail, a, check.address, name, otherUse, fromName)
  else if (check.outcome == OtherPasswordRefused) { ...a, page: OtherEmailPage, signIn: offServers(finished), problem: PasswordRefused }
  else { ...a, signIn: finished, problem: ServersRefused }
pure def lawStaleCheckCannotConnect(a: Accounts, check: OtherReport, name: str, fromName: str, by: AccountActor): bool =
  check.attempt != a.signIn.attempt implies
    not(canOtherResult(a, check, name, fromName, by) or canServersResult(a, check, name, fromName, by))
pure def alwaysOnlyOtherEmailKeepsAFromName(a: Accounts): bool =
  a.accounts.every(x => x.fromName != "" implies x.provider == OtherEmail)
pure def sometimesOtherNeedsServers(a: Accounts): bool = a.page == MailServersPage and a.signIn.domain != ""
pure def sometimesPasswordRefused(a: Accounts): bool = a.problem == PasswordRefused
pure def sometimesCheckingOther(a: Accounts): bool = a.signIn.stage == CheckingOther
pure def sometimesCheckingServers(a: Accounts): bool = a.signIn.stage == CheckingServers
pure def sometimesServersRefused(a: Accounts): bool = a.problem == ServersRefused and a.page == MailServersPage
pure def sometimesOtherEmailConnected(a: Accounts): bool = a.accounts.some(x => x.provider == OtherEmail)
```

### Mail settings can be looked up from her address, and fill the form for her to check

On Mail settings, Look them up asks, as a new attempt, for the settings of
the domain after the @: the email company’s own setup file first, then the
shared list of email companies’ settings, then the internet’s address book.
The answer is the servers those sources list. The form fills with the first
incoming (IMAP) and the first outgoing (SMTP) server that is reached over a
secure connection, a direct secure one before one that turns secure, and
with nothing when either is missing; then the page says the settings
weren’t found. Nothing is saved or sent to the email company: she checks the
filled form and taps Connect, as with servers she typed. Looking them up
again forgets what the last lookup found, Connect while looking ignores the
answer, and leaving Mail settings forgets what was found.

```quint
type ServerKind = ImapServer | SmtpServer | PopServer
type Security = SecureDirect | SecureUpgrade | Insecure
type FoundServer = { kind: ServerKind, host: str, port: int, security: Security }
type LookupReport = { attempt: int, found: List[FoundServer] }
pure val noServer: FoundServer = { kind: PopServer, host: "", port: 0, security: Insecure }
pure def secureBetter(best: FoundServer, s: FoundServer, kind: ServerKind): bool =
  s.kind == kind and s.host != "" and s.security != Insecure and
    (best.host == "" or (best.security != SecureDirect and s.security == SecureDirect))
pure def bestServer(found: List[FoundServer], kind: ServerKind): FoundServer =
  found.foldl(noServer, (best, s) => if (secureBetter(best, s, kind)) s else best)
pure def lookupFinds(found: List[FoundServer]): bool =
  bestServer(found, ImapServer).host != "" and bestServer(found, SmtpServer).host != ""
pure def canLookUpServers(a: Accounts, by: AccountActor): bool =
  by == AccountPerson and a.page == MailServersPage and a.signIn.stage == NotSigningIn and a.signIn.lookup != LookingUp
pure def lookUpServers(a: Accounts, by: AccountActor): Accounts =
  { ...a, problem: NoProblem, signIn: { ...offServers(a.signIn), lookup: LookingUp, attempt: a.signIn.attempt + 1 } }
pure def canServersLookedUp(a: Accounts, report: LookupReport, by: AccountActor): bool =
  by == AccountConnector and a.page == MailServersPage and a.signIn.lookup == LookingUp and report.attempt == a.signIn.attempt
pure def serversLookedUp(a: Accounts, report: LookupReport, by: AccountActor): Accounts =
  if (lookupFinds(report.found))
    { ...a, signIn: { ...a.signIn, lookup: LookupFound,
      incoming: bestServer(report.found, ImapServer).host, outgoing: bestServer(report.found, SmtpServer).host } }
  else { ...a, signIn: { ...a.signIn, lookup: LookupMissed, incoming: "", outgoing: "" } }
pure def alwaysFoundServersAreBoth(a: Accounts): bool =
  (a.signIn.lookup == LookupFound) == (a.signIn.incoming != "" and a.signIn.outgoing != "") and
  (a.signIn.lookup != NotLookedUp implies a.page == MailServersPage)
pure def lawLookupFillsOnlyWithSecureServers(a: Accounts, report: LookupReport, by: AccountActor): bool =
  (canServersLookedUp(a, report, by) and serversLookedUp(a, report, by).signIn.lookup == LookupFound) implies
    (report.found.some(s => s.kind == ImapServer and s.security != Insecure and s.host == serversLookedUp(a, report, by).signIn.incoming) and
      report.found.some(s => s.kind == SmtpServer and s.security != Insecure and s.host == serversLookedUp(a, report, by).signIn.outgoing))
pure def lawLookupPrefersADirectSecureServer(found: List[FoundServer]): bool =
  found.some(s => s.kind == ImapServer and s.host != "" and s.security == SecureDirect) implies
    bestServer(found, ImapServer).security == SecureDirect
pure def lawLookupSavesNothing(a: Accounts, report: LookupReport, by: AccountActor): bool =
  canServersLookedUp(a, report, by) implies
    (serversLookedUp(a, report, by).accounts == a.accounts and serversLookedUp(a, report, by).signIn.stage == NotSigningIn)
pure def sometimesServersFound(a: Accounts): bool = a.signIn.lookup == LookupFound
pure def sometimesServersNotFound(a: Accounts): bool = a.signIn.lookup == LookupMissed
pure val reportValues: Set[LookupReport] =
  Set(2, 3, 4, 5, 6).map(n => { attempt: n, found: List(
    { kind: ImapServer, host: "imap.riverview.net", port: 993, security: SecureDirect },
    { kind: SmtpServer, host: "smtp.riverview.net", port: 587, security: SecureUpgrade }) })
    .union(Set(2, 3, 4).map(n => { attempt: n, found: List({ kind: ImapServer, host: "mail.riverview.net", port: 143, security: Insecure }) }))
pure val foundValues: Set[List[FoundServer]] = reportValues.map(r => r.found)
```

### Nothing she types to sign in enters the tablet’s state

No password, verification code or recovery answer has a place in this state
or in any event: the provider’s page keeps what she types there, and the
Other email form hands the password straight to the connector. Before an
account exists, the only text kept from the forms is the domain of an Other
email address, and only while its forms are open, and the servers a lookup
found, only while Mail settings is open. Grace never sees the provider’s page or the password field.

```quint
pure def alwaysTypedDomainStaysOnItsForm(a: Accounts): bool =
  (a.signIn.domain != "" implies (a.page == OtherEmailPage or a.page == MailServersPage)) and
  (a.signIn.stage == CheckingOther implies (a.page == OtherEmailPage and a.signIn.domain != "")) and
  (a.signIn.stage == CheckingServers implies (a.page == MailServersPage and a.signIn.domain != "")) and
  (a.page == MailServersPage implies a.signIn.domain != "")
```

### The settings pages go back one step at a time

The list, or the intro and provider grid when there is no account, is the
first page. Back goes from Add an email and from an account to the list,
from Other email to Add an email when an account exists and otherwise to the
list, and from Mail settings to Other email. Leaving the Other email forms
forgets the domain and any sign-in again that started there.

```quint
pure def canGoBack(a: Accounts, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage == NotSigningIn and a.removing == 0 and a.page != AccountList
pure def backFrom(a: Accounts): AccountPage =
  if (a.page == MailServersPage) OtherEmailPage
  else if (a.page == OtherEmailPage and a.accounts.length() > 0) AddAccount
  else AccountList
pure def goBack(a: Accounts, by: AccountActor): Accounts =
  val back = backFrom(a)
  { ...a, page: back, shown: if (back == AccountList) 0 else a.shown, problem: NoProblem,
    signIn: if (back == OtherEmailPage) offServers(a.signIn) else { ...offServers(a.signIn), renewing: 0, domain: "" } }
pure def canOpenAccount(a: Accounts, id: int, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage == NotSigningIn and a.removing == 0 and a.page == AccountList and hasAccount(a, id)
pure def openAccount(a: Accounts, id: int, by: AccountActor): Accounts =
  { ...a, page: AccountDetail, shown: id, problem: NoProblem, signIn: { ...a.signIn, renewing: 0 } }
pure def sometimesAccountShown(a: Accounts): bool = a.page == AccountDetail
```

### Grace is told what happened to the accounts, never what was typed

What Grace is told is derived from the state before and after an event, and
being told authorizes nothing. She hears that a provider’s page opened (she
cannot see it), that an account was connected, renewed or removed, and the
problem now shown: unfinished sign-in, already on the tablet, a listed
company’s address, a refused Other email password, refused servers or email
still waiting. A problem is told when it appears, not again while the same
problem stays shown. Signing in again is told as renewed only when the company
allowed it; Cancel or an unfinished sign-in on a company’s page renews
nothing. A refused password on a provider’s own page cannot be told:
the tablet learns only that sign-in was not finished.

```quint
type TellKind = TellNothing | TellPageOpen | TellConnected | TellRenewed | TellRemoved | TellProblem
type Told = { kind: TellKind, account: int, provider: Provider, problem: Problem }
pure def told(before: Accounts, after: Accounts): Told =
  val added = after.accounts.select(x => not(before.accounts.some(y => y.id == x.id)))
  val gone = before.accounts.select(x => not(after.accounts.some(y => y.id == x.id)))
  val quiet = { kind: TellNothing, account: 0, provider: after.signIn.provider, problem: NoProblem }
  if (added.length() > 0)
    { ...quiet, kind: TellConnected, account: added.nthOr(0, noAccount).id, provider: added.nthOr(0, noAccount).provider }
  else if (gone.length() > 0)
    { ...quiet, kind: TellRemoved, account: gone.nthOr(0, noAccount).id, provider: gone.nthOr(0, noAccount).provider }
  else if (after.signIn.stage == ProviderPage and after.signIn.attempt != before.signIn.attempt)
    { ...quiet, kind: TellPageOpen, account: after.signIn.renewing }
  else if (after.problem != NoProblem and after.problem != before.problem)
    { ...quiet, kind: TellProblem, problem: after.problem }
  else if (before.signIn.stage != NotSigningIn and after.signIn.stage == NotSigningIn and after.signIn.renewing != 0 and
      after.page == AccountDetail and after.shown == after.signIn.renewing)
    { ...quiet, kind: TellRenewed, account: after.shown, provider: accountAt(after, after.shown).provider }
  else quiet
pure def lawNothingChangedTellsNothing(a: Accounts): bool = told(a, a).kind == TellNothing
pure def lawOnlyAnAllowedAnswerRenews(a: Accounts, sheet: SheetReport, name: str, by: AccountActor): bool =
  ((canSheetResult(a, sheet, name, by) and sheet.outcome != Allowed) implies
    told(a, sheetResult(a, sheet, name, by)).kind != TellRenewed) and
  ((canCancelSignIn(a, by) and a.signIn.stage == ProviderPage) implies
    told(a, cancelSignIn(a, by)).kind != TellRenewed)
```

## Story: Choose what each email brings and take it off the tablet

> As Margaret, I want to turn an email’s Email, Calendar and Contacts on or
> off, sign in again when it asks, and remove it from the tablet without
> losing it at my email company.

### Signing in again renews the same account

Sign in again, from an account’s page or from Email’s banner, opens that
account’s provider page as a new attempt over that account’s settings page,
or the Other email form for an Other email. Signing in again to a company’s
account stays on that account’s page until it ends. Allowed for the same
address renews the account and shows it; its switches, name and history
stay as they were.

```quint
pure def canSignInAgain(a: Accounts, id: int, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage == NotSigningIn and a.removing == 0 and hasAccount(a, id)
pure def signInAgain(a: Accounts, id: int, by: AccountActor): Accounts =
  val provider = accountAt(a, id).provider
  if (provider == OtherEmail)
    { ...a, page: OtherEmailPage, problem: NoProblem, signIn: { ...nextAttempt(a.signIn), provider: OtherEmail, renewing: id } }
  else
    { ...a, page: AccountDetail, shown: id, problem: NoProblem,
      signIn: { ...nextAttempt(a.signIn), stage: ProviderPage, provider: provider, renewing: id } }
pure def alwaysRenewingNamesAnAccount(a: Accounts): bool =
  a.signIn.renewing != 0 implies (hasAccount(a, a.signIn.renewing) and accountAt(a, a.signIn.renewing).provider == a.signIn.provider)
pure def alwaysCompanyRenewalStaysOnItsAccount(a: Accounts): bool =
  (a.signIn.renewing != 0 and a.signIn.provider != OtherEmail) implies (a.page == AccountDetail and a.shown == a.signIn.renewing)
pure def stepRenewalKeepsTheAccount(before: Accounts, after: Accounts): bool =
  before.accounts.every(x => after.accounts.every(y => y.id == x.id implies
    (y.address == x.address and y.provider == x.provider and y.name == x.name and y.colour == x.colour)))
pure def sometimesRenewed(a: Accounts): bool =
  a.signIn.stage == NotSigningIn and a.signIn.renewing != 0 and a.problem == NoProblem and
  a.page == AccountDetail and a.shown == a.signIn.renewing
```

### Turning a use off hides it and keeps the account

Email off hides that account’s mail, From choice, inbox row and what Grace is
shown of its mail; Calendar off hides its appointments and reminders;
Contacts off removes its names from the recipient picker. Only her switch
changes them, and the account, its address and its history stay. The Inbox
filter names an account whose Email is on, or is All inboxes, and turning
that account’s Email off goes back to All inboxes.

```quint
pure def canSetUse(a: Accounts, id: int, use: Use, by: AccountActor): bool =
  by == AccountPerson and hasAccount(a, id)
pure def setUse(a: Accounts, id: int, use: Use, by: AccountActor): Accounts =
  { ...a, accounts: a.accounts.listMap(x => if (x.id == id) { ...x, use: use } else x),
    inboxFilter: if (a.inboxFilter == id and not(use.mail)) 0 else a.inboxFilter }
pure def canFilterInbox(a: Accounts, id: int, by: AccountActor): bool =
  by == AccountPerson and (id == 0 or mailAccounts(a).some(x => x.id == id))
pure def filterInbox(a: Accounts, id: int, by: AccountActor): Accounts = { ...a, inboxFilter: id }
pure def alwaysFilterNamesAnEmailAccount(a: Accounts): bool =
  a.inboxFilter == 0 or mailAccounts(a).some(x => x.id == a.inboxFilter)
pure def stepUsesChangeOnlyByHerSwitch(before: Accounts, via: str, after: Accounts): bool =
  before.accounts.every(x => after.accounts.every(y => (y.id == x.id and y.use != x.use) implies via == "setUse"))
pure def stepUseChangesKeepAccounts(before: Accounts, via: str, after: Accounts): bool =
  via == "setUse" implies after.accounts.length() == before.accounts.length() and
    before.accounts.every(x => after.accounts.some(y => y.id == x.id and y.address == x.address))
pure def sometimesCalendarOff(a: Accounts): bool =
  a.accounts.some(x => x.provider != OtherEmail and not(x.use.calendar) and x.use.mail)
pure def sometimesOneInbox(a: Accounts): bool = a.inboxFilter != 0 and mailAccounts(a).length() >= 2
pure val useValues = Set(
  { mail: true, calendar: true, contacts: true }, { mail: true, calendar: false, contacts: true },
  { mail: false, calendar: true, contacts: false })
```

### Calendar’s connect banner stays away once she says Not now

Without an account whose Calendar is on, Calendar offers to connect an
email. Her Not now hides it until the tablet restarts.

```quint
pure def canDismissBanner(a: Accounts, by: AccountActor): bool =
  by == AccountPerson and not(a.bannerDismissed)
pure def dismissBanner(a: Accounts, by: AccountActor): Accounts = { ...a, bannerDismissed: true }
pure def sometimesBannerDismissed(a: Accounts): bool = a.bannerDismissed
```

### Removing asks first and waits for unsent email

Remove from this tablet asks "Remove <Name> from this tablet?"; Keep it
closes the question. Removing takes the account, its tablet copy of email,
appointments and contacts off the tablet, and leaves them safe with the
email company. While an email of that account waits in Outbox or its sending
is unsettled, the shell reports how many, and removal is refused with the
reason on the question. Removal clears an Inbox filter and the From history
of that account.

```quint
pure def canRequestRemoval(a: Accounts, id: int, by: AccountActor): bool =
  by == AccountPerson and a.signIn.stage == NotSigningIn and a.removing == 0 and
  a.page == AccountDetail and a.shown == id and hasAccount(a, id)
pure def requestRemoval(a: Accounts, id: int, by: AccountActor): Accounts = { ...a, removing: id, discarding: 0, problem: NoProblem }
pure def canKeepAccount(a: Accounts, by: AccountActor): bool = by == AccountPerson and a.removing != 0
pure def keepAccount(a: Accounts, by: AccountActor): Accounts = { ...a, removing: 0, discarding: 0, problem: NoProblem }
pure def canRemoveAccount(a: Accounts, id: int, waiting: int, by: AccountActor): bool =
  by == AccountPerson and a.removing == id and id != 0 and waiting >= 0 and a.discarding == 0
pure def removedFrom(id: int, a: Accounts): Accounts = {
  ...a, accounts: a.accounts.select(x => x.id != id), page: AccountList, shown: 0, removing: 0, discarding: 0, problem: NoProblem,
  inboxFilter: if (a.inboxFilter == id) 0 else a.inboxFilter,
  lastFrom: a.lastFrom.select(f => f.account != id),
  signIn: { ...a.signIn, renewing: if (a.signIn.renewing == id) 0 else a.signIn.renewing }
}
pure def removeAccount(a: Accounts, id: int, waiting: int, by: AccountActor): Accounts =
  if (waiting > 0) { ...a, problem: EmailWaiting } else removedFrom(id, a)
pure def stepRemovalNeedsTheQuestion(before: Accounts, via: str, after: Accounts): bool =
  before.accounts.every(x => after.accounts.some(y => y.id == x.id) or
    ((via == "removeAccount" or via == "discardAndRemove") and before.removing == x.id))
pure def lawWaitingEmailBlocksRemoval(a: Accounts, id: int, waiting: int, by: AccountActor): bool =
  (canRemoveAccount(a, id, waiting, by) and waiting > 0) implies
    (removeAccount(a, id, waiting, by).accounts == a.accounts and removeAccount(a, id, waiting, by).problem == EmailWaiting)
pure def sometimesRemovalAsked(a: Accounts): bool = a.removing != 0 and a.problem == NoProblem
pure def sometimesRemovalWaitsForEmail(a: Accounts): bool = a.removing != 0 and a.problem == EmailWaiting
pure def sometimesRemoved(a: Accounts): bool = a.page == AccountList and a.nextId > a.accounts.length() + 1
pure val waitingValues = Set(0, 1, 2)
```

### Remove anyway discards the waiting email only after she confirms how much

While email waits, the question also offers Remove anyway. It first asks
again, saying how many waiting emails will be discarded and never sent;
Keep it closes both questions. Her yes there discards that account’s waiting
email, never more than she was told about, and removes the account as
Remove does. Only her taps remove an account or discard its email: Grace has
no way to.

```quint
pure def canRemoveAnyway(a: Accounts, id: int, waiting: int, by: AccountActor): bool =
  by == AccountPerson and a.removing == id and id != 0 and waiting > 0 and a.discarding == 0
pure def removeAnyway(a: Accounts, id: int, waiting: int, by: AccountActor): Accounts =
  { ...a, discarding: waiting, problem: NoProblem }
pure def canDiscardAndRemove(a: Accounts, id: int, waiting: int, by: AccountActor): bool =
  by == AccountPerson and a.removing == id and id != 0 and a.discarding > 0 and waiting >= 0 and waiting <= a.discarding
pure def discardAndRemove(a: Accounts, id: int, waiting: int, by: AccountActor): Accounts = removedFrom(id, a)
pure def lawDiscardIsNeverMoreThanSheWasTold(a: Accounts, id: int, waiting: int, by: AccountActor): bool =
  canDiscardAndRemove(a, id, waiting, by) implies (waiting <= a.discarding and by == AccountPerson)
pure def stepDiscardFollowsHerConfirm(before: Accounts, via: str, after: Accounts): bool =
  via == "discardAndRemove" implies (before.discarding > 0 and before.removing != 0 and not(hasAccount(after, before.removing)))
pure def sometimesDiscardAsked(a: Accounts): bool = a.discarding > 0
```

### A new email comes from the account last used with that person, else the most used

A reply goes from the account the email came to; the shell knows that
account. For a new email, From starts at the account last used to send to
that recipient while its Email is on, otherwise at the email account that
has sent the most, the first in the list on a tie. She can change it. Only
an email the provider confirmed as sent counts.

```quint
pure def canNoteSent(a: Accounts, recipient: str, id: int, by: AccountActor): bool =
  by == AccountHost and recipient != "" and hasAccount(a, id)
pure def noteSent(a: Accounts, recipient: str, id: int, by: AccountActor): Accounts = {
  ...a, accounts: a.accounts.listMap(x => if (x.id == id) { ...x, sent: x.sent + 1 } else x),
  lastFrom: a.lastFrom.select(f => f.recipient != recipient).append({ recipient: recipient, account: id })
}
pure def lastUsed(a: Accounts, recipient: str): int =
  a.lastFrom.foldl(0, (found, f) => if (f.recipient == recipient) f.account else found)
pure def defaultFrom(a: Accounts, recipient: str): int =
  val recent = lastUsed(a, recipient)
  if (mailAccounts(a).some(x => x.id == recent)) recent
  else mailAccounts(a).foldl(noAccount, (best, x) => if (best.id == 0 or x.sent > best.sent) x else best).id
pure def alwaysFromHistoryNamesAccounts(a: Accounts): bool =
  a.lastFrom.every(f => f.recipient != "" and hasAccount(a, f.account) and
    a.lastFrom.select(g => g.recipient == f.recipient).length() == 1)
pure def lawDefaultFromSendsMail(a: Accounts, recipient: str): bool =
  defaultFrom(a, recipient) == 0 or mailAccounts(a).some(x => x.id == defaultFrom(a, recipient))
pure def lawDefaultFromExistsWithEmail(a: Accounts, recipient: str): bool =
  (mailAccounts(a).length() > 0 and a.accounts.every(x => x.id > 0)) implies defaultFrom(a, recipient) != 0
pure def sometimesFromRemembered(a: Accounts): bool = a.lastFrom.length() > 0 and mailAccounts(a).length() >= 2
pure val recipientValues = Set("susan@example.com", "david@example.com")
```

### Simulation samples cover sign-in answers

```quint
pure val idValues = Set(0, 1, 2, 3)
pure val nameValues = Set("Gmail", "Outlook", "Gmail (margaret2)")
pure val allowedUse: Use = { mail: true, calendar: true, contacts: true }
pure val sheetValues: Set[SheetReport] =
  Set(1, 2, 3, 4, 5).map(n => { attempt: n, outcome: Allowed, address: "margaret@gmail.com", granted: allowedUse })
    .union(Set(1, 2, 3, 4, 5).map(n => { attempt: n, outcome: Allowed, address: "margaret@outlook.com", granted: allowedUse }))
    .union(Set(1, 2, 3, 4).map(n => { attempt: n, outcome: Refused, address: "", granted: allowedUse }))
    .union(Set(1, 2, 3).map(n => { attempt: n, outcome: Cancelled, address: "", granted: allowedUse }))
pure val checkValues: Set[OtherReport] =
  Set(1, 2, 3, 4, 5).map(n => { attempt: n, outcome: OtherAllowed, address: "margaret@riverview.net" })
    .union(Set(1, 2, 3, 4).map(n => { attempt: n, outcome: OtherNeedsServers, address: "" }))
    .union(Set(1, 2, 3).map(n => { attempt: n, outcome: OtherPasswordRefused, address: "" }))
    .union(Set(2, 3).map(n => { attempt: n, outcome: OtherRefused, address: "" }))
pure val weight_sheetResult = 6
pure val weight_otherResult = 4
pure val weight_serversResult = 4
pure val weight_chooseProvider = 4
pure val weight_requestRemoval = 3
pure val weight_removeAccount = 3
pure val weight_lookUpServers = 3
pure val weight_serversLookedUp = 3
pure val weight_removeAnyway = 2
pure val weight_discardAndRemove = 2
pure val fromNameValues = Set("Margaret Hill", "")
```
