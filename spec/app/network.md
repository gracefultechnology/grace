# Join a Wi-Fi network privately

Set-up starts here, because Grace can neither think nor speak before the
tablet is online. The current prototype's Wi-Fi settings and rail popover
show remembered and nearby networks, password entry, errors and a route to
help. This module owns the list of nearby networks and the one join attempt.
[The device shell](./shell.md) alone owns connectivity (offline, online, or
behind a sign-in page); finishing this workflow is an observed join result,
not a promise that the connection remains online forever.

Grace is the tablet's device owner, so Wi-Fi never sends the person to
Android's settings or asks them for a permission. She holds location without
a prompt, which Android requires of any app that lists nearby networks, and
keeps Location on. She turns Wi-Fi on and joins open networks and networks
with one shared password herself, in her own screen, with no Android dialog.
If Wi-Fi needs web sign-in, the person signs in on the network's page in
Grace's own browser. Networks that ask for an account and old WEP networks are not
listed: Grace cannot join them, and a tablet she manages has no Android
Wi-Fi screen to send the person to. Grace handles the four outcomes of her
own join call. Network
names, credentials and fixed delays in
`prototype/Grace Prototype.html:1994–2036,2217–2227` are demo data, not
policy. No password, account password, library-card number or PIN enters
this model.

## Story: Join the network I choose

> As a person using Grace, I can choose a network, enter its password and
> understand whether joining succeeded. When Wi-Fi requires web sign-in,
> I sign in on the network's page in Grace's browser and return to her.
> I never need Android's settings. I can cancel from Grace’s private
> password entry.

### A selected network has one current join attempt

Nearby networks remain available beyond the first visible rows through Show
more and Show fewer. The adapter sorts remembered networks first, then signal
strength, and supplies stable network identities; display names alone cannot
identify a security context. The adapter reports as remembered only the
network the tablet is on once Android has validated it. The displayed four-row preview is not a limit
on discovery or supported networks. A network can be chosen only from a
list the OS reported. A remembered or open network joins at once, and a
password network asks for its password.

```quint
type NetworkActor = Person | OperatingSystem
type Authentication = OpenNetwork | SharedPassword
type Network = { id: str, authentication: Authentication, remembered: bool }
type JoinPhase = Selecting | PrivateEntry | Joining | PortalEntry | JoinComplete | JoinUnconfirmed | JoinFailed
type JoinResult = Joined | RejectedCredentials | Unavailable | Unverified | PortalRequired
type JoinReport = { network: str, version: int, result: JoinResult, explanation: str }
type Discovery = Scanning | WifiOff | Unmanaged | NoNetworks | NetworksFound({ networks: List[Network] })
type NetworkJoin = {
  selected: Network, phase: JoinPhase, version: int, errors: int,
  entryReady: bool, privateVisible: bool, explanation: str,
  expanded: bool, discovery: Discovery
}
pure val noNetwork: Network = { id: "", authentication: OpenNetwork, remembered: false }
pure val initial: NetworkJoin = {
  selected: noNetwork, phase: Selecting, version: 0, errors: 0,
  entryReady: false, privateVisible: false, explanation: "", expanded: false,
  discovery: Scanning
}
pure def cleared(version: int, n: NetworkJoin): NetworkJoin = {
  ...initial, version: version, expanded: n.expanded, discovery: n.discovery
}
pure def attemptPhase(network: Network): JoinPhase =
  if (network.remembered or network.authentication == OpenNetwork) Joining
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
```

### The password goes from Grace's field to Android only, and Show never shares it with Grace

The person types a network's password in Grace's own field. It goes from
that field to Grace's join call, which hands it to Android, and nowhere else: never into this model,
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
those of Grace's join call: connected (joined), wrong password (rejected),
not connected (unavailable) and a sign-in page (portal). Only a password
network can reject its password, and rejected credentials return to
password entry with the OS's explanation. The second
rejection offers the written Fix Wi-Fi steps, and further rejections keep a
calm route to the network's administrator; there is no hard retry cap or
guessed credential validation. Unavailable networks show failure with an
explicit retry action, which asks for the password again because it was
never kept. A join the call reports connected but that Grace's own look at
Android's current access point does not confirm is unverified: it says the
tablet is online but could not confirm which network. A fresh observation of
the chosen connection can complete it.
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
pure def answers(phase: JoinPhase, result: JoinResult): bool = phase == Joining
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
    | Unverified => JoinUnconfirmed
    | PortalRequired => PortalEntry
  }
  {
  ...n, phase: nextPhase,
  errors: if (report.result == RejectedCredentials) n.errors + 1 else n.errors,
  explanation: report.explanation, entryReady: false, privateVisible: false
  }
}
pure def canConfirmConnection(n: NetworkJoin, networkId: str, version: int, by: NetworkActor): bool =
  val discovery = n.discovery
  by == OperatingSystem and (match discovery { | NetworksFound(_) => true | NoNetworks => true | _ => false }) and
  (n.phase == JoinFailed or n.phase == JoinUnconfirmed or n.phase == PortalEntry) and
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
pure def sometimesJoinUnconfirmed(n: NetworkJoin): bool = n.phase == JoinUnconfirmed
```

### Wi-Fi sign-in opens in Grace's browser

Grace offers sign-in when Android reports that a connected Wi-Fi network
needs it, including when the connection was made before opening Grace's
Wi-Fi page or another connection is the default.
Grace also offers it while the selected join is waiting for sign-in and
Android has not validated a Wi-Fi connection. On Android 12 and later, Grace
can confirm a Wi-Fi connection even when another connection is the default.
If Android validates a different Wi-Fi network and reports no portal, Grace shows that connection while the
selected join remains pending. Sign in opens Grace's browser on an address
that the network's sign-in page takes over, and the person completes any
sign-in or terms there. Returning without signing in keeps that attempt
pending and the same action opens the page again. Android's validation of
the selected connection completes the join. Grace never reads or submits
portal credentials or accepts its terms.

```quint
pure def wifiSignInOffered(n: NetworkJoin, wifiNeedsSignIn: bool, wifiValidated: bool): bool =
  n.phase != PrivateEntry and (wifiNeedsSignIn or (n.phase == PortalEntry and not(wifiValidated)))
```

### Cancel closes private password entry

Cancel on Grace’s private password form clears that form and returns to the
last scan. Once it exits an attempt, a callback for that attempt cannot
restore it.

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
  { id: "network", authentication: OpenNetwork, remembered: false })
pure val networkIdValues = Set("network", "other", "")
pure val versionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val weight_reportEntry = 4
pure val weight_join = 4
pure val weight_receive = 4
pure val goodReport: JoinReport = { network: "network", version: 1, result: Joined, explanation: "" }
pure val reportValues = Set(goodReport, { ...goodReport, version: 2 },
  { ...goodReport, result: PortalRequired }, { ...goodReport, result: Unavailable, explanation: "Network unavailable" },
  { ...goodReport, result: Unverified },
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
offers Turn on, which Grace does herself. Location is Grace's as the
tablet's device owner; a tablet she does not manage, such as a developer's,
lists no networks to her, and offers Android's internet panel, which can.
No networks nearby offers a fresh search. Each report of the OS replaces
the reason. When a scan lists no networks, Grace clears the previous list.
Turning off the radio or losing location access retires the selection, any
join under way and its result. An empty scan closes only a password entry
and keeps a join already under way and its result. An Android reply for the
old selection cannot restore it.

```quint
type ScanResult = RadioOff | NoLocationAccess | LocationDisabled | NoneNearby | Found({ networks: List[Network] })
type ListAction = NoAction | TurnOn | OpenPanel | Rescan
pure def listAction(d: Discovery): ListAction = match d {
  | Scanning => NoAction
  | NetworksFound(_) => NoAction
  | WifiOff => TurnOn
  | Unmanaged => OpenPanel
  | NoNetworks => Rescan
}
pure def canReportScan(n: NetworkJoin, found: ScanResult, by: NetworkActor): bool =
  by == OperatingSystem and match found {
    | Found(listed) => listed.networks.length() > 0 and listed.networks.every(a =>
        a.id != "" and listed.networks.every(b => a.id == b.id implies a == b))
    | _ => true
  }
pure def reportScan(n: NetworkJoin, found: ScanResult, by: NetworkActor): NetworkJoin = {
  val retired = found == RadioOff or found == NoLocationAccess or found == LocationDisabled or
    (found == NoneNearby and n.phase == PrivateEntry)
  val selection = if (retired and n.phase != Selecting) cleared(n.version + 1, n) else n
  { ...selection, discovery: match found {
    | RadioOff => WifiOff
    | NoLocationAccess => Unmanaged
    | LocationDisabled => Unmanaged
    | NoneNearby => NoNetworks
    | Found(listed) => NetworksFound({ networks: listed.networks })
  } }
}
pure def canTurnOn(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == TurnOn
pure def turnOn(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: Scanning }
pure def canOpenPanel(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == OpenPanel
pure def openPanel(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: Scanning }
pure def canRescan(n: NetworkJoin, by: NetworkActor): bool = by == Person and listAction(n.discovery) == Rescan
pure def rescan(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...n, discovery: Scanning }
pure def lawEveryEmptyListOffersAnAction(d: Discovery): bool =
  (match d { | Scanning => false | NetworksFound(_) => false | _ => true }) iff listAction(d) != NoAction
pure val dValues: Set[Discovery] = Set(Scanning, WifiOff, Unmanaged, NoNetworks).union(
  networkValues.map(network => NetworksFound({ networks: List(network) }))
)
pure val foundValues: Set[ScanResult] = Set(RadioOff, NoLocationAccess, LocationDisabled, NoneNearby).union(
  networkValues.map(network => Found({ networks: List(network) }))
)
pure def sometimesWifiOff(n: NetworkJoin): bool = n.discovery == WifiOff
pure def sometimesUnmanaged(n: NetworkJoin): bool = n.discovery == Unmanaged
pure def sometimesNoNetworksNearby(n: NetworkJoin): bool = n.discovery == NoNetworks
```
