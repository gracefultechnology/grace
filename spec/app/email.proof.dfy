lemma SendDraftIssuedView(m: Mailbox, operationId: string, recipientValid: bool, persisted: bool, by_: MailActor)
  ensures sendDraft(m, operationId, recipientValid, persisted, by_).issuedSends ==
    m.issuedSends + ProofLib.Filter((set_x: string) => !((set_x in m.issuedSends)), [operationId])
{
}

lemma sendDraft_ensures(m: Mailbox, operationId: string, recipientValid: bool, persisted: bool, by_: MailActor)
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftAssetsAreValid(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysMessageAssetsAreBound(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysConnectedIdentity(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysAccountIdentityIsBound(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysGenerationAndRevision(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysReadAccess(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysReadSelectionIsBound(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSelectedContent(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysFolderIsVisible(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSearchMatchesQuery(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysBillProvenance(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysResultPersistenceHasTerminal(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysApprovalIsCurrent(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftHasAccount(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysRetirementHasMailbox(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftVersions(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSendHasRecipient(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSendEvidence(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftStoreHasRevision(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysEditableDraftIsNotRetired(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepMailboxIdentityIsFixed(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepUnresolvedDraftIsFixed(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepRetirementRequiresCompletion(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
{
  if inv(m) && canSendDraft(m, operationId, recipientValid, persisted, by_) {
    SendDraftIssuedView(m, operationId, recipientValid, persisted, by_);
    ProofLib.FilterMember((set_x: string) => !((set_x in m.issuedSends)), [operationId], operationId);
  }
}

lemma EmailRemovedAssetsView(m: Mailbox, assetId: string, by_: MailActor)
  ensures removeAsset(m, assetId, by_).draftAttachments ==
    ProofLib.Filter((a: app__files_SavedFile) => (a.id != assetId), m.draftAttachments)
{
}

lemma EmailForwardedAssetsView(m: Mailbox, content: DraftContent, by_: MailActor)
  ensures forwardAttachment(m, content, by_).draftAttachments ==
    ProofLib.Filter((a: app__files_SavedFile) => (a.sourceRef in [m.attachmentRef]), m.assets)
{
}

lemma removeAsset_ensures(m: Mailbox, assetId: string, by_: MailActor)
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftAssetsAreValid(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysMessageAssetsAreBound(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysConnectedIdentity(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysAccountIdentityIsBound(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysGenerationAndRevision(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysReadAccess(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysReadSelectionIsBound(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSelectedContent(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysFolderIsVisible(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSearchMatchesQuery(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysBillProvenance(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysResultPersistenceHasTerminal(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysApprovalIsCurrent(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftHasAccount(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysRetirementHasMailbox(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftVersions(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSendHasRecipient(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSendEvidence(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftStoreHasRevision(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysEditableDraftIsNotRetired(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepMailboxIdentityIsFixed(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepUnresolvedDraftIsFixed(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepRetirementRequiresCompletion(m, removeAsset(m, assetId, by_)))
{
  if inv(m) && canRemoveAsset(m, assetId, by_) {
    EmailRemovedAssetsView(m, assetId, by_);
    ProofLib.FilterSubset((a: app__files_SavedFile) => (a.id != assetId), m.draftAttachments);
  }
}

lemma forwardAttachment_ensures(m: Mailbox, content: DraftContent, by_: MailActor)
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftAssetsAreValid(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysMessageAssetsAreBound(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysConnectedIdentity(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysAccountIdentityIsBound(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysGenerationAndRevision(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysReadAccess(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysReadSelectionIsBound(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSelectedContent(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysFolderIsVisible(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSearchMatchesQuery(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysBillProvenance(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysResultPersistenceHasTerminal(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysApprovalIsCurrent(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftHasAccount(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysRetirementHasMailbox(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftVersions(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSendHasRecipient(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSendEvidence(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftStoreHasRevision(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysEditableDraftIsNotRetired(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepMailboxIdentityIsFixed(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepUnresolvedDraftIsFixed(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepRetirementRequiresCompletion(m, forwardAttachment(m, content, by_)))
{
  if inv(m) && canForwardAttachment(m, by_) {
    EmailForwardedAssetsView(m, content, by_);
    ProofLib.FilterSubset((a: app__files_SavedFile) => (a.sourceRef in [m.attachmentRef]), m.assets);
  }
}

lemma lawRetirementPreservesOtherDrafts_ensures(m: Mailbox, draftId: string)
  ensures (lawRetirementPreservesOtherDrafts(m, draftId) == true)
{
  if draftId != m.draftId && m.draftId != "" {
    var key := "$" + draftId;
    var changed := "$" + m.draftId;
    assert key[1..] == draftId;
    assert changed[1..] == m.draftId;
    assert key != changed;
    if key in m.retiredDrafts {
      assert key in retireCurrentDraft(m);
      assert retireCurrentDraft(m)[key] == m.retiredDrafts[key];
    } else {
      assert key !in retireCurrentDraft(m);
    }
  }
}
