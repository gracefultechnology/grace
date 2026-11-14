# Current Grace prototype and requirements audit

The current visual and interaction reference is `prototype/Grace Prototype.html`
(2,401 lines), supplied during this task. It supersedes
`prototype/Grace Bill Pay.html`. The latter remains historical evidence only.
This inventory is based on source inspection; it does not certify a running
provider integration, microphone, printer, Android device or pixel comparison.

`prototype/prd.md` is a concatenation of revisions: early exploration at
1–765, future vision at 766–834, On-screen Helper at 835–1351, Screen Share at
1352–1531, companion requirements at 1532–1639, and the current Grace MVP PRD
from 1640 onward. Current requirements and later dated decisions govern
consequential behavior. The user's task expands the old single-provider
phase to complete Email, Calendar, browser and Calendar bill payment. The
new prototype also makes Files and the Settings presentation concrete.

## Current visual contract

| Area | Current HTML evidence | Contract for implementation |
|---|---|---|
| Reference device | 40–49 | 1280×800 landscape surface in a 1316×836 frame; Figtree; soft gradient and glass. These are reference dimensions, not assumptions about native insets. |
| Rail | 52–64, 802–812, 2372–2376 | Time/date/status, Wi-Fi, Home, Volume, Settings, Ask Grace. A raised white selection marks the active rail destination/popover; expanded Grace changes selection without relocating the rail. |
| Window geometry | 65–70 | Browser and app windows begin at x144, width1130, six-pixel edge/gap and 26-pixel reference corners. Grace occupies the same column. |
| Home geometry | 318–338, 390–405, 647–665 | Home's background extends to x6 behind the rail; its cards remain in the content column. Compact Grace changes card arrangement and retains complete readable preview items. |
| Home navigation | 2278–2365, 2399 | Final mode is G, the progressive-blur carousel. Calendar, Email, Internet and Files are reached through two pages, arrows, dots or swiping. Mode A–H and Files-card A–C selectors are comparison tooling, not product settings. |
| Browser chrome | 73–93, 820–828 | 64-pixel tab strip, 80-pixel toolbar, Back/Forward/Go/reload presentation, address capsule, tab close, new tab and separate Close browser. It still simulates one tab. |
| App header | 1884–1892, 2390–2399 | Final selection is icon headers. Contextual Back and action capsules plus Close remain consistent across Calendar, Email, Files and Settings. Large-title and other header modes are comparison controls. |
| Grace presentation | 67–70, 111–196, 1173–1266 | Compact bottom window and expanded conversation share header, messages and composer. Native keyboard ownership must distinguish website input from Grace input; the caption strip and Show chat preserve the conversation. |
| Guidance | 1128–1171, 1465–1478, 2072–2081 | Current-target ring plus an adjacent short instruction; app guidance attaches to real app controls as well as website controls. Close tip dismisses that guidance, not the whole task. |
| Text accessibility | 600–622, 1833–1844, 2378–2385 | Text size applies to Home, rail, apps, website content and Grace; card content is measured below its title. Native keyboard, overflow, readable controls and actual device scaling still need implementation review. |

## Home, browser and system behavior

Home now contains working app entry points, not placeholder Calendar/Email
buttons. `homeCards` derives Calendar previews and unread Email rows from
prototype data (1874–1882); Files is inserted at 2289–2293. The examples are
not seed user records. Returning Home resets the carousel to page zero
(1062), while switching layout between compact and full Home also resets its
page (2357). Swiping suppresses the following click (2361–2365), so a drag
must not accidentally open an app.

The Internet preview follows the retained browser page (1005–1007). Home
hides and retains the browser; Close browser clears all tabs and returns Home;
closing the final tab leaves an empty new tab (1052–1062). The required real
browser still needs unbounded ordered tabs, least-recently-used overflow,
independent scroll/history, genuine loading/security errors, address entry,
recent sites and page zoom from PRD DEC16/20. Additional tabs remain a toast
at 1057 and address typing remains a toast at 1066. New-tab Go does nothing
at 1050. These shortcuts are not implementation requirements.

Ask Grace opens an idle conversation expanded, reopens a paused task compact,
and leaves an already open window alone (1721–1734). Wake has its own rule:
an already visible window keeps its size, Home opens expanded and other apps
open compact. These are distinct entry actions over the same conversation.

The new reference blocks Internet and Email launches while offline
(2249–2250), dims Internet and says new mail will arrive after reconnection
(1878–1882). It also expects Grace to help reconnect (1858–1870, 2110–2111,
2227). The model therefore distinguishes actual host reasoning availability
from network connectivity: supported offline assistance may work, while web
and payment actions require a real online connection. This does not claim
that a local model has already been implemented. Previously retained mail
must not be discarded because new mail cannot refresh.

Wi-Fi and Volume are popovers over the current surface, with a close button,
second-tap toggle and outside-click dismissal (1851–1862, 2240, 2247–2248).
Volume has a percentage/Muted state, minus/plus, slider, Mute/Unmute and Test
sound. It controls all device audio; output mute is separate from an active
microphone exchange. Choosing another network opens Settings → Wi-Fi (2216).

Settings pages are Text size, Brightness, Grace's voice, Wi-Fi and About
(2038–2053). Text sizes are Smaller, Normal, Larger and Largest. Brightness
has a slider, minus/plus and night dimming from 9 pm to 7 am. Grace's voice has
sample playback, Slower/Normal/Faster and spoken-output control. The prototype
also offers a wake-word toggle. The user explicitly approved "Hey Grace"
during this task, extending the earlier explicit-Talk requirements; the
separate wake model and workspace composition govern that activation.
The About screen's "everything up to date" is a static placeholder, not
verified update status.

## Private network joining

Current source is at 1994–2036 and 2217–2227:

- Nearby networks show signal, locked/unlocked and remembered status; four
  rows are initially visible, with Show more/Show fewer. The selected current
  network is separate from the nearby list.
- A remembered or open network begins connecting. A new protected network
  asks for a password; an account network asks for account identity and
  password. The secure OS fields support Show/Hide and Cancel.
- Missing required fields cannot Join. A rejection clears the private input,
  gives a clear explanation and permits another attempt. Two failures expose
  Ask Grace; later failures recommend help from the network administrator.
- An account network may present a certificate decision with Trust and join,
  Ask Grace and Cancel. The decision must refer to actual OS certificate
  evidence and the current request, never a blanket website/assistant grant.
- A captive network opens its own sign-in page in a browser sheet with Cancel
  and private fields. Its content and consent belong to the provider.
- A real OS result establishes success. The prototype's fixed password,
  account name, 1.6-second success timer and nine-second reconnection timer
  (2000, 2036, 2128, 2223) must not survive the rebuild.

`network.md` models the join workflow and stale callbacks without storing
secrets. `shell.md` owns actual network availability; displaying JoinComplete
does not override a later OS disconnection report.

## Current application coverage

Calendar source is 1894–1954 and 2157–2178. It now has week/month views,
selected day, detail, New/Edit forms, recurrence/reminder choices, save/cancel,
recurrence-aware deletion controls and Home reminder banners. Prototype
calendar data and simplistic date arithmetic require the real occurrence,
provider-revision and reminder contracts. Calls and directions still only
produce placeholder toasts (2177–2178).

Email source is 1955–1977 and 2179–2205. It now includes folders/search,
reading, recipient selection, reply/forward/compose, draft retention,
attachments and viewers, save to Files, Trash/Undo/restore and permanent
removal. Send mutates mock data synchronously (2202), so real authorization,
idempotency, provider acknowledgment and ambiguous-result recovery remain
model requirements. The prototype's fixed recipient names, canned attachment
choices and automatic scam assertions are not generic implementation logic.

Files source is 1978–1992 and 2184–2190. It includes Photos/Documents, photo
navigation, document viewing, save/share through Email, print affordances
and photo removal. It must not retain the demo's hardcoded attachment or
report successful printing before a real print result. See the accompanying
Files source audit and Files model for the complete workflow.

The Share handler's switch from photo preview to Email is modeled atomically
by `Handoffs.trySharePhoto`: Files stays on the same photo when the chosen
mailbox has an existing composer, pending save or unresolved send. Successful
preflight opens a new recipient-empty draft with subject “A photo” carrying the
exact selected photo; it does not send it. File generation and mailbox identity/generation/revision
reject delayed handoffs to a different photo, account or composer.

The detailed Email/Calendar and Files inventories are maintained with their
respective models. Their source paths are the current prototype, not the
obsolete single-flow file.

## Payment and assistant shortcuts that remain unsafe to copy

The payment mock is still provider-specific. Any nonempty password signs in
(1039); submitting immediately produces a scheduled outcome (1043). Account
identity, balances, due date, funding reference and receipt are fixture data.
A reusable model must instead verify origin, account and fresh facts, review
all current consequences and retain a durable unresolved window before any
final-submit route. Scheduled, accepted, settled, failed and unknown are
different outcomes. Different Calendar entries for the same provider bill
must share one canonical payment record.

Current PRD payment authorization permits either a website tap or explicit
voice approval after current amount/date/funding/fees readback (1704–1716,
1848–1852, 1882–1884, 2195). The unchanged mock's manual-submit-only wording
does not remove that requirement. Silence, partial recognition, an initial
yes followed by a correction, website text or Grace's own voice cannot approve.

The prototype still contains unsafe microphone restoration on empty typing
and keyboard closure (1661,1704), fixed-action playback for the mocked website
(1373–1385), and simulated speech input. Preserve the visual design while
using explicit Talk or the enabled wake phrase, one task, generation-fenced callbacks, fresh observation
on Resume and current-target validation. Manual navigation, Home, Close,
sleep, lost permissions and changed context revoke stale actions. Expected
navigation caused by the current authorized operation instead reobserves
within the active task; it must not force a new user Resume at every page.

Sleep shows clock/date and the next appointment and hides Grace while retaining
the conversation and task (2254–2258). Touch wakes to the retained surface
with Grace still closed (2259–2260). The new wake-word demonstration (2261–2268)
is not evidence of an implemented wake detector. The user approved the wake
phrase as a product requirement: enabled, permitted detection may activate
Grace and open a bounded listening exchange when reasoning is available. If
the detector works but reasoning is unavailable, Grace opens a notice without
conversation capture. Touch wake alone does not start
listening, and neither kind of wake authorizes a consequential action.

## Explicit conflicts and integration boundaries

| Conflict or shortcut | Resolution in the requirements/model work |
|---|---|
| Old single-provider and Email/Calendar exclusions | Current user scope and the new app prototype supersede them. Provider identities and website targets remain data. |
| Old native-settings-only presentation | Current Settings and popovers are the visual reference; OS capabilities, permission results and security checks remain authoritative. |
| Wake word and automatic microphone restoration | The user approved enabled "Hey Grace" activation. Keep it distinct from touch wake or keyboard closure, fence detector callbacks and expire unanswered listening; waking never approves a payment. |
| "Offline Grace runs on the tablet" | Model actual supported reasoning availability independently; do not claim a local model exists. |
| Certificate safety inferred from physical location | Show actual OS evidence; location alone does not authenticate a certificate. |
| Instant login, send, print, join or scheduled payment | Require corresponding authoritative result, errors and uncertainty rather than mock timers/toasts. |
| Hardcoded card, bill, account, network, date or recipient | Use unbounded opaque identities and provider data; finite examples exist only in simulation. |
| Comparison-mode controls | Final G Home carousel, Files card A and icon header are source defaults; A–H/A–C/header comparison selectors are not product options. |

Formal verification can establish transition, authorization, identity,
retention and stale-callback properties. It cannot certify visual pixels,
semantic understanding of arbitrary websites, real provider security,
redaction before upload, hardware permissions or real-world effect completion.
Those require the later VibeLang/React adapters and device/provider journeys.
