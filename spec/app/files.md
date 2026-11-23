# Saved photos and documents

Files is the local library shown in `prototype/Grace Prototype.html`, lines
2041–2059. Photos is the initial tab; Documents contains PDFs. Email attachment
saves feed this same library, and sharing a photo opens an email draft. This
model owns the library and its current selection, not email sending or personal
memory. Raw document/image bytes remain in the access-controlled content store;
only immutable references and sanitized display metadata enter this state.

## Story: Find and open something I saved

> As an older adult, I want my saved photos and documents in one familiar place,
> with readable previews and help finding the item I mean.

### A library belongs to one owner and identifies files independently of their names

An asset's source is the verified origin, account, containing message/document
and source attachment reference. Its local ID and content reference are stable.
Two attachments with the same filename are different files; saving the same
source again is idempotent. Example values are simulation fixtures, not a fixed
provider, person or filename. The host authenticates actors independently of
request JSON and resolves source access before importing content.

```quint
type FileActor = FileUser | FileHost | FileStore
type FileKind = Photo | Pdf
type FileTab = Photos | Documents
type FileOperation = NoFileOperation | ReadingCatalog | ReadingFile | Locating | SavingFiles | DeletingPhoto
type FileFeedback = NoFileFeedback | FilesSaved | PhotoDeleted | CatalogFailed | ContentFailed | WriteFailed | NothingFound | SeveralMatches
type SavedFile = {
  id: str, kind: FileKind, name: str, origin: str, account: str, container: str,
  sourceRef: str, contentRef: str, group: str, savedAt: int, pages: int
}
type Files = {
  owner: str, opened: bool, loaded: bool, entries: List[SavedFile], tab: FileTab,
  selected: str, contentReady: bool, generation: int, pending: FileOperation,
  pendingId: str, pendingFiles: List[SavedFile], feedback: FileFeedback,
  query: str, matches: List[str], page: int
}
type FileEffect = LoadLibrary({ owner: str, generation: int }) |
  SearchFiles({ owner: str, generation: int, query: str }) |
  ReadFile({ owner: str, generation: int, file: SavedFile }) |
  StoreFiles({ owner: str, generation: int, files: List[SavedFile] }) |
  RemovePhoto({ owner: str, generation: int, id: str }) |
  SharePhoto({ owner: str, file: SavedFile })
type FilesResult = { state: Files, out: List[FileEffect] }
type CatalogReport = { owner: str, generation: int, entries: List[SavedFile], succeeded: bool, evidence: str }
type FileReceipt = { owner: str, generation: int, id: str, succeeded: bool, evidence: str }
type FileImport = { owner: str, generation: int, entries: List[SavedFile], authorization: str }
type LocateReport = { owner: str, generation: int, query: str, ids: List[str] }
type PhotoCursor = { at: int, found: int }
pure val noPhotoCursor: PhotoCursor = { at: 0, found: -1 }
pure val emptyFile: SavedFile = { id: "", kind: Photo, name: "", origin: "", account: "", container: "", sourceRef: "", contentRef: "", group: "", savedAt: 0, pages: 0 }
pure val initial: Files = { owner: "", opened: false, loaded: false, entries: List(), tab: Photos,
  selected: "", contentReady: false, generation: 0, pending: NoFileOperation, pendingId: "",
  pendingFiles: List(), feedback: NoFileFeedback, query: "", matches: List(), page: 0 }
pure def validFile(file: SavedFile): bool =
  file.id != "" and file.name != "" and file.origin != "" and file.account != "" and file.container != "" and
  file.sourceRef != "" and file.contentRef != "" and file.savedAt >= 0 and
  (if (file.kind == Pdf) file.pages > 0 else file.pages == 0)
pure def sameSource(a: SavedFile, b: SavedFile): bool =
  a.origin == b.origin and a.account == b.account and a.container == b.container and a.sourceRef == b.sourceRef
pure def sameAsset(a: SavedFile, b: SavedFile): bool =
  a.id == b.id and sameSource(a, b) and a.contentRef == b.contentRef and a.kind == b.kind and a.pages == b.pages
pure def validCatalog(entries: List[SavedFile]): bool =
  entries.every(f => validFile(f) and entries.select(g => g.id == f.id).length() == 1 and
    entries.select(g => sameSource(f, g)).length() == 1)
pure def hasFile(f: Files, id: str): bool = f.entries.some(e => e.id == id)
pure def fileAt(f: Files, id: str): SavedFile = f.entries.select(e => e.id == id).nthOr(0, emptyFile)
pure def photos(f: Files): List[SavedFile] = f.entries.select(e => e.kind == Photo)
pure def documents(f: Files): List[SavedFile] = f.entries.select(e => e.kind == Pdf)
pure def tabFor(file: SavedFile): FileTab = if (file.kind == Photo) Photos else Documents
pure def alwaysLibraryIdentity(f: Files): bool =
  f.generation >= 0 and ((f.opened or f.loaded or f.pending != NoFileOperation) implies f.owner != "")
pure def alwaysCatalogValid(f: Files): bool = validCatalog(f.entries) and (not(f.loaded) implies f.entries == List())
pure def alwaysCatalogLoadHasNoStaleView(f: Files): bool =
  f.pending == ReadingCatalog implies not(f.loaded) and f.selected == "" and not(f.contentReady) and f.matches == List()
pure def alwaysSelectionExists(f: Files): bool =
  (f.selected != "" implies f.opened and f.loaded and hasFile(f, f.selected) and f.tab == tabFor(fileAt(f, f.selected))) and
  (f.contentReady implies f.selected != "")
```

### Opening and retrying load the authoritative local library

Opening Files clears the previous preview but retains the chosen tab. The first
open, a retry after load failure, or an open after restart reads the local store.
A matching successful result alone establishes a loaded library. Saved local
content can be used offline; an email source needs its own current access when
saving a new attachment. Loading errors have a Retry path, not an empty library
presented as proof that the files disappeared.
An attachment save may load the same catalog in the background without leaving
the email. That internal load neither opens Files nor authorizes saving content.

```quint
pure def canOpenFiles(f: Files, owner: str, by: FileActor): bool =
  by == FileUser and owner != "" and (f.owner == "" or owner == f.owner) and
  (f.pending == NoFileOperation or (f.loaded and (f.pending == SavingFiles or f.pending == DeletingPhoto)))
pure def openFiles(f: Files, owner: str, by: FileActor): FilesResult = {
  state: { ...f, owner: owner, opened: true, selected: "", contentReady: false, page: 0,
    pending: if (f.loaded) f.pending else ReadingCatalog, generation: if (f.loaded) f.generation else f.generation + 1,
    feedback: if (f.pending == NoFileOperation) NoFileFeedback else f.feedback, query: "", matches: List() },
  out: if (f.loaded) List() else List(LoadLibrary({ owner: owner, generation: f.generation + 1 }))
}
pure def canLoadForSave(f: Files, owner: str, by: FileActor): bool =
  by == FileHost and owner != "" and (f.owner == "" or owner == f.owner) and not(f.loaded) and f.pending == NoFileOperation
pure def loadForSave(f: Files, owner: str, by: FileActor): FilesResult = {
  state: { ...f, owner: owner, pending: ReadingCatalog, generation: f.generation + 1, feedback: NoFileFeedback,
    selected: "", contentReady: false, page: 0, query: "", matches: List() },
  out: List(LoadLibrary({ owner: owner, generation: f.generation + 1 }))
}
pure def canLoadCatalog(f: Files, catalogReport: CatalogReport, by: FileActor): bool =
  by == FileStore and f.pending == ReadingCatalog and catalogReport.owner == f.owner and
  catalogReport.generation == f.generation and
  (catalogReport.succeeded implies catalogReport.evidence != "" and validCatalog(catalogReport.entries))
pure def loadCatalog(f: Files, catalogReport: CatalogReport, by: FileActor): FilesResult =
  val locating = catalogReport.succeeded and f.opened and f.query != ""
  { state: { ...f, loaded: catalogReport.succeeded, entries: if (catalogReport.succeeded) catalogReport.entries else List(),
      pending: if (locating) Locating else NoFileOperation, feedback: if (catalogReport.succeeded) NoFileFeedback else CatalogFailed },
    out: if (locating) List(SearchFiles({ owner: f.owner, generation: f.generation, query: f.query })) else List() }
pure def canChooseTab(f: Files, tab: FileTab, by: FileActor): bool =
  by == FileUser and f.opened and f.loaded and f.selected == "" and
  (f.pending == NoFileOperation or f.pending == Locating)
pure def chooseTab(f: Files, tab: FileTab, by: FileActor): Files =
  { ...f, tab: tab, query: "", matches: List(), feedback: NoFileFeedback,
    pending: NoFileOperation, generation: if (f.pending == Locating) f.generation + 1 else f.generation }
pure def sometimesLibraryLoaded(f: Files): bool = f.loaded
pure def sometimesCatalogFailure(f: Files): bool = f.feedback == CatalogFailed
```

### Opening a file verifies that exact content before presenting a preview

The grid and document rows select stable IDs, never array positions retained
across a save or delete. Opening preserves the source file. Photo preview has
Previous and Next at actual bounds; document preview identifies its filename and
shows "Page n of N" for the page on screen, as the prototype does
(`prototype/Grace Prototype.html`, lines 2050 and 2053). The prototype draws
only page one of documents such as its four-page "Medicare summary.pdf" (line
2047); here every page is reachable. A document opens at page 1, and the person
moves to the previous or next page within 1 to its page count. A photo has no
page. Corrupt, missing or unsupported content gives a visible failure and
Back/Retry. The content renderer must sandbox active content and must not execute
instructions embedded in a file or upload it merely because it was opened.

```quint
pure def canOpenFile(f: Files, id: str, by: FileActor): bool =
  by == FileUser and f.opened and f.loaded and f.pending == NoFileOperation and hasFile(f, id)
pure def openFile(f: Files, id: str, by: FileActor): FilesResult = {
  state: { ...f, selected: id, tab: tabFor(fileAt(f, id)), contentReady: false, page: if (fileAt(f, id).kind == Pdf) 1 else 0,
    pending: ReadingFile, pendingId: id, generation: f.generation + 1, feedback: NoFileFeedback },
  out: List(ReadFile({ owner: f.owner, generation: f.generation + 1, file: fileAt(f, id) }))
}
pure def canContentResult(f: Files, fileReceipt: FileReceipt, by: FileActor): bool =
  by == FileHost and f.pending == ReadingFile and fileReceipt.owner == f.owner and
  fileReceipt.generation == f.generation and fileReceipt.id == f.pendingId and
  (fileReceipt.succeeded implies fileReceipt.evidence != "")
pure def contentResult(f: Files, fileReceipt: FileReceipt, by: FileActor): Files =
  { ...f, pending: NoFileOperation, pendingId: "", contentReady: fileReceipt.succeeded,
    feedback: if (fileReceipt.succeeded) NoFileFeedback else ContentFailed }
pure def photoPosition(f: Files): int =
  photos(f).foldl(noPhotoCursor, (r, e) => { at: r.at + 1, found: if (e.id == f.selected) r.at else r.found }).found
pure def canMovePhoto(f: Files, direction: int, by: FileActor): bool =
  by == FileUser and f.opened and f.pending == NoFileOperation and f.selected != "" and
  fileAt(f, f.selected).kind == Photo and (direction == -1 or direction == 1) and
  photoPosition(f) + direction >= 0 and photoPosition(f) + direction < photos(f).length()
pure def movePhoto(f: Files, direction: int, by: FileActor): FilesResult =
  openFile(f, photos(f).nthOr(photoPosition(f) + direction, emptyFile).id, by)
pure def canBackToFiles(f: Files, by: FileActor): bool =
  by == FileUser and f.opened and f.selected != "" and (f.pending == NoFileOperation or f.pending == ReadingFile)
pure def backToFiles(f: Files, by: FileActor): Files =
  { ...f, selected: "", contentReady: false, page: 0, pending: NoFileOperation, pendingId: "", generation: f.generation + 1, feedback: NoFileFeedback }
pure def canMovePage(f: Files, direction: int, by: FileActor): bool =
  by == FileUser and f.opened and f.contentReady and f.pending == NoFileOperation and f.selected != "" and
  fileAt(f, f.selected).kind == Pdf and (direction == -1 or direction == 1) and
  f.page + direction >= 1 and f.page + direction <= fileAt(f, f.selected).pages
pure def movePage(f: Files, direction: int, by: FileActor): Files = { ...f, page: f.page + direction }
pure def alwaysPageInBounds(f: Files): bool =
  if (f.selected != "" and fileAt(f, f.selected).kind == Pdf) f.page >= 1 and f.page <= fileAt(f, f.selected).pages
  else f.page == 0
pure def alwaysPendingFileExists(f: Files): bool =
  ((f.pending == ReadingFile or f.pending == DeletingPhoto) implies
    f.loaded and hasFile(f, f.pendingId)) and
  ((f.pending == NoFileOperation or f.pending == ReadingCatalog or f.pending == Locating or f.pending == SavingFiles) implies f.pendingId == "") and
  (f.pending == ReadingFile implies f.opened and f.selected == f.pendingId and not(f.contentReady)) and
  (f.pending == DeletingPhoto implies fileAt(f, f.pendingId).kind == Photo)
pure def sometimesPhotoOpened(f: Files): bool = f.contentReady and fileAt(f, f.selected).kind == Photo
pure def sometimesDocumentOpened(f: Files): bool = f.contentReady and fileAt(f, f.selected).kind == Pdf
pure def sometimesContentFailure(f: Files): bool = f.feedback == ContentFailed
pure def sometimesLaterPage(f: Files): bool = f.contentReady and f.page > 1
```

### Find help distinguishes one match, multiple matches and no match

“Ask Grace to find anything” uses only the owner's permitted file metadata or
explicitly authorized content. The retrieval adapter supplies current stable
IDs. A single result highlights the actual row and selects its tab; multiple
matches ask which item rather than guessing from a repeated name. No match
states that plainly. Finding does not open, share or delete content.
Each explicit find request carries a new generation. A new query replaces the
old request, including while that request waits for its catalog. A catalog
load started by opening Files or preparing an attachment stays separate.
Close cancels the find. A result must match the owner, generation and
exact requested query, so stale retrieval cannot reopen Files or replace the
current answer.

Grace's find opens Files from any screen (prototype lines 2247 and 2281–2284),
so it does not need Files to have been opened first. When the library has not
been loaded yet, before its first opening or after a restart, the find opens
Files, keeps the query and reads the catalog for the owner who asked. A
successful load for that same request generation then starts the search with
the kept query; a failed load shows the catalog failure with Retry and searches
nothing.

```quint
pure def canFindFiles(f: Files, owner: str, query: str, by: FileActor): bool =
  by == FileUser and owner != "" and (f.owner == "" or owner == f.owner) and query != "" and
  (f.pending == NoFileOperation or
    (f.loaded and f.pending == Locating) or
    (not(f.loaded) and f.pending == ReadingCatalog and f.opened and f.query != ""))
pure def findFiles(f: Files, owner: str, query: str, by: FileActor): FilesResult = {
  state: { ...f, owner: owner, opened: true, selected: "", contentReady: false, page: 0,
    pending: if (f.loaded) Locating else ReadingCatalog,
    query: query, matches: List(), generation: f.generation + 1, feedback: NoFileFeedback },
  out: List(if (f.loaded) SearchFiles({ owner: owner, generation: f.generation + 1, query: query })
    else LoadLibrary({ owner: owner, generation: f.generation + 1 }))
}
pure def lawReplacingAColdFindRefusesItsFirstCatalog(f: Files, owner: str, query: str, catalogReport: CatalogReport): bool =
  not(f.loaded) and f.pending == ReadingCatalog and f.query != "" and
    canFindFiles(f, owner, query, FileUser) and canLoadCatalog(f, catalogReport, FileStore) implies
    not(canLoadCatalog(findFiles(f, owner, query, FileUser).state, catalogReport, FileStore))
pure def canLocate(f: Files, locateReport: LocateReport, by: FileActor): bool =
  by == FileHost and f.loaded and f.opened and f.pending == Locating and locateReport.owner == f.owner and
  locateReport.generation == f.generation and locateReport.query == f.query and
  locateReport.ids.every(id => hasFile(f, id) and locateReport.ids.select(other => other == id).length() == 1)
pure def locate(f: Files, locateReport: LocateReport, by: FileActor): Files =
  { ...f, pending: NoFileOperation, selected: "", contentReady: false, page: 0, matches: locateReport.ids,
    tab: if (locateReport.ids.length() == 1) tabFor(fileAt(f, locateReport.ids.nthOr(0, ""))) else f.tab,
    feedback: if (locateReport.ids.length() == 0) NothingFound else if (locateReport.ids.length() > 1) SeveralMatches else NoFileFeedback }
pure def highlightedFile(f: Files): str = if (f.matches.length() == 1) f.matches.nthOr(0, "") else ""
pure def alwaysMatchesExist(f: Files): bool = f.matches.every(id => hasFile(f, id)) and
  ((f.matches.length() > 0 or f.pending == Locating) implies f.query != "") and
  (f.pending == Locating implies f.opened and f.loaded)
pure def sometimesSeveralMatches(f: Files): bool = f.feedback == SeveralMatches
pure def sometimesNothingFound(f: Files): bool = f.feedback == NothingFound
```

### Asking Grace to find a file works before Files was ever opened

The first request a fresh library makes carries generation 1, so a single
highlighted match at generation 1 was found by a find that began with the
library unloaded.

```quint
pure def sometimesFindWaitsForLibrary(f: Files): bool = f.pending == ReadingCatalog and f.query != ""
pure def sometimesFoundBeforeLibraryOpened(f: Files): bool = highlightedFile(f) != "" and f.generation == 1
```

## Story: Save, share and remove the chosen file

> As an older adult, I want a clear result when I save an attachment, share a
> photo or delete a local photo, without changing the wrong item.

### Saving one attachment or all selected photos is one acknowledged local transaction

The Email Save/Save all action supplies an authorized source-bound batch. The
host must verify the current owner, source attachment and immutable content;
planner text cannot manufacture this receipt. New files appear first in supplied
save order, while repeated saves retain existing entries. The prototype's
filename-only document deduplication is not carried forward. A collision between
an ID and another source/content is refused. The store stages bytes and commits
the complete batch atomically, or leaves the library unchanged and offers Retry.
On an Android tablet, choosing Save to Grace Files from a hosted original photo
or PDF opens private Files for confirmation. Cancel leaves the library unchanged.
Grace fetches the original only after confirmation from the same signed-in device
account. The handoff expires after five minutes, and Grace verifies the source
and the content again before saving. Repeating a save keeps the same entry.

```quint
pure def compatibleImport(f: Files, incoming: List[SavedFile]): bool =
  incoming.every(a => f.entries.every(b => (a.id == b.id or sameSource(a, b)) implies sameAsset(a, b)))
pure def mergeFiles(existing: List[SavedFile], incoming: List[SavedFile]): List[SavedFile] =
  incoming.select(a => not(existing.some(b => b.id == a.id))).concat(existing)
pure def canSaveFiles(f: Files, fileImport: FileImport, by: FileActor): bool =
  by == FileHost and f.loaded and f.pending == NoFileOperation and fileImport.owner == f.owner and
  fileImport.generation == f.generation and fileImport.authorization != "" and fileImport.entries.length() > 0 and validCatalog(fileImport.entries) and compatibleImport(f, fileImport.entries)
pure def saveFiles(f: Files, fileImport: FileImport, by: FileActor): FilesResult = {
  state: { ...f, pending: SavingFiles, pendingFiles: fileImport.entries, generation: f.generation + 1, feedback: NoFileFeedback },
  out: List(StoreFiles({ owner: f.owner, generation: f.generation + 1, files: fileImport.entries }))
}
pure def canDeletePhoto(f: Files, id: str, generation: int, by: FileActor): bool =
  by == FileUser and f.opened and f.loaded and f.pending == NoFileOperation and f.selected != "" and
  id == f.selected and generation == f.generation and fileAt(f, f.selected).kind == Photo
pure def deletePhoto(f: Files, id: str, generation: int, by: FileActor): FilesResult = {
  state: { ...f, pending: DeletingPhoto, pendingId: f.selected, generation: f.generation + 1, feedback: NoFileFeedback },
  out: List(RemovePhoto({ owner: f.owner, generation: f.generation + 1, id: f.selected }))
}
pure def canWriteResult(f: Files, fileReceipt: FileReceipt, by: FileActor): bool =
  by == FileStore and (f.pending == SavingFiles or f.pending == DeletingPhoto) and
  fileReceipt.owner == f.owner and fileReceipt.generation == f.generation and fileReceipt.id == f.pendingId and
  (fileReceipt.succeeded implies fileReceipt.evidence != "")
pure def writeResult(f: Files, fileReceipt: FileReceipt, by: FileActor): Files =
  val deleting = f.pending == DeletingPhoto and fileReceipt.succeeded
  { ...f, entries: if (not(fileReceipt.succeeded)) f.entries else if (deleting) f.entries.select(e => e.id != f.pendingId) else mergeFiles(f.entries, f.pendingFiles),
    selected: if (deleting) "" else f.selected, contentReady: if (deleting) false else f.contentReady,
    page: if (deleting) 0 else f.page,
    pending: NoFileOperation, pendingId: "", pendingFiles: List(), query: "", matches: List(),
    feedback: if (not(fileReceipt.succeeded)) WriteFailed else if (deleting) PhotoDeleted else FilesSaved }
pure def alwaysPendingImportValid(f: Files): bool =
  if (f.pending == SavingFiles) f.loaded and f.pendingFiles.length() > 0 and validCatalog(f.pendingFiles) and compatibleImport(f, f.pendingFiles)
  else f.pendingFiles == List()
pure def stepFailedWriteKeepsLibrary(before: Files, via: str, after: Files): bool =
  (via == "writeResult" and after.feedback == WriteFailed) implies after.entries == before.entries
pure def sometimesSavedFiles(f: Files): bool = f.feedback == FilesSaved
pure def sometimesDeletedPhoto(f: Files): bool = f.feedback == PhotoDeleted
pure def sometimesWriteFailure(f: Files): bool = f.feedback == WriteFailed
```

### A photo taken or a file chosen on the device has its own local source identity

Email's Attach menu offers Take a photo, Choose from Photos and Choose a file
(`prototype/Grace Prototype.html`, line 2021); Take a photo shows only on a
tablet with a camera. Choose from Photos and Choose a file attach a saved
Files photo or document with the identity it already has, whichever account
or message it came from. A new camera photo, or a file Files took from the
system picker, has no mailbox source, so its source is the device:
origin `device`, the owner's account, the capture or picker session as its
container, and the capture or picked item's ID as both its source reference and
its stable local ID. Its content reference names the captured bytes. A photo
taken from Email is saved to Files by the same acknowledged write as any
import before it joins the draft, because its bytes must outlast the camera
and wait for Send; a photo Files did not keep is not attached, and the draft
keeps the revision it had when the camera opened. Every attachment is sent as
its own bytes: those Files holds, or, for one forwarded from a message and
never saved, the bytes fetched from that message in the account sending it.
One that is neither is refused, and the email is not sent.

```quint
type DeviceCapture = {
  owner: str, session: str, captureId: str, contentRef: str, name: str, kind: FileKind, takenAt: int, pages: int
}
pure val deviceOrigin: str = "device"
pure def captureFile(capture: DeviceCapture): SavedFile = {
  id: capture.captureId, kind: capture.kind, name: capture.name, origin: deviceOrigin, account: capture.owner,
  container: capture.session, sourceRef: capture.captureId, contentRef: capture.contentRef, group: "",
  savedAt: capture.takenAt, pages: capture.pages
}
pure def lawCaptureHasDeviceIdentity(capture: DeviceCapture): bool =
  val file = captureFile(capture)
  (capture.owner != "" and capture.session != "" and capture.captureId != "" and capture.contentRef != "" and
    capture.name != "" and capture.takenAt >= 0 and (if (capture.kind == Pdf) capture.pages > 0 else capture.pages == 0)) implies
    (validFile(file) and file.origin == deviceOrigin and file.account == capture.owner and
      file.container == capture.session and file.sourceRef == capture.captureId)
pure val captureValues = Set(
  { owner: "owner", session: "camera-session", captureId: "capture", contentRef: "blob-capture", name: "Photo.jpg", kind: Photo, takenAt: 1, pages: 0 },
  { owner: "owner", session: "picker-session", captureId: "picked", contentRef: "blob-picked", name: "Program.pdf", kind: Pdf, takenAt: 1, pages: 3 },
  { owner: "owner", session: "picker-session", captureId: "", contentRef: "blob-picked", name: "Program.pdf", kind: Pdf, takenAt: 1, pages: 0 })
```

### Delete is the explicit local action and does not delete its source email

The photo viewer's Delete button is the user's choice; no extra confirmation
screen is introduced. The selected photo remains available until the store
acknowledges removal. Failure retains it and allows Retry. There is no document
Delete, folder manager, trash manager, upload or editing surface in this
prototype. Deleting the local copy does not delete its source message, revoke a
sent attachment or alter transaction evidence. A later deliberate Save may
import the source again.

```quint
pure def stepOnlyAcknowledgedWritesChangeLibrary(before: Files, via: str, after: Files): bool =
  (via != "loadCatalog" and via != "writeResult" and via != "restartFiles") implies after.entries == before.entries
```

### Sharing a photo opens a draft without sending it

Share uses the exact selected, readable local photo and opens Email's recipient
chooser with that attachment. Recipient choice, editing, review and explicit
Send belong to Email. This effect contains no recipient or permission to send,
so sharing cannot become silent publication.

```quint
pure def canSharePhoto(f: Files, id: str, generation: int, by: FileActor): bool =
  by == FileUser and f.opened and f.contentReady and f.pending == NoFileOperation and
  id == f.selected and generation == f.generation and fileAt(f, f.selected).kind == Photo
pure def sharePhoto(f: Files, id: str, generation: int, by: FileActor): FilesResult = {
  state: { ...f, selected: "", contentReady: false, page: 0 },
  out: List(SharePhoto({ owner: f.owner, file: fileAt(f, f.selected) }))
}
```

### Close and restart stop previews without inventing a storage result

Close returns Home and clears the preview while preserving the tab and saved
library. A loaded library can reopen while a write finishes; reopening
does not change that pending request generation. Tab choice cancels a pending
find request before showing the chosen index. Reads are cancelled; a storage operation already dispatched
may finish and report its matching result. Restart discards the view and reloads
the durable catalog on the next open. The store serializes commits or compares
request versions at commit; a rejected late callback cannot overwrite newer
storage.

```quint
pure def canCloseFiles(f: Files, by: FileActor): bool = by == FileUser and f.opened
pure def closeFiles(f: Files, by: FileActor): Files =
  val reading = f.pending == ReadingCatalog or f.pending == ReadingFile or f.pending == Locating
  { ...f, opened: false, selected: "", contentReady: false, page: 0,
    pending: if (reading) NoFileOperation else f.pending, pendingId: if (reading) "" else f.pendingId,
    generation: if (reading) f.generation + 1 else f.generation }
pure def canRestartFiles(f: Files, by: FileActor): bool = by == FileHost and f.owner != ""
pure def restartFiles(f: Files, by: FileActor): Files =
  { ...initial, owner: f.owner, tab: f.tab, generation: f.generation + 1 }
pure def stepOwnerDoesNotChange(before: Files, after: Files): bool = before.owner != "" implies after.owner == before.owner
```

### A surface that hands a library on keeps every library rule

Email and the handoffs between apps change a library only through these
operations, and check the library they return against all of its rules at once.

```quint
pure def validFiles(f: Files): bool =
  alwaysLibraryIdentity(f) and alwaysCatalogValid(f) and alwaysCatalogLoadHasNoStaleView(f) and
  alwaysSelectionExists(f) and alwaysPageInBounds(f) and alwaysPendingFileExists(f) and
  alwaysMatchesExist(f) and alwaysPendingImportValid(f)
```

### Local save, preview, recovery and handoff paths have representative inputs

```quint
pure val samplePhoto: SavedFile = { id: "photo", kind: Photo, name: "Recital.jpg", origin: "https://mail.example", account: "mail-account", container: "message", sourceRef: "attachment-photo", contentRef: "blob-photo", group: "This week", savedAt: 1, pages: 0 }
pure val sampleOtherPhoto: SavedFile = { ...samplePhoto, id: "photo2", sourceRef: "attachment-photo2", contentRef: "blob-photo2" }
pure val samplePdf: SavedFile = { ...samplePhoto, id: "document", kind: Pdf, name: "Visit form.pdf", sourceRef: "attachment-pdf", contentRef: "blob-pdf", pages: 2 }
pure val ownerValues = Set("owner", "other", "")
pure val idValues = Set("photo", "photo2", "document", "missing", "")
pure val directionValues = Set(-1, 1, 0)
pure val queryValues = Set("", "recital", "form", "photos", "missing", "bad")
pure val catalogReportValues = Set(
  { owner: "owner", generation: 1, entries: List(samplePhoto, sampleOtherPhoto, samplePdf), succeeded: true, evidence: "catalog" },
  { owner: "owner", generation: 1, entries: List(), succeeded: true, evidence: "empty-catalog" },
  { owner: "owner", generation: 2, entries: List(samplePhoto, samplePdf), succeeded: true, evidence: "catalog" },
  { owner: "owner", generation: 3, entries: List(samplePhoto, samplePdf), succeeded: true, evidence: "catalog" },
  { owner: "owner", generation: 1, entries: List(), succeeded: false, evidence: "" },
  { owner: "other", generation: 1, entries: List(samplePhoto), succeeded: true, evidence: "catalog" })
pure val fileImportValues = Set(
  { owner: "owner", generation: 1, entries: List(samplePhoto, sampleOtherPhoto), authorization: "save-all-choice" },
  { owner: "owner", generation: 1, entries: List(samplePdf), authorization: "save-choice" },
  { owner: "owner", generation: 1, entries: List(samplePhoto), authorization: "save-choice" },
  { owner: "other", generation: 1, entries: List(samplePhoto), authorization: "save-choice" },
  { owner: "owner", generation: 1, entries: List(samplePhoto), authorization: "" },
  { owner: "owner", generation: 2, entries: List(samplePhoto), authorization: "save-choice" },
  { owner: "owner", generation: 3, entries: List(samplePhoto), authorization: "save-choice" },
  { owner: "owner", generation: 1, entries: List({ ...samplePhoto, contentRef: "different-content" }), authorization: "save-choice" })
pure val fileReceiptValues = Set(
  { owner: "owner", generation: 2, id: "photo", succeeded: true, evidence: "read" },
  { owner: "owner", generation: 2, id: "photo2", succeeded: true, evidence: "read" },
  { owner: "owner", generation: 2, id: "document", succeeded: true, evidence: "read" },
  { owner: "owner", generation: 2, id: "photo", succeeded: false, evidence: "" },
  { owner: "owner", generation: 2, id: "", succeeded: true, evidence: "saved" },
  { owner: "owner", generation: 2, id: "", succeeded: false, evidence: "" },
  { owner: "owner", generation: 3, id: "photo", succeeded: true, evidence: "stored" },
  { owner: "owner", generation: 3, id: "photo2", succeeded: true, evidence: "read" },
  { owner: "owner", generation: 3, id: "photo", succeeded: false, evidence: "" },
  { owner: "owner", generation: 4, id: "photo2", succeeded: true, evidence: "read" },
  { owner: "owner", generation: 4, id: "document", succeeded: true, evidence: "read" },
  { owner: "other", generation: 2, id: "photo", succeeded: true, evidence: "wrong-owner" })
pure val locateReportValues = Set(
  { owner: "owner", generation: 2, query: "recital", ids: List("photo") }, { owner: "owner", generation: 2, query: "form", ids: List("document") },
  { owner: "owner", generation: 2, query: "photos", ids: List("photo", "photo2") }, { owner: "owner", generation: 2, query: "missing", ids: List() },
  { owner: "owner", generation: 2, query: "bad", ids: List("missing") }, { owner: "owner", generation: 2, query: "", ids: List() },
  { owner: "owner", generation: 1, query: "recital", ids: List("photo") }, { owner: "other", generation: 2, query: "recital", ids: List("photo") })
pure val weight_openFiles = 3
pure val weight_loadCatalog = 5
pure val weight_openFile = 3
pure val weight_contentResult = 4
pure val weight_saveFiles = 3
pure val weight_writeResult = 4
```
