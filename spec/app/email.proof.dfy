lemma SendDraftIssuedView(m: Mailbox, operationId: string, recipientValid: bool, persisted: bool, by_: MailActor)
  ensures sendDraft(m, operationId, recipientValid, persisted, by_).issuedSends ==
    m.issuedSends + ProofLib.Filter((set_x: string) => !((set_x in m.issuedSends)), [operationId])
{
}

lemma sendDraft_ensures(m: Mailbox, operationId: string, recipientValid: bool, persisted: bool, by_: MailActor)
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysConnectedIdentity(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysAccountIdentityIsBound(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysGenerationAndRevision(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSelectedContent(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysReadAccess(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysReadSelectionIsBound(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysFolderIsVisible(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSearchMatchesQuery(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysMessageRegistry(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysListedMessagesAreCurrent(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSelectionUsesCanonicalMessage(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysBillProvenance(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysScamWarningIsCurrent(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysLinkBelongsToSelection(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysFlaggedMessageIsNoBillSource(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysResultPersistenceHasTerminal(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysApprovalIsCurrent(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSendHasRecipient(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysSendEvidence(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysQueuedSendsAreIssued(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftHasAccount(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftStoreHasRevision(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysRetirementHasMailbox(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftVersions(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysEditableDraftIsNotRetired(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysDraftAssetsAreValid(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> alwaysMessageAssetsAreBound(sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepMessageRecordsAreRetained(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepOnlyThePersonApproves(m, "sendDraft", sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepSendingNeedsCurrentApproval(m, "sendDraft", sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepUnresolvedDraftIsFixed(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepQueueNeedsCurrentApproval(m, "sendDraft", sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepQueuedSendGoesOnce(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepWorthyComposerIsNotDropped(m, "sendDraft", sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepMailboxIdentityIsFixed(m, sendDraft(m, operationId, recipientValid, persisted, by_)))
  ensures (inv(m) ==> canSendDraft(m, operationId, recipientValid, persisted, by_) ==> stepRetirementRequiresCompletion(m, "sendDraft", sendDraft(m, operationId, recipientValid, persisted, by_)))
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
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysConnectedIdentity(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysAccountIdentityIsBound(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysGenerationAndRevision(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSelectedContent(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysReadAccess(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysReadSelectionIsBound(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysFolderIsVisible(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSearchMatchesQuery(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysMessageRegistry(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysListedMessagesAreCurrent(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSelectionUsesCanonicalMessage(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysBillProvenance(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysScamWarningIsCurrent(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysLinkBelongsToSelection(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysFlaggedMessageIsNoBillSource(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysResultPersistenceHasTerminal(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysApprovalIsCurrent(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSendHasRecipient(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysSendEvidence(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysQueuedSendsAreIssued(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftHasAccount(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftStoreHasRevision(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysRetirementHasMailbox(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftVersions(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysEditableDraftIsNotRetired(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysDraftAssetsAreValid(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> alwaysMessageAssetsAreBound(removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepMessageRecordsAreRetained(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepOnlyThePersonApproves(m, "removeAsset", removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepSendingNeedsCurrentApproval(m, "removeAsset", removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepUnresolvedDraftIsFixed(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepQueueNeedsCurrentApproval(m, "removeAsset", removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepQueuedSendGoesOnce(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepWorthyComposerIsNotDropped(m, "removeAsset", removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepMailboxIdentityIsFixed(m, removeAsset(m, assetId, by_)))
  ensures (inv(m) ==> canRemoveAsset(m, assetId, by_) ==> stepRetirementRequiresCompletion(m, "removeAsset", removeAsset(m, assetId, by_)))
{
  if inv(m) && canRemoveAsset(m, assetId, by_) {
    EmailRemovedAssetsView(m, assetId, by_);
    ProofLib.FilterSubset((a: app__files_SavedFile) => (a.id != assetId), m.draftAttachments);
  }
}


lemma forwardAttachment_ensures(m: Mailbox, content: DraftContent, by_: MailActor)
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysConnectedIdentity(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysAccountIdentityIsBound(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysGenerationAndRevision(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSelectedContent(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysReadAccess(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysReadSelectionIsBound(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysFolderIsVisible(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSearchMatchesQuery(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysMessageRegistry(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysListedMessagesAreCurrent(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSelectionUsesCanonicalMessage(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysBillProvenance(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysScamWarningIsCurrent(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysLinkBelongsToSelection(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysFlaggedMessageIsNoBillSource(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysResultPersistenceHasTerminal(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysApprovalIsCurrent(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSendHasRecipient(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysSendEvidence(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysQueuedSendsAreIssued(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftHasAccount(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftStoreHasRevision(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysRetirementHasMailbox(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftVersions(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysEditableDraftIsNotRetired(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysDraftAssetsAreValid(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> alwaysMessageAssetsAreBound(forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepMessageRecordsAreRetained(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepOnlyThePersonApproves(m, "forwardAttachment", forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepSendingNeedsCurrentApproval(m, "forwardAttachment", forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepUnresolvedDraftIsFixed(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepQueueNeedsCurrentApproval(m, "forwardAttachment", forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepQueuedSendGoesOnce(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepWorthyComposerIsNotDropped(m, "forwardAttachment", forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepMailboxIdentityIsFixed(m, forwardAttachment(m, content, by_)))
  ensures (inv(m) ==> canForwardAttachment(m, by_) ==> stepRetirementRequiresCompletion(m, "forwardAttachment", forwardAttachment(m, content, by_)))
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


lemma receiveMessage_ensures(m: Mailbox, scope: ListingScope, listing: app__emailItem_MetadataReceipt, by_: MailActor)
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysConnectedIdentity(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysAccountIdentityIsBound(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysGenerationAndRevision(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSelectedContent(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysReadAccess(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysReadSelectionIsBound(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysFolderIsVisible(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSearchMatchesQuery(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysMessageRegistry(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysListedMessagesAreCurrent(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSelectionUsesCanonicalMessage(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysBillProvenance(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysScamWarningIsCurrent(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysLinkBelongsToSelection(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysFlaggedMessageIsNoBillSource(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysResultPersistenceHasTerminal(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysApprovalIsCurrent(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSendHasRecipient(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSendEvidence(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysQueuedSendsAreIssued(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftHasAccount(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftStoreHasRevision(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysRetirementHasMailbox(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftVersions(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysEditableDraftIsNotRetired(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftAssetsAreValid(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysMessageAssetsAreBound(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepMessageRecordsAreRetained(m, receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepOnlyThePersonApproves(m, "receiveMessage", receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepSendingNeedsCurrentApproval(m, "receiveMessage", receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepUnresolvedDraftIsFixed(m, receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepQueueNeedsCurrentApproval(m, "receiveMessage", receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepQueuedSendGoesOnce(m, receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepWorthyComposerIsNotDropped(m, "receiveMessage", receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepMailboxIdentityIsFixed(m, receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepRetirementRequiresCompletion(m, "receiveMessage", receiveMessage(m, scope, listing, by_)))
{
  EmailFrame_receiveMessage(m, scope, listing, by_);
  if inv(m) && canReceiveMessage(m, scope, listing, by_) {
    EmailLookupFacts(m, listing.seed.identity.ref);
    var old_ := messageRecord(m, listing.seed.identity.ref);
    if !hasMessage(m, listing.seed.identity.ref) {
      app__emailItem_initialHolds_ensures();
      app__emailItem_loadMessage_ensures(app__emailItem_initial, listing.seed, app__emailItem_MessageActor.MessageProvider);
      var record := app__emailItem_loadMessage(app__emailItem_initial, listing.seed, app__emailItem_MessageActor.MessageProvider);
      EmailPutInto(m, record, receiveMessage(m, scope, listing, by_));
    } else if app__emailItem_canRefreshMetadata(old_, listing, app__emailItem_MessageActor.MessageProvider) {
      assert app__emailItem_inv(old_);
      app__emailItem_refreshMetadata_ensures(old_, listing, app__emailItem_MessageActor.MessageProvider);
      var record := app__emailItem_refreshMetadata(old_, listing, app__emailItem_MessageActor.MessageProvider);
      EmailPutInto(m, record, receiveMessage(m, scope, listing, by_));
    }
    ProofLib.FilterSubset((set_x: string) => !((set_x in m.messageRefs)), [listing.seed.identity.ref]);
  }

  if inv(m) && canReceiveMessage(m, scope, listing, by_) {
    var after := receiveMessage(m, scope, listing, by_);
    assert after.messageRefs == m.messageRefs + ProofLib.Filter((set_x: string) => !((set_x in m.messageRefs)), [listing.seed.identity.ref]);
    forall ref | ref in after.messageRefs
      ensures availableMessage(after, ref)
    {
      if !(ref in m.messageRefs) {
        ProofLib.FilterMember((set_x: string) => !((set_x in m.messageRefs)), [listing.seed.identity.ref], ref);
        assert ref == listing.seed.identity.ref;
      }
      if ref != listing.seed.identity.ref {
        assert ref in m.messageRefs;
        assert availableMessage(m, ref);
        assert messageRecord(after, ref) == messageRecord(m, ref);
      }
    }
  }
}


lemma readResult_ensures(m: Mailbox, readReceipt: ReadReceipt, by_: MailActor)
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysConnectedIdentity(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysAccountIdentityIsBound(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysGenerationAndRevision(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSelectedContent(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysReadAccess(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysReadSelectionIsBound(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysFolderIsVisible(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSearchMatchesQuery(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysMessageRegistry(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysListedMessagesAreCurrent(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSelectionUsesCanonicalMessage(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysBillProvenance(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysScamWarningIsCurrent(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysLinkBelongsToSelection(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysFlaggedMessageIsNoBillSource(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysResultPersistenceHasTerminal(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysApprovalIsCurrent(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSendHasRecipient(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSendEvidence(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysQueuedSendsAreIssued(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftHasAccount(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftStoreHasRevision(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysRetirementHasMailbox(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftVersions(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysEditableDraftIsNotRetired(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftAssetsAreValid(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysMessageAssetsAreBound(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepMessageRecordsAreRetained(m, readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepOnlyThePersonApproves(m, "readResult", readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepSendingNeedsCurrentApproval(m, "readResult", readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepUnresolvedDraftIsFixed(m, readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepQueueNeedsCurrentApproval(m, "readResult", readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepQueuedSendGoesOnce(m, readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepWorthyComposerIsNotDropped(m, "readResult", readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepMailboxIdentityIsFixed(m, readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepRetirementRequiresCompletion(m, "readResult", readResult(m, readReceipt, by_)))
{
  EmailFrame_readResult(m, readReceipt, by_);
  if inv(m) && canReadResult(m, readReceipt, by_) {
    EmailLookupFacts(m, m.requestedRef);
    var old_ := messageRecord(m, m.requestedRef);
    if readReceipt.succeeded && m.readKind.OpenMessage? && app__emailItem_canChangeMessage(old_, app__emailItem_MessageChange.ReadMessage, app__emailItem_MessageActor.MessageUser) {
      assert app__emailItem_inv(old_);
      app__emailItem_changeMessage_ensures(old_, app__emailItem_MessageChange.ReadMessage, app__emailItem_MessageActor.MessageUser);
      var record := app__emailItem_changeMessage(old_, app__emailItem_MessageChange.ReadMessage, app__emailItem_MessageActor.MessageUser);
      EmailPutInto(m, record, readResult(m, readReceipt, by_));
    }
  }
}


lemma changeSelectedMessage_ensures(m: Mailbox, target: MessageTarget, change: app__emailItem_MessageChange, by_: MailActor)
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysConnectedIdentity(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysAccountIdentityIsBound(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysGenerationAndRevision(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSelectedContent(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysReadAccess(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysReadSelectionIsBound(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysFolderIsVisible(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSearchMatchesQuery(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysMessageRegistry(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysListedMessagesAreCurrent(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSelectionUsesCanonicalMessage(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysBillProvenance(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysScamWarningIsCurrent(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysLinkBelongsToSelection(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysFlaggedMessageIsNoBillSource(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysResultPersistenceHasTerminal(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysApprovalIsCurrent(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSendHasRecipient(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSendEvidence(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysQueuedSendsAreIssued(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftHasAccount(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftStoreHasRevision(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysRetirementHasMailbox(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftVersions(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysEditableDraftIsNotRetired(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftAssetsAreValid(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysMessageAssetsAreBound(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepMessageRecordsAreRetained(m, changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepOnlyThePersonApproves(m, "changeSelectedMessage", changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepSendingNeedsCurrentApproval(m, "changeSelectedMessage", changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepUnresolvedDraftIsFixed(m, changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepQueueNeedsCurrentApproval(m, "changeSelectedMessage", changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepQueuedSendGoesOnce(m, changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepWorthyComposerIsNotDropped(m, "changeSelectedMessage", changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepMailboxIdentityIsFixed(m, changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepRetirementRequiresCompletion(m, "changeSelectedMessage", changeSelectedMessage(m, target, change, by_)))
{
  EmailFrame_changeSelectedMessage(m, target, change, by_);
  if inv(m) && canChangeSelectedMessage(m, target, change, by_) {
    EmailLookupFacts(m, target.ref);
    var old_ := messageRecord(m, target.ref);
    assert app__emailItem_inv(old_);
    app__emailItem_changeMessage_ensures(old_, change, app__emailItem_MessageActor.MessageUser);
    var record := app__emailItem_changeMessage(old_, change, app__emailItem_MessageActor.MessageUser);
    EmailPutInto(m, record, changeSelectedMessage(m, target, change, by_));
    ProofLib.FilterSubset((set_x: string) => !((set_x in [target.ref])), m.messageRefs);
  }

  if inv(m) && canChangeSelectedMessage(m, target, change, by_) {
    var after := changeSelectedMessage(m, target, change, by_);
    if change.UnreadMessage? {
      assert after.messageRefs == m.messageRefs;
    } else {
      assert after.messageRefs == ProofLib.Filter((set_x: string) => !((set_x in [target.ref])), m.messageRefs);
    }
    forall ref | ref in after.messageRefs
      ensures availableMessage(after, ref)
    {
      if !change.UnreadMessage? {
        ProofLib.FilterMember((set_x: string) => !((set_x in [target.ref])), m.messageRefs, ref);
        assert ref != target.ref;
      }
      assert ref in m.messageRefs;
      assert availableMessage(m, ref);
      if ref != target.ref {
        assert messageRecord(after, ref) == messageRecord(m, ref);
      } else {
        assert messageRecord(after, ref) == app__emailItem_changeMessage(messageRecord(m, ref), change, app__emailItem_MessageActor.MessageUser);
        assert !changingFolder(messageRecord(after, ref));
      }
    }
  }
}


lemma undoMessageTrash_ensures(m: Mailbox, target: MessageTarget, by_: MailActor)
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysConnectedIdentity(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysAccountIdentityIsBound(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysGenerationAndRevision(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSelectedContent(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysReadAccess(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysReadSelectionIsBound(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysFolderIsVisible(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSearchMatchesQuery(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysMessageRegistry(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysListedMessagesAreCurrent(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSelectionUsesCanonicalMessage(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysBillProvenance(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysScamWarningIsCurrent(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysLinkBelongsToSelection(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysFlaggedMessageIsNoBillSource(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysResultPersistenceHasTerminal(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysApprovalIsCurrent(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSendHasRecipient(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSendEvidence(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysQueuedSendsAreIssued(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftHasAccount(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftStoreHasRevision(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysRetirementHasMailbox(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftVersions(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysEditableDraftIsNotRetired(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftAssetsAreValid(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysMessageAssetsAreBound(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepMessageRecordsAreRetained(m, undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepOnlyThePersonApproves(m, "undoMessageTrash", undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepSendingNeedsCurrentApproval(m, "undoMessageTrash", undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepUnresolvedDraftIsFixed(m, undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepQueueNeedsCurrentApproval(m, "undoMessageTrash", undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepQueuedSendGoesOnce(m, undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepWorthyComposerIsNotDropped(m, "undoMessageTrash", undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepMailboxIdentityIsFixed(m, undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepRetirementRequiresCompletion(m, "undoMessageTrash", undoMessageTrash(m, target, by_)))
{
  EmailFrame_undoMessageTrash(m, target, by_);
  if inv(m) && canUndoMessageTrash(m, target, by_) {
    EmailLookupFacts(m, target.ref);
    var old_ := messageRecord(m, target.ref);
    assert app__emailItem_inv(old_);
    app__emailItem_undoTrash_ensures(old_, target.revision, app__emailItem_MessageActor.MessageUser);
    var record := app__emailItem_undoTrash(old_, target.revision, app__emailItem_MessageActor.MessageUser);
    EmailPutInto(m, record, undoMessageTrash(m, target, by_));
    ProofLib.FilterSubset((set_x: string) => !((set_x in [target.ref])), m.messageRefs);
  }

  if inv(m) && canUndoMessageTrash(m, target, by_) {
    var after := undoMessageTrash(m, target, by_);
    if true {
      assert after.messageRefs == ProofLib.Filter((set_x: string) => !((set_x in [target.ref])), m.messageRefs);
    }
    if after.readStatus.Reading? && after.readKind.OpenMessage? && true {
      assert m.requestedRef != target.ref;
      ProofLib.FilterMember((set_x: string) => !((set_x in [target.ref])), m.messageRefs, m.requestedRef);
    }
    forall ref | ref in after.messageRefs
      ensures availableMessage(after, ref)
    {
      if true {
        ProofLib.FilterMember((set_x: string) => !((set_x in [target.ref])), m.messageRefs, ref);
        assert ref != target.ref;
      }
      if ref != target.ref {
        assert ref in m.messageRefs;
        assert availableMessage(m, ref);
        assert messageRecord(after, ref) == messageRecord(m, ref);
      }
    }
  }
}


lemma completeMessageChange_ensures(m: Mailbox, messageReceipt: app__emailItem_ChangeReceipt, by_: MailActor)
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysConnectedIdentity(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysAccountIdentityIsBound(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysGenerationAndRevision(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSelectedContent(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysReadAccess(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysReadSelectionIsBound(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysFolderIsVisible(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSearchMatchesQuery(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysMessageRegistry(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysListedMessagesAreCurrent(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSelectionUsesCanonicalMessage(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysBillProvenance(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysScamWarningIsCurrent(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysLinkBelongsToSelection(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysFlaggedMessageIsNoBillSource(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysResultPersistenceHasTerminal(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysApprovalIsCurrent(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSendHasRecipient(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSendEvidence(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysQueuedSendsAreIssued(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftHasAccount(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftStoreHasRevision(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysRetirementHasMailbox(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftVersions(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysEditableDraftIsNotRetired(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftAssetsAreValid(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysMessageAssetsAreBound(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepMessageRecordsAreRetained(m, completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepOnlyThePersonApproves(m, "completeMessageChange", completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepSendingNeedsCurrentApproval(m, "completeMessageChange", completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepUnresolvedDraftIsFixed(m, completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepQueueNeedsCurrentApproval(m, "completeMessageChange", completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepQueuedSendGoesOnce(m, completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepWorthyComposerIsNotDropped(m, "completeMessageChange", completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepMailboxIdentityIsFixed(m, completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepRetirementRequiresCompletion(m, "completeMessageChange", completeMessageChange(m, messageReceipt, by_)))
{
  EmailFrame_completeMessageChange(m, messageReceipt, by_);
  if inv(m) && canCompleteMessageChange(m, messageReceipt, by_) {
    EmailLookupFacts(m, messageReceipt.identity.ref);
    var old_ := messageRecord(m, messageReceipt.identity.ref);
    assert app__emailItem_inv(old_);
    app__emailItem_completeChange_ensures(old_, messageReceipt, app__emailItem_MessageActor.MessageProvider);
    var record := app__emailItem_completeChange(old_, messageReceipt, app__emailItem_MessageActor.MessageProvider);
    EmailPutInto(m, record, completeMessageChange(m, messageReceipt, by_));
    ProofLib.FilterSubset((set_x: string) => !((set_x in [messageReceipt.identity.ref])), m.messageRefs);
  }

  if inv(m) && canCompleteMessageChange(m, messageReceipt, by_) {
    var after := completeMessageChange(m, messageReceipt, by_);
    if changingFolder(messageRecord(m, messageReceipt.identity.ref)) {
      assert after.messageRefs == ProofLib.Filter((set_x: string) => !((set_x in [messageReceipt.identity.ref])), m.messageRefs);
    }
    if after.readStatus.Reading? && after.readKind.OpenMessage? && changingFolder(messageRecord(m, messageReceipt.identity.ref)) {
      assert m.requestedRef != messageReceipt.identity.ref;
      ProofLib.FilterMember((set_x: string) => !((set_x in [messageReceipt.identity.ref])), m.messageRefs, m.requestedRef);
    }
    forall ref | ref in after.messageRefs
      ensures availableMessage(after, ref)
    {
      if changingFolder(messageRecord(m, messageReceipt.identity.ref)) {
        ProofLib.FilterMember((set_x: string) => !((set_x in [messageReceipt.identity.ref])), m.messageRefs, ref);
        assert ref != messageReceipt.identity.ref;
      }
      if ref != messageReceipt.identity.ref {
        assert ref in m.messageRefs;
        assert availableMessage(m, ref);
        assert messageRecord(after, ref) == messageRecord(m, ref);
      }
    }
  }
}


lemma EmailRegistryView(m: Mailbox, ref: string, record: app__emailItem_MessageRecord)
  ensures alwaysMessageRegistry(m) == (forall entry :: entry in m.messages ==>
    entry.loaded && entry.identity == messageIdentity(m, entry.identity.ref) && app__emailItem_validMessageRecord(entry) &&
    |ProofLib.Filter((other: app__emailItem_MessageRecord) => (other.identity.ref == entry.identity.ref), m.messages)| == 1)
  ensures messageRecord(m, ref) == (if |ProofLib.Filter((record: app__emailItem_MessageRecord) => (record.identity.ref == ref), m.messages)| == 1 then
    ProofLib.Filter((record: app__emailItem_MessageRecord) => (record.identity.ref == ref), m.messages)[0] else app__emailItem_initial)
  ensures putMessage(m.messages, record) == ProofLib.Filter((old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref), m.messages) + [record]
{
}

lemma EmailRegistryDistinct(m: Mailbox)
  requires alwaysMessageRegistry(m)
  ensures ProofLib.DistinctBy(m.messages, (record: app__emailItem_MessageRecord) => record.identity.ref)
{
  EmailRegistryView(m, "", app__emailItem_initial);
  forall i, j | 0 <= i < |m.messages| && 0 <= j < |m.messages| && i != j
    ensures m.messages[i].identity.ref != m.messages[j].identity.ref
  {
    var entry := m.messages[i];
    assert entry in m.messages;
    assert |ProofLib.Filter((other: app__emailItem_MessageRecord) => (other.identity.ref == entry.identity.ref), m.messages)| == 1;
    if m.messages[j].identity.ref == entry.identity.ref {
      ProofLib.FilterTwo((other: app__emailItem_MessageRecord) => (other.identity.ref == entry.identity.ref), m.messages, i, j);
    }
  }
}

lemma EmailRegistryFromDistinct(m: Mailbox)
  requires ProofLib.DistinctBy(m.messages, (record: app__emailItem_MessageRecord) => record.identity.ref)
  requires forall entry :: entry in m.messages ==>
    (entry.loaded && entry.identity == messageIdentity(m, entry.identity.ref) && app__emailItem_validMessageRecord(entry))
  ensures alwaysMessageRegistry(m)
{
  EmailRegistryView(m, "", app__emailItem_initial);
  forall entry | entry in m.messages
    ensures |ProofLib.Filter((other: app__emailItem_MessageRecord) => (other.identity.ref == entry.identity.ref), m.messages)| == 1
  {
    var i :| 0 <= i < |m.messages| && m.messages[i] == entry;
    ProofLib.FilterOne((other: app__emailItem_MessageRecord) => (other.identity.ref == entry.identity.ref), m.messages, i);
  }
}

lemma EmailRecordLookup(m: Mailbox, record: app__emailItem_MessageRecord)
  requires alwaysMessageRegistry(m) && record in m.messages
  ensures messageRecord(m, record.identity.ref) == record
{
  EmailRegistryView(m, record.identity.ref, record);
  EmailRegistryDistinct(m);
  var found := ProofLib.Filter((record_: app__emailItem_MessageRecord) => (record_.identity.ref == record.identity.ref), m.messages);
  ProofLib.FilterMember((record_: app__emailItem_MessageRecord) => (record_.identity.ref == record.identity.ref), m.messages, record);
  var i :| 0 <= i < |m.messages| && m.messages[i] == record;
  ProofLib.FilterOne((record_: app__emailItem_MessageRecord) => (record_.identity.ref == record.identity.ref), m.messages, i);
  ProofLib.FilterMember((record_: app__emailItem_MessageRecord) => (record_.identity.ref == record.identity.ref), m.messages, found[0]);
  var j :| 0 <= j < |m.messages| && m.messages[j] == found[0];
  assert i == j;
}

lemma EmailLookupFacts(m: Mailbox, ref: string)
  requires alwaysMessageRegistry(m)
  ensures hasMessage(m, ref) == messageRecord(m, ref).loaded
  ensures hasMessage(m, ref) ==> messageRecord(m, ref) in m.messages && messageRecord(m, ref).identity == messageIdentity(m, ref)
  ensures !hasMessage(m, ref) ==> messageRecord(m, ref) == app__emailItem_initial
  ensures app__emailItem_validMessageRecord(messageRecord(m, ref))
{
  EmailRegistryView(m, ref, app__emailItem_initial);
  if hasMessage(m, ref) {
    var record :| record in m.messages && record.identity.ref == ref;
    EmailRecordLookup(m, record);
  } else {
    ProofLib.FilterNone((record: app__emailItem_MessageRecord) => (record.identity.ref == ref), m.messages);
  }
}

lemma EmailPutRecord(m: Mailbox, record: app__emailItem_MessageRecord)
  requires alwaysMessageRegistry(m)
  requires record.loaded && app__emailItem_validMessageRecord(record) && record.identity == messageIdentity(m, record.identity.ref)
  ensures alwaysMessageRegistry(m.(messages := putMessage(m.messages, record)))
  ensures messageRecord(m.(messages := putMessage(m.messages, record)), record.identity.ref) == record
  ensures forall ref :: ref != record.identity.ref ==>
    messageRecord(m.(messages := putMessage(m.messages, record)), ref) == messageRecord(m, ref)
{
  EmailRegistryView(m, record.identity.ref, record);
  EmailRegistryDistinct(m);
  var retained := ProofLib.Filter((old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref), m.messages);
  ProofLib.FilterKeepsDistinctBy((old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref), m.messages,
    (record: app__emailItem_MessageRecord) => record.identity.ref);
  ProofLib.FilterSubset((old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref), m.messages);
  forall old_ | old_ in retained
    ensures old_ in m.messages && old_.identity.ref != record.identity.ref
  { ProofLib.FilterMember((old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref), m.messages, old_); }
  ProofLib.DistinctByConcat(retained, [record], (record: app__emailItem_MessageRecord) => record.identity.ref);
  var after := m.(messages := putMessage(m.messages, record));
  EmailRegistryFromDistinct(after);
  EmailRecordLookup(after, record);
  forall ref | ref != record.identity.ref
    ensures messageRecord(after, ref) == messageRecord(m, ref)
  {
    EmailLookupFacts(m, ref);
    EmailLookupFacts(after, ref);
    if hasMessage(m, ref) {
      var old_ := messageRecord(m, ref);
      ProofLib.FilterMember((old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref), m.messages, old_);
      EmailRecordLookup(after, old_);
    } else if hasMessage(after, ref) {
      var old_ := messageRecord(after, ref);
      assert old_ in retained;
      assert old_ in m.messages;
    }
  }
}

lemma EmailPutKeepsHistory(m: Mailbox, record: app__emailItem_MessageRecord)
  requires alwaysMessageRegistry(m)
  requires record.loaded && app__emailItem_validMessageRecord(record) && record.identity == messageIdentity(m, record.identity.ref)
  requires hasMessage(m, record.identity.ref) ==>
    (record.revision >= messageRecord(m, record.identity.ref).revision &&
      (messageRecord(m, record.identity.ref).folder.PurgedFolder? ==> record.folder.PurgedFolder?))
  ensures stepMessageRecordsAreRetained(m, m.(messages := putMessage(m.messages, record)))
{
  EmailPutRecord(m, record);
  var after := m.(messages := putMessage(m.messages, record));
  forall prior | prior in m.messages
    ensures exists next :: (next in after.messages && next.identity == prior.identity && next.revision >= prior.revision &&
      (prior.folder.PurgedFolder? ==> next.folder.PurgedFolder?))
  {
    EmailRecordLookup(m, prior);
    if prior.identity.ref == record.identity.ref {
      assert record in after.messages;
    } else {
      EmailLookupFacts(after, prior.identity.ref);
      assert messageRecord(after, prior.identity.ref) == prior;
      assert prior in after.messages;
    }
  }
}

lemma EmailFrame_receiveMessage(m: Mailbox, scope: ListingScope, listing: app__emailItem_MetadataReceipt, by_: MailActor)
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftHasAccount(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysRetirementHasMailbox(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftVersions(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftAssetsAreValid(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysMessageAssetsAreBound(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysConnectedIdentity(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysAccountIdentityIsBound(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysGenerationAndRevision(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysReadAccess(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysReadSelectionIsBound(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSelectedContent(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysFolderIsVisible(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSearchMatchesQuery(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysBillProvenance(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysResultPersistenceHasTerminal(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysApprovalIsCurrent(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysDraftStoreHasRevision(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSendHasRecipient(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysSendEvidence(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> alwaysEditableDraftIsNotRetired(receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepMailboxIdentityIsFixed(m, receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepRetirementRequiresCompletion(m, "receiveMessage", receiveMessage(m, scope, listing, by_)))
  ensures (inv(m) ==> canReceiveMessage(m, scope, listing, by_) ==> stepUnresolvedDraftIsFixed(m, receiveMessage(m, scope, listing, by_)))
{
}

lemma EmailFrame_readResult(m: Mailbox, readReceipt: ReadReceipt, by_: MailActor)
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftHasAccount(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysRetirementHasMailbox(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftVersions(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftAssetsAreValid(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysMessageAssetsAreBound(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysConnectedIdentity(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysAccountIdentityIsBound(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysGenerationAndRevision(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysReadAccess(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysReadSelectionIsBound(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSelectedContent(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysFolderIsVisible(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSearchMatchesQuery(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysBillProvenance(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysResultPersistenceHasTerminal(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysApprovalIsCurrent(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysDraftStoreHasRevision(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSendHasRecipient(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysSendEvidence(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> alwaysEditableDraftIsNotRetired(readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepMailboxIdentityIsFixed(m, readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepRetirementRequiresCompletion(m, "readResult", readResult(m, readReceipt, by_)))
  ensures (inv(m) ==> canReadResult(m, readReceipt, by_) ==> stepUnresolvedDraftIsFixed(m, readResult(m, readReceipt, by_)))
{
}

lemma EmailFrame_changeSelectedMessage(m: Mailbox, target: MessageTarget, change: app__emailItem_MessageChange, by_: MailActor)
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftHasAccount(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysRetirementHasMailbox(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftVersions(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftAssetsAreValid(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysMessageAssetsAreBound(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysConnectedIdentity(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysAccountIdentityIsBound(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysGenerationAndRevision(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysReadAccess(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysReadSelectionIsBound(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSelectedContent(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysFolderIsVisible(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSearchMatchesQuery(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysBillProvenance(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysResultPersistenceHasTerminal(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysApprovalIsCurrent(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysDraftStoreHasRevision(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSendHasRecipient(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysSendEvidence(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> alwaysEditableDraftIsNotRetired(changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepMailboxIdentityIsFixed(m, changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepRetirementRequiresCompletion(m, "changeSelectedMessage", changeSelectedMessage(m, target, change, by_)))
  ensures (inv(m) ==> canChangeSelectedMessage(m, target, change, by_) ==> stepUnresolvedDraftIsFixed(m, changeSelectedMessage(m, target, change, by_)))
{
}

lemma EmailFrame_undoMessageTrash(m: Mailbox, target: MessageTarget, by_: MailActor)
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftHasAccount(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysRetirementHasMailbox(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftVersions(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftAssetsAreValid(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysMessageAssetsAreBound(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysConnectedIdentity(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysAccountIdentityIsBound(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysGenerationAndRevision(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysReadAccess(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSelectedContent(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysFolderIsVisible(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSearchMatchesQuery(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysBillProvenance(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysResultPersistenceHasTerminal(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysApprovalIsCurrent(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysDraftStoreHasRevision(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSendHasRecipient(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysSendEvidence(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> alwaysEditableDraftIsNotRetired(undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepMailboxIdentityIsFixed(m, undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepRetirementRequiresCompletion(m, "undoMessageTrash", undoMessageTrash(m, target, by_)))
  ensures (inv(m) ==> canUndoMessageTrash(m, target, by_) ==> stepUnresolvedDraftIsFixed(m, undoMessageTrash(m, target, by_)))
{
  if inv(m) && canUndoMessageTrash(m, target, by_) {
    var after := undoMessageTrash(m, target, by_);
    var removed := true;
    if removed {
      assert after.messageRefs == ProofLib.Filter((set_x: string) => !((set_x in [target.ref])), m.messageRefs);
      if after.readStatus.Reading? && after.readKind.OpenMessage? {
        assert m.requestedRef != target.ref;
        ProofLib.FilterMember((set_x: string) => !((set_x in [target.ref])), m.messageRefs, m.requestedRef);
      }
    }
  }
}

lemma EmailFrame_completeMessageChange(m: Mailbox, messageReceipt: app__emailItem_ChangeReceipt, by_: MailActor)
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftHasAccount(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysRetirementHasMailbox(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftVersions(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftAssetsAreValid(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysMessageAssetsAreBound(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysConnectedIdentity(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysAccountIdentityIsBound(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysGenerationAndRevision(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysReadAccess(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSelectedContent(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysFolderIsVisible(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSearchMatchesQuery(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysBillProvenance(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysResultPersistenceHasTerminal(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysApprovalIsCurrent(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysDraftStoreHasRevision(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSendHasRecipient(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysSendEvidence(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> alwaysEditableDraftIsNotRetired(completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepMailboxIdentityIsFixed(m, completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepRetirementRequiresCompletion(m, "completeMessageChange", completeMessageChange(m, messageReceipt, by_)))
  ensures (inv(m) ==> canCompleteMessageChange(m, messageReceipt, by_) ==> stepUnresolvedDraftIsFixed(m, completeMessageChange(m, messageReceipt, by_)))
{
  if inv(m) && canCompleteMessageChange(m, messageReceipt, by_) {
    var after := completeMessageChange(m, messageReceipt, by_);
    var removed := changingFolder(messageRecord(m, messageReceipt.identity.ref));
    if removed {
      assert after.messageRefs == ProofLib.Filter((set_x: string) => !((set_x in [messageReceipt.identity.ref])), m.messageRefs);
      if after.readStatus.Reading? && after.readKind.OpenMessage? {
        assert m.requestedRef != messageReceipt.identity.ref;
        ProofLib.FilterMember((set_x: string) => !((set_x in [messageReceipt.identity.ref])), m.messageRefs, m.requestedRef);
      }
    }
  }
}

lemma EmailPutInto(m: Mailbox, record: app__emailItem_MessageRecord, after: Mailbox)
  requires alwaysMessageRegistry(m)
  requires record.loaded && app__emailItem_validMessageRecord(record) && record.identity == messageIdentity(m, record.identity.ref)
  requires after.messages == putMessage(m.messages, record)
  requires after.owner == m.owner && after.provider == m.provider && after.account == m.account
  requires hasMessage(m, record.identity.ref) ==> (record.revision >= messageRecord(m, record.identity.ref).revision &&
    (messageRecord(m, record.identity.ref).folder.PurgedFolder? ==> record.folder.PurgedFolder?))
  ensures alwaysMessageRegistry(after)
  ensures messageRecord(after, record.identity.ref) == record
  ensures forall ref :: ref != record.identity.ref ==> messageRecord(after, ref) == messageRecord(m, ref)
  ensures stepMessageRecordsAreRetained(m, after)
{
  EmailPutRecord(m, record);
  EmailPutKeepsHistory(m, record);
}

lemma closeUndoToast_ensures(m: Mailbox, target: MessageTarget, by_: MailActor)
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysConnectedIdentity(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysAccountIdentityIsBound(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysGenerationAndRevision(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysSelectedContent(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysReadAccess(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysReadSelectionIsBound(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysFolderIsVisible(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysSearchMatchesQuery(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysMessageRegistry(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysListedMessagesAreCurrent(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysSelectionUsesCanonicalMessage(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysBillProvenance(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysScamWarningIsCurrent(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysLinkBelongsToSelection(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysFlaggedMessageIsNoBillSource(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysResultPersistenceHasTerminal(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysApprovalIsCurrent(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysSendHasRecipient(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysSendEvidence(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysQueuedSendsAreIssued(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysDraftHasAccount(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysDraftStoreHasRevision(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysRetirementHasMailbox(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysDraftVersions(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysEditableDraftIsNotRetired(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysDraftAssetsAreValid(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> alwaysMessageAssetsAreBound(closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepMessageRecordsAreRetained(m, closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepOnlyThePersonApproves(m, "closeUndoToast", closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepSendingNeedsCurrentApproval(m, "closeUndoToast", closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepUnresolvedDraftIsFixed(m, closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepQueueNeedsCurrentApproval(m, "closeUndoToast", closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepQueuedSendGoesOnce(m, closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepWorthyComposerIsNotDropped(m, "closeUndoToast", closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepMailboxIdentityIsFixed(m, closeUndoToast(m, target, by_)))
  ensures (inv(m) ==> canCloseUndoToast(m, target, by_) ==> stepRetirementRequiresCompletion(m, "closeUndoToast", closeUndoToast(m, target, by_)))
{
  if inv(m) && canCloseUndoToast(m, target, by_) {
    EmailLookupFacts(m, target.ref);
    var old_ := messageRecord(m, target.ref);
    assert app__emailItem_inv(old_);
    app__emailItem_closeUndo_ensures(old_, target.revision, app__emailItem_MessageActor.MessageUser);
    var record := app__emailItem_closeUndo(old_, target.revision, app__emailItem_MessageActor.MessageUser);
    var after := closeUndoToast(m, target, by_);
    EmailPutInto(m, record, after);
    forall ref
      ensures availableMessage(after, ref) == availableMessage(m, ref)
      ensures messageRecord(after, ref).loaded == messageRecord(m, ref).loaded
      ensures messageRecord(after, ref).folder == messageRecord(m, ref).folder
    {
      if ref == target.ref {
        assert messageRecord(after, ref) == record;
      } else {
        assert messageRecord(after, ref) == messageRecord(m, ref);
      }
    }
  }
}

lemma lawClosedToastCannotUndo_ensures(m: Mailbox, target: MessageTarget, by_: MailActor)
  ensures (lawClosedToastCannotUndo(m, target, by_) == true)
{
  if canCloseUndoToast(m, target, by_) {
    var record := app__emailItem_closeUndo(messageRecord(m, target.ref), target.revision, app__emailItem_MessageActor.MessageUser);
    assert record.identity.ref == target.ref;
    EmailPutFinds(m, record);
    assert messageRecord(closeUndoToast(m, target, by_), target.ref) == record;
    assert record.undoRevision == -1;
  }
}

lemma EmailPutFinds(m: Mailbox, rec: app__emailItem_MessageRecord)
  ensures messageRecord(m.(messages := putMessage(m.messages, rec)), rec.identity.ref) == rec
{
  var after := m.(messages := putMessage(m.messages, rec));
  EmailRegistryView(m, rec.identity.ref, rec);
  EmailRegistryView(after, rec.identity.ref, rec);
  var retained := ProofLib.Filter((old_: app__emailItem_MessageRecord) => (old_.identity.ref != rec.identity.ref), m.messages);
  forall i | 0 <= i < |retained|
    ensures retained[i].identity.ref != rec.identity.ref
  {
    ProofLib.FilterMember((old_: app__emailItem_MessageRecord) => (old_.identity.ref != rec.identity.ref), m.messages, retained[i]);
  }
  ProofLib.FilterNone((record: app__emailItem_MessageRecord) => (record.identity.ref == rec.identity.ref), retained);
  ProofLib.FilterAppend((record: app__emailItem_MessageRecord) => (record.identity.ref == rec.identity.ref), retained, rec);
}

lemma endConnection_ensures(m: Mailbox, resultStatus: Connection, by_: MailActor)
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysConnectedIdentity(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysAccountIdentityIsBound(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysGenerationAndRevision(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysSelectedContent(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysReadAccess(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysReadSelectionIsBound(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysFolderIsVisible(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysSearchMatchesQuery(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysMessageRegistry(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysListedMessagesAreCurrent(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysSelectionUsesCanonicalMessage(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysBillProvenance(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysScamWarningIsCurrent(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysLinkBelongsToSelection(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysFlaggedMessageIsNoBillSource(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysResultPersistenceHasTerminal(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysApprovalIsCurrent(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysSendHasRecipient(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysSendEvidence(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysQueuedSendsAreIssued(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysDraftHasAccount(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysDraftStoreHasRevision(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysRetirementHasMailbox(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysDraftVersions(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysEditableDraftIsNotRetired(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysDraftAssetsAreValid(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> alwaysMessageAssetsAreBound(endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepMessageRecordsAreRetained(m, endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepOnlyThePersonApproves(m, "endConnection", endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepSendingNeedsCurrentApproval(m, "endConnection", endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepUnresolvedDraftIsFixed(m, endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepQueueNeedsCurrentApproval(m, "endConnection", endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepQueuedSendGoesOnce(m, endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepWorthyComposerIsNotDropped(m, "endConnection", endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepMailboxIdentityIsFixed(m, endConnection(m, resultStatus, by_)))
  ensures (inv(m) ==> canEndConnection(m, resultStatus, by_) ==> stepRetirementRequiresCompletion(m, "endConnection", endConnection(m, resultStatus, by_)))
{
  if inv(m) && canEndConnection(m, resultStatus, by_) {
    OutboxFenced(m, endConnection(m, resultStatus, by_));
  }
}

lemma interrupt_ensures(m: Mailbox, by_: MailActor)
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysConnectedIdentity(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysAccountIdentityIsBound(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysGenerationAndRevision(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysSelectedContent(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysReadAccess(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysReadSelectionIsBound(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysFolderIsVisible(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysSearchMatchesQuery(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysMessageRegistry(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysListedMessagesAreCurrent(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysSelectionUsesCanonicalMessage(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysBillProvenance(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysScamWarningIsCurrent(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysLinkBelongsToSelection(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysFlaggedMessageIsNoBillSource(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysResultPersistenceHasTerminal(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysApprovalIsCurrent(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysSendHasRecipient(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysSendEvidence(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysQueuedSendsAreIssued(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysDraftHasAccount(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysDraftStoreHasRevision(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysRetirementHasMailbox(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysDraftVersions(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysEditableDraftIsNotRetired(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysDraftAssetsAreValid(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> alwaysMessageAssetsAreBound(interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepMessageRecordsAreRetained(m, interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepOnlyThePersonApproves(m, "interrupt", interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepSendingNeedsCurrentApproval(m, "interrupt", interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepUnresolvedDraftIsFixed(m, interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepQueueNeedsCurrentApproval(m, "interrupt", interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepQueuedSendGoesOnce(m, interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepWorthyComposerIsNotDropped(m, "interrupt", interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepMailboxIdentityIsFixed(m, interrupt(m, by_)))
  ensures (inv(m) ==> canInterrupt(m, by_) ==> stepRetirementRequiresCompletion(m, "interrupt", interrupt(m, by_)))
{
  if inv(m) && canInterrupt(m, by_) {
    OutboxFenced(m, interrupt(m, by_));
  }
}

lemma restartMailbox_ensures(m: Mailbox, by_: MailActor)
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysConnectedIdentity(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysAccountIdentityIsBound(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysGenerationAndRevision(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysSelectedContent(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysReadAccess(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysReadSelectionIsBound(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysFolderIsVisible(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysSearchMatchesQuery(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysMessageRegistry(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysListedMessagesAreCurrent(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysSelectionUsesCanonicalMessage(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysBillProvenance(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysScamWarningIsCurrent(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysLinkBelongsToSelection(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysFlaggedMessageIsNoBillSource(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysResultPersistenceHasTerminal(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysApprovalIsCurrent(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysSendHasRecipient(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysSendEvidence(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysQueuedSendsAreIssued(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysDraftHasAccount(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysDraftStoreHasRevision(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysRetirementHasMailbox(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysDraftVersions(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysEditableDraftIsNotRetired(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysDraftAssetsAreValid(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> alwaysMessageAssetsAreBound(restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepMessageRecordsAreRetained(m, restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepOnlyThePersonApproves(m, "restartMailbox", restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepSendingNeedsCurrentApproval(m, "restartMailbox", restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepUnresolvedDraftIsFixed(m, restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepQueueNeedsCurrentApproval(m, "restartMailbox", restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepQueuedSendGoesOnce(m, restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepWorthyComposerIsNotDropped(m, "restartMailbox", restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepMailboxIdentityIsFixed(m, restartMailbox(m, by_)))
  ensures (inv(m) ==> canRestartMailbox(m, by_) ==> stepRetirementRequiresCompletion(m, "restartMailbox", restartMailbox(m, by_)))
{
  if inv(m) && canRestartMailbox(m, by_) {
    OutboxFenced(m, restartMailbox(m, by_));
  }
}

lemma dispatchQueued_ensures(m: Mailbox, operationId: string, reachable: bool, by_: MailActor)
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysConnectedIdentity(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysAccountIdentityIsBound(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysGenerationAndRevision(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysSelectedContent(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysReadAccess(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysReadSelectionIsBound(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysFolderIsVisible(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysSearchMatchesQuery(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysMessageRegistry(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysListedMessagesAreCurrent(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysSelectionUsesCanonicalMessage(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysBillProvenance(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysScamWarningIsCurrent(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysLinkBelongsToSelection(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysFlaggedMessageIsNoBillSource(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysResultPersistenceHasTerminal(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysApprovalIsCurrent(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysSendHasRecipient(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysSendEvidence(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysQueuedSendsAreIssued(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysDraftHasAccount(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysDraftStoreHasRevision(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysRetirementHasMailbox(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysDraftVersions(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysEditableDraftIsNotRetired(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysDraftAssetsAreValid(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> alwaysMessageAssetsAreBound(dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepMessageRecordsAreRetained(m, dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepOnlyThePersonApproves(m, "dispatchQueued", dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepSendingNeedsCurrentApproval(m, "dispatchQueued", dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepUnresolvedDraftIsFixed(m, dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepQueueNeedsCurrentApproval(m, "dispatchQueued", dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepQueuedSendGoesOnce(m, dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepWorthyComposerIsNotDropped(m, "dispatchQueued", dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepMailboxIdentityIsFixed(m, dispatchQueued(m, operationId, reachable, by_)))
  ensures (inv(m) ==> canDispatchQueued(m, operationId, reachable, by_) ==> stepRetirementRequiresCompletion(m, "dispatchQueued", dispatchQueued(m, operationId, reachable, by_)))
{
  if inv(m) && canDispatchQueued(m, operationId, reachable, by_) {
    OutboxRestatus(m, operationId, OutboxStatus.Dispatching, "", dispatchQueued(m, operationId, reachable, by_));
  }
}

lemma queuedResult_ensures(m: Mailbox, operationId: string, resultStatus: SendStatus, evidence: string, persisted: bool, by_: MailActor)
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysConnectedIdentity(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysAccountIdentityIsBound(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysGenerationAndRevision(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysSelectedContent(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysReadAccess(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysReadSelectionIsBound(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysFolderIsVisible(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysSearchMatchesQuery(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysMessageRegistry(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysListedMessagesAreCurrent(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysSelectionUsesCanonicalMessage(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysBillProvenance(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysScamWarningIsCurrent(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysLinkBelongsToSelection(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysFlaggedMessageIsNoBillSource(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysResultPersistenceHasTerminal(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysApprovalIsCurrent(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysSendHasRecipient(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysSendEvidence(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysQueuedSendsAreIssued(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysDraftHasAccount(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysDraftStoreHasRevision(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysRetirementHasMailbox(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysDraftVersions(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysEditableDraftIsNotRetired(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysDraftAssetsAreValid(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> alwaysMessageAssetsAreBound(queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepMessageRecordsAreRetained(m, queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepOnlyThePersonApproves(m, "queuedResult", queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepSendingNeedsCurrentApproval(m, "queuedResult", queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepUnresolvedDraftIsFixed(m, queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepQueueNeedsCurrentApproval(m, "queuedResult", queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepQueuedSendGoesOnce(m, queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepWorthyComposerIsNotDropped(m, "queuedResult", queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepMailboxIdentityIsFixed(m, queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
  ensures (inv(m) ==> canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) ==> stepRetirementRequiresCompletion(m, "queuedResult", queuedResult(m, operationId, resultStatus, evidence, persisted, by_)))
{
  if inv(m) && canQueuedResult(m, operationId, resultStatus, evidence, persisted, by_) {
    var after := queuedResult(m, operationId, resultStatus, evidence, persisted, by_);
    if resultStatus.Sent? && persisted {
      OutboxRemoved(m, operationId, after);
    } else if resultStatus.SendFailed? && persisted {
      OutboxRestatus(m, operationId, OutboxStatus.DispatchFailed, evidence, after);
    } else {
      OutboxRestatus(m, operationId, OutboxStatus.DispatchUnknown, "", after);
    }
  }
}

lemma reopenQueued_ensures(m: Mailbox, operationId: string, by_: MailActor)
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysConnectedIdentity(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysAccountIdentityIsBound(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysGenerationAndRevision(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysSelectedContent(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysReadAccess(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysReadSelectionIsBound(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysFolderIsVisible(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysSearchMatchesQuery(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysMessageRegistry(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysListedMessagesAreCurrent(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysSelectionUsesCanonicalMessage(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysBillProvenance(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysScamWarningIsCurrent(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysLinkBelongsToSelection(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysFlaggedMessageIsNoBillSource(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysResultPersistenceHasTerminal(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysApprovalIsCurrent(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysSendHasRecipient(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysSendEvidence(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysQueuedSendsAreIssued(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysDraftHasAccount(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysDraftStoreHasRevision(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysRetirementHasMailbox(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysDraftVersions(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysEditableDraftIsNotRetired(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysDraftAssetsAreValid(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> alwaysMessageAssetsAreBound(reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepMessageRecordsAreRetained(m, reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepOnlyThePersonApproves(m, "reopenQueued", reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepSendingNeedsCurrentApproval(m, "reopenQueued", reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepUnresolvedDraftIsFixed(m, reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepQueueNeedsCurrentApproval(m, "reopenQueued", reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepQueuedSendGoesOnce(m, reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepWorthyComposerIsNotDropped(m, "reopenQueued", reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepMailboxIdentityIsFixed(m, reopenQueued(m, operationId, by_)))
  ensures (inv(m) ==> canReopenQueued(m, operationId, by_) ==> stepRetirementRequiresCompletion(m, "reopenQueued", reopenQueued(m, operationId, by_)))
{
  if inv(m) && canReopenQueued(m, operationId, by_) {
    OutboxFacts(m);
    var w :| w in m.outbox && w.operationId == operationId;
    OutboxFound(m.outbox, operationId, w);
    OutboxRemoved(m, operationId, reopenQueued(m, operationId, by_));
  }
}

lemma queueSend_ensures(m: Mailbox, operationId: string, recipientValid: bool, persisted: bool, reachable: bool, by_: MailActor)
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysConnectedIdentity(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysAccountIdentityIsBound(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysGenerationAndRevision(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysSelectedContent(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysReadAccess(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysReadSelectionIsBound(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysFolderIsVisible(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysSearchMatchesQuery(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysMessageRegistry(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysListedMessagesAreCurrent(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysSelectionUsesCanonicalMessage(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysBillProvenance(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysScamWarningIsCurrent(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysLinkBelongsToSelection(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysFlaggedMessageIsNoBillSource(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysResultPersistenceHasTerminal(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysApprovalIsCurrent(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysSendHasRecipient(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysSendEvidence(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysQueuedSendsAreIssued(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysDraftHasAccount(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysDraftStoreHasRevision(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysRetirementHasMailbox(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysDraftVersions(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysEditableDraftIsNotRetired(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysDraftAssetsAreValid(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> alwaysMessageAssetsAreBound(queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepMessageRecordsAreRetained(m, queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepOnlyThePersonApproves(m, "queueSend", queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepSendingNeedsCurrentApproval(m, "queueSend", queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepUnresolvedDraftIsFixed(m, queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepQueueNeedsCurrentApproval(m, "queueSend", queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepQueuedSendGoesOnce(m, queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepWorthyComposerIsNotDropped(m, "queueSend", queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepMailboxIdentityIsFixed(m, queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
  ensures (inv(m) ==> canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) ==> stepRetirementRequiresCompletion(m, "queueSend", queueSend(m, operationId, recipientValid, persisted, reachable, by_)))
{
  if inv(m) && canQueueSend(m, operationId, recipientValid, persisted, reachable, by_) {
    var after := queueSend(m, operationId, recipientValid, persisted, reachable, by_);
    ProofLib.FilterMember((set_x: string) => !((set_x in m.issuedSends)), [operationId], operationId);
    OutboxAppended(m, QueuedSend(operationId, currentDraft(m), OutboxStatus.Waiting, ""), after);
  }
}

lemma assistMail_ensures(m: Mailbox, assist: MailAssist, asked: bool, by_: MailActor)
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysConnectedIdentity(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysAccountIdentityIsBound(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysGenerationAndRevision(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysSelectedContent(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysReadAccess(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysReadSelectionIsBound(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysFolderIsVisible(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysSearchMatchesQuery(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysMessageRegistry(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysListedMessagesAreCurrent(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysSelectionUsesCanonicalMessage(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysBillProvenance(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysScamWarningIsCurrent(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysLinkBelongsToSelection(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysFlaggedMessageIsNoBillSource(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysResultPersistenceHasTerminal(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysApprovalIsCurrent(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysSendHasRecipient(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysSendEvidence(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysQueuedSendsAreIssued(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysDraftHasAccount(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysDraftStoreHasRevision(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysRetirementHasMailbox(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysDraftVersions(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysEditableDraftIsNotRetired(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysDraftAssetsAreValid(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> alwaysMessageAssetsAreBound(assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepMessageRecordsAreRetained(m, assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepFlaggedLinkWaitsForConfirmation(m, assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepOnlyThePersonApproves(m, "assistMail", assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepSendingNeedsCurrentApproval(m, "assistMail", assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepUnresolvedDraftIsFixed(m, assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepQueueNeedsCurrentApproval(m, "assistMail", assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepQueuedSendGoesOnce(m, assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepWorthyComposerIsNotDropped(m, "assistMail", assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepMailboxIdentityIsFixed(m, assistMail(m, assist, asked, by_)))
  ensures (inv(m) ==> canAssistMail(m, assist, asked, by_) ==> stepRetirementRequiresCompletion(m, "assistMail", assistMail(m, assist, asked, by_)))
{
  if inv(m) && canAssistMail(m, assist, asked, by_) {
    if assist.AssistTrash? {
      changeSelectedMessage_ensures(m, assist.target, app__emailItem_MessageChange.TrashMessage, MailActor.MailUser);
    } else if assist.AssistRestore? {
      changeSelectedMessage_ensures(m, assist.target, app__emailItem_MessageChange.RestoreMessage, MailActor.MailUser);
    } else if assist.AssistMarkUnread? {
      changeSelectedMessage_ensures(m, assist.target, app__emailItem_MessageChange.UnreadMessage, MailActor.MailUser);
    } else if assist.AssistUndoTrash? {
      undoMessageTrash_ensures(m, assist.target, MailActor.MailUser);
    }
  }
}

lemma lawGraceNeverRaisesApproval_ensures(m: Mailbox, assist: MailAssist, asked: bool, by_: MailActor)
  ensures (lawGraceNeverRaisesApproval(m, assist, asked, by_) == true)
{
  if canAssistMail(m, assist, asked, by_) && !(assist.AssistTrash? || assist.AssistRestore? || assist.AssistMarkUnread? || assist.AssistUndoTrash?) {
    assert assistMail(m, assist, asked, by_).messages == m.messages;
  }
  if canAssistMail(m, assist, asked, by_) && (assist.AssistTrash? || assist.AssistRestore? || assist.AssistMarkUnread? || assist.AssistUndoTrash?) {
    var after := assistMail(m, assist, asked, by_);
    var change := if assist.AssistTrash? then app__emailItem_MessageChange.TrashMessage
      else if assist.AssistMarkUnread? then app__emailItem_MessageChange.UnreadMessage else app__emailItem_MessageChange.RestoreMessage;
    var changed := app__emailItem_changeMessage(messageRecord(m, assist.target.ref), change, app__emailItem_MessageActor.MessageUser);
    assert after.messages == putMessage(m.messages, changed);
    EmailRegistryView(m, assist.target.ref, changed);
    forall r | r in after.messages && r.pending.PurgeMessage?
      ensures exists o :: o in m.messages && o.identity == r.identity && o.pending.PurgeMessage?
    {
      ProofLib.FilterMember((old_: app__emailItem_MessageRecord) => (old_.identity.ref != changed.identity.ref), m.messages, r);
      assert r in m.messages;
    }
  }
}

lemma OutboxIssuedView(m: Mailbox)
  ensures alwaysQueuedSendsAreIssued(m) == ((m.outboxSent >= 0) && !((exists q :: q in m.outbox && !((((((((q.operationId != "") && (q.operationId in m.issuedSends)) && (q.snapshot.content.to != "")) && (q.snapshot.version >= 0)) && !((exists a :: a in q.snapshot.attachments && !(app__files_validFile(a))))) && (!(q.status.DispatchFailed?) || (q.evidence != ""))) && (|ProofLib.Filter((o: QueuedSend) => (o.operationId == q.operationId), m.outbox)| == 1))))))
{
}

lemma OutboxQueuedInView(outbox: seq<QueuedSend>, operationId: string)
  ensures queuedIn(outbox, operationId) == (if 0 < |ProofLib.Filter((q: QueuedSend) => (q.operationId == operationId), outbox)| then
    ProofLib.Filter((q: QueuedSend) => (q.operationId == operationId), outbox)[0] else noQueued)
  ensures withoutQueued(outbox, operationId) == ProofLib.Filter((q: QueuedSend) => (q.operationId != operationId), outbox)
{
}

lemma OutboxCountsDistinct(xs: seq<QueuedSend>)
  requires forall q :: q in xs ==> |ProofLib.Filter((o: QueuedSend) => (o.operationId == q.operationId), xs)| == 1
  ensures ProofLib.DistinctBy(xs, (x: QueuedSend) => x.operationId)
{
  forall i, j | 0 <= i < |xs| && 0 <= j < |xs| && i != j
    ensures xs[i].operationId != xs[j].operationId
  {
    var q := xs[i];
    assert q in xs;
    if xs[j].operationId == q.operationId {
      ProofLib.FilterTwo((o: QueuedSend) => (o.operationId == q.operationId), xs, i, j);
    }
  }
}

lemma OutboxDistinctCount(xs: seq<QueuedSend>, q: QueuedSend)
  requires ProofLib.DistinctBy(xs, (x: QueuedSend) => x.operationId) && q in xs
  ensures |ProofLib.Filter((o: QueuedSend) => (o.operationId == q.operationId), xs)| == 1
{
  var i :| 0 <= i < |xs| && xs[i] == q;
  ProofLib.FilterOne((o: QueuedSend) => (o.operationId == q.operationId), xs, i);
}

lemma OutboxFound(xs: seq<QueuedSend>, operationId: string, found: QueuedSend)
  requires ProofLib.DistinctBy(xs, (x: QueuedSend) => x.operationId)
  requires found in xs && found.operationId == operationId
  ensures isQueued(xs, operationId) && queuedIn(xs, operationId) == found
{
  OutboxQueuedInView(xs, operationId);
  var i :| 0 <= i < |xs| && xs[i] == found;
  ProofLib.FilterOne((q: QueuedSend) => (q.operationId == operationId), xs, i);
  var first := ProofLib.Filter((q: QueuedSend) => (q.operationId == operationId), xs)[0];
  ProofLib.FilterMember((q: QueuedSend) => (q.operationId == operationId), xs, first);
  var j :| 0 <= j < |xs| && xs[j] == first;
  assert i == j;
}

lemma OutboxMissing(xs: seq<QueuedSend>, operationId: string)
  requires !isQueued(xs, operationId)
  ensures queuedIn(xs, operationId) == noQueued
{
  OutboxQueuedInView(xs, operationId);
  ProofLib.FilterNone((q: QueuedSend) => (q.operationId == operationId), xs);
}

lemma OutboxFacts(m: Mailbox)
  requires alwaysQueuedSendsAreIssued(m)
  ensures ProofLib.DistinctBy(m.outbox, (x: QueuedSend) => x.operationId)
  ensures forall q :: q in m.outbox ==> q.operationId != "" && q.operationId in m.issuedSends && q.snapshot.content.to != "" &&
    q.snapshot.version >= 0 && (forall a :: a in q.snapshot.attachments ==> app__files_validFile(a)) &&
    (q.status.DispatchFailed? ==> q.evidence != "")
  ensures m.outboxSent >= 0
{
  OutboxIssuedView(m);
  OutboxCountsDistinct(m.outbox);
}

lemma OutboxValid(m: Mailbox)
  requires ProofLib.DistinctBy(m.outbox, (x: QueuedSend) => x.operationId)
  requires forall q :: q in m.outbox ==> q.operationId != "" && q.operationId in m.issuedSends && q.snapshot.content.to != "" &&
    q.snapshot.version >= 0 && (forall a :: a in q.snapshot.attachments ==> app__files_validFile(a)) &&
    (q.status.DispatchFailed? ==> q.evidence != "")
  requires m.outboxSent >= 0
  ensures alwaysQueuedSendsAreIssued(m)
{
  OutboxIssuedView(m);
  forall q | q in m.outbox
    ensures |ProofLib.Filter((o: QueuedSend) => (o.operationId == q.operationId), m.outbox)| == 1
  {
    OutboxDistinctCount(m.outbox, q);
  }
}

lemma OutboxGoesOnceView(before: Mailbox, after: Mailbox)
  requires ProofLib.DistinctBy(before.outbox, (x: QueuedSend) => x.operationId)
  requires ProofLib.DistinctBy(after.outbox, (x: QueuedSend) => x.operationId)
  requires forall q :: q in after.outbox && (q.status.Waiting? || q.status.Dispatching?) ==>
    (forall p :: p in before.outbox && p.operationId == q.operationId ==> (p.status.Waiting? || p.status == q.status))
  ensures stepQueuedSendGoesOnce(before, after)
{
  forall q | q in after.outbox
    ensures (!((queuedIn(after.outbox, q.operationId).status.Waiting? || queuedIn(after.outbox, q.operationId).status.Dispatching?)) || ((!(isQueued(before.outbox, q.operationId)) || queuedIn(before.outbox, q.operationId).status.Waiting?) || (queuedIn(before.outbox, q.operationId).status == queuedIn(after.outbox, q.operationId).status)))
  {
    OutboxFound(after.outbox, q.operationId, q);
    if isQueued(before.outbox, q.operationId) {
      var p :| p in before.outbox && p.operationId == q.operationId;
      OutboxFound(before.outbox, q.operationId, p);
    }
  }
}

lemma OutboxMapped(m: Mailbox, after: Mailbox)
  requires alwaysQueuedSendsAreIssued(m)
  requires |after.outbox| == |m.outbox| && after.outboxSent == m.outboxSent
  requires forall x :: x in m.issuedSends ==> x in after.issuedSends
  requires forall i :: 0 <= i < |m.outbox| ==> after.outbox[i].operationId == m.outbox[i].operationId &&
    after.outbox[i].snapshot == m.outbox[i].snapshot &&
    (after.outbox[i].status.DispatchFailed? ==> after.outbox[i].evidence != "") &&
    ((after.outbox[i].status.Waiting? || after.outbox[i].status.Dispatching?) ==> (m.outbox[i].status.Waiting? || m.outbox[i].status == after.outbox[i].status))
  ensures alwaysQueuedSendsAreIssued(after)
  ensures stepQueuedSendGoesOnce(m, after)
{
  OutboxFacts(m);
  forall i, j | 0 <= i < |after.outbox| && 0 <= j < |after.outbox| && i != j
    ensures after.outbox[i].operationId != after.outbox[j].operationId
  {
  }
  forall q | q in after.outbox
    ensures q.operationId != "" && q.operationId in after.issuedSends && q.snapshot.content.to != "" &&
      q.snapshot.version >= 0 && (forall a :: a in q.snapshot.attachments ==> app__files_validFile(a)) &&
      (q.status.DispatchFailed? ==> q.evidence != "")
  {
    var i :| 0 <= i < |after.outbox| && after.outbox[i] == q;
    assert m.outbox[i] in m.outbox;
  }
  OutboxValid(after);
  forall q | q in after.outbox && (q.status.Waiting? || q.status.Dispatching?)
    ensures forall p :: p in m.outbox && p.operationId == q.operationId ==> (p.status.Waiting? || p.status == q.status)
  {
    var i :| 0 <= i < |after.outbox| && after.outbox[i] == q;
    forall p | p in m.outbox && p.operationId == q.operationId
      ensures p.status.Waiting? || p.status == q.status
    {
      var j :| 0 <= j < |m.outbox| && m.outbox[j] == p;
      assert i == j;
    }
  }
  OutboxGoesOnceView(m, after);
}

lemma OutboxFenceShape(outbox: seq<QueuedSend>)
  ensures |fenceQueue(outbox)| == |outbox|
  ensures forall i :: 0 <= i < |outbox| ==> fenceQueue(outbox)[i] ==
    (if outbox[i].status.Dispatching? then outbox[i].(status := OutboxStatus.DispatchUnknown) else outbox[i])
{
}

lemma OutboxStatusShape(outbox: seq<QueuedSend>, operationId: string, queueStatus: OutboxStatus, evidence: string)
  ensures |withStatus(outbox, operationId, queueStatus, evidence)| == |outbox|
  ensures forall i :: 0 <= i < |outbox| ==> withStatus(outbox, operationId, queueStatus, evidence)[i] ==
    (if outbox[i].operationId == operationId then outbox[i].(status := queueStatus, evidence := evidence) else outbox[i])
{
}

lemma OutboxFenced(m: Mailbox, after: Mailbox)
  requires alwaysQueuedSendsAreIssued(m)
  requires after.outbox == fenceQueue(m.outbox) && after.outboxSent == m.outboxSent && after.issuedSends == m.issuedSends
  ensures alwaysQueuedSendsAreIssued(after)
  ensures stepQueuedSendGoesOnce(m, after)
{
  OutboxFacts(m);
  OutboxFenceShape(m.outbox);
  OutboxMapped(m, after);
}

lemma OutboxRestatus(m: Mailbox, operationId: string, queueStatus: OutboxStatus, evidence: string, after: Mailbox)
  requires alwaysQueuedSendsAreIssued(m)
  requires after.outbox == withStatus(m.outbox, operationId, queueStatus, evidence) && after.outboxSent == m.outboxSent && after.issuedSends == m.issuedSends
  requires queueStatus.DispatchFailed? ==> evidence != ""
  requires queueStatus.Waiting? ==> false
  requires queueStatus.Dispatching? ==> (isQueued(m.outbox, operationId) && queuedIn(m.outbox, operationId).status.Waiting?)
  ensures alwaysQueuedSendsAreIssued(after)
  ensures stepQueuedSendGoesOnce(m, after)
{
  OutboxFacts(m);
  OutboxStatusShape(m.outbox, operationId, queueStatus, evidence);
  forall i | 0 <= i < |m.outbox| && m.outbox[i].operationId == operationId && queueStatus.Dispatching?
    ensures m.outbox[i].status.Waiting?
  {
    assert m.outbox[i] in m.outbox;
    OutboxFound(m.outbox, operationId, m.outbox[i]);
  }
  OutboxMapped(m, after);
}

lemma OutboxRemoved(m: Mailbox, operationId: string, after: Mailbox)
  requires alwaysQueuedSendsAreIssued(m)
  requires after.outbox == withoutQueued(m.outbox, operationId) && after.outboxSent >= m.outboxSent
  requires forall x :: x in m.issuedSends ==> x in after.issuedSends
  ensures alwaysQueuedSendsAreIssued(after)
  ensures stepQueuedSendGoesOnce(m, after)
{
  OutboxFacts(m);
  OutboxQueuedInView(m.outbox, operationId);
  ProofLib.FilterKeepsDistinctBy((q: QueuedSend) => (q.operationId != operationId), m.outbox, (x: QueuedSend) => x.operationId);
  forall q | q in after.outbox
    ensures q in m.outbox
  {
    ProofLib.FilterMember((q: QueuedSend) => (q.operationId != operationId), m.outbox, q);
  }
  OutboxValid(after);
  forall q | q in after.outbox && (q.status.Waiting? || q.status.Dispatching?)
    ensures forall p :: p in m.outbox && p.operationId == q.operationId ==> (p.status.Waiting? || p.status == q.status)
  {
    forall p | p in m.outbox && p.operationId == q.operationId
      ensures p.status.Waiting? || p.status == q.status
    {
      var i :| 0 <= i < |m.outbox| && m.outbox[i] == p;
      var j :| 0 <= j < |m.outbox| && m.outbox[j] == q;
      assert i == j;
    }
  }
  OutboxGoesOnceView(m, after);
}

lemma OutboxAppended(m: Mailbox, entry: QueuedSend, after: Mailbox)
  requires alwaysQueuedSendsAreIssued(m)
  requires after.outbox == m.outbox + [entry] && after.outboxSent == m.outboxSent
  requires forall x :: x in m.issuedSends ==> x in after.issuedSends
  requires entry.operationId != "" && entry.operationId in after.issuedSends && !(entry.operationId in m.issuedSends)
  requires entry.snapshot.content.to != "" && entry.snapshot.version >= 0 && entry.status.Waiting?
  requires forall a :: a in entry.snapshot.attachments ==> app__files_validFile(a)
  ensures alwaysQueuedSendsAreIssued(after)
  ensures stepQueuedSendGoesOnce(m, after)
{
  OutboxFacts(m);
  ProofLib.DistinctByConcat(m.outbox, [entry], (x: QueuedSend) => x.operationId);
  OutboxValid(after);
  forall q | q in after.outbox && (q.status.Waiting? || q.status.Dispatching?)
    ensures forall p :: p in m.outbox && p.operationId == q.operationId ==> (p.status.Waiting? || p.status == q.status)
  {
    forall p | p in m.outbox && p.operationId == q.operationId
      ensures p.status.Waiting? || p.status == q.status
    {
      var i :| 0 <= i < |m.outbox| && m.outbox[i] == p;
      var j :| 0 <= j < |after.outbox| && after.outbox[j] == q;
      assert after.outbox[i] == p;
      assert i == j;
    }
  }
  OutboxGoesOnceView(m, after);
}
