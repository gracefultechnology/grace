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
    if true {
      assert after.messageRefs == ProofLib.Filter((set_x: string) => !((set_x in [target.ref])), m.messageRefs);
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