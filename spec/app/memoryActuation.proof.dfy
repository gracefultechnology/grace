lemma lawChangedDetailRevokesSavedCommand_ensures(w: app__workspace_Workspace, pendingEffect: app__workspace_WorkspaceEffect, d: app__savedDetails_SavedDetails, proposedFact: app__memory_FactProposal, saved: SavedFill, by_: app__workspace_WorkspaceActor)
  ensures (lawChangedDetailRevokesSavedCommand(w, pendingEffect, d, proposedFact, saved, by_) == true)
{
  app__savedDetails_lawChangedDetailWaitsForHerYes_ensures(d, proposedFact);
}

lemma lawDeletedDetailRevokesSavedCommand_ensures(w: app__workspace_Workspace, pendingEffect: app__workspace_WorkspaceEffect, d: app__savedDetails_SavedDetails, version: int, saved: SavedFill, by_: app__workspace_WorkspaceActor)
  ensures (lawDeletedDetailRevokesSavedCommand(w, pendingEffect, d, version, saved, by_) == true)
{
  app__savedDetails_lawDeletedDetailIsNotSaved_ensures(d, receiptKey(saved.authorization), version);
}

lemma lawClearAllRevokesSavedCommand_ensures(w: app__workspace_Workspace, pendingEffect: app__workspace_WorkspaceEffect, d: app__savedDetails_SavedDetails, saved: SavedFill, by_: app__workspace_WorkspaceActor)
  ensures (lawClearAllRevokesSavedCommand(w, pendingEffect, d, saved, by_) == true)
{
  app__savedDetails_lawClearedDetailIsNotSaved_ensures(d, receiptKey(saved.authorization));
}
