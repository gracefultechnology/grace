# Join a Wi-Fi network privately

The current prototype's Wi-Fi settings and rail popover show remembered and
nearby networks, password and account entry, a certificate decision, a public
network sign-in sheet, errors and a route to ask Grace for help. This module
owns that join workflow. [The device shell](./shell.md) alone owns actual
connectivity; finishing this workflow is an observed join result, not a
promise that the connection remains online forever.

The OS supplies network discovery, authentication and certificate evidence.
Network names, credentials, certificate subjects and fixed delays in
`prototype/Grace Prototype.html:1994–2036,2217–2227` are demo data, not policy.
No password, account password, library-card number or PIN enters this model.
The real network's sign-in page stays provider-owned and consent is never
preselected by Grace. Grace cannot infer certificate authenticity from the
person being physically near a network.

## Story: Join the network I choose

> As a person using Grace, I can choose a network, enter its private details,
> decide an actual security prompt and understand whether joining succeeded.

### A selected network has one current join attempt

Nearby networks remain available beyond the first visible rows through Show
more and Show fewer. The adapter sorts remembered networks first, then signal
strength, and supplies stable network identities; display names alone cannot
identify a security context. The displayed four-row preview is not a limit
on discovery or supported networks.

```quint
type NetworkActor = Person | OperatingSystem
type Authentication = OpenNetwork | SharedPassword | AccountPassword
type Network = { id: str, authentication: Authentication, remembered: bool }
type JoinPhase = Selecting | PrivateEntry | Joining | CertificateDecision | PortalEntry | JoinComplete | JoinFailed
type JoinResult = Joined | RejectedCredentials | Unavailable | CertificateRequired | PortalRequired
type JoinReport = { network: str, version: int, result: JoinResult, certificate: str, explanation: str }
type NetworkJoin = {
  selected: Network, phase: JoinPhase, version: int, errors: int,
  entryReady: bool, privateVisible: bool, certificate: str, explanation: str,
  expanded: bool
}
pure val noNetwork: Network = { id: "", authentication: OpenNetwork, remembered: false }
pure val initial: NetworkJoin = {
  selected: noNetwork, phase: Selecting, version: 0, errors: 0,
  entryReady: false, privateVisible: false, certificate: "", explanation: "", expanded: false
}
pure def canChoose(n: NetworkJoin, network: Network, by: NetworkActor): bool =
  by == Person and network.id != "" and n.phase != Joining
pure def choose(n: NetworkJoin, network: Network, by: NetworkActor): NetworkJoin = {
  ...initial, selected: network, version: n.version + 1,
  phase: if (network.remembered or network.authentication == OpenNetwork) Joining else PrivateEntry,
  expanded: n.expanded
}
pure def canExpand(n: NetworkJoin, by: NetworkActor): bool = by == Person
pure def expand(n: NetworkJoin, expanded: bool, by: NetworkActor): NetworkJoin = { ...n, expanded: expanded }
pure def alwaysSelectedAttempt(n: NetworkJoin): bool =
  (n.phase == Selecting iff n.selected.id == "") and n.version >= 0 and n.errors >= 0
```

### Private entry remains in the OS and Show never shares it with Grace

For account networks the OS requires both account identity and password.
The only report here is whether all required fields are present. Join and
the keyboard submit use the same guarded action; empty input cannot start it.
Show or Hide changes the person's OS field only. Grace may explain the
controls while secret capture stays redacted.

```quint
pure def canReportEntry(n: NetworkJoin, version: int, by: NetworkActor): bool =
  by == OperatingSystem and version == n.version and (n.phase == PrivateEntry or n.phase == PortalEntry)
pure def reportEntry(n: NetworkJoin, version: int, ready: bool, by: NetworkActor): NetworkJoin = {
  ...n, entryReady: ready
}
pure def canShowPrivate(n: NetworkJoin, by: NetworkActor): bool =
  by == Person and n.phase == PrivateEntry
pure def showPrivate(n: NetworkJoin, visible: bool, by: NetworkActor): NetworkJoin = {
  ...n, privateVisible: visible
}
pure def canJoin(n: NetworkJoin, by: NetworkActor): bool =
  by == Person and n.entryReady and (n.phase == PrivateEntry or n.phase == PortalEntry)
pure def join(n: NetworkJoin, by: NetworkActor): NetworkJoin = {
  ...n, phase: Joining, version: n.version + 1, entryReady: false, privateVisible: false, explanation: ""
}
pure def alwaysPrivateVisibilityIsLocal(n: NetworkJoin): bool =
  n.privateVisible implies n.phase == PrivateEntry
pure def alwaysReadinessBelongsToPrivateEntry(n: NetworkJoin): bool =
  n.entryReady implies n.phase == PrivateEntry or n.phase == PortalEntry
```

### Only the current OS result can complete or challenge the join

No timer or nonempty password establishes a connection. Rejected credentials
return to private entry with the OS's explanation. The second rejection
offers Ask Grace, and further rejections keep a calm route to the network's
administrator; there is no hard retry cap or guessed credential validation.
Unavailable networks show failure with an explicit retry action.

```quint
pure def canReceive(n: NetworkJoin, report: JoinReport, by: NetworkActor): bool =
  by == OperatingSystem and n.phase == Joining and report.network == n.selected.id and report.version == n.version and
  (report.result == CertificateRequired implies report.certificate != "") and
  (report.result == RejectedCredentials or report.result == Unavailable implies report.explanation != "")
pure def receive(n: NetworkJoin, report: JoinReport, by: NetworkActor): NetworkJoin = {
  val result = report.result
  {
  ...n, phase: match result {
    | Joined => JoinComplete
    | RejectedCredentials => PrivateEntry
    | Unavailable => JoinFailed
    | CertificateRequired => CertificateDecision
    | PortalRequired => PortalEntry
  },
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
  ...n, phase: Joining, version: n.version + 1, explanation: ""
}
```

### Certificate consent and cancellation are explicit current choices

The prompt displays actual OS certificate details and an independent way to
verify them. Ask Grace explains the decision but does not approve it. Trust
and join applies only to that current certificate and network. Public-network
sign-in uses its own sheet with Cancel and private fields, not a bank-browser
tab or a generic automatic click.

```quint
pure def canDecideCertificate(n: NetworkJoin, version: int, certificate: str, by: NetworkActor): bool =
  by == Person and n.phase == CertificateDecision and version == n.version and certificate == n.certificate
pure def decideCertificate(n: NetworkJoin, version: int, certificate: str, accepted: bool, by: NetworkActor): NetworkJoin =
  if (accepted) { ...n, phase: Joining, version: n.version + 1, certificate: "" }
  else { ...initial, version: n.version + 1, expanded: n.expanded }
pure def canCancel(n: NetworkJoin, by: NetworkActor): bool = by == Person and n.phase != Selecting
pure def cancel(n: NetworkJoin, by: NetworkActor): NetworkJoin = {
  ...initial, version: n.version + 1, expanded: n.expanded
}
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
pure val certificateValues = Set("certificate", "other", "")
pure val goodReport: JoinReport = { network: "network", version: 1, result: Joined, certificate: "", explanation: "" }
pure val reportValues = Set(goodReport, { ...goodReport, version: 2 },
  { ...goodReport, result: CertificateRequired, certificate: "certificate" },
  { ...goodReport, result: PortalRequired }, { ...goodReport, result: Unavailable, explanation: "Network unavailable" },
  { ...goodReport, result: RejectedCredentials, explanation: "Check private details" },
  { ...goodReport, version: 2, result: RejectedCredentials, explanation: "Check private details" },
  { ...goodReport, version: 3, result: RejectedCredentials, explanation: "Check private details" })
```
