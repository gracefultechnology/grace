# Files and preference audit of the new prototype

Source: `prototype/Grace Prototype.html`, replacing the earlier Bill Pay-only
HTML. This is a source-level audit of the supplied interactive prototype, not
an assertion that its local JavaScript performs real storage, printing or
provider operations. The prototype is authoritative for the described screens
and interaction count; the PRD's privacy, user-control and evidence rules still
apply to its simulated shortcuts.

This audit dates from the models-only phase (13 November 2026). Its source
lines point into the prototype of that day (2,401 lines, which
`git show "7007516^:prototype/Grace Prototype.html"` prints); an updated
prototype replaced it on 16 November 2026. Where it differs from the
[acceptance list's decisions](implementation-acceptance.md#decisions-and-their-defaults)
or the specs, those win: no wake detector is installed (decision 5), and
Files has no Print, so the print rows below no longer apply.

## Files: observed screens, data and transitions

| Surface or action | Actual prototype behavior | Source lines |
| --- | --- | --- |
| Home entry | A Files card on the second Home page shows three photos and a document, with “3 new photos from Susan.” Carousel arrows, page dots and swipe expose it; the A–H and card A–C choices are design-comparison controls, not product settings. | 2277–2294; 2367 |
| Opening Files | Home clears the photo/PDF preview, opens Files and retains its selected tab. It works without the network check used by Email and Internet. | 2249–2250 |
| Initial data | Photos is initially selected. Six illustrative photos and three PDFs are prepopulated in in-memory `X.files`; no storage read or persistence is performed. | 1978–1980 |
| Photos index | Photos/Documents segmented control, “Ask Grace to find anything,” four-column photo grid, time-group headings and optional source text. Photo cards select by array position. | 1987–1992 |
| Photo viewer | Full photo, “Photo n of total,” Back to Files, Share and Delete. Previous/Next are hidden at the first/last photo. | 1983–1984; 2188 |
| Documents index | PDF icon, filename, source/saved-date subtitle, Open and Print for every row. There is no document-delete or rename control. | 1989 |
| Document viewer | Filename, Back to Files, Print, a page-one placeholder and “Page 1 of n.” No next-page, edit or zoom control is implemented in this viewer. | 1985–1986; 2189 |
| Save one photo | Email photo viewer Save to Files inserts the image if its fixture key is not already present and shows a toast. The Email viewer remains open. | 1941; 1981; 2184 |
| Save all photos | Email Save all to Files loops over the current message's photos and reports its attachment count. The toast can count already-saved photos again. | 1963; 1981; 2185 |
| Save PDF | Email PDF viewer Save to Files inserts the document only if no equal filename exists, then shows a toast. Filename equality can incorrectly merge unrelated documents. | 1943; 1981; 2187 |
| Share photo | Clears the Files photo preview, opens Email's recipient chooser and creates an unsent composition with subject “A photo” and the selected image attached. It does not send. | 2189 |
| Delete photo | Delete immediately removes the selected array element, returns to the Files index and says “Photo deleted.” There is no confirmation, Trash, Undo or storage failure. | 2190 |
| Find with Grace | A Files request opens the indicated tab, chooses the first fuzzy metadata match and highlights its row/photo; the assistant prompt offers an appropriate next step. No explicit no-result or ambiguity state is implemented. | 2095; 2097–2116; 2143–2146 |
| Close | Clears both previews and returns Home; the in-memory library and tab survive this action. Reloading the HTML reinstates fixtures. | 2156 |

The prototype has no file-loading, unreadable-content, save, delete, access or
printer-failure state. Print is only `axToast('Sent to the printer')` (2187),
with no print-service request or verified job result. The image strings and
PDF drawings are illustrative assets. Those omissions are implementation gaps,
not permission to fabricate success in the rebuilt app.

## Spec implemented from that behavior

`spec/app/files.md` adds one owner-bound catalog with stable `SavedFile` IDs,
source identities and immutable content references. Photos and Documents are
projections of that catalog; preview, current content-read request and bounds
belong to the same state. Names and group labels are display metadata rather
than identity. Production inputs accept arbitrary providers and assets.

The library loads from local storage, including a background load for Email
Save that does not navigate away. Single/batch saves require an authorized
source binding and one durable atomic acknowledgement. Repeating the same
source save is idempotent; conflicting source/content identity is rejected.
The whole batch either commits or reports failure. Saved local files remain
available offline.

Delete remains one explicit user action, matching the prototype's interaction
count. A store acknowledgement determines when the catalog actually changes;
failure retains the photo. It does not delete the email source or retract a
previously sent attachment. Sharing emits only an owner-bound attachment handoff
to Email's unsent composition. The Email model owns recipients, review and Send.
Print emits an exact-content request and distinguishes accepted, failed and
uncertain jobs. A readable, authorized PDF can also be printed directly from
Email without inserting a pretend saved file into the catalog; an unresolved job does not silently trigger another print.

Current request/owner checks reject stale callbacks. Opening a file does not
execute embedded content or grant an assistant permission to transmit its
bytes. Rendering/sandboxing and source authentication remain integration
boundaries. Search uses an explicit current request with owner, generation and exact query
binding. It supports no result and ambiguous matches rather than taking a first
name match as proof of intent; Close, a new query and tab changes invalidate
stale retrieval. Saves, Delete and Share also bind to the current generation
and immutable selected identity. Close cancels reads, preserves the tab
and catalog, and does not claim to undo dispatched writes or print jobs. A
loaded Files window can reopen while such background work is pending without
changing the active request generation.

The prototype does not establish folders, PDF editing, document deletion,
uploads, rich receipt management or universal file-format support. These are
not added to the model. PDF page rendering and image accessibility require
runtime validation; model validity alone cannot certify them.

## Conversation, memory and preference changes

The new prototype retains the compact/expanded Grace window and the growing
composer (four lines compact, six expanded; 1642–1647). Its attachment menu
still says attachment-to-chat is not part of this prototype (1755), independently
of Email's supported attachments and Files. No new personal-memory UI or durable
memory behavior is implemented; the prior approved-memory requirements remain.

Unsafe microphone shortcuts persist: initial `mic:true` (964), restoration on
send (1661), restoration after keyboard dismissal (1704), and restoration after
private password guidance (1469). Existing conversation models intentionally
retain explicit Talk, Type/mute suppression, stale-callback fencing and private
content removal under current VOICE/DATA requirements.

The new Settings and rail controls add these concrete choices:

| Control | Prototype behavior | Source lines |
| --- | --- | --- |
| Text size | Smaller, Normal, Larger, Largest at 90%, 100%, 115%, 130%; applies across tablet text and whole-page website zoom. | 1832–1844; 2040–2042 |
| Brightness | 20–100%, minus/plus and slider; a CSS dark overlay simulates the result. | 1845; 2043–2046; 2211 |
| Night dimming | On/off switch describes 9 pm–7 am; no actual timed dimming routine is implemented. | 2046; 2211 |
| Device volume | 0–100%, minus/plus/slider, mute/unmute and Test sound. Zero volume mutes; unmute at zero sets 50%. It affects all device audio. | 1846–1858; 2214–2215 |
| Grace voice | Output on/off, 80%/100%/115% pace, Play a sample. It is separate from device mute and the microphone. | 2047–2050; 2212–2213 |
| Spoken preference changes | Apply requested values immediately; one Undo snapshot and “Show me where” navigation are described. | 2104; 2113; 2122–2128 |

`spec/app/preferences.md` now models those four text sizes, valid volume/mute
and brightness ranges, optional night dimming, a one-step Undo and explicit
sample playback. Native display calibration supplies the night level; the
model bounds it without inventing a pixel/dimming algorithm. Changes use the
existing versioned persistence path internally, with no extra Save screen.
The device adapter must report failure instead of claiming a CSS simulation
changed native hardware. Values remain preview versus confirmed persistence
until acknowledged, including Undo and returning to a previous value during
an in-flight write.

The prototype also introduces “Listen for Hey Grace” while asleep and a
simulated wake action (2050; 2255–2274). The user approved it, and the later
direction of no models on the tablet keeps it out of the MVP: Settings shows
it as not available. Preferences still holds the persisted wake-enabled
choice, and the
[wake model](../spec/app/wake.md) and [workspace](../spec/app/workspace.md)
coordinate permission checks, capture and cancellation. Wake detection does
not bypass active conversation controls or turn website audio into user input.

## Validation scope

The formal pipeline checks generation, simulation, proof and replay. Isolated
proof runs establish individual model obligations during development; the
combined root check establishes the current spec tree together.

The new Ask Grace handler also supersedes the earlier opening-layout rule:
`openGrace` opens expanded from every surface, a paused mid-task reopening uses
the compact window with the page visible, and pressing Ask Grace while already
open does not toggle or resize it (1715–1734). The assistant model now follows
this route while preserving the safety distinction between reopening and
explicit Resume; current page reconciliation remains required before work.

Isolated verification: expanded Preferences, including the user-approved
`wakeEnabled` field, proved all 40 obligations. The Files catalog and operation
model proved all 192 obligations with `spec/app/files.proof.dfy`; the proof
establishes unique IDs/source identities through filtered deletion and batch
merge, and exact file membership for photo navigation and printing. The final
source also preserves known pending print feedback when reopening Files; that
current-source revision proved all 192 obligations with no unproved clauses or
errors. Evidence is `/tmp/grace-files-final-feedback/app__files.ts.result.json`;
its source SHA-256 is `49cd21b47a244fc255bc8459335f375f91416b37861c2427637f8785984070ca`.
The root check still owns combined simulation, replay, generated type checks
and integration review.
