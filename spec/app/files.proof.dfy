lemma CatalogFilterView(entries: seq<SavedFile>)
  ensures validCatalog(entries) == (forall f :: f in entries ==>
    validFile(f) && |ProofLib.Filter((g: SavedFile) => (g.id == f.id), entries)| == 1 &&
    |ProofLib.Filter((g: SavedFile) => sameSource(f, g), entries)| == 1)
{
}

lemma CatalogDistinct(entries: seq<SavedFile>)
  requires validCatalog(entries)
  ensures ProofLib.DistinctBy(entries, (f: SavedFile) => f.id)
  ensures ProofLib.DistinctBy(entries, (f: SavedFile) => (f.origin, f.account, f.container, f.sourceRef))
  ensures forall f :: f in entries ==> validFile(f)
{
  CatalogFilterView(entries);
  forall i, j | 0 <= i < |entries| && 0 <= j < |entries| && i != j
    ensures entries[i].id != entries[j].id
    ensures (entries[i].origin, entries[i].account, entries[i].container, entries[i].sourceRef) !=
      (entries[j].origin, entries[j].account, entries[j].container, entries[j].sourceRef)
  {
    var f := entries[i];
    ProofLib.FilterCountOneIffUnique((g: SavedFile) => (g.id == f.id), entries, (g: SavedFile) => g.id, i);
    ProofLib.FilterCountOneIffUnique((g: SavedFile) => sameSource(f, g), entries,
      (g: SavedFile) => (g.origin, g.account, g.container, g.sourceRef), i);
  }
}

lemma DistinctCatalog(entries: seq<SavedFile>)
  requires ProofLib.DistinctBy(entries, (f: SavedFile) => f.id)
  requires ProofLib.DistinctBy(entries, (f: SavedFile) => (f.origin, f.account, f.container, f.sourceRef))
  requires forall f :: f in entries ==> validFile(f)
  ensures validCatalog(entries)
{
  CatalogFilterView(entries);
  forall f | f in entries
    ensures validFile(f) && |ProofLib.Filter((g: SavedFile) => (g.id == f.id), entries)| == 1 &&
      |ProofLib.Filter((g: SavedFile) => sameSource(f, g), entries)| == 1
  {
    var i :| 0 <= i < |entries| && entries[i] == f;
    ProofLib.FilterOne((g: SavedFile) => (g.id == f.id), entries, i);
    ProofLib.FilterOne((g: SavedFile) => sameSource(f, g), entries, i);
  }
}

lemma FilteredCatalog(entries: seq<SavedFile>, keep: SavedFile -> bool)
  requires validCatalog(entries)
  ensures validCatalog(ProofLib.Filter(keep, entries))
{
  CatalogDistinct(entries);
  ProofLib.FilterKeepsDistinctBy(keep, entries, (f: SavedFile) => f.id);
  ProofLib.FilterKeepsDistinctBy(keep, entries, (f: SavedFile) => (f.origin, f.account, f.container, f.sourceRef));
  ProofLib.FilterSubset(keep, entries);
  DistinctCatalog(ProofLib.Filter(keep, entries));
}

lemma FilesFilterView(f: Files, id: string)
  ensures photos(f) == ProofLib.Filter((e: SavedFile) => e.kind.Photo?, f.entries)
  ensures fileAt(f, id) == (if |ProofLib.Filter((e: SavedFile) => (e.id == id), f.entries)| > 0 then
    ProofLib.Filter((e: SavedFile) => (e.id == id), f.entries)[0] else emptyFile)
  ensures mergeFiles(f.entries, f.pendingFiles) ==
    ProofLib.Filter((a: SavedFile) => !((exists b :: b in f.entries && (b.id == a.id))), f.pendingFiles) + f.entries
{
}

lemma FileLookup(f: Files, file: SavedFile)
  requires validCatalog(f.entries) && file in f.entries
  ensures hasFile(f, file.id) && fileAt(f, file.id) == file
{
  FilesFilterView(f, file.id);
  CatalogDistinct(f.entries);
  var selected := ProofLib.Filter((e: SavedFile) => (e.id == file.id), f.entries);
  ProofLib.FilterMember((e: SavedFile) => (e.id == file.id), f.entries, file);
  ProofLib.FilterMember((e: SavedFile) => (e.id == file.id), f.entries, selected[0]);
  var i :| 0 <= i < |f.entries| && f.entries[i] == file;
  var j :| 0 <= j < |f.entries| && f.entries[j] == selected[0];
  assert i == j;
}

lemma MergeCatalog(f: Files)
  requires validCatalog(f.entries) && validCatalog(f.pendingFiles) && compatibleImport(f, f.pendingFiles)
  ensures validCatalog(mergeFiles(f.entries, f.pendingFiles))
  ensures forall file :: file in f.entries ==> file in mergeFiles(f.entries, f.pendingFiles)
{
  FilesFilterView(f, "");
  CatalogDistinct(f.entries);
  CatalogDistinct(f.pendingFiles);
  var added := ProofLib.Filter((a: SavedFile) => !((exists b :: b in f.entries && (b.id == a.id))), f.pendingFiles);
  FilteredCatalog(f.pendingFiles, (a: SavedFile) => !((exists b :: b in f.entries && (b.id == a.id))));
  CatalogDistinct(added);
  forall a, b | a in added && b in f.entries
    ensures a.id != b.id
    ensures (a.origin, a.account, a.container, a.sourceRef) != (b.origin, b.account, b.container, b.sourceRef)
  {
    ProofLib.FilterMember((a: SavedFile) => !((exists b :: b in f.entries && (b.id == a.id))), f.pendingFiles, a);
    assert a in f.pendingFiles && a.id != b.id;
    if sameSource(a, b) { assert sameAsset(a, b); }
  }
  ProofLib.DistinctByConcat(added, f.entries, (f: SavedFile) => f.id);
  ProofLib.DistinctByConcat(added, f.entries, (f: SavedFile) => (f.origin, f.account, f.container, f.sourceRef));
  DistinctCatalog(added + f.entries);
}

lemma ExistingFileLookup(f: Files, id: string)
  requires validCatalog(f.entries) && hasFile(f, id)
  ensures fileAt(f, id) in f.entries && fileAt(f, id).id == id
{
  var file :| file in f.entries && file.id == id;
  FileLookup(f, file);
}

lemma movePhoto_ensures(f: Files, direction: int, by_: FileActor)
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysLibraryIdentity(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysCatalogValid(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysCatalogLoadHasNoStaleView(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysSelectionExists(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysPageInBounds(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysPendingFileExists(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysMatchesExist(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> alwaysPendingImportValid(movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> stepFailedWriteKeepsLibrary(f, "movePhoto", movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> stepOnlyAcknowledgedWritesChangeLibrary(f, "movePhoto", movePhoto(f, direction, by_).state))
  ensures (inv(f) ==> canMovePhoto(f, direction, by_) ==> stepOwnerDoesNotChange(f, movePhoto(f, direction, by_).state))
{
  if inv(f) && canMovePhoto(f, direction, by_) {
    FilesFilterView(f, f.selected);
    var position := photoPosition(f) + direction;
    var chosen := photos(f)[position];
    ProofLib.FilterMember((e: SavedFile) => e.kind.Photo?, f.entries, chosen);
    FileLookup(f, chosen);
    assert canOpenFile(f, chosen.id, by_);
    openFile_ensures(f, chosen.id, by_);
  }
}

lemma writeResult_ensures(f: Files, fileReceipt: FileReceipt, by_: FileActor)
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysLibraryIdentity(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysCatalogValid(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysCatalogLoadHasNoStaleView(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysSelectionExists(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysPageInBounds(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysPendingFileExists(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysMatchesExist(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> alwaysPendingImportValid(writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> stepFailedWriteKeepsLibrary(f, "writeResult", writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> stepOnlyAcknowledgedWritesChangeLibrary(f, "writeResult", writeResult(f, fileReceipt, by_)))
  ensures (inv(f) ==> canWriteResult(f, fileReceipt, by_) ==> stepOwnerDoesNotChange(f, writeResult(f, fileReceipt, by_)))
{
  if inv(f) && canWriteResult(f, fileReceipt, by_) {
    var after := writeResult(f, fileReceipt, by_);
    if fileReceipt.succeeded {
      if f.pending.DeletingPhoto? {
        FilteredCatalog(f.entries, (e: SavedFile) => (e.id != f.pendingId));
        assert after.entries == ProofLib.Filter((e: SavedFile) => (e.id != f.pendingId), f.entries);
      } else {
        MergeCatalog(f);
        if f.selected != "" {
          ExistingFileLookup(f, f.selected);
          var chosen := fileAt(f, f.selected);
          FileLookup(f, chosen);
          assert chosen in after.entries;
          FileLookup(after, chosen);
        }
      }
    }
  }
}

// spec/app/files.md, "Opening a file verifies that exact content before presenting a preview"
lemma openFile_ensures(f: Files, id: string, by_: FileActor)
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysLibraryIdentity(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysCatalogValid(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysCatalogLoadHasNoStaleView(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysSelectionExists(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysPageInBounds(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysPendingFileExists(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysMatchesExist(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> alwaysPendingImportValid(openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> stepFailedWriteKeepsLibrary(f, "openFile", openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> stepOnlyAcknowledgedWritesChangeLibrary(f, "openFile", openFile(f, id, by_).state))
  ensures (inv(f) ==> canOpenFile(f, id, by_) ==> stepOwnerDoesNotChange(f, openFile(f, id, by_).state))
{
  if inv(f) && canOpenFile(f, id, by_) {
    ExistingFileLookup(f, id);
    CatalogDistinct(f.entries);
    var after := openFile(f, id, by_).state;
    assert after.entries == f.entries;
    assert fileAt(after, id) == fileAt(f, id);
    assert validFile(fileAt(f, id));
  }
}
