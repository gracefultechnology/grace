lemma ComponentInvariants(w: Workspace)
  requires inv(w)
  ensures app__shell_inv(w.device)
  ensures app__browser_inv(w.browser)
  ensures app__assistant_inv(w.assistant)
  ensures app__conversation_inv(w.assistant.conversation)
  ensures app__execution_inv(w.execution)
  ensures app__commitment_inv(w.commitment)
  ensures app__preferences_inv(w.preferences)
  ensures app__wake_inv(w.wake)
{
}

lemma QuietComponents(w: Workspace)
  requires inv(w)
  ensures app__assistant_inv(quietAssistant(w.assistant))
  ensures app__execution_inv(quietExecution(w.execution))
  ensures app__commitment_inv(quietCommitment(w.commitment))
{
  ComponentInvariants(w);
  if app__assistant_unfinished(w.assistant) {
    app__assistant_pause_ensures(w.assistant, app__conversation_ConversationActor.ConversationRuntime);
  } else if app__assistant_canQuiet(w.assistant, app__conversation_ConversationActor.ConversationRuntime) {
    app__assistant_quiet_ensures(w.assistant, app__conversation_ConversationActor.ConversationRuntime);
  }
  if app__execution_canPause(w.execution, app__execution_ExecutionActor.BrowserBridge) {
    app__execution_pause_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
  }
  if app__commitment_canStop(w.commitment, app__task_TaskActor.Host) {
    app__commitment_stop_ensures(w.commitment, app__task_TaskActor.Host);
  } else if app__commitment_canInvalidate(w.commitment, app__task_TaskActor.Host) {
    app__commitment_invalidate_ensures(w.commitment, app__task_TaskActor.Host);
  }
}

lemma InterruptedInvariant(device: app__shell_Shell, browser: app__browser_Browser, w: Workspace)
  requires inv(w)
  requires app__shell_inv(device)
  requires app__browser_inv(browser)
  ensures inv(interrupted(device, browser, w))
{
  QuietComponents(w);
  app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
  var leaves := device.surface != w.device.surface || !device.readiness.Ready?;
  var quiet := quietAssistant(w.assistant);
  if leaves && browser.editingAddress { app__browser_dismissAddress_ensures(browser); }
  if leaves && app__assistant_canDismissKeyboard(quiet, app__conversation_ConversationActor.ConversationUser) {
    app__assistant_dismissKeyboard_ensures(quiet, app__conversation_ConversationActor.ConversationUser);
  }
}

lemma KeyboardInvariant(w: Workspace, keyboard: app__assistant_KeyboardOwner)
  requires inv(w)
  ensures inv(w.(assistant := w.assistant.(keyboard := keyboard)))
{
}

lemma CloseQuietWorkspace(w: Workspace)
  requires inv(w)
  requires w.execution.phase == app__execution_OperationPhase.Idle || w.execution.phase == app__execution_OperationPhase.Paused
  requires app__assistant_isVisible(w.assistant)
  requires !app__assistant_unfinished(w.assistant) || w.assistant.activity.Paused?
  ensures inv(w.(assistant := app__assistant_close(w.assistant, app__conversation_ConversationActor.ConversationUser)))
{
  ComponentInvariants(w);
  app__assistant_close_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
  var closed := app__assistant_close(w.assistant, app__conversation_ConversationActor.ConversationUser);
  assert closed.activity == w.assistant.activity;
}

lemma openGrace_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCommitmentAssociation(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPausedCommitmentCannotSubmit(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysOneTask(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPausedTogether(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysRecordingHasPermission(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysOperationHasVisibleTask(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysWakeRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysActiveWakePausesWebsiteWork(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPreferencesRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysDeviceRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysBrowserRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysAssistantRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysExecutionRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCommitmentRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCommitmentRegistryIsCanonical(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCurrentBeforeAction(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepInterruptionsKeepTask(w, "openGrace", openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "openGrace", openGrace(w, by_), []))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepEffectsRequireCurrentContext(w, openGrace(w, by_), []))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "openGrace", openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "openGrace", openGrace(w, by_)))
{
  if inv(w) && canOpenGrace(w, by_) {
    ComponentInvariants(w);
    app__assistant_open_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    AfterInteractionInvariant(app__assistant_open(w.assistant, app__conversation_ConversationActor.ConversationUser), w.browser.editingAddress, false, w);
  }
}

lemma closeGrace_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCommitmentAssociation(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPausedCommitmentCannotSubmit(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysOneTask(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPausedTogether(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysRecordingHasPermission(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysOperationHasVisibleTask(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysWakeRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysActiveWakePausesWebsiteWork(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPreferencesRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysDeviceRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysBrowserRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysAssistantRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysExecutionRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCommitmentRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCommitmentRegistryIsCanonical(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCurrentBeforeAction(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepInterruptionsKeepTask(w, "closeGrace", closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "closeGrace", closeGrace(w, by_), []))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepEffectsRequireCurrentContext(w, closeGrace(w, by_), []))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "closeGrace", closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "closeGrace", closeGrace(w, by_)))
{
  if inv(w) && canCloseGrace(w, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_close_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma talk_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCommitmentAssociation(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPausedCommitmentCannotSubmit(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysOneTask(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPausedTogether(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysRecordingHasPermission(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysOperationHasVisibleTask(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysWakeRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysActiveWakePausesWebsiteWork(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPreferencesRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysDeviceRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysBrowserRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysAssistantRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysExecutionRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCommitmentRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCommitmentRegistryIsCanonical(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCurrentBeforeAction(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepInterruptionsKeepTask(w, "talk", talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "talk", talk(w, by_), []))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepEffectsRequireCurrentContext(w, talk(w, by_), []))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "talk", talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "talk", talk(w, by_)))
{
  if inv(w) && canTalk(w, by_) {
    ComponentInvariants(w);
    app__assistant_talk_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    AfterInteractionInvariant(app__assistant_talk(w.assistant, app__conversation_ConversationActor.ConversationUser), w.assistant.keyboard != app__assistant_KeyboardOwner.NoKeyboard || w.browser.editingAddress, false, w);
  }
}

lemma purgePrivate_ensures(w: Workspace, token: int, messageIndex: int, purgeDraft: bool, by_: WorkspaceActor)
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCommitmentAssociation(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPausedCommitmentCannotSubmit(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysOneTask(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPausedTogether(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysRecordingHasPermission(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysOperationHasVisibleTask(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysEvidenceVersionsAreNonnegative(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysWakeRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysActiveWakePausesWebsiteWork(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPreferencesRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysDeviceRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysBrowserRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysAssistantRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysExecutionRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCommitmentRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCommitmentRegistryIsCanonical(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCommitmentUsesCanonicalIdentity(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCurrentBeforeAction(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCommitmentReviewUsesCurrentContext(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepInterruptionsKeepTask(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepWakeNeverDispatchesWebsite(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_), []))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepEffectsRequireCurrentContext(w, purgePrivate(w, token, messageIndex, purgeDraft, by_), []))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepCommitmentSwitchRetainsRecords(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_)))
{
  if inv(w) && canPurgePrivate(w, token, messageIndex, purgeDraft, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_purgePrivate_ensures(w.assistant, token, messageIndex, purgeDraft, app__conversation_ConversationActor.ConversationRuntime);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
  }
}

lemma cancelWake_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCommitmentAssociation(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPausedCommitmentCannotSubmit(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysOneTask(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPausedTogether(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysRecordingHasPermission(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysOperationHasVisibleTask(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysWakeRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysActiveWakePausesWebsiteWork(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPreferencesRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysDeviceRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysBrowserRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysAssistantRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysExecutionRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCommitmentRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCommitmentRegistryIsCanonical(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCurrentBeforeAction(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepInterruptionsKeepTask(w, "cancelWake", cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "cancelWake", cancelWake(w, by_), []))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepEffectsRequireCurrentContext(w, cancelWake(w, by_), []))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "cancelWake", cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "cancelWake", cancelWake(w, by_)))
{
  if inv(w) && canCancelWake(w, by_) {
    ComponentInvariants(w);
    InterruptedInvariant(w.device, w.browser, w);
  }
}

lemma changePreferences_ensures(w: Workspace, settings: app__preferences_DisplayPreferences, by_: WorkspaceActor)
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCommitmentAssociation(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPausedCommitmentCannotSubmit(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysOneTask(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPausedTogether(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysRecordingHasPermission(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysOperationHasVisibleTask(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysEvidenceVersionsAreNonnegative(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysWakeRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysActiveWakePausesWebsiteWork(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPreferencesRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysDeviceRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysBrowserRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysAssistantRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysExecutionRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCommitmentRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCommitmentRegistryIsCanonical(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCommitmentUsesCanonicalIdentity(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCurrentBeforeAction(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCommitmentReviewUsesCurrentContext(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepInterruptionsKeepTask(w, "changePreferences", changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepWakeNeverDispatchesWebsite(w, "changePreferences", changePreferences(w, settings, by_), []))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepEffectsRequireCurrentContext(w, changePreferences(w, settings, by_), []))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "changePreferences", changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepCommitmentSwitchRetainsRecords(w, "changePreferences", changePreferences(w, settings, by_)))
{
  if inv(w) && canChangePreferences(w, settings, by_) {
    ComponentInvariants(w);
    app__preferences_preview_ensures(w.preferences, settings, app__preferences_PreferenceActor.PreferenceUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma savePreferences_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCommitmentAssociation(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPausedCommitmentCannotSubmit(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysOneTask(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPausedTogether(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysRecordingHasPermission(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysOperationHasVisibleTask(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysWakeRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysActiveWakePausesWebsiteWork(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPreferencesRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysDeviceRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysBrowserRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysAssistantRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysExecutionRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCommitmentRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCommitmentRegistryIsCanonical(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCurrentBeforeAction(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepInterruptionsKeepTask(w, "savePreferences", savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "savePreferences", savePreferences(w, by_), []))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepEffectsRequireCurrentContext(w, savePreferences(w, by_), []))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "savePreferences", savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "savePreferences", savePreferences(w, by_)))
{
  if inv(w) && canSavePreferences(w, by_) {
    ComponentInvariants(w);
    app__preferences_save_ensures(w.preferences, app__preferences_PreferenceActor.PreferenceUser);
  }
}

lemma preferencesSaved_ensures(w: Workspace, saveToken: int, succeeded: bool, by_: WorkspaceActor)
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCommitmentAssociation(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPausedCommitmentCannotSubmit(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysOneTask(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPausedTogether(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysRecordingHasPermission(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysOperationHasVisibleTask(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysEvidenceVersionsAreNonnegative(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysWakeRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysActiveWakePausesWebsiteWork(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPreferencesRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysDeviceRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysBrowserRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysAssistantRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysExecutionRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCommitmentRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCommitmentRegistryIsCanonical(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCommitmentUsesCanonicalIdentity(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCurrentBeforeAction(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCommitmentReviewUsesCurrentContext(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepInterruptionsKeepTask(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepWakeNeverDispatchesWebsite(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_), []))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepEffectsRequireCurrentContext(w, preferencesSaved(w, saveToken, succeeded, by_), []))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepCommitmentSwitchRetainsRecords(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_)))
{
  if inv(w) && canPreferencesSaved(w, saveToken, by_) {
    ComponentInvariants(w);
    if succeeded { app__preferences_saved_ensures(w.preferences, saveToken, app__preferences_PreferenceActor.PreferenceStore); }
    else { app__preferences_saveFailed_ensures(w.preferences, saveToken, app__preferences_PreferenceActor.PreferenceStore); }
  }
}

lemma wakeNoSpeech_ensures(w: Workspace, timer: app__wake_WakeTimer, by_: WorkspaceActor)
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCommitmentAssociation(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPausedCommitmentCannotSubmit(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysOneTask(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPausedTogether(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysRecordingHasPermission(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysOperationHasVisibleTask(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysEvidenceVersionsAreNonnegative(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysWakeRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysActiveWakePausesWebsiteWork(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPreferencesRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysDeviceRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysBrowserRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysAssistantRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysExecutionRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCommitmentRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCommitmentRegistryIsCanonical(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCommitmentUsesCanonicalIdentity(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCurrentBeforeAction(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCommitmentReviewUsesCurrentContext(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepInterruptionsKeepTask(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepWakeNeverDispatchesWebsite(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state, wakeNoSpeech(w, timer, by_).out))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepEffectsRequireCurrentContext(w, wakeNoSpeech(w, timer, by_).state, wakeNoSpeech(w, timer, by_).out))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepCommitmentSwitchRetainsRecords(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state))
{
  if inv(w) && canWakeNoSpeech(w, timer, by_) {
    ComponentInvariants(w);
    app__wake_noSpeech_ensures(w.wake, timer, app__wake_WakeActor.WakeHost);
    app__conversation_wakeSilence_ensures(w.assistant.conversation, timer.conversationVersion, app__conversation_ConversationActor.ConversationRuntime);
  }
}

lemma wakeReturn_ensures(w: Workspace, timer: app__wake_WakeTimer, by_: WorkspaceActor)
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCommitmentAssociation(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPausedCommitmentCannotSubmit(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysOneTask(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPausedTogether(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysRecordingHasPermission(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysOperationHasVisibleTask(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysEvidenceVersionsAreNonnegative(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysWakeRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysActiveWakePausesWebsiteWork(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPreferencesRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysDeviceRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysBrowserRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysAssistantRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysExecutionRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCommitmentRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCommitmentRegistryIsCanonical(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCommitmentUsesCanonicalIdentity(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCurrentBeforeAction(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCommitmentReviewUsesCurrentContext(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepInterruptionsKeepTask(w, "wakeReturn", wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepWakeNeverDispatchesWebsite(w, "wakeReturn", wakeReturn(w, timer, by_), []))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepEffectsRequireCurrentContext(w, wakeReturn(w, timer, by_), []))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "wakeReturn", wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepCommitmentSwitchRetainsRecords(w, "wakeReturn", wakeReturn(w, timer, by_)))
{
  if inv(w) && canWakeReturn(w, timer, by_) {
    ComponentInvariants(w);
    app__wake_returnAfterSilence_ensures(w.wake, timer, app__wake_WakeActor.WakeHost);
    if w.wake.prior.WasClosed? {
      QuietComponents(w);
      app__assistant_close_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    } else {
      app__assistant_resize_ensures(w.assistant, w.wake.prior.WasExpanded?, app__conversation_ConversationActor.ConversationUser);
    }
  }
}

lemma stop_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCommitmentAssociation(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPausedCommitmentCannotSubmit(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysOneTask(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPausedTogether(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysRecordingHasPermission(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysOperationHasVisibleTask(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysWakeRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysActiveWakePausesWebsiteWork(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPreferencesRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysDeviceRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysBrowserRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysAssistantRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysExecutionRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCommitmentRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCommitmentRegistryIsCanonical(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCurrentBeforeAction(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> stepInterruptionsKeepTask(w, "stop", stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "stop", stop(w, by_), []))
  ensures (inv(w) ==> canStop(w, by_) ==> stepEffectsRequireCurrentContext(w, stop(w, by_), []))
  ensures (inv(w) ==> canStop(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "stop", stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "stop", stop(w, by_)))
{
  if inv(w) && canStop(w, by_) {
    ComponentInvariants(w);
    InterruptedInvariant(w.device, w.browser, w);
  }
}

lemma RegistryFilterView(w: Workspace)
  ensures alwaysCommitmentRegistryIsCanonical(w) == (forall p :: p in w.otherCommitments ==>
    !p.stage.Empty? && !p.live && !p.fresh_ && !p.readBack &&
    (w.commitment.stage.Empty? || p.key != w.commitment.key) &&
    |ProofLib.Filter((other: app__commitment_Commitment) => (other.key == p.key), w.otherCommitments)| == 1)
{
}

lemma RegistryDistinct(w: Workspace)
  requires alwaysCommitmentRegistryIsCanonical(w)
  ensures ProofLib.DistinctBy(w.otherCommitments, (p: app__commitment_Commitment) => p.key)
{
  RegistryFilterView(w);
  forall i, j | 0 <= i < |w.otherCommitments| && 0 <= j < |w.otherCommitments| && i != j
    ensures w.otherCommitments[i].key != w.otherCommitments[j].key
  {
    var p := w.otherCommitments[i];
    assert p in w.otherCommitments;
    assert |ProofLib.Filter((other: app__commitment_Commitment) => (other.key == p.key), w.otherCommitments)| == 1;
    if w.otherCommitments[j].key == p.key {
      ProofLib.FilterTwo((other: app__commitment_Commitment) => (other.key == p.key), w.otherCommitments, i, j);
    }
  }
}

lemma RegistryFromDistinct(w: Workspace)
  requires ProofLib.DistinctBy(w.otherCommitments, (p: app__commitment_Commitment) => p.key)
  requires forall p :: p in w.otherCommitments ==> (!p.stage.Empty? && !p.live && !p.fresh_ && !p.readBack &&
    (w.commitment.stage.Empty? || p.key != w.commitment.key))
  ensures alwaysCommitmentRegistryIsCanonical(w)
{
  RegistryFilterView(w);
  forall p | p in w.otherCommitments
    ensures |ProofLib.Filter((other: app__commitment_Commitment) => (other.key == p.key), w.otherCommitments)| == 1
  {
    var i :| 0 <= i < |w.otherCommitments| && w.otherCommitments[i] == p;
    ProofLib.FilterOne((other: app__commitment_Commitment) => (other.key == p.key), w.otherCommitments, i);
  }
}

lemma RegistryStoredMember(key: app__task_Subject, records: seq<app__commitment_Commitment>)
  ensures storedCommitment(key, records) == app__commitment_initial ||
    (storedCommitment(key, records) in records && storedCommitment(key, records).key == key)
  ensures (forall p :: p in records ==> p.key != key) ==> storedCommitment(key, records) == app__commitment_initial
  decreases |records|
{
  if |records| > 0 {
    var prefix := records[..|records|-1];
    var last := records[|records|-1];
    RegistryStoredMember(key, prefix);
    ProofLib.FoldLeftAppend((found: app__commitment_Commitment, record: app__commitment_Commitment) => (if (record.key == key) then record else found), app__commitment_initial, prefix, last);
    assert records == prefix + [last];
  }
}

lemma RegistryStoredExact(records: seq<app__commitment_Commitment>, p: app__commitment_Commitment)
  requires ProofLib.DistinctBy(records, (p: app__commitment_Commitment) => p.key)
  requires p in records
  ensures storedCommitment(p.key, records) == p
  decreases |records|
{
  var prefix := records[..|records|-1];
  var last := records[|records|-1];
  ProofLib.FoldLeftAppend((found: app__commitment_Commitment, record: app__commitment_Commitment) => (if (record.key == p.key) then record else found), app__commitment_initial, prefix, last);
  assert records == prefix + [last];
  if last.key == p.key {
    var i :| 0 <= i < |records| && records[i] == p;
    assert i == |records|-1;
  } else {
    RegistryStoredExact(prefix, p);
  }
}

lemma RegistryQuietCommitment(p: app__commitment_Commitment)
  requires app__commitment_validCommitment(p)
  ensures app__commitment_validCommitment(quietCommitment(p))
  ensures quietCommitment(p).key == p.key && quietCommitment(p).attempt == p.attempt &&
    quietCommitment(p).durable == p.durable && quietCommitment(p).result == p.result
  ensures !p.stage.Empty? ==> !quietCommitment(p).stage.Empty? && !quietCommitment(p).live && !quietCommitment(p).fresh_ && !quietCommitment(p).readBack
{
  assert app__commitment_inv(p);
  if app__commitment_canStop(p, app__task_TaskActor.Host) {
    app__commitment_stop_ensures(p, app__task_TaskActor.Host);
  } else if app__commitment_canInvalidate(p, app__task_TaskActor.Host) {
    app__commitment_invalidate_ensures(p, app__task_TaskActor.Host);
  }
}

lemma RegistryBind(w: Workspace, key: app__task_Subject, by_: WorkspaceActor)
  requires alwaysCommitmentRules(w) && alwaysCommitmentRegistryIsCanonical(w)
  requires app__task_validKey(key)
  ensures alwaysCommitmentRules(bindCommitment(w, key, by_))
  ensures alwaysCommitmentRegistryIsCanonical(bindCommitment(w, key, by_))
  ensures stepCommitmentSwitchRetainsRecords(w, "bindCommitment", bindCommitment(w, key, by_))
  ensures bindCommitment(w, key, by_).commitment.key == key && !bindCommitment(w, key, by_).commitment.stage.Empty?
{
  RegistryDistinct(w);
  RegistryFilterView(w);
  RegistryStoredMember(key, w.otherCommitments);
  RegistryQuietCommitment(w.commitment);
  var existing := if !w.commitment.stage.Empty? && w.commitment.key == key then w.commitment else storedCommitment(key, w.otherCommitments);
  if existing.stage.Empty? {
    app__commitment_initialHolds_ensures();
    app__commitment_bind_ensures(app__commitment_initial, key, app__task_TaskActor.Person);
  } else if app__commitment_canResume(existing, app__task_TaskActor.Person) {
    assert app__commitment_inv(existing);
    app__commitment_resume_ensures(existing, app__task_TaskActor.Person);
  }
  var after := bindCommitment(w, key, by_);
  var remaining := ProofLib.Filter((p: app__commitment_Commitment) => (p.key != key), w.otherCommitments);
  assert after.otherCommitments == (if !w.commitment.stage.Empty? && w.commitment.key != key then remaining + [quietCommitment(w.commitment)] else remaining);
  assert after.commitment.key == key && !after.commitment.stage.Empty?;
  ProofLib.FilterKeepsDistinctBy((p: app__commitment_Commitment) => (p.key != key), w.otherCommitments, (p: app__commitment_Commitment) => p.key);
  ProofLib.FilterSubset((p: app__commitment_Commitment) => (p.key != key), w.otherCommitments);
  forall p | p in remaining
    ensures p in w.otherCommitments && p.key != key
  { ProofLib.FilterMember((p: app__commitment_Commitment) => (p.key != key), w.otherCommitments, p); }
  if !w.commitment.stage.Empty? && w.commitment.key != key {
    ProofLib.DistinctByConcat(remaining, [quietCommitment(w.commitment)], (p: app__commitment_Commitment) => p.key);
  }
  RegistryFromDistinct(after);
  forall prior | prior in commitmentRecords(w)
    ensures exists record :: (record in commitmentRecords(after) && record.key == prior.key &&
      record.attempt == prior.attempt && record.durable == prior.durable && record.result == prior.result)
  {
    if prior.key == key {
      if prior in w.otherCommitments {
        RegistryStoredExact(w.otherCommitments, prior);
      }
      assert existing == prior;
      assert after.commitment in commitmentRecords(after);
    } else if prior in w.otherCommitments {
      ProofLib.FilterMember((p: app__commitment_Commitment) => (p.key != key), w.otherCommitments, prior);
      assert prior in commitmentRecords(after);
    } else {
      assert prior == w.commitment;
      assert quietCommitment(prior) in commitmentRecords(after);
    }
  }
}

lemma RegistrySave(w: Workspace, saveReport: SaveReport, by_: WorkspaceActor)
  requires alwaysCommitmentRules(w) && alwaysCommitmentRegistryIsCanonical(w)
  requires canSaveCommitment(w, saveReport, by_)
  ensures alwaysCommitmentRules(saveCommitment(w, saveReport, by_))
  ensures alwaysCommitmentRegistryIsCanonical(saveCommitment(w, saveReport, by_))
{
  RegistryDistinct(w);
  RegistryFilterView(w);
  var after := saveCommitment(w, saveReport, by_);
  if !w.commitment.stage.Empty? && saveReport.key == w.commitment.key {
    assert !w.commitment.stage.Empty?;
    app__commitment_saveOutcome_ensures(w.commitment, saveReport.revision, saveReport.succeeded, app__task_TaskActor.Store);
    RegistryQuietCommitment(app__commitment_saveOutcome(w.commitment, saveReport.revision, saveReport.succeeded, app__task_TaskActor.Store));
    assert after.commitment.key == w.commitment.key;
  } else {
    forall i | 0 <= i < |w.otherCommitments|
      ensures app__commitment_validCommitment(after.otherCommitments[i])
      ensures after.otherCommitments[i].key == w.otherCommitments[i].key
      ensures !after.otherCommitments[i].stage.Empty? && !after.otherCommitments[i].live &&
        !after.otherCommitments[i].fresh_ && !after.otherCommitments[i].readBack
    {
      var p := w.otherCommitments[i];
      assert p in w.otherCommitments;
      if p.key == saveReport.key {
        RegistryStoredExact(w.otherCommitments, p);
        assert app__commitment_canSaveOutcome(p, saveReport.revision, app__task_TaskActor.Store);
        app__commitment_saveOutcome_ensures(p, saveReport.revision, saveReport.succeeded, app__task_TaskActor.Store);
      }
    }
    assert ProofLib.DistinctBy(after.otherCommitments, (p: app__commitment_Commitment) => p.key);
  }
  RegistryFromDistinct(after);
}

lemma RegistryRestart(w: Workspace, lifecycle: Lifecycle, by_: WorkspaceActor)
  requires alwaysCommitmentRules(w) && alwaysCommitmentRegistryIsCanonical(w)
  ensures alwaysCommitmentRules(changeLifecycle(w, lifecycle, by_))
  ensures alwaysCommitmentRegistryIsCanonical(changeLifecycle(w, lifecycle, by_))
{
  RegistryDistinct(w);
  RegistryFilterView(w);
  var after := changeLifecycle(w, lifecycle, by_);
  if lifecycle.RestartDevice? {
    if app__commitment_canRestart(w.commitment, app__task_TaskActor.Store) {
      app__commitment_restart_ensures(w.commitment, app__task_TaskActor.Store);
    }
    forall i | 0 <= i < |w.otherCommitments|
      ensures app__commitment_validCommitment(after.otherCommitments[i])
      ensures after.otherCommitments[i].key == w.otherCommitments[i].key
      ensures !after.otherCommitments[i].stage.Empty? && !after.otherCommitments[i].live &&
        !after.otherCommitments[i].fresh_ && !after.otherCommitments[i].readBack
    {
      var p := w.otherCommitments[i];
      assert p in w.otherCommitments;
      app__commitment_restart_ensures(p, app__task_TaskActor.Store);
    }
    assert ProofLib.DistinctBy(after.otherCommitments, (p: app__commitment_Commitment) => p.key);
  } else {
    RegistryQuietCommitment(w.commitment);
  }
  RegistryFromDistinct(after);
}

lemma newConversation_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCommitmentAssociation(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPausedCommitmentCannotSubmit(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysOneTask(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPausedTogether(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysRecordingHasPermission(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysOperationHasVisibleTask(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysWakeRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysActiveWakePausesWebsiteWork(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPreferencesRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysDeviceRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysBrowserRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysAssistantRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysExecutionRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCommitmentRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCommitmentRegistryIsCanonical(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCurrentBeforeAction(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepInterruptionsKeepTask(w, "newConversation", newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "newConversation", newConversation(w, by_), []))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepEffectsRequireCurrentContext(w, newConversation(w, by_), []))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "newConversation", newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "newConversation", newConversation(w, by_)))
{
  if inv(w) && canNewConversation(w, by_) {
    ComponentInvariants(w);
    app__assistant_newConversation_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma requestReplacement_ensures(w: Workspace, requestedTask: string, requestedGoal: string, by_: WorkspaceActor)
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCommitmentAssociation(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPausedCommitmentCannotSubmit(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysOneTask(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPausedTogether(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysRecordingHasPermission(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysOperationHasVisibleTask(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysEvidenceVersionsAreNonnegative(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysWakeRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysActiveWakePausesWebsiteWork(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPreferencesRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysDeviceRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysBrowserRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysAssistantRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysExecutionRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCommitmentRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCommitmentRegistryIsCanonical(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCommitmentUsesCanonicalIdentity(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCurrentBeforeAction(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCommitmentReviewUsesCurrentContext(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepInterruptionsKeepTask(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepWakeNeverDispatchesWebsite(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_), []))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepEffectsRequireCurrentContext(w, requestReplacement(w, requestedTask, requestedGoal, by_), []))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepCommitmentSwitchRetainsRecords(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_)))
{
  if inv(w) && canRequestReplacement(w, requestedTask, requestedGoal, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_requestReplacement_ensures(w.assistant, requestedTask, requestedGoal, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma keepTask_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCommitmentAssociation(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPausedCommitmentCannotSubmit(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysOneTask(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPausedTogether(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysRecordingHasPermission(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysOperationHasVisibleTask(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysWakeRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysActiveWakePausesWebsiteWork(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPreferencesRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysDeviceRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysBrowserRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysAssistantRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysExecutionRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCommitmentRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCommitmentRegistryIsCanonical(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCurrentBeforeAction(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepInterruptionsKeepTask(w, "keepTask", keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "keepTask", keepTask(w, by_), []))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepEffectsRequireCurrentContext(w, keepTask(w, by_), []))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "keepTask", keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "keepTask", keepTask(w, by_)))
{
  if inv(w) && canKeepTask(w, by_) {
    ComponentInvariants(w);
    app__assistant_chooseReplacement_ensures(w.assistant, false, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma continueTask_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCommitmentAssociation(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPausedCommitmentCannotSubmit(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysOneTask(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPausedTogether(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysRecordingHasPermission(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysOperationHasVisibleTask(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysWakeRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysActiveWakePausesWebsiteWork(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPreferencesRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysDeviceRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysBrowserRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysAssistantRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysExecutionRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCommitmentRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCommitmentRegistryIsCanonical(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCurrentBeforeAction(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepInterruptionsKeepTask(w, "continueTask", continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "continueTask", continueTask(w, by_), []))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepEffectsRequireCurrentContext(w, continueTask(w, by_), []))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "continueTask", continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "continueTask", continueTask(w, by_)))
{
  if inv(w) && canContinueTask(w, by_) {
    ComponentInvariants(w);
    app__assistant_continueTask_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    if app__commitment_canInvalidate(w.commitment, app__task_TaskActor.Host) {
      app__commitment_invalidate_ensures(w.commitment, app__task_TaskActor.Host);
    }
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma completeOrdinary_ensures(w: Workspace, completion: GoalCompletion, by_: WorkspaceActor)
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCommitmentAssociation(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPausedCommitmentCannotSubmit(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysOneTask(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPausedTogether(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysRecordingHasPermission(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysOperationHasVisibleTask(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysEvidenceVersionsAreNonnegative(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysWakeRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysActiveWakePausesWebsiteWork(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPreferencesRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysDeviceRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysBrowserRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysAssistantRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysExecutionRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCommitmentRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCommitmentRegistryIsCanonical(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCommitmentUsesCanonicalIdentity(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCurrentBeforeAction(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCommitmentReviewUsesCurrentContext(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepInterruptionsKeepTask(w, "completeOrdinary", completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepWakeNeverDispatchesWebsite(w, "completeOrdinary", completeOrdinary(w, completion, by_), []))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepEffectsRequireCurrentContext(w, completeOrdinary(w, completion, by_), []))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "completeOrdinary", completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepCommitmentSwitchRetainsRecords(w, "completeOrdinary", completeOrdinary(w, completion, by_)))
{
  if inv(w) && canCompleteOrdinary(w, completion, by_) {
    ComponentInvariants(w);
    app__execution_retire_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    app__assistant_finishTask_ensures(w.assistant, completion.task, completion.taskVersion, app__assistant_TaskOutcome.Completed, completion.evidence, app__conversation_ConversationActor.ConversationRuntime);
  }
}

lemma approveSpokenCommitment_ensures(w: Workspace, commitmentTokens: CommitmentTokens, spoken: SpokenApproval, by_: WorkspaceActor)
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysCommitmentAssociation(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysPausedCommitmentCannotSubmit(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysOneTask(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysPausedTogether(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysRecordingHasPermission(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysOperationHasVisibleTask(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysEvidenceVersionsAreNonnegative(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysWakeRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysActiveWakePausesWebsiteWork(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysPreferencesRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysDeviceRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysBrowserRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysAssistantRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysExecutionRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysCommitmentRules(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysCommitmentRegistryIsCanonical(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysCommitmentUsesCanonicalIdentity(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysCurrentBeforeAction(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> alwaysCommitmentReviewUsesCurrentContext(approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> stepInterruptionsKeepTask(w, "approveSpokenCommitment", approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> stepWakeNeverDispatchesWebsite(w, "approveSpokenCommitment", approveSpokenCommitment(w, commitmentTokens, spoken, by_), []))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> stepEffectsRequireCurrentContext(w, approveSpokenCommitment(w, commitmentTokens, spoken, by_), []))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "approveSpokenCommitment", approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) ==> stepCommitmentSwitchRetainsRecords(w, "approveSpokenCommitment", approveSpokenCommitment(w, commitmentTokens, spoken, by_)))
{
  if inv(w) && canApproveSpokenCommitment(w, commitmentTokens, spoken, by_) {
    ComponentInvariants(w);
    app__conversation_hear_ensures(w.assistant.conversation, spoken.token, spoken.text, spoken.owner, app__conversation_ConversationActor.ConversationRuntime);
    app__commitment_authorize_ensures(w.commitment, commitmentTokens.revision, spoken.correction, app__task_TaskActor.Person);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma interact_ensures(w: Workspace, input: app__interaction_Interaction, by_: WorkspaceActor)
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCommitmentAssociation(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPausedCommitmentCannotSubmit(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysOneTask(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPausedTogether(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysRecordingHasPermission(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysOperationHasVisibleTask(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysEvidenceVersionsAreNonnegative(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysWakeRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysActiveWakePausesWebsiteWork(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPreferencesRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysDeviceRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysBrowserRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysAssistantRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysExecutionRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCommitmentRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCommitmentRegistryIsCanonical(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCommitmentUsesCanonicalIdentity(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCurrentBeforeAction(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCommitmentReviewUsesCurrentContext(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepInterruptionsKeepTask(w, "interact", interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepWakeNeverDispatchesWebsite(w, "interact", interact(w, input, by_), []))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepEffectsRequireCurrentContext(w, interact(w, input, by_), []))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "interact", interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepCommitmentSwitchRetainsRecords(w, "interact", interact(w, input, by_)))
{
  if inv(w) && canInteract(w, input, by_) {
    ComponentInvariants(w);
    var actor := if by_ == WorkspaceActor.Person then app__conversation_ConversationActor.ConversationUser else app__conversation_ConversationActor.ConversationRuntime;
    InteractionFrame(w.assistant, input, actor);
    AfterInteractionInvariant(app__interaction_interact(w.assistant, input, actor), app__interaction_changesGeometry(input), app__interaction_submitsContent(input), w);
  }
}

lemma bindCommitment_ensures(w: Workspace, key: app__task_Subject, by_: WorkspaceActor)
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysCommitmentAssociation(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysPausedCommitmentCannotSubmit(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysOneTask(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysPausedTogether(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysRecordingHasPermission(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysOperationHasVisibleTask(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysEvidenceVersionsAreNonnegative(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysWakeRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysActiveWakePausesWebsiteWork(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysPreferencesRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysDeviceRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysBrowserRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysAssistantRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysExecutionRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysCommitmentRules(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysCommitmentRegistryIsCanonical(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysCommitmentUsesCanonicalIdentity(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysCurrentBeforeAction(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> alwaysCommitmentReviewUsesCurrentContext(bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> stepInterruptionsKeepTask(w, "bindCommitment", bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> stepWakeNeverDispatchesWebsite(w, "bindCommitment", bindCommitment(w, key, by_), []))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> stepEffectsRequireCurrentContext(w, bindCommitment(w, key, by_), []))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "bindCommitment", bindCommitment(w, key, by_)))
  ensures (inv(w) ==> canBindCommitment(w, key, by_) ==> stepCommitmentSwitchRetainsRecords(w, "bindCommitment", bindCommitment(w, key, by_)))
{
  if inv(w) && canBindCommitment(w, key, by_) {
    ComponentInvariants(w);
    RegistryBind(w, key, by_);
  }
}

lemma saveCommitment_ensures(w: Workspace, saveReport: SaveReport, by_: WorkspaceActor)
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysCommitmentAssociation(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysPausedCommitmentCannotSubmit(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysOneTask(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysPausedTogether(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysRecordingHasPermission(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysOperationHasVisibleTask(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysEvidenceVersionsAreNonnegative(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysWakeRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysActiveWakePausesWebsiteWork(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysPreferencesRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysDeviceRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysBrowserRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysAssistantRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysExecutionRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysCommitmentRules(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysCommitmentRegistryIsCanonical(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysCommitmentUsesCanonicalIdentity(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysCurrentBeforeAction(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> alwaysCommitmentReviewUsesCurrentContext(saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> stepInterruptionsKeepTask(w, "saveCommitment", saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> stepWakeNeverDispatchesWebsite(w, "saveCommitment", saveCommitment(w, saveReport, by_), []))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> stepEffectsRequireCurrentContext(w, saveCommitment(w, saveReport, by_), []))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "saveCommitment", saveCommitment(w, saveReport, by_)))
  ensures (inv(w) ==> canSaveCommitment(w, saveReport, by_) ==> stepCommitmentSwitchRetainsRecords(w, "saveCommitment", saveCommitment(w, saveReport, by_)))
{
  if inv(w) && canSaveCommitment(w, saveReport, by_) {
    ComponentInvariants(w);
    RegistrySave(w, saveReport, by_);
  }
}

lemma AfterInteractionInvariant(changed: app__assistant_Assistant, geometry: bool, content: bool, w: Workspace)
  requires inv(w)
  requires app__assistant_inv(changed)
  requires changed.taskId == w.assistant.taskId
  requires app__assistant_unfinished(changed) == app__assistant_unfinished(w.assistant)
  requires changed.activity.Paused? == w.assistant.activity.Paused?
  requires !(geometry || content) ==> changed.activity.DoingWork? == w.assistant.activity.DoingWork?
  requires changed.conversation.voice ==> w.device.readiness.Ready? && w.device.microphoneAllowed && app__shell_mayRequestReasoning(w.device) && app__assistant_isVisible(changed)
  ensures inv(afterInteraction(changed, geometry, content, w))
{
  assert app__browser_inv(w.browser);
  assert app__execution_inv(w.execution);
  assert app__commitment_inv(w.commitment);
  assert app__wake_inv(w.wake);
  if geometry || content {
    if app__execution_canInvalidate(w.execution, app__execution_ExecutionActor.BrowserBridge) {
      app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    }
    if app__commitment_canInvalidate(w.commitment, app__task_TaskActor.Host) {
      app__commitment_invalidate_ensures(w.commitment, app__task_TaskActor.Host);
    }
  }
  if geometry && w.browser.editingAddress && !changed.keyboard.WebsiteKeyboard? {
    app__browser_dismissAddress_ensures(w.browser);
  }
  var browser := if geometry && w.browser.editingAddress && !changed.keyboard.WebsiteKeyboard? then app__browser_dismissAddress(w.browser) else w.browser;
  if geometry { app__browser_pageChanged_ensures(browser); }
  app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
  var after := afterInteraction(changed, geometry, content, w);
  assert app__assistant_inv(after.assistant);
}

lemma InteractionFrame(a: app__assistant_Assistant, input: app__interaction_Interaction, by_: app__conversation_ConversationActor)
  requires app__assistant_inv(a)
  requires app__interaction_canInteract(a, input, by_)
  ensures app__assistant_inv(app__interaction_interact(a, input, by_))
  ensures app__interaction_interact(a, input, by_).taskId == a.taskId
  ensures app__assistant_unfinished(app__interaction_interact(a, input, by_)) == app__assistant_unfinished(a)
  ensures app__interaction_interact(a, input, by_).activity.Paused? == a.activity.Paused?
  ensures !(app__interaction_changesGeometry(input) || app__interaction_submitsContent(input)) ==> app__interaction_interact(a, input, by_).activity.DoingWork? == a.activity.DoingWork?
  ensures app__interaction_interact(a, input, by_).conversation.voice ==> a.conversation.voice
{
  app__interaction_lawInteractionPreservesAssistant_ensures(a, input, by_);
  match input {
    case UnusableSpeech(token, owner) => assert a.conversation.voice;
    case _ => assert true;
  }
}

lemma begin_ensures(w: Workspace, taskRequest: TaskRequest, by_: WorkspaceActor)
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCommitmentAssociation(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPausedCommitmentCannotSubmit(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysOneTask(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPausedTogether(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysRecordingHasPermission(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysOperationHasVisibleTask(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysEvidenceVersionsAreNonnegative(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysWakeRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysActiveWakePausesWebsiteWork(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPreferencesRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysDeviceRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysBrowserRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysAssistantRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysExecutionRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCommitmentRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCommitmentRegistryIsCanonical(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCommitmentUsesCanonicalIdentity(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCurrentBeforeAction(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCommitmentReviewUsesCurrentContext(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepInterruptionsKeepTask(w, "begin", begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepWakeNeverDispatchesWebsite(w, "begin", begin(w, taskRequest, by_), []))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepEffectsRequireCurrentContext(w, begin(w, taskRequest, by_), []))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "begin", begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepCommitmentSwitchRetainsRecords(w, "begin", begin(w, taskRequest, by_)))
{
  if inv(w) && canBegin(w, taskRequest, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__browser_navigate_ensures(w.browser, taskRequest.origin);
    app__assistant_beginTask_ensures(w.assistant, taskRequest.task, taskRequest.goal, app__conversation_ConversationActor.ConversationUser);
    app__execution_start_ensures(w.execution, taskRequest.owner, taskRequest.task, taskRequest.origin, app__execution_ExecutionActor.User);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma replaceTask_ensures(w: Workspace, taskRequest: TaskRequest, by_: WorkspaceActor)
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCommitmentAssociation(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPausedCommitmentCannotSubmit(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysOneTask(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPausedTogether(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysRecordingHasPermission(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysOperationHasVisibleTask(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysEvidenceVersionsAreNonnegative(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysWakeRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysActiveWakePausesWebsiteWork(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPreferencesRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysDeviceRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysBrowserRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysAssistantRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysExecutionRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCommitmentRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCommitmentRegistryIsCanonical(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCommitmentUsesCanonicalIdentity(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCurrentBeforeAction(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCommitmentReviewUsesCurrentContext(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepInterruptionsKeepTask(w, "replaceTask", replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepWakeNeverDispatchesWebsite(w, "replaceTask", replaceTask(w, taskRequest, by_), []))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepEffectsRequireCurrentContext(w, replaceTask(w, taskRequest, by_), []))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "replaceTask", replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepCommitmentSwitchRetainsRecords(w, "replaceTask", replaceTask(w, taskRequest, by_)))
{
  if inv(w) && canReplaceTask(w, taskRequest, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__browser_navigate_ensures(w.browser, taskRequest.origin);
    app__assistant_chooseReplacement_ensures(w.assistant, true, app__conversation_ConversationActor.ConversationUser);
    if hasNext(w.plan) {
      app__execution_start_ensures(w.execution, taskRequest.owner, taskRequest.task, taskRequest.origin, app__execution_ExecutionActor.User);
    } else {
      app__execution_retire_ensures(w.execution, app__execution_ExecutionActor.User);
      var retired := app__execution_retire(w.execution, app__execution_ExecutionActor.User);
      app__execution_start_ensures(retired, taskRequest.owner, taskRequest.task, taskRequest.origin, app__execution_ExecutionActor.User);
    }
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma closeBrowser_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCommitmentAssociation(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPausedCommitmentCannotSubmit(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysOneTask(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPausedTogether(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysRecordingHasPermission(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysOperationHasVisibleTask(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysWakeRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysActiveWakePausesWebsiteWork(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPreferencesRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysDeviceRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysBrowserRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysAssistantRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysExecutionRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCommitmentRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCommitmentRegistryIsCanonical(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCurrentBeforeAction(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepInterruptionsKeepTask(w, "closeBrowser", closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "closeBrowser", closeBrowser(w, by_), []))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepEffectsRequireCurrentContext(w, closeBrowser(w, by_), []))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "closeBrowser", closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "closeBrowser", closeBrowser(w, by_)))
{
  if inv(w) && canCloseBrowser(w, by_) {
    ComponentInvariants(w);
    app__browser_closeBrowser_ensures(w.browser);
    app__shell_openSurface_ensures(w.device, app__shell_Surface.Home);
    InterruptedInvariant(app__shell_openSurface(w.device, app__shell_Surface.Home), app__browser_closeBrowser(w.browser), w);
  }
}

lemma unexpectedPage_ensures(w: Workspace, unexpected: UnexpectedNavigation, by_: WorkspaceActor)
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCommitmentAssociation(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPausedCommitmentCannotSubmit(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysOneTask(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPausedTogether(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysRecordingHasPermission(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysOperationHasVisibleTask(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysEvidenceVersionsAreNonnegative(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysWakeRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysActiveWakePausesWebsiteWork(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPreferencesRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysDeviceRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysBrowserRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysAssistantRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysExecutionRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCommitmentRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCommitmentRegistryIsCanonical(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCommitmentUsesCanonicalIdentity(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCurrentBeforeAction(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCommitmentReviewUsesCurrentContext(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepInterruptionsKeepTask(w, "unexpectedPage", unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepWakeNeverDispatchesWebsite(w, "unexpectedPage", unexpectedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepEffectsRequireCurrentContext(w, unexpectedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "unexpectedPage", unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepCommitmentSwitchRetainsRecords(w, "unexpectedPage", unexpectedPage(w, unexpected, by_)))
{
  if inv(w) && canUnexpectedPage(w, unexpected, by_) {
    ComponentInvariants(w);
    app__browser_pageMoved_ensures(w.browser, unexpected.destination);
    InterruptedInvariant(w.device, app__browser_pageMoved(w.browser, unexpected.destination), w);
  }
}

lemma unwatchedPage_ensures(w: Workspace, unexpected: UnexpectedNavigation, by_: WorkspaceActor)
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCommitmentAssociation(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPausedCommitmentCannotSubmit(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysOneTask(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPausedTogether(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysRecordingHasPermission(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysOperationHasVisibleTask(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysEvidenceVersionsAreNonnegative(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysWakeRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysActiveWakePausesWebsiteWork(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPreferencesRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysDeviceRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysBrowserRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysAssistantRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysExecutionRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCommitmentRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCommitmentRegistryIsCanonical(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCommitmentUsesCanonicalIdentity(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCurrentBeforeAction(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCommitmentReviewUsesCurrentContext(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepInterruptionsKeepTask(w, "unwatchedPage", unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepWakeNeverDispatchesWebsite(w, "unwatchedPage", unwatchedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepEffectsRequireCurrentContext(w, unwatchedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "unwatchedPage", unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepCommitmentSwitchRetainsRecords(w, "unwatchedPage", unwatchedPage(w, unexpected, by_)))
{
  if inv(w) && canUnwatchedPage(w, unexpected, by_) {
    ComponentInvariants(w);
    app__browser_tabMoved_ensures(w.browser, unexpected.id, unexpected.destination);
    app__browser_lawABackgroundTabMovingKeepsTheSelectedPage_ensures(w.browser, unexpected.id, unexpected.destination);
  }
}

lemma receiveLoad_ensures(w: Workspace, loadReport: LoadReport, by_: WorkspaceActor)
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCommitmentAssociation(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPausedCommitmentCannotSubmit(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysOneTask(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPausedTogether(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysRecordingHasPermission(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysOperationHasVisibleTask(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysEvidenceVersionsAreNonnegative(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysWakeRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysActiveWakePausesWebsiteWork(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPreferencesRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysDeviceRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysBrowserRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysAssistantRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysExecutionRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCommitmentRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCommitmentRegistryIsCanonical(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCommitmentUsesCanonicalIdentity(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCurrentBeforeAction(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCommitmentReviewUsesCurrentContext(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepInterruptionsKeepTask(w, "receiveLoad", receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepWakeNeverDispatchesWebsite(w, "receiveLoad", receiveLoad(w, loadReport, by_), []))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepEffectsRequireCurrentContext(w, receiveLoad(w, loadReport, by_), []))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "receiveLoad", receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepCommitmentSwitchRetainsRecords(w, "receiveLoad", receiveLoad(w, loadReport, by_)))
{
if inv(w) && canReceiveLoad(w, loadReport, by_) {
  ComponentInvariants(w);
  app__browser_finishLoad_ensures(w.browser, loadReport.id, loadReport.version, loadReport.result);
  var browser := app__browser_finishLoad(w.browser, loadReport.id, loadReport.version, loadReport.result);
  if loadReport.id == w.browser.selected && ((loadReport.result != app__browser_Load.Loaded && app__assistant_unfinished(w.assistant)) || w.execution.phase == app__execution_OperationPhase.Observed || w.execution.phase == app__execution_OperationPhase.Queued || w.execution.phase == app__execution_OperationPhase.InFlight) {
    InterruptedInvariant(w.device, browser, w);
  } else if loadReport.id != w.browser.selected {
    BackgroundLoadKeepsSelected(w.browser, loadReport.id, loadReport.version, loadReport.result);
  }
}
}

lemma receiveProgress_ensures(w: Workspace, progress: ProgressReport, by_: WorkspaceActor)
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCommitmentAssociation(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPausedCommitmentCannotSubmit(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysOneTask(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPausedTogether(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysRecordingHasPermission(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysOperationHasVisibleTask(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysEvidenceVersionsAreNonnegative(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysWakeRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysActiveWakePausesWebsiteWork(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPreferencesRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysDeviceRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysBrowserRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysAssistantRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysExecutionRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCommitmentRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCommitmentRegistryIsCanonical(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCommitmentUsesCanonicalIdentity(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCurrentBeforeAction(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCommitmentReviewUsesCurrentContext(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepInterruptionsKeepTask(w, "receiveProgress", receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepWakeNeverDispatchesWebsite(w, "receiveProgress", receiveProgress(w, progress, by_), []))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepEffectsRequireCurrentContext(w, receiveProgress(w, progress, by_), []))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "receiveProgress", receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepCommitmentSwitchRetainsRecords(w, "receiveProgress", receiveProgress(w, progress, by_)))
{
  if inv(w) && canReceiveProgress(w, progress, by_) {
    ComponentInvariants(w);
    if progress.destination == "" {
      app__browser_pageChanged_ensures(w.browser);
    } else {
      app__browser_pageMoved_ensures(w.browser, progress.destination);
    }
    app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    if app__commitment_canInvalidate(w.commitment, app__task_TaskActor.Host) {
      app__commitment_invalidate_ensures(w.commitment, app__task_TaskActor.Host);
    }
    if progress.kind == ProgressKind.OrdinaryProgress {
      app__assistant_receiveStep_ensures(w.assistant, w.assistant.taskId, progress.taskVersion, w.assistant.operation, "Inspect the updated page", false, app__conversation_ConversationActor.ConversationRuntime);
    }
  }
}

lemma changePage_ensures(w: Workspace, browserInput: app__browserControls_BrowserInput, by_: WorkspaceActor)
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCommitmentAssociation(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPausedCommitmentCannotSubmit(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysOneTask(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPausedTogether(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysRecordingHasPermission(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysOperationHasVisibleTask(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysEvidenceVersionsAreNonnegative(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysWakeRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysActiveWakePausesWebsiteWork(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPreferencesRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysDeviceRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysBrowserRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysAssistantRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysExecutionRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCommitmentRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCommitmentRegistryIsCanonical(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCommitmentUsesCanonicalIdentity(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCurrentBeforeAction(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCommitmentReviewUsesCurrentContext(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepInterruptionsKeepTask(w, "changePage", changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepWakeNeverDispatchesWebsite(w, "changePage", changePage(w, browserInput, by_), []))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepEffectsRequireCurrentContext(w, changePage(w, browserInput, by_), []))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "changePage", changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepCommitmentSwitchRetainsRecords(w, "changePage", changePage(w, browserInput, by_)))
{
if inv(w) && canChangePage(w, browserInput, by_) {
  ComponentInvariants(w);
  var actor := if by_ == WorkspaceActor.Person then app__browserControls_BrowserControlActor.BrowserControlUser else app__browserControls_BrowserControlActor.BrowserControlHost;
  app__browserControls_lawControlsPreserveBrowser_ensures(w.browser, browserInput, actor);
  app__browserControls_lawRecentEditsKeepPage_ensures(w.browser, browserInput, actor);
  var browser := app__browserControls_control(w.browser, browserInput, actor);
  if browser.revision != w.browser.revision {
    InterruptedInvariant(w.device, browser, w);
  } else {
    BrowserControlKeepsPage(w.browser, browserInput, actor);
  }
  var updated := if browser.revision != w.browser.revision then interrupted(w.device, browser, w) else w.(browser := browser, wake := app__wake_cancel(w.wake, app__wake_WakeActor.WakeHost));
  app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
  assert inv(updated);
  var keyboard := if browser.editingAddress && app__assistant_canFocusWebsite(updated.assistant, app__conversation_ConversationActor.ConversationUser)
    then app__assistant_KeyboardOwner.WebsiteKeyboard
    else if w.browser.editingAddress && !browser.editingAddress && updated.assistant.keyboard == app__assistant_KeyboardOwner.WebsiteKeyboard
    then app__assistant_KeyboardOwner.NoKeyboard else updated.assistant.keyboard;
  KeyboardInvariant(updated, keyboard);
  assert changePage(w, browserInput, by_) == updated.(assistant := updated.assistant.(keyboard := keyboard));
}
}

lemma initialHolds_ensures()
  ensures inv(initialHolds())
{
  app__shell_initialHolds_ensures();
  app__browser_initialHolds_ensures();
  app__assistant_initialHolds_ensures();
  app__conversation_initialHolds_ensures();
  app__execution_initialHolds_ensures();
  app__commitment_initialHolds_ensures();
  app__preferences_initialHolds_ensures();
  app__wake_initialHolds_ensures();
}

lemma BrowserLookupFilter(b: app__browser_Browser, id: int)
  ensures app__browser_tabById(b, id) == (var matches := ProofLib.Filter((t: app__browser_Tab) => (t.id == id), b.tabs); if |matches| > 0 then matches[|matches|-1] else app__browser_blankTab(0, 0))
{}
lemma BrowserKeysFilter(b: app__browser_Browser)
  ensures app__browser_alwaysTabIdentifiersAreUnique(b) == !(exists t :: t in b.tabs && !(|ProofLib.Filter((other: app__browser_Tab) => (other.id == t.id), b.tabs)| == 1))
{}
lemma BrowserLookupMember(b: app__browser_Browser, id: int, t: app__browser_Tab)
  requires app__browser_inv(b) && t in b.tabs && t.id == id
  ensures app__browser_tabById(b, id) == t
{
  BrowserLookupFilter(b, id);
  BrowserKeysFilter(b);
  var matches := ProofLib.Filter((t: app__browser_Tab) => (t.id == id), b.tabs);
  ProofLib.FilterMember((t: app__browser_Tab) => (t.id == id), b.tabs, t);
  assert |matches| == 1;
  assert matches[0] == t;
}
lemma BackgroundLoadKeepsSelected(b: app__browser_Browser, id: int, version: int, result: app__browser_Load)
  requires app__browser_inv(b) && app__browser_canFinishLoad(b, id, version, result)
  requires id != b.selected
  ensures app__browser_activeTab(app__browser_finishLoad(b, id, version, result)) == app__browser_activeTab(b)
  ensures app__browser_finishLoad(b, id, version, result).revision == b.revision
{
  app__browser_finishLoad_ensures(b, id, version, result);
  var t :| t in b.tabs && t.id == b.selected;
  var i :| 0 <= i < |b.tabs| && b.tabs[i] == t;
  var after := app__browser_finishLoad(b, id, version, result);
  assert after.tabs[i] == t;
  BrowserLookupMember(b, b.selected, t);
  BrowserLookupMember(after, after.selected, t);
}
lemma BrowserControlKeepsPage(b: app__browser_Browser, input: app__browserControls_BrowserInput, by_: app__browserControls_BrowserControlActor)
  requires app__browser_inv(b) && app__browserControls_canControl(b, input, by_)
  requires app__browserControls_control(b, input, by_).revision == b.revision
  ensures app__browserControls_control(b, input, by_).tabs == b.tabs
  ensures app__browserControls_control(b, input, by_).selected == b.selected
{
  match input {
    case EditAddress(text) => assert b.editingAddress;
    case ExplainEmptyAddress => assert true;
    case RemoveRecent(url) => assert true;
    case RequestClearHistory => assert true;
    case AnswerClearHistory(confirmed) => assert true;
    case _ => assert false;
  }
}

lemma RestartedAssistantInvariant(a: app__assistant_Assistant)
  requires app__assistant_inv(a)
  ensures app__assistant_inv(restartedAssistant(a))
{
  app__assistant_initialHolds_ensures();
  app__conversation_initialHolds_ensures();
}

lemma lawRestartKeepsCommitmentRecords_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (lawRestartKeepsCommitmentRecords(w, by_) == true)
{
  if canChangeLifecycle(w, Lifecycle.RestartDevice, by_) {
    var after := changeLifecycle(w, Lifecycle.RestartDevice, by_);
    assert |after.otherCommitments| == |w.otherCommitments|;
    forall prior | prior in w.otherCommitments
      ensures (exists restored :: restored in after.otherCommitments && sameDurableCommitmentRecord(prior, restored))
    {
      var i :| 0 <= i < |w.otherCommitments| && w.otherCommitments[i] == prior;
      var restored := after.otherCommitments[i];
      assert restored == app__commitment_restart(prior, app__task_TaskActor.Store);
      assert restored in after.otherCommitments;
      assert sameDurableCommitmentRecord(prior, restored);
    }
    forall restored | restored in after.otherCommitments
      ensures restored.result == restored.durable.result && !restored.live && !restored.fresh_
    {
      var i :| 0 <= i < |after.otherCommitments| && after.otherCommitments[i] == restored;
      assert restored == app__commitment_restart(w.otherCommitments[i], app__task_TaskActor.Store);
    }
  }
}

lemma changeLifecycle_ensures(w: Workspace, lifecycle: Lifecycle, by_: WorkspaceActor)
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCommitmentAssociation(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPausedCommitmentCannotSubmit(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysOneTask(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPausedTogether(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysRecordingHasPermission(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysOperationHasVisibleTask(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysEvidenceVersionsAreNonnegative(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysWakeRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysActiveWakePausesWebsiteWork(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPreferencesRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysDeviceRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysBrowserRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysAssistantRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysExecutionRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCommitmentRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCommitmentRegistryIsCanonical(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCommitmentUsesCanonicalIdentity(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCurrentBeforeAction(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCommitmentReviewUsesCurrentContext(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepInterruptionsKeepTask(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepWakeNeverDispatchesWebsite(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_), []))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepEffectsRequireCurrentContext(w, changeLifecycle(w, lifecycle, by_), []))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepCommitmentSwitchRetainsRecords(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_)))
{
  if inv(w) && canChangeLifecycle(w, lifecycle, by_) {
    ComponentInvariants(w);
    if lifecycle.RestartDevice? {
      app__shell_restart_ensures(w.device);
      app__browser_closeBrowser_ensures(w.browser);
      RestartedAssistantInvariant(w.assistant);
      if app__execution_canRetire(w.execution, app__execution_ExecutionActor.BrowserBridge) {
        app__execution_retire_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
      }
      app__preferences_restart_ensures(w.preferences, app__preferences_PreferenceActor.PreferenceStore);
      app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
      RegistryRestart(w, lifecycle, by_);
      if w.commitment.stage.Empty? && w.commitment.fresh_ {
        assert currentCommitmentContext(w);
        assert app__assistant_unfinished(w.assistant);
        assert w.assistant.taskId != "";
        assert w.commitmentTask != "";
        assert false;
      }
      var after := changeLifecycle(w, lifecycle, by_);
      assert inv(after);
    } else {
      match lifecycle {
        case StartupSucceeded => app__shell_finishStartup_ensures(w.device, true);
        case StartupFailed => app__shell_finishStartup_ensures(w.device, false);
        case RetryStartup => app__shell_retryStartup_ensures(w.device);
        case SleepDevice => app__shell_sleep_ensures(w.device);
        case WakeDevice => app__shell_wake_ensures(w.device);
        case RestartDevice => assert false;
      }
      var device := if lifecycle.StartupSucceeded? then app__shell_finishStartup(w.device, true)
        else if lifecycle.StartupFailed? then app__shell_finishStartup(w.device, false)
        else if lifecycle.RetryStartup? then app__shell_retryStartup(w.device)
        else if lifecycle.SleepDevice? then app__shell_sleep(w.device)
        else if lifecycle.WakeDevice? then app__shell_wake(w.device)
        else app__shell_restart(w.device);
      InterruptedInvariant(device, w.browser, w);
      var stopped := interrupted(device, w.browser, w);
      if lifecycle.SleepDevice? && app__assistant_isVisible(stopped.assistant) {
        assert !app__assistant_unfinished(stopped.assistant) || stopped.assistant.activity.Paused?;
        CloseQuietWorkspace(stopped);
      }
      var after := changeLifecycle(w, lifecycle, by_);
      assert inv(after);
    }
  }
}

lemma beginGuided_ensures(w: Workspace, request: GuidedRequest, by_: WorkspaceActor)
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysCommitmentAssociation(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysPausedCommitmentCannotSubmit(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysOneTask(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysPausedTogether(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysRecordingHasPermission(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysOperationHasVisibleTask(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysEvidenceVersionsAreNonnegative(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysWakeRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysActiveWakePausesWebsiteWork(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysPreferencesRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysDeviceRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysBrowserRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysAssistantRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysExecutionRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysCommitmentRules(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysCommitmentRegistryIsCanonical(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysCommitmentUsesCanonicalIdentity(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysCurrentBeforeAction(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> alwaysCommitmentReviewUsesCurrentContext(beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> stepInterruptionsKeepTask(w, "beginGuided", beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> stepWakeNeverDispatchesWebsite(w, "beginGuided", beginGuided(w, request, by_), []))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> stepEffectsRequireCurrentContext(w, beginGuided(w, request, by_), []))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "beginGuided", beginGuided(w, request, by_)))
  ensures (inv(w) ==> canBeginGuided(w, request, by_) ==> stepCommitmentSwitchRetainsRecords(w, "beginGuided", beginGuided(w, request, by_)))
{
  if inv(w) && canBeginGuided(w, request, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_beginTask_ensures(w.assistant, request.task, request.goal, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma GuidedReceiptPreserves(w: Workspace, report: GuidedObservation, by_: WorkspaceActor)
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysCommitmentAssociation(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysPausedCommitmentCannotSubmit(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysOneTask(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysPausedTogether(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysRecordingHasPermission(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysOperationHasVisibleTask(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysEvidenceVersionsAreNonnegative(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysWakeRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysActiveWakePausesWebsiteWork(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysPreferencesRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysDeviceRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysBrowserRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysAssistantRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysExecutionRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysCommitmentRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysCommitmentRegistryIsCanonical(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysCommitmentUsesCanonicalIdentity(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysCurrentBeforeAction(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> alwaysCommitmentReviewUsesCurrentContext(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> stepInterruptionsKeepTask(w, "confirmGuided", confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> stepWakeNeverDispatchesWebsite(w, "confirmGuided", confirmGuided(w, report, by_), []))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> stepEffectsRequireCurrentContext(w, confirmGuided(w, report, by_), []))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "confirmGuided", confirmGuided(w, report, by_)))
  ensures (inv(w) ==> guidedObservationCurrent(w, report, by_) ==> stepCommitmentSwitchRetainsRecords(w, "confirmGuided", confirmGuided(w, report, by_)))
{
  if inv(w) && guidedObservationCurrent(w, report, by_) {
    ComponentInvariants(w);
    var after := confirmGuided(w, report, by_);
    assert |after.plan.receipts| == |w.plan.receipts| + 1;
    if hasNext(after.plan) {
      assert nextOutcome(after.plan) in w.plan.steps;
      assert guidedDetails(nextOutcome(after.plan)).outcome != "";
    } else {
      app__assistant_finishTask_ensures(w.assistant, report.task, report.version, app__assistant_TaskOutcome.Completed, report.evidence, app__conversation_ConversationActor.ConversationRuntime);
    }
  }
}

lemma confirmGuided_ensures(w: Workspace, report: GuidedObservation, by_: WorkspaceActor)
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysCommitmentAssociation(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysPausedCommitmentCannotSubmit(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysOneTask(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysPausedTogether(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysRecordingHasPermission(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysOperationHasVisibleTask(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysEvidenceVersionsAreNonnegative(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysWakeRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysActiveWakePausesWebsiteWork(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysPreferencesRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysDeviceRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysBrowserRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysAssistantRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysExecutionRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysCommitmentRules(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysCommitmentRegistryIsCanonical(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysCommitmentUsesCanonicalIdentity(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysCurrentBeforeAction(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> alwaysCommitmentReviewUsesCurrentContext(confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> stepInterruptionsKeepTask(w, "confirmGuided", confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> stepWakeNeverDispatchesWebsite(w, "confirmGuided", confirmGuided(w, report, by_), []))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> stepEffectsRequireCurrentContext(w, confirmGuided(w, report, by_), []))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "confirmGuided", confirmGuided(w, report, by_)))
  ensures (inv(w) ==> canConfirmGuided(w, report, by_) ==> stepCommitmentSwitchRetainsRecords(w, "confirmGuided", confirmGuided(w, report, by_)))
{
  GuidedReceiptPreserves(w, report, by_);
}

lemma confirmGuidedNamedPage_ensures(w: Workspace, pageCheck: GuidedNamedPageCheck, by_: WorkspaceActor)
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysCommitmentAssociation(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysPausedCommitmentCannotSubmit(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysOneTask(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysPausedTogether(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysRecordingHasPermission(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysOperationHasVisibleTask(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysEvidenceVersionsAreNonnegative(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysWakeRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysActiveWakePausesWebsiteWork(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysPreferencesRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysDeviceRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysBrowserRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysAssistantRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysExecutionRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysCommitmentRules(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysCommitmentRegistryIsCanonical(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysCommitmentUsesCanonicalIdentity(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysCurrentBeforeAction(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> alwaysCommitmentReviewUsesCurrentContext(confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> stepInterruptionsKeepTask(w, "confirmGuidedNamedPage", confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> stepWakeNeverDispatchesWebsite(w, "confirmGuidedNamedPage", confirmGuidedNamedPage(w, pageCheck, by_), []))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> stepEffectsRequireCurrentContext(w, confirmGuidedNamedPage(w, pageCheck, by_), []))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "confirmGuidedNamedPage", confirmGuidedNamedPage(w, pageCheck, by_)))
  ensures (inv(w) ==> canConfirmGuidedNamedPage(w, pageCheck, by_) ==> stepCommitmentSwitchRetainsRecords(w, "confirmGuidedNamedPage", confirmGuidedNamedPage(w, pageCheck, by_)))
{
  GuidedReceiptPreserves(w, pageCheck.report, by_);
}

lemma resume_ensures(w: Workspace, by_: WorkspaceActor)
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysCommitmentAssociation(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysPausedCommitmentCannotSubmit(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysOneTask(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysPausedTogether(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysRecordingHasPermission(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysOperationHasVisibleTask(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysEvidenceVersionsAreNonnegative(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysWakeRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysActiveWakePausesWebsiteWork(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysPreferencesRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysDeviceRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysBrowserRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysAssistantRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysExecutionRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysCommitmentRules(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysCommitmentRegistryIsCanonical(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysCommitmentUsesCanonicalIdentity(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysCurrentBeforeAction(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> alwaysCommitmentReviewUsesCurrentContext(resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> stepInterruptionsKeepTask(w, "resume", resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "resume", resume(w, by_), []))
  ensures (inv(w) ==> canResume(w, by_) ==> stepEffectsRequireCurrentContext(w, resume(w, by_), []))
  ensures (inv(w) ==> canResume(w, by_) ==> stepDepartureKeepsCommitmentAttempt(w, "resume", resume(w, by_)))
  ensures (inv(w) ==> canResume(w, by_) ==> stepCommitmentSwitchRetainsRecords(w, "resume", resume(w, by_)))
{
  if inv(w) && canResume(w, by_) {
    ComponentInvariants(w);
    app__assistant_resume_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    if !hasNext(w.plan) {
      app__execution_resume_ensures(w.execution, app__execution_ExecutionActor.User);
      if app__commitment_canResume(w.commitment, app__task_TaskActor.Person) {
        app__commitment_resume_ensures(w.commitment, app__task_TaskActor.Person);
      }
    }
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}
