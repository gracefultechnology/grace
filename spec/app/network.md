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
network?" dialog. Company-style networks, which ask for an account, old
WEP networks and a hotel or café's sign-in page are handed to Android's own
internet panel.
Six of the seven join outcomes are the Wi-Fi plugin's six statuses, one for
one (`vendor/eliza/plugins/plugin-native-wifi/src/definitions.ts`);
the certificate challenge is the one outcome no plugin status sends. Network
names, credentials and fixed delays in
`prototype/Grace Prototype.html:1994–2036,2217–2227` are demo data, not
policy. No password, account password, library-card number or PIN enters
this model.

## Story: Join the network I choose

> As a person using Grace, I can choose a network, enter its password and
> understand whether joining succeeded; a network Grace cannot join opens in
> Android's own panel.

### A selected network has one current join attempt

Nearby networks remain available beyond the first visible rows through Show
more and Show fewer. The adapter sorts remembered networks first, then signal
strength, and supplies stable network identities; display names alone cannot
identify a security context. The displayed four-row preview is not a limit
on discovery or supported networks. A network can be chosen only from a
list the OS reported. A remembered or open network joins at once, a
password network asks for its password, and a network that asks for an
account opens Android's panel, because no app can join it; the adapter
reports an old WEP network, which no app can join either, as one.

```quint
type NetworkActor = Person | OperatingSystem
type Authentication = OpenNetwork | SharedPassword | AccountPassword
type Network = { id: str, authentication: Authentication, remembered: bool }
type JoinPhase = Selecting | PrivateEntry | Joining | AndroidPanel | CertificateDecision | PortalEntry | JoinComplete | JoinUnconfirmed | JoinFailed
type JoinResult = Joined | RejectedCredentials | Unavailable | Declined | Unverified | CertificateRequired | PortalRequired
type JoinReport = { network: str, version: int, result: JoinResult, certificate: str, explanation: str }
type Discovery = Scanning | WifiOff | LocationAccessNeeded | ExplainingLocation | LocationRefused | LocationOff | NoNetworks | NetworksFound({ networks: List[Network] })
type NetworkJoin = {
  selected: Network, phase: JoinPhase, version: int, errors: int,
  entryReady: bool, privateVisible: bool, certificate: str, explanation: str,
  expanded: bool, discovery: Discovery, locationAsked: bool
}
pure val noNetwork: Network = { id: "", authentication: OpenNetwork, remembered: false }
pure val initial: NetworkJoin = {
  selected: noNetwork, phase: Selecting, version: 0, errors: 0,
  entryReady: false, privateVisible: false, certificate: "", explanation: "", expanded: false,
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
the plugin's: connected (joined), wrong password (rejected), not connected
(unavailable), declined in Android's dialog, unverified (a working Wi-Fi
whose name Android withheld) and a sign-in page (portal). Only a password
network can reject its password, and rejected credentials return to
password entry with the OS's explanation. The second
rejection offers the written Fix Wi-Fi steps, and further rejections keep a
calm route to the network's administrator; there is no hard retry cap or
guessed credential validation. Unavailable networks show failure with an
explicit retry action, which asks for the password again because it was
never kept. Declining Android's dialog returns to the list. An unverified
join says the tablet is online but could not confirm which network. A
sign-in page opens in Android's panel; Grace never fills it in or accepts
its terms. While Android's panel is open, the result Android reports when
Grace is shown again completes, fails or keeps waiting on the join.

```quint
pure def answers(phase: JoinPhase, result: JoinResult): bool =
  phase == Joining or
  ((phase == AndroidPanel or phase == PortalEntry) and
    (result == Joined or result == Unverified or result == Unavailable or result == PortalRequired))
pure def canReceive(n: NetworkJoin, report: JoinReport, by: NetworkActor): bool =
  by == OperatingSystem and answers(n.phase, report.result) and report.network == n.selected.id and report.version == n.version and
  (report.result == RejectedCredentials implies n.selected.authentication == SharedPassword) and
  (report.result == CertificateRequired implies report.certificate != "") and
  (report.result == RejectedCredentials or report.result == Unavailable implies report.explanation != "")
pure def receive(n: NetworkJoin, report: JoinReport, by: NetworkActor): NetworkJoin = {
  val result = report.result
  val nextPhase = match result {
    | Joined => JoinComplete
    | RejectedCredentials => PrivateEntry
    | Unavailable => JoinFailed
    | Declined => Selecting
    | Unverified => JoinUnconfirmed
    | CertificateRequired => CertificateDecision
    | PortalRequired => PortalEntry
  }
  if (nextPhase == Selecting) cleared(n.version, n) else {
  ...n, phase: nextPhase,
  errors: if (report.result == RejectedCredentials) n.errors + 1 else n.errors,
  certificate: if (report.result == CertificateRequired) report.certificate else "",
  explanation: report.explanation, entryReady: false, privateVisible: false
  }
}
pure def helpOffered(n: NetworkJoin): bool = n.errors >= 2 or n.phase == JoinFailed or n.phase == CertificateDecision
pure def alwaysCertificateIsScoped(n: NetworkJoin): bool =
  (n.phase == CertificateDecision iff n.certificate != "")
pure def canRetry(n: NetworkJoin, by: NetworkActor): bool = by == Person and n.phase == JoinFailed
pure def retry(n: NetworkJoin, by: NetworkActor): NetworkJoin = {
  ...n, phase: attemptPhase(n.selected), version: n.version + 1, explanation: ""
}
pure def sometimesJoinUnconfirmed(n: NetworkJoin): bool = n.phase == JoinUnconfirmed
```

### Certificate consent and cancellation are explicit current choices

The prompt displays actual OS certificate details and an independent way to
verify them. Ask Grace explains the decision but does not approve it. Trust
and join applies only to that current certificate and network. Cancel
returns to the list from any step, the list as the OS last reported it.

```quint
pure def canDecideCertificate(n: NetworkJoin, version: int, certificate: str, by: NetworkActor): bool =
  by == Person and n.phase == CertificateDecision and version == n.version and certificate == n.certificate
pure def decideCertificate(n: NetworkJoin, version: int, certificate: str, accepted: bool, by: NetworkActor): NetworkJoin =
  if (accepted) { ...n, phase: Joining, version: n.version + 1, certificate: "" }
  else cleared(n.version + 1, n)
pure def canCancel(n: NetworkJoin, by: NetworkActor): bool = by == Person and n.phase != Selecting
pure def cancel(n: NetworkJoin, by: NetworkActor): NetworkJoin = cleared(n.version + 1, n)
pure def canRestart(n: NetworkJoin, by: NetworkActor): bool = by == OperatingSystem
pure def restart(n: NetworkJoin, by: NetworkActor): NetworkJoin = { ...initial, version: n.version + 1 }
pure def stepAttemptNeverMovesBack(before: NetworkJoin, after: NetworkJoin): bool = after.version >= before.version
pure def lawOldJoinCannotComplete(n: NetworkJoin, report: JoinReport, by: NetworkActor): bool =
  report.version != n.version implies not(canReceive(n, report, by))
pure def sometimesPrivateEntry(n: NetworkJoin): bool = n.phase == PrivateEntry
pure def sometimesCertificateDecision(n: NetworkJoin): bool = n.phase == CertificateDecision
pure def sometimesPortalEntry(n: NetworkJoin): bool = n.phase == PortalEntry
pure def sometimesJoinComplete(n: NetworkJoin): bool = n.phase == JoinComplete
pure def sometimesJoinFailed(n: NetworkJoin): bool = n.phase == JoinFailed
pure def sometimesRepeatedCredentialsNeedHelp(n: NetworkJoin): bool = n.phase == PrivateEntry and n.errors >= 2
pure val networkValues = Set(
  { id: "network", authentication: SharedPassword, remembered: false },
  { id: "network", authentication: AccountPassword, remembered: false },
  { id: "network", authentication: OpenNetwork, remembered: false })
pure val versionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val weight_reportEntry = 4
pure val weight_join = 4
pure val weight_receive = 4
pure val certificateValues = Set("certificate", "other", "")
pure val goodReport: JoinReport = { network: "network", version: 1, result: Joined, certificate: "", explanation: "" }
pure val reportValues = Set(goodReport, { ...goodReport, version: 2 },
  { ...goodReport, result: CertificateRequired, certificate: "certificate" },
  { ...goodReport, result: PortalRequired }, { ...goodReport, result: Unavailable, explanation: "Network unavailable" },
  { ...goodReport, result: Unverified }, { ...goodReport, version: 2, result: Declined },
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
needed.

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
  { ...n, discovery: match found {
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
