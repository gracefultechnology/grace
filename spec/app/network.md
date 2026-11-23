# Join a Wi-Fi network privately

Set-up starts here, because Grace can neither think nor speak before the
tablet is online. The current prototype's Wi-Fi settings and rail popover
show remembered and nearby networks, password entry, errors and a route to
help. This module owns the list of nearby networks and the one join attempt.
[The device shell](./shell.md) alone owns connectivity (offline, online, or
behind a sign-in page); finishing this workflow is an observed join result,
not a promise that the connection remains online forever.

Grace joins what Android lets an app join: open networks and networks with
one shared password, in her own screen, through Android's "Save this
network?" dialog. Company-style networks, which ask for an account, and old
WEP networks are handed to Android's internet panel. Android owns enterprise
credentials and certificate trust. If Wi-Fi needs web sign-in, Android's
Wi-Fi settings opens the network's sign-in page. Grace handles the Wi-Fi
bridge's seven statuses (`vendor/eliza/packages/os/src/bridges/definitions/wifi.ts`). Network
names, credentials and fixed delays in
`prototype/Grace Prototype.html:1994–2036,2217–2227` are demo data, not
policy. No password, account password, library-card number or PIN enters
this model.

## Story: Join the network I choose

> As a person using Grace, I can choose a network, enter its password and
> understand whether joining succeeded. When Wi-Fi requires web sign-in,
> I can reach the sign-in page through Android and return to Grace. If my
> network needs an account or certificate, I handle that in Android. I can
> cancel from Grace’s private password entry.

### A selected network has one current join attempt

Nearby networks remain available beyond the first visible rows through Show
more and Show fewer. The adapter sorts remembered networks first, then signal
strength, and supplies stable network identities; display names alone cannot
identify a security context. Android lets no app read its saved networks, so
on Android the adapter reports as remembered only the network the tablet is
on once Android has validated it. The displayed four-row preview is not a limit
on discovery or supported networks. A network can be chosen only from a
list the OS reported. A remembered or open network joins at once, a
password network asks for its password, and a network that asks for an
account opens Android's panel, because no app can join it; the adapter
reports an old WEP network, which no app can join either, as one.

```quint
type NetworkActor = Person | OperatingSystem
type Authentication = OpenNetwork | SharedPassword | AccountPassword
type Network = { id: str, authentication: Authentication, remembered: bool }
type JoinPhase = Selecting | PrivateEntry | Joining | AndroidPanel | SavedNetworkPanel | PortalEntry | JoinComplete | JoinUnconfirmed | JoinFailed
type JoinResult = Joined | RejectedCredentials | Unavailable | Declined | Unverified | PortalRequired | SavedNetwork
type JoinReport = { network: str, version: int, result: JoinResult, explanation: str }
type Discovery = Scanning | WifiOff | LocationAccessNeeded | ExplainingLocation | LocationRefused | LocationOff | NoNetworks | NetworksFound({ networks: List[Network] })
type NetworkJoin = {
  selected: Network, phase: JoinPhase, version: int, errors: int,
  entryReady: bool, privateVisible: bool, explanation: str,
  expanded: bool, discovery: Discovery, locationAsked: bool
}
pure val noNetwork: Network = { id: "", authentication: OpenNetwork, remembered: false }
pure val initial: NetworkJoin = {
  selected: noNetwork, phase: Selecting, version: 0, errors: 0,
  entryReady: false, privateVisible: false, explanation: "", expanded: false,
  discovery: Scanning, locationAsked: false
}
pure def cleared(version: int, n: NetworkJoin): NetworkJoin = {
  ...initial, version: version, expanded: n.expanded, discovery: n.discovery, locationAsked: n.locationAsked
}
pure def attemptPhase(network: Network): JoinPhase =
  if (network.remembered or network.authentication == OpenNetwork) Joining
  else if (network.authentication == AccountPassword) AndroidPanel
  else PrivateEntry
pure def reportedNetwork(d: Discovery, network: Network): bool = match d {
  | NetworksFound(listed) => listed.networks.includes(network)
  | _ => false
}
pure def canChoose(n: NetworkJoin, network: Network, by: NetworkActor): bool =
  by == Person and network.id != "" and n.phase != Joining and reportedNetwork(n.discovery, network)
pure def choose(n: NetworkJoin, network: Network, by: NetworkActor): NetworkJoin = {
  ...cleared(n.version + 1, n), selected: network, phase: attemptPhase(network)
}
pure def canExpand(n: NetworkJoin, by: NetworkActor): bool = by == Person
pure def expand(n: NetworkJoin, expanded: bool, by: NetworkActor): NetworkJoin = { ...n, expanded: expanded }
pure def alwaysSelectedAttempt(n: NetworkJoin): bool =
  (n.phase == Selecting iff n.selected.id == "") and n.version >= 0 and n.errors >= 0
pure def sometimesAccountNetworkInAndroidPanel(n: NetworkJoin): bool =
  n.phase == AndroidPanel and n.selected.authentication == AccountPassword
```

### The password goes from Grace's field to Android only, and Show never shares it with Grace

The person types a network's password in Grace's own field. It goes from
that field to Android's join call and nowhere else: never into this model,
a log, storage or what Grace the assistant can read or say. The only report
here is whether the field holds anything. Join and the keyboard submit use
the same guarded action; an empty field cannot start it. Show or Hide changes
the person's field only. Grace may explain the controls; she never sees what
was typed.

```quint
pure def canReportEntry(n: NetworkJoin, version: int, by: NetworkActor): bool =
  by == Person and version == n.version and n.phase == PrivateEntry
pure def reportEntry(n: NetworkJoin, version: int, ready: bool, by: NetworkActor): NetworkJoin = {
  ...n, entryReady: ready
}
pure def canShowPrivate(n: NetworkJoin, by: NetworkActor): bool =
  by == Person and n.phase == PrivateEntry
pure def showPrivate(n: NetworkJoin, visible: bool, by: NetworkActor): NetworkJoin = {
  ...n, privateVisible: visible
}
pure def canJoin(n: NetworkJoin, by: NetworkActor): bool =
  by == Person and n.entryReady and n.phase == PrivateEntry
pure def join(n: NetworkJoin, by: NetworkActor): NetworkJoin = {
  ...n, phase: Joining, version: n.version + 1, entryReady: false, privateVisible: false, explanation: ""
}
pure def alwaysPrivateVisibilityIsLocal(n: NetworkJoin): bool =
  n.privateVisible implies n.phase == PrivateEntry
pure def alwaysReadinessBelongsToPrivateEntry(n: NetworkJoin): bool =
  n.entryReady implies n.phase == PrivateEntry
```

### Only the current OS result can complete or challenge the join

No timer or nonempty password establishes a connection. The outcomes are
the bridge's: connected (joined), wrong password (rejected), not connected
(unavailable), declined in Android's dialog, unverified (a working Wi-Fi
whose name Android withheld) and a sign-in page (portal). Only a password
network can reject its password, and rejected credentials return to
password entry with the OS's explanation. The second
rejection offers the written Fix Wi-Fi steps, and further rejections keep a
calm route to the network's administrator; there is no hard retry cap or
guessed credential validation. Unavailable networks show failure with an
explicit retry action, which asks for the password again because it was
never kept. Declining Android's dialog returns to the list. An unverified
join says the tablet is online but could not confirm which network. While
Android's internet panel is open, the result Android reports when Grace is
shown again completes, fails or keeps waiting on the join.
When Android reports the network is already saved but has not connected, Grace
keeps the selection and offers to open Android’s Wi-Fi so the person can select
it there. Opening or closing the panel and remaining on a different network
leave this attempt pending. A fresh observation of the chosen connection can
complete it.
If Android later validates the selected network after an unavailable,
unverified or sign-in-required result, Grace completes the join and shows
the connected network. This also happens when validation arrives while Grace
is already visible.
Android may name its current connection even when it has no nearby scan
results. Grace shows that name and shows signal strength only when measured.
To confirm the choice, Grace matches Android's current access point and its
security to the scan. If the scan is empty, the access point observed when the
person chose the network can still identify it. A shared name or a hidden
access-point address alone cannot confirm the selected network.
An observation belongs to the selection and attempt in progress when the
read started. An undisclosed name, a different network, a cancelled attempt
or loss of permission cannot complete it.

```quint
pure def answers(phase: JoinPhase, result: JoinResult): bool =
  phase == Joining or
  (phase == AndroidPanel and
    (result == Joined or result == Unverified or result == Unavailable or result == PortalRequired))
pure def canReceive(n: NetworkJoin, report: JoinReport, by: NetworkActor): bool =
  by == OperatingSystem and answers(n.phase, report.result) and report.network == n.selected.id and report.version == n.version and
  (report.result == RejectedCredentials implies n.selected.authentication == SharedPassword) and
  (report.result == RejectedCredentials or report.result == Unavailable implies report.explanation != "")
pure def receive(n: NetworkJoin, report: JoinReport, by: NetworkActor): NetworkJoin = {
  val result = report.result
  val nextPhase = match result {
    | Joined => JoinComplete
    | RejectedCredentials => PrivateEntry
    | Unavailable => JoinFailed
    | Declined => Selecting
    | Unverified => JoinUnconfirmed
    | PortalRequired => PortalEntry
    | SavedNetwork => SavedNetworkPanel
  }
  if (nextPhase == Selecting) cleared(n.version, n) else {
  ...n, phase: nextPhase,
  errors: if (report.result == RejectedCredentials) n.errors + 1 else n.errors,
  explanation: report.explanation, entryReady: false, privateVisible: false
  }
}
pure def canConfirmConnection(n: NetworkJoin, networkId: str, version: int, by: NetworkActor): bool =
  val discovery = n.discovery
  by == OperatingSystem and (match discovery { | NetworksFound(_) => true | NoNetworks => true | _ => false }) and
  (n.phase == JoinFailed or n.phase == JoinUnconfirmed or n.phase == SavedNetworkPanel or n.phase == PortalEntry) and
  networkId != "" and networkId == n.selected.id and version == n.version
pure def confirmConnection(n: NetworkJoin, networkId: str, version: int, by: NetworkActor): NetworkJoin =
  { ...n, phase: JoinComplete, explanation: "" }
pure def lawOnlyCurrentObservedNetworkConfirms(n: NetworkJoin, networkId: str, version: int, by: NetworkActor): bool =
  canConfirmConnection(n, networkId, version, by) implies (version == n.version and networkId == n.selected.id and by == OperatingSystem)
pure def helpOffered(n: NetworkJoin): bool = n.errors >= 2 or n.phase == JoinFailed
pure def canRetry(n: NetworkJoin, by: NetworkActor): bool = by == Person and n.phase == JoinFailed
pure def retry(n: NetworkJoin, by: NetworkActor): NetworkJoin = {
  ...n, phase: attemptPhase(n.selected), version: n.version + 1, explanation: ""
}
pure def sometimesSavedNetworkPanel(n: NetworkJoin): bool = n.phase == SavedNetworkPanel
pure def sometimesJoinUnconfirmed(n: NetworkJoin): bool = n.phase == JoinUnconfirmed
```

### Android handles Wi-Fi sign-in

Grace offers sign-in when Android reports that a connected Wi-Fi network
needs it, including when the connection was made before opening Grace's
Wi-Fi page, location access is off, or another connection is the default.
Grace also offers it while the selected join is waiting for sign-in and
Android has not validated a Wi-Fi connection. On Android 12 and later, Grace
can confirm a Wi-Fi connection even when another connection is the default.
If Android validates a different Wi-Fi network and reports no portal, Grace shows that connection while the
selected join remains pending. When Android first reports a sign-in page
for the current attempt, Grace opens
Android's Wi-Fi settings. There the person taps the connected network to
open the portal and completes any sign-in or terms. Returning without
signing in keeps that attempt pending and the same action can reopen Android
Wi-Fi. Android's validation of the selected connection completes the join.
Grace never reads or submits portal credentials or accepts its terms.

```quint
pure def wifiSignInOffered(n: NetworkJoin, wifiNeedsSignIn: bool, wifiValidated: bool): bool =
  n.phase != PrivateEntry and (wifiNeedsSignIn or (n.phase == PortalEntry and not(wifiValidated)))
```

### Android owns enterprise trust and Cancel closes private password entry

A new enterprise or old WEP join goes to Android’s network panel. Enter its
account details and decide certificate trust there. Grace never receives a
certificate or offers a trust decision. Cancel on Grace’s private password
form clears that form and returns to the last scan. Declining Android’s
dialog is an OS result. Once either action exits an attempt, a callback for
that attempt cannot restore it.

```quint
pure def canCancel(n: NetworkJoin, by: NetworkActor): bool = by == Person and n.phase == PrivateEntry
pure def cancel(n: NetworkJoin, by: NetworkActor): NetworkJoin = cleared(n.version + 1, n)
pure def canRestart(n: NetworkJoin, by: NetworkActor): bool = by == OperatingSystem
pure def restart(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...initial, version: n.version + 1 }
pure def stepAttemptNeverMovesBack(before: NetworkJoin, after: NetworkJoin): bool = after.version >= before.version
pure def lawOldJoinCannotComplete(n: NetworkJoin, report: JoinReport, by: NetworkActor): bool =
  report.version != n.version implies not(canReceive(n, report, by))
pure def sometimesPrivateEntry(n: NetworkJoin): bool = n.phase == PrivateEntry
pure def sometimesPortalEntry(n: NetworkJoin): bool = n.phase == PortalEntry
pure def sometimesJoinComplete(n: NetworkJoin): bool = n.phase == JoinComplete
pure def sometimesJoinFailed(n: NetworkJoin): bool = n.phase == JoinFailed
pure def sometimesRepeatedCredentialsNeedHelp(n: NetworkJoin): bool = n.phase == PrivateEntry and n.errors >= 2
pure val networkValues = Set(
  { id: "network", authentication: SharedPassword, remembered: false },
  { id: "network", authentication: AccountPassword, remembered: false },
  { id: "network", authentication: OpenNetwork, remembered: false })
pure val networkIdValues = Set("network", "other", "")
pure val versionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val weight_reportEntry = 4
pure val weight_join = 4
pure val weight_receive = 4
pure val goodReport: JoinReport = { network: "network", version: 1, result: Joined, explanation: "" }
pure val reportValues = Set(goodReport, { ...goodReport, version: 2 },
  { ...goodReport, result: PortalRequired }, { ...goodReport, result: Unavailable, explanation: "Network unavailable" },
  { ...goodReport, result: Unverified }, { ...goodReport, result: SavedNetwork }, { ...goodReport, version: 2, result: Declined },
  { ...goodReport, result: RejectedCredentials, explanation: "Check private details" },
  { ...goodReport, version: 2, result: RejectedCredentials, explanation: "Check private details" },
  { ...goodReport, version: 3, result: RejectedCredentials, explanation: "Check private details" })
```

## Story: See why no networks are listed

> As a person setting up the tablet, when no networks are listed I am told
> why in plain words, with the one thing that helps.

### An empty list always says why and offers one action

Android lists nearby networks only while Wi-Fi is on, Grace may use precise
location, and Location is on; the plugin says which is missing. Wi-Fi off
and Location off offer Android's internet panel, because an app can switch
neither on. No networks nearby offers a fresh search. Each report of the
OS replaces the reason, except while the person reads why location is
needed. When a scan lists no networks, Grace clears the previous list.
Turning off the radio or losing location access retires the selection, any
join under way and its result. An empty scan closes only a password entry
and keeps a join already under way and its result. An Android reply for the
old selection cannot restore it.

```quint
type ScanResult = RadioOff | NoLocationAccess | LocationDisabled | NoneNearby | Found({ networks: List[Network] })
type ListAction = NoAction | OpenPanel | Explain | Allow | Rescan
pure def listAction(d: Discovery): ListAction = match d {
  | Scanning => NoAction
  | NetworksFound(_) => NoAction
  | WifiOff => OpenPanel
  | LocationOff => OpenPanel
  | LocationRefused => OpenPanel
  | LocationAccessNeeded => Explain
  | ExplainingLocation => Allow
  | NoNetworks => Rescan
}
pure def canReportScan(n: NetworkJoin, found: ScanResult, by: NetworkActor): bool =
  by == OperatingSystem and n.discovery != ExplainingLocation and match found {
    | Found(listed) => listed.networks.length() > 0 and listed.networks.every(a =>
        a.id != "" and listed.networks.every(b => a.id == b.id implies a == b))
    | _ => true
  }
pure def reportScan(n: NetworkJoin, found: ScanResult, by: NetworkActor): NetworkJoin = {
  val refused = if (n.locationAsked) LocationRefused else LocationAccessNeeded
  val retired = found == RadioOff or found == NoLocationAccess or found == LocationDisabled or
    (found == NoneNearby and n.phase == PrivateEntry)
  val selection = if (retired and n.phase != Selecting) cleared(n.version + 1, n) else n
  { ...selection, discovery: match found {
    | RadioOff => WifiOff
    | NoLocationAccess => refused
    | LocationDisabled => LocationOff
    | NoneNearby => NoNetworks
    | Found(listed) => NetworksFound({ networks: listed.networks })
  } }
}
pure def canOpenPanel(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == OpenPanel
pure def openPanel(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: Scanning }
pure def canRescan(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == Rescan
pure def rescan(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: Scanning }
pure def lawEveryEmptyListOffersAnAction(d: Discovery): bool =
  (match d { | Scanning => false | NetworksFound(_) => false | _ => true }) iff listAction(d) != NoAction
pure val dValues: Set[Discovery] = Set(Scanning, WifiOff, LocationAccessNeeded, ExplainingLocation, LocationRefused, LocationOff, NoNetworks).union(
  networkValues.map(network => NetworksFound({ networks: List(network) }))
)
pure val foundValues: Set[ScanResult] = Set(RadioOff, NoLocationAccess, LocationDisabled, NoneNearby).union(
  networkValues.map(network => Found({ networks: List(network) }))
)
pure def sometimesWifiOff(n: NetworkJoin): bool = n.discovery == WifiOff
pure def sometimesLocationOff(n: NetworkJoin): bool = n.discovery == LocationOff
pure def sometimesNoNetworksNearby(n: NetworkJoin): bool = n.discovery == NoNetworks
```

### Grace says why she needs location before Android asks for it

On a fresh tablet the first system prompt the person meets is Android's
location question, so Grace first says, in one sentence, that the tablet
uses its location only to find Wi-Fi networks nearby. Only Allow, after that
sentence, raises Android's prompt. Once she has been asked and still refuses,
Grace does not ask again: the list offers Android's internet panel, which
lists networks without Grace seeing location.

```quint
pure def canExplainLocation(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == Explain
pure def explainLocation(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: ExplainingLocation }
pure def canAllowLocation(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == Allow
pure def allowLocation(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: Scanning, locationAsked: true }
pure def lawLocationIsAskedOnlyAfterItsExplanation(n: NetworkJoin, by: NetworkActor): bool =
  canAllowLocation(n, by) implies n.discovery == ExplainingLocation
pure def alwaysRefusalFollowsAnAsk(n: NetworkJoin): bool = n.discovery == LocationRefused implies n.locationAsked
pure def sometimesLocationExplained(n: NetworkJoin): bool = n.discovery == ExplainingLocation
pure def sometimesLocationRefused(n: NetworkJoin): bool = n.discovery == LocationRefused
```
