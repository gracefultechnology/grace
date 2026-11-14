// Proofs for the owned workspace and its canonical payment registry.

lemma ComponentInvariants(w: Workspace)
  requires inv(w)
  ensures app__shell_inv(w.device)
  ensures app__browser_inv(w.browser)
  ensures app__assistant_inv(w.assistant)
  ensures app__conversation_inv(w.assistant.conversation)
  ensures app__execution_inv(w.execution)
  ensures app__payment_inv(w.payment)
  ensures app__preferences_inv(w.preferences)
  ensures app__wake_inv(w.wake)
{
}

lemma QuietComponents(w: Workspace)
  requires inv(w)
  ensures app__assistant_inv(quietAssistant(w.assistant))
  ensures app__execution_inv(quietExecution(w.execution))
  ensures app__payment_inv(quietPayment(w.payment))
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
  if app__payment_canStop(w.payment, app__payment_PaymentActor.BrowserHost) {
    app__payment_stop_ensures(w.payment, app__payment_PaymentActor.BrowserHost);
  } else if app__payment_canInvalidate(w.payment, app__payment_PaymentActor.BrowserHost) {
    app__payment_invalidate_ensures(w.payment, app__payment_PaymentActor.BrowserHost);
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
  ensures inv(w.(assistant := app__assistant_close(w.assistant, app__conversation_ConversationActor.ConversationUser)))
{
  ComponentInvariants(w);
  app__assistant_close_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
}

lemma openGrace_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPaymentRules(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPaymentRegistryIsCanonical(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPaymentAssociation(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPausedPaymentCannotSubmit(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysCurrentBeforeAction(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepInterruptionsKeepTask(w, "openGrace", openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "openGrace", openGrace(w, by_), []))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepEffectsRequireCurrentContext(w, openGrace(w, by_), []))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "openGrace", openGrace(w, by_)))
  ensures (inv(w) ==> canOpenGrace(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "openGrace", openGrace(w, by_)))
{
  if inv(w) && canOpenGrace(w, by_) {
    ComponentInvariants(w);
    app__assistant_open_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    AfterInteractionInvariant(app__assistant_open(w.assistant, app__conversation_ConversationActor.ConversationUser), w.browser.editingAddress, false, w);
  }
}

lemma closeGrace_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPaymentRules(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPaymentRegistryIsCanonical(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPaymentAssociation(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPausedPaymentCannotSubmit(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysCurrentBeforeAction(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepInterruptionsKeepTask(w, "closeGrace", closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "closeGrace", closeGrace(w, by_), []))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepEffectsRequireCurrentContext(w, closeGrace(w, by_), []))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "closeGrace", closeGrace(w, by_)))
  ensures (inv(w) ==> canCloseGrace(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "closeGrace", closeGrace(w, by_)))
{
  if inv(w) && canCloseGrace(w, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_close_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma talk_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPaymentRules(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPaymentRegistryIsCanonical(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPaymentAssociation(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPausedPaymentCannotSubmit(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysCurrentBeforeAction(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepInterruptionsKeepTask(w, "talk", talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "talk", talk(w, by_), []))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepEffectsRequireCurrentContext(w, talk(w, by_), []))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "talk", talk(w, by_)))
  ensures (inv(w) ==> canTalk(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "talk", talk(w, by_)))
{
  if inv(w) && canTalk(w, by_) {
    ComponentInvariants(w);
    app__assistant_talk_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    AfterInteractionInvariant(app__assistant_talk(w.assistant, app__conversation_ConversationActor.ConversationUser), w.assistant.keyboard != app__assistant_KeyboardOwner.NoKeyboard || w.browser.editingAddress, false, w);
  }
}

lemma purgePrivate_ensures(w: Workspace, token: int, messageIndex: int, purgeDraft: bool, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPaymentRules(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPaymentRegistryIsCanonical(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPaymentAssociation(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPausedPaymentCannotSubmit(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysCurrentBeforeAction(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPaymentUsesCanonicalIdentity(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> alwaysPaymentReviewUsesCurrentContext(purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepInterruptionsKeepTask(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepWakeNeverDispatchesWebsite(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_), []))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepEffectsRequireCurrentContext(w, purgePrivate(w, token, messageIndex, purgeDraft, by_), []))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepDepartureKeepsPaymentAttempt(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_)))
  ensures (inv(w) ==> canPurgePrivate(w, token, messageIndex, purgeDraft, by_) ==> stepPaymentSwitchRetainsRecords(w, "purgePrivate", purgePrivate(w, token, messageIndex, purgeDraft, by_)))
{
  if inv(w) && canPurgePrivate(w, token, messageIndex, purgeDraft, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_purgePrivate_ensures(w.assistant, token, messageIndex, purgeDraft, app__conversation_ConversationActor.ConversationRuntime);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
  }
}

lemma cancelWake_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPaymentRules(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPaymentRegistryIsCanonical(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPaymentAssociation(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPausedPaymentCannotSubmit(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysCurrentBeforeAction(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepInterruptionsKeepTask(w, "cancelWake", cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "cancelWake", cancelWake(w, by_), []))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepEffectsRequireCurrentContext(w, cancelWake(w, by_), []))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "cancelWake", cancelWake(w, by_)))
  ensures (inv(w) ==> canCancelWake(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "cancelWake", cancelWake(w, by_)))
{
  if inv(w) && canCancelWake(w, by_) {
    ComponentInvariants(w);
    InterruptedInvariant(w.device, w.browser, w);
  }
}

lemma changePreferences_ensures(w: Workspace, settings: app__preferences_DisplayPreferences, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPaymentRules(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPaymentRegistryIsCanonical(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPaymentAssociation(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPausedPaymentCannotSubmit(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysCurrentBeforeAction(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPaymentUsesCanonicalIdentity(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> alwaysPaymentReviewUsesCurrentContext(changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepInterruptionsKeepTask(w, "changePreferences", changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepWakeNeverDispatchesWebsite(w, "changePreferences", changePreferences(w, settings, by_), []))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepEffectsRequireCurrentContext(w, changePreferences(w, settings, by_), []))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepDepartureKeepsPaymentAttempt(w, "changePreferences", changePreferences(w, settings, by_)))
  ensures (inv(w) ==> canChangePreferences(w, settings, by_) ==> stepPaymentSwitchRetainsRecords(w, "changePreferences", changePreferences(w, settings, by_)))
{
  if inv(w) && canChangePreferences(w, settings, by_) {
    ComponentInvariants(w);
    app__preferences_preview_ensures(w.preferences, settings, app__preferences_PreferenceActor.PreferenceUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma savePreferences_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPaymentRules(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPaymentRegistryIsCanonical(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPaymentAssociation(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPausedPaymentCannotSubmit(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysCurrentBeforeAction(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepInterruptionsKeepTask(w, "savePreferences", savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "savePreferences", savePreferences(w, by_), []))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepEffectsRequireCurrentContext(w, savePreferences(w, by_), []))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "savePreferences", savePreferences(w, by_)))
  ensures (inv(w) ==> canSavePreferences(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "savePreferences", savePreferences(w, by_)))
{
  if inv(w) && canSavePreferences(w, by_) {
    ComponentInvariants(w);
    app__preferences_save_ensures(w.preferences, app__preferences_PreferenceActor.PreferenceUser);
  }
}

lemma preferencesSaved_ensures(w: Workspace, saveToken: int, succeeded: bool, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPaymentRules(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPaymentRegistryIsCanonical(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPaymentAssociation(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPausedPaymentCannotSubmit(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysCurrentBeforeAction(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPaymentUsesCanonicalIdentity(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> alwaysPaymentReviewUsesCurrentContext(preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepInterruptionsKeepTask(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepWakeNeverDispatchesWebsite(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_), []))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepEffectsRequireCurrentContext(w, preferencesSaved(w, saveToken, succeeded, by_), []))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepDepartureKeepsPaymentAttempt(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_)))
  ensures (inv(w) ==> canPreferencesSaved(w, saveToken, by_) ==> stepPaymentSwitchRetainsRecords(w, "preferencesSaved", preferencesSaved(w, saveToken, succeeded, by_)))
{
  if inv(w) && canPreferencesSaved(w, saveToken, by_) {
    ComponentInvariants(w);
    if succeeded { app__preferences_saved_ensures(w.preferences, saveToken, app__preferences_PreferenceActor.PreferenceStore); }
    else { app__preferences_saveFailed_ensures(w.preferences, saveToken, app__preferences_PreferenceActor.PreferenceStore); }
  }
}

lemma wakeNoSpeech_ensures(w: Workspace, timer: app__wake_WakeTimer, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPaymentRules(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPaymentRegistryIsCanonical(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPaymentAssociation(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPausedPaymentCannotSubmit(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysCurrentBeforeAction(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPaymentUsesCanonicalIdentity(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> alwaysPaymentReviewUsesCurrentContext(wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepInterruptionsKeepTask(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepWakeNeverDispatchesWebsite(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state, wakeNoSpeech(w, timer, by_).out))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepEffectsRequireCurrentContext(w, wakeNoSpeech(w, timer, by_).state, wakeNoSpeech(w, timer, by_).out))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepDepartureKeepsPaymentAttempt(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state))
  ensures (inv(w) ==> canWakeNoSpeech(w, timer, by_) ==> stepPaymentSwitchRetainsRecords(w, "wakeNoSpeech", wakeNoSpeech(w, timer, by_).state))
{
  if inv(w) && canWakeNoSpeech(w, timer, by_) {
    ComponentInvariants(w);
    app__wake_noSpeech_ensures(w.wake, timer, app__wake_WakeActor.WakeHost);
    app__conversation_wakeSilence_ensures(w.assistant.conversation, timer.conversationVersion, app__conversation_ConversationActor.ConversationRuntime);
  }
}

lemma wakeReturn_ensures(w: Workspace, timer: app__wake_WakeTimer, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPaymentRules(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPaymentRegistryIsCanonical(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPaymentAssociation(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPausedPaymentCannotSubmit(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysCurrentBeforeAction(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPaymentUsesCanonicalIdentity(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> alwaysPaymentReviewUsesCurrentContext(wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepInterruptionsKeepTask(w, "wakeReturn", wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepWakeNeverDispatchesWebsite(w, "wakeReturn", wakeReturn(w, timer, by_), []))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepEffectsRequireCurrentContext(w, wakeReturn(w, timer, by_), []))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepDepartureKeepsPaymentAttempt(w, "wakeReturn", wakeReturn(w, timer, by_)))
  ensures (inv(w) ==> canWakeReturn(w, timer, by_) ==> stepPaymentSwitchRetainsRecords(w, "wakeReturn", wakeReturn(w, timer, by_)))
{
  if inv(w) && canWakeReturn(w, timer, by_) {
    ComponentInvariants(w);
    app__wake_returnAfterSilence_ensures(w.wake, timer, app__wake_WakeActor.WakeHost);
    if w.wake.prior.WasClosed? { app__assistant_close_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser); }
    else { app__assistant_resize_ensures(w.assistant, w.wake.prior.WasExpanded?, app__conversation_ConversationActor.ConversationUser); }
  }
}

lemma stop_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPaymentRules(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPaymentRegistryIsCanonical(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPaymentAssociation(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPausedPaymentCannotSubmit(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysCurrentBeforeAction(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> stepInterruptionsKeepTask(w, "stop", stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "stop", stop(w, by_), []))
  ensures (inv(w) ==> canStop(w, by_) ==> stepEffectsRequireCurrentContext(w, stop(w, by_), []))
  ensures (inv(w) ==> canStop(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "stop", stop(w, by_)))
  ensures (inv(w) ==> canStop(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "stop", stop(w, by_)))
{
  if inv(w) && canStop(w, by_) {
    ComponentInvariants(w);
    InterruptedInvariant(w.device, w.browser, w);
  }
}

lemma RegistryFilterView(w: Workspace)
  ensures alwaysPaymentRegistryIsCanonical(w) == (forall p :: p in w.otherPayments ==>
    !p.stage.Empty? && !p.live && !p.fresh_ && !p.readBack &&
    (w.payment.stage.Empty? || p.key != w.payment.key) &&
    |ProofLib.Filter((other: app__payment_Payment) => (other.key == p.key), w.otherPayments)| == 1)
{
}

lemma RegistryDistinct(w: Workspace)
  requires alwaysPaymentRegistryIsCanonical(w)
  ensures ProofLib.DistinctBy(w.otherPayments, (p: app__payment_Payment) => p.key)
{
  RegistryFilterView(w);
  forall i, j | 0 <= i < |w.otherPayments| && 0 <= j < |w.otherPayments| && i != j
    ensures w.otherPayments[i].key != w.otherPayments[j].key
  {
    var p := w.otherPayments[i];
    assert p in w.otherPayments;
    assert |ProofLib.Filter((other: app__payment_Payment) => (other.key == p.key), w.otherPayments)| == 1;
    if w.otherPayments[j].key == p.key {
      ProofLib.FilterTwo((other: app__payment_Payment) => (other.key == p.key), w.otherPayments, i, j);
    }
  }
}

lemma RegistryFromDistinct(w: Workspace)
  requires ProofLib.DistinctBy(w.otherPayments, (p: app__payment_Payment) => p.key)
  requires forall p :: p in w.otherPayments ==> (!p.stage.Empty? && !p.live && !p.fresh_ && !p.readBack &&
    (w.payment.stage.Empty? || p.key != w.payment.key))
  ensures alwaysPaymentRegistryIsCanonical(w)
{
  RegistryFilterView(w);
  forall p | p in w.otherPayments
    ensures |ProofLib.Filter((other: app__payment_Payment) => (other.key == p.key), w.otherPayments)| == 1
  {
    var i :| 0 <= i < |w.otherPayments| && w.otherPayments[i] == p;
    ProofLib.FilterOne((other: app__payment_Payment) => (other.key == p.key), w.otherPayments, i);
  }
}

lemma RegistryStoredMember(key: app__payment_BillKey, records: seq<app__payment_Payment>)
  ensures storedPayment(key, records) == app__payment_initial ||
    (storedPayment(key, records) in records && storedPayment(key, records).key == key)
  ensures (forall p :: p in records ==> p.key != key) ==> storedPayment(key, records) == app__payment_initial
  decreases |records|
{
  if |records| > 0 {
    var prefix := records[..|records|-1];
    var last := records[|records|-1];
    RegistryStoredMember(key, prefix);
    ProofLib.FoldLeftAppend((found: app__payment_Payment, record: app__payment_Payment) => (if (record.key == key) then record else found), app__payment_initial, prefix, last);
    assert records == prefix + [last];
  }
}

lemma RegistryStoredExact(records: seq<app__payment_Payment>, p: app__payment_Payment)
  requires ProofLib.DistinctBy(records, (p: app__payment_Payment) => p.key)
  requires p in records
  ensures storedPayment(p.key, records) == p
  decreases |records|
{
  var prefix := records[..|records|-1];
  var last := records[|records|-1];
  ProofLib.FoldLeftAppend((found: app__payment_Payment, record: app__payment_Payment) => (if (record.key == p.key) then record else found), app__payment_initial, prefix, last);
  assert records == prefix + [last];
  if last.key == p.key {
    var i :| 0 <= i < |records| && records[i] == p;
    assert i == |records|-1;
  } else {
    RegistryStoredExact(prefix, p);
  }
}

lemma RegistryQuietPayment(p: app__payment_Payment)
  requires validPayment(p)
  ensures validPayment(quietPayment(p))
  ensures quietPayment(p).key == p.key && quietPayment(p).attempt == p.attempt &&
    quietPayment(p).durable == p.durable && quietPayment(p).result == p.result
  ensures !p.stage.Empty? ==> !quietPayment(p).stage.Empty? && !quietPayment(p).live && !quietPayment(p).fresh_ && !quietPayment(p).readBack
{
  assert app__payment_inv(p);
  if app__payment_canStop(p, app__payment_PaymentActor.BrowserHost) {
    app__payment_stop_ensures(p, app__payment_PaymentActor.BrowserHost);
  } else if app__payment_canInvalidate(p, app__payment_PaymentActor.BrowserHost) {
    app__payment_invalidate_ensures(p, app__payment_PaymentActor.BrowserHost);
  }
}

lemma RegistryBind(w: Workspace, key: app__payment_BillKey, by_: WorkspaceActor)
  requires alwaysPaymentRules(w) && alwaysPaymentRegistryIsCanonical(w)
  requires app__payment_validKey(key)
  ensures alwaysPaymentRules(bindPayment(w, key, by_))
  ensures alwaysPaymentRegistryIsCanonical(bindPayment(w, key, by_))
  ensures stepPaymentSwitchRetainsRecords(w, "bindPayment", bindPayment(w, key, by_))
  ensures bindPayment(w, key, by_).payment.key == key && !bindPayment(w, key, by_).payment.stage.Empty?
{
  RegistryDistinct(w);
  RegistryFilterView(w);
  RegistryStoredMember(key, w.otherPayments);
  RegistryQuietPayment(w.payment);
  var existing := if !w.payment.stage.Empty? && w.payment.key == key then w.payment else storedPayment(key, w.otherPayments);
  if existing.stage.Empty? {
    app__payment_initialHolds_ensures();
    app__payment_bind_ensures(app__payment_initial, key, app__payment_PaymentActor.Person);
  } else if app__payment_canResume(existing, app__payment_PaymentActor.Person) {
    assert app__payment_inv(existing);
    app__payment_resume_ensures(existing, app__payment_PaymentActor.Person);
  }
  var after := bindPayment(w, key, by_);
  var remaining := ProofLib.Filter((p: app__payment_Payment) => (p.key != key), w.otherPayments);
  assert after.otherPayments == (if !w.payment.stage.Empty? && w.payment.key != key then remaining + [quietPayment(w.payment)] else remaining);
  assert after.payment.key == key && !after.payment.stage.Empty?;
  ProofLib.FilterKeepsDistinctBy((p: app__payment_Payment) => (p.key != key), w.otherPayments, (p: app__payment_Payment) => p.key);
  ProofLib.FilterSubset((p: app__payment_Payment) => (p.key != key), w.otherPayments);
  forall p | p in remaining
    ensures p in w.otherPayments && p.key != key
  { ProofLib.FilterMember((p: app__payment_Payment) => (p.key != key), w.otherPayments, p); }
  if !w.payment.stage.Empty? && w.payment.key != key {
    ProofLib.DistinctByConcat(remaining, [quietPayment(w.payment)], (p: app__payment_Payment) => p.key);
  }
  RegistryFromDistinct(after);
  forall prior | prior in paymentRecords(w)
    ensures exists record :: (record in paymentRecords(after) && record.key == prior.key &&
      record.attempt == prior.attempt && record.durable == prior.durable && record.result == prior.result)
  {
    if prior.key == key {
      if prior in w.otherPayments {
        RegistryStoredExact(w.otherPayments, prior);
      }
      assert existing == prior;
      assert after.payment in paymentRecords(after);
    } else if prior in w.otherPayments {
      ProofLib.FilterMember((p: app__payment_Payment) => (p.key != key), w.otherPayments, prior);
      assert prior in paymentRecords(after);
    } else {
      assert prior == w.payment;
      assert quietPayment(prior) in paymentRecords(after);
    }
  }
}

lemma RegistrySave(w: Workspace, saveReport: SaveReport, by_: WorkspaceActor)
  requires alwaysPaymentRules(w) && alwaysPaymentRegistryIsCanonical(w)
  requires canSavePayment(w, saveReport, by_)
  ensures alwaysPaymentRules(savePayment(w, saveReport, by_))
  ensures alwaysPaymentRegistryIsCanonical(savePayment(w, saveReport, by_))
{
  RegistryDistinct(w);
  RegistryFilterView(w);
  var after := savePayment(w, saveReport, by_);
  if !w.payment.stage.Empty? && saveReport.key == w.payment.key {
    assert !w.payment.stage.Empty?;
    app__payment_saveOutcome_ensures(w.payment, saveReport.revision, saveReport.succeeded, app__payment_PaymentActor.DurableStore);
    RegistryQuietPayment(app__payment_saveOutcome(w.payment, saveReport.revision, saveReport.succeeded, app__payment_PaymentActor.DurableStore));
    assert after.payment.key == w.payment.key;
  } else {
    forall i | 0 <= i < |w.otherPayments|
      ensures validPayment(after.otherPayments[i])
      ensures after.otherPayments[i].key == w.otherPayments[i].key
      ensures !after.otherPayments[i].stage.Empty? && !after.otherPayments[i].live &&
        !after.otherPayments[i].fresh_ && !after.otherPayments[i].readBack
    {
      var p := w.otherPayments[i];
      assert p in w.otherPayments;
      if p.key == saveReport.key {
        RegistryStoredExact(w.otherPayments, p);
        assert app__payment_canSaveOutcome(p, saveReport.revision, app__payment_PaymentActor.DurableStore);
        app__payment_saveOutcome_ensures(p, saveReport.revision, saveReport.succeeded, app__payment_PaymentActor.DurableStore);
      }
    }
    assert ProofLib.DistinctBy(after.otherPayments, (p: app__payment_Payment) => p.key);
  }
  RegistryFromDistinct(after);
}

lemma RegistryRestart(w: Workspace, lifecycle: Lifecycle, by_: WorkspaceActor)
  requires alwaysPaymentRules(w) && alwaysPaymentRegistryIsCanonical(w)
  ensures alwaysPaymentRules(changeLifecycle(w, lifecycle, by_))
  ensures alwaysPaymentRegistryIsCanonical(changeLifecycle(w, lifecycle, by_))
{
  RegistryDistinct(w);
  RegistryFilterView(w);
  var after := changeLifecycle(w, lifecycle, by_);
  if lifecycle.RestartDevice? && app__payment_canRestart(w.payment, app__payment_PaymentActor.DurableStore) {
    app__payment_restart_ensures(w.payment, app__payment_PaymentActor.DurableStore);
    forall i | 0 <= i < |w.otherPayments|
      ensures validPayment(after.otherPayments[i])
      ensures after.otherPayments[i].key == w.otherPayments[i].key
      ensures !after.otherPayments[i].stage.Empty? && !after.otherPayments[i].live &&
        !after.otherPayments[i].fresh_ && !after.otherPayments[i].readBack
    {
      var p := w.otherPayments[i];
      assert p in w.otherPayments;
      app__payment_restart_ensures(p, app__payment_PaymentActor.DurableStore);
    }
    assert ProofLib.DistinctBy(after.otherPayments, (p: app__payment_Payment) => p.key);
  } else {
    RegistryQuietPayment(w.payment);
  }
  RegistryFromDistinct(after);
}

lemma newConversation_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPaymentRules(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPaymentRegistryIsCanonical(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPaymentAssociation(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPausedPaymentCannotSubmit(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysCurrentBeforeAction(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepInterruptionsKeepTask(w, "newConversation", newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "newConversation", newConversation(w, by_), []))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepEffectsRequireCurrentContext(w, newConversation(w, by_), []))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "newConversation", newConversation(w, by_)))
  ensures (inv(w) ==> canNewConversation(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "newConversation", newConversation(w, by_)))
{
  if inv(w) && canNewConversation(w, by_) {
    ComponentInvariants(w);
    app__assistant_newConversation_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma requestReplacement_ensures(w: Workspace, requestedTask: string, requestedGoal: string, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPaymentRules(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPaymentRegistryIsCanonical(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPaymentAssociation(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPausedPaymentCannotSubmit(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysCurrentBeforeAction(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPaymentUsesCanonicalIdentity(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> alwaysPaymentReviewUsesCurrentContext(requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepInterruptionsKeepTask(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepWakeNeverDispatchesWebsite(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_), []))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepEffectsRequireCurrentContext(w, requestReplacement(w, requestedTask, requestedGoal, by_), []))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepDepartureKeepsPaymentAttempt(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_)))
  ensures (inv(w) ==> canRequestReplacement(w, requestedTask, requestedGoal, by_) ==> stepPaymentSwitchRetainsRecords(w, "requestReplacement", requestReplacement(w, requestedTask, requestedGoal, by_)))
{
  if inv(w) && canRequestReplacement(w, requestedTask, requestedGoal, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__assistant_requestReplacement_ensures(w.assistant, requestedTask, requestedGoal, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma keepTask_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPaymentRules(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPaymentRegistryIsCanonical(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPaymentAssociation(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPausedPaymentCannotSubmit(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysCurrentBeforeAction(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepInterruptionsKeepTask(w, "keepTask", keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "keepTask", keepTask(w, by_), []))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepEffectsRequireCurrentContext(w, keepTask(w, by_), []))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "keepTask", keepTask(w, by_)))
  ensures (inv(w) ==> canKeepTask(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "keepTask", keepTask(w, by_)))
{
  if inv(w) && canKeepTask(w, by_) {
    ComponentInvariants(w);
    app__assistant_chooseReplacement_ensures(w.assistant, false, app__conversation_ConversationActor.ConversationUser);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma continueTask_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPaymentRules(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPaymentRegistryIsCanonical(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPaymentAssociation(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPausedPaymentCannotSubmit(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysCurrentBeforeAction(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepInterruptionsKeepTask(w, "continueTask", continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "continueTask", continueTask(w, by_), []))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepEffectsRequireCurrentContext(w, continueTask(w, by_), []))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "continueTask", continueTask(w, by_)))
  ensures (inv(w) ==> canContinueTask(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "continueTask", continueTask(w, by_)))
{
  if inv(w) && canContinueTask(w, by_) {
    ComponentInvariants(w);
    app__assistant_continueTask_ensures(w.assistant, app__conversation_ConversationActor.ConversationUser);
    app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    if app__payment_canInvalidate(w.payment, app__payment_PaymentActor.BrowserHost) {
      app__payment_invalidate_ensures(w.payment, app__payment_PaymentActor.BrowserHost);
    }
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma completeOrdinary_ensures(w: Workspace, completion: GoalCompletion, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPaymentRules(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPaymentRegistryIsCanonical(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPaymentAssociation(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPausedPaymentCannotSubmit(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysCurrentBeforeAction(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPaymentUsesCanonicalIdentity(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> alwaysPaymentReviewUsesCurrentContext(completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepInterruptionsKeepTask(w, "completeOrdinary", completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepWakeNeverDispatchesWebsite(w, "completeOrdinary", completeOrdinary(w, completion, by_), []))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepEffectsRequireCurrentContext(w, completeOrdinary(w, completion, by_), []))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepDepartureKeepsPaymentAttempt(w, "completeOrdinary", completeOrdinary(w, completion, by_)))
  ensures (inv(w) ==> canCompleteOrdinary(w, completion, by_) ==> stepPaymentSwitchRetainsRecords(w, "completeOrdinary", completeOrdinary(w, completion, by_)))
{
  if inv(w) && canCompleteOrdinary(w, completion, by_) {
    ComponentInvariants(w);
    app__execution_retire_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    app__assistant_finishTask_ensures(w.assistant, completion.task, completion.taskVersion, app__assistant_TaskOutcome.Completed, completion.evidence, app__conversation_ConversationActor.ConversationRuntime);
  }
}

lemma approveSpokenPayment_ensures(w: Workspace, paymentTokens: PaymentTokens, spoken: SpokenApproval, by_: WorkspaceActor)
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysOneTask(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPausedTogether(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysRecordingHasPermission(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysOperationHasVisibleTask(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysEvidenceVersionsAreNonnegative(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysWakeRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysActiveWakePausesWebsiteWork(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPreferencesRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysDeviceRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysBrowserRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysAssistantRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysExecutionRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPaymentRules(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPaymentRegistryIsCanonical(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPaymentAssociation(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPausedPaymentCannotSubmit(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysCurrentBeforeAction(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPaymentUsesCanonicalIdentity(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> alwaysPaymentReviewUsesCurrentContext(approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> stepInterruptionsKeepTask(w, "approveSpokenPayment", approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> stepWakeNeverDispatchesWebsite(w, "approveSpokenPayment", approveSpokenPayment(w, paymentTokens, spoken, by_), []))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> stepEffectsRequireCurrentContext(w, approveSpokenPayment(w, paymentTokens, spoken, by_), []))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> stepDepartureKeepsPaymentAttempt(w, "approveSpokenPayment", approveSpokenPayment(w, paymentTokens, spoken, by_)))
  ensures (inv(w) ==> canApproveSpokenPayment(w, paymentTokens, spoken, by_) ==> stepPaymentSwitchRetainsRecords(w, "approveSpokenPayment", approveSpokenPayment(w, paymentTokens, spoken, by_)))
{
  if inv(w) && canApproveSpokenPayment(w, paymentTokens, spoken, by_) {
    ComponentInvariants(w);
    app__assistant_hear_ensures(w.assistant, spoken.token, spoken.text, spoken.owner, app__conversation_ConversationActor.ConversationRuntime);
    app__payment_authorize_ensures(w.payment, paymentTokens.revision, spoken.correction, app__payment_PaymentActor.Person);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma interact_ensures(w: Workspace, input: app__interaction_Interaction, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPaymentRules(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPaymentRegistryIsCanonical(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPaymentAssociation(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPausedPaymentCannotSubmit(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysCurrentBeforeAction(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPaymentUsesCanonicalIdentity(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> alwaysPaymentReviewUsesCurrentContext(interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepInterruptionsKeepTask(w, "interact", interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepWakeNeverDispatchesWebsite(w, "interact", interact(w, input, by_), []))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepEffectsRequireCurrentContext(w, interact(w, input, by_), []))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepDepartureKeepsPaymentAttempt(w, "interact", interact(w, input, by_)))
  ensures (inv(w) ==> canInteract(w, input, by_) ==> stepPaymentSwitchRetainsRecords(w, "interact", interact(w, input, by_)))
{
  if inv(w) && canInteract(w, input, by_) {
    ComponentInvariants(w);
    var actor := if by_ == WorkspaceActor.Person then app__conversation_ConversationActor.ConversationUser else app__conversation_ConversationActor.ConversationRuntime;
    InteractionFrame(w.assistant, input, actor);
    AfterInteractionInvariant(app__interaction_interact(w.assistant, input, actor), app__interaction_changesGeometry(input), app__interaction_submitsContent(input), w);
  }
}

lemma bindPayment_ensures(w: Workspace, key: app__payment_BillKey, by_: WorkspaceActor)
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysOneTask(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPausedTogether(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysRecordingHasPermission(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysOperationHasVisibleTask(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysEvidenceVersionsAreNonnegative(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysWakeRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysActiveWakePausesWebsiteWork(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPreferencesRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysDeviceRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysBrowserRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysAssistantRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysExecutionRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPaymentRules(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPaymentRegistryIsCanonical(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPaymentAssociation(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPausedPaymentCannotSubmit(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysCurrentBeforeAction(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPaymentUsesCanonicalIdentity(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> alwaysPaymentReviewUsesCurrentContext(bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> stepInterruptionsKeepTask(w, "bindPayment", bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> stepWakeNeverDispatchesWebsite(w, "bindPayment", bindPayment(w, key, by_), []))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> stepEffectsRequireCurrentContext(w, bindPayment(w, key, by_), []))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> stepDepartureKeepsPaymentAttempt(w, "bindPayment", bindPayment(w, key, by_)))
  ensures (inv(w) ==> canBindPayment(w, key, by_) ==> stepPaymentSwitchRetainsRecords(w, "bindPayment", bindPayment(w, key, by_)))
{
  if inv(w) && canBindPayment(w, key, by_) {
    ComponentInvariants(w);
    RegistryBind(w, key, by_);
  }
}

lemma savePayment_ensures(w: Workspace, saveReport: SaveReport, by_: WorkspaceActor)
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysOneTask(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPausedTogether(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysRecordingHasPermission(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysOperationHasVisibleTask(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysEvidenceVersionsAreNonnegative(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysWakeRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysActiveWakePausesWebsiteWork(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPreferencesRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysDeviceRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysBrowserRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysAssistantRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysExecutionRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPaymentRules(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPaymentRegistryIsCanonical(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPaymentAssociation(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPausedPaymentCannotSubmit(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysCurrentBeforeAction(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPaymentUsesCanonicalIdentity(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> alwaysPaymentReviewUsesCurrentContext(savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> stepInterruptionsKeepTask(w, "savePayment", savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> stepWakeNeverDispatchesWebsite(w, "savePayment", savePayment(w, saveReport, by_), []))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> stepEffectsRequireCurrentContext(w, savePayment(w, saveReport, by_), []))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> stepDepartureKeepsPaymentAttempt(w, "savePayment", savePayment(w, saveReport, by_)))
  ensures (inv(w) ==> canSavePayment(w, saveReport, by_) ==> stepPaymentSwitchRetainsRecords(w, "savePayment", savePayment(w, saveReport, by_)))
{
  if inv(w) && canSavePayment(w, saveReport, by_) {
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
  assert app__payment_inv(w.payment);
  assert app__wake_inv(w.wake);
  if geometry || content {
    if app__execution_canInvalidate(w.execution, app__execution_ExecutionActor.BrowserBridge) {
      app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    }
    if app__payment_canInvalidate(w.payment, app__payment_PaymentActor.BrowserHost) {
      app__payment_invalidate_ensures(w.payment, app__payment_PaymentActor.BrowserHost);
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
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPaymentRules(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPaymentRegistryIsCanonical(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPaymentAssociation(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPausedPaymentCannotSubmit(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysCurrentBeforeAction(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPaymentUsesCanonicalIdentity(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> alwaysPaymentReviewUsesCurrentContext(begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepInterruptionsKeepTask(w, "begin", begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepWakeNeverDispatchesWebsite(w, "begin", begin(w, taskRequest, by_), []))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepEffectsRequireCurrentContext(w, begin(w, taskRequest, by_), []))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepDepartureKeepsPaymentAttempt(w, "begin", begin(w, taskRequest, by_)))
  ensures (inv(w) ==> canBegin(w, taskRequest, by_) ==> stepPaymentSwitchRetainsRecords(w, "begin", begin(w, taskRequest, by_)))
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
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPaymentRules(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPaymentRegistryIsCanonical(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPaymentAssociation(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPausedPaymentCannotSubmit(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysCurrentBeforeAction(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPaymentUsesCanonicalIdentity(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> alwaysPaymentReviewUsesCurrentContext(replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepInterruptionsKeepTask(w, "replaceTask", replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepWakeNeverDispatchesWebsite(w, "replaceTask", replaceTask(w, taskRequest, by_), []))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepEffectsRequireCurrentContext(w, replaceTask(w, taskRequest, by_), []))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepDepartureKeepsPaymentAttempt(w, "replaceTask", replaceTask(w, taskRequest, by_)))
  ensures (inv(w) ==> canReplaceTask(w, taskRequest, by_) ==> stepPaymentSwitchRetainsRecords(w, "replaceTask", replaceTask(w, taskRequest, by_)))
{
  if inv(w) && canReplaceTask(w, taskRequest, by_) {
    ComponentInvariants(w);
    QuietComponents(w);
    app__browser_navigate_ensures(w.browser, taskRequest.origin);
    app__assistant_chooseReplacement_ensures(w.assistant, true, app__conversation_ConversationActor.ConversationUser);
    app__execution_retire_ensures(w.execution, app__execution_ExecutionActor.User);
    var retired := app__execution_retire(w.execution, app__execution_ExecutionActor.User);
    app__execution_start_ensures(retired, taskRequest.owner, taskRequest.task, taskRequest.origin, app__execution_ExecutionActor.User);
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
  }
}

lemma closeBrowser_ensures(w: Workspace, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPaymentRules(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPaymentRegistryIsCanonical(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPaymentAssociation(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPausedPaymentCannotSubmit(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysCurrentBeforeAction(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPaymentUsesCanonicalIdentity(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> alwaysPaymentReviewUsesCurrentContext(closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepInterruptionsKeepTask(w, "closeBrowser", closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepWakeNeverDispatchesWebsite(w, "closeBrowser", closeBrowser(w, by_), []))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepEffectsRequireCurrentContext(w, closeBrowser(w, by_), []))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepDepartureKeepsPaymentAttempt(w, "closeBrowser", closeBrowser(w, by_)))
  ensures (inv(w) ==> canCloseBrowser(w, by_) ==> stepPaymentSwitchRetainsRecords(w, "closeBrowser", closeBrowser(w, by_)))
{
  if inv(w) && canCloseBrowser(w, by_) {
    ComponentInvariants(w);
    app__browser_closeBrowser_ensures(w.browser);
    app__shell_openSurface_ensures(w.device, app__shell_Surface.Home);
    InterruptedInvariant(app__shell_openSurface(w.device, app__shell_Surface.Home), app__browser_closeBrowser(w.browser), w);
  }
}

lemma unexpectedPage_ensures(w: Workspace, unexpected: UnexpectedNavigation, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPaymentRules(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPaymentRegistryIsCanonical(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPaymentAssociation(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPausedPaymentCannotSubmit(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysCurrentBeforeAction(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPaymentUsesCanonicalIdentity(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> alwaysPaymentReviewUsesCurrentContext(unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepInterruptionsKeepTask(w, "unexpectedPage", unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepWakeNeverDispatchesWebsite(w, "unexpectedPage", unexpectedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepEffectsRequireCurrentContext(w, unexpectedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepDepartureKeepsPaymentAttempt(w, "unexpectedPage", unexpectedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnexpectedPage(w, unexpected, by_) ==> stepPaymentSwitchRetainsRecords(w, "unexpectedPage", unexpectedPage(w, unexpected, by_)))
{
  if inv(w) && canUnexpectedPage(w, unexpected, by_) {
    ComponentInvariants(w);
    app__browser_pageMoved_ensures(w.browser, unexpected.destination);
    InterruptedInvariant(w.device, app__browser_pageMoved(w.browser, unexpected.destination), w);
  }
}

// A background tab's move keeps the selected page and the revision (the browser's law), and website work needs the selected page in view.
lemma unwatchedPage_ensures(w: Workspace, unexpected: UnexpectedNavigation, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPaymentRules(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPaymentRegistryIsCanonical(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPaymentAssociation(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPausedPaymentCannotSubmit(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysCurrentBeforeAction(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPaymentUsesCanonicalIdentity(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> alwaysPaymentReviewUsesCurrentContext(unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepInterruptionsKeepTask(w, "unwatchedPage", unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepWakeNeverDispatchesWebsite(w, "unwatchedPage", unwatchedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepEffectsRequireCurrentContext(w, unwatchedPage(w, unexpected, by_), []))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepDepartureKeepsPaymentAttempt(w, "unwatchedPage", unwatchedPage(w, unexpected, by_)))
  ensures (inv(w) ==> canUnwatchedPage(w, unexpected, by_) ==> stepPaymentSwitchRetainsRecords(w, "unwatchedPage", unwatchedPage(w, unexpected, by_)))
{
  if inv(w) && canUnwatchedPage(w, unexpected, by_) {
    ComponentInvariants(w);
    app__browser_tabMoved_ensures(w.browser, unexpected.id, unexpected.destination);
    app__browser_lawABackgroundTabMovingKeepsTheSelectedPage_ensures(w.browser, unexpected.id, unexpected.destination);
  }
}

lemma receiveLoad_ensures(w: Workspace, loadReport: LoadReport, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPaymentRules(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPaymentRegistryIsCanonical(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPaymentAssociation(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPausedPaymentCannotSubmit(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysCurrentBeforeAction(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPaymentUsesCanonicalIdentity(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> alwaysPaymentReviewUsesCurrentContext(receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepInterruptionsKeepTask(w, "receiveLoad", receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepWakeNeverDispatchesWebsite(w, "receiveLoad", receiveLoad(w, loadReport, by_), []))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepEffectsRequireCurrentContext(w, receiveLoad(w, loadReport, by_), []))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepDepartureKeepsPaymentAttempt(w, "receiveLoad", receiveLoad(w, loadReport, by_)))
  ensures (inv(w) ==> canReceiveLoad(w, loadReport, by_) ==> stepPaymentSwitchRetainsRecords(w, "receiveLoad", receiveLoad(w, loadReport, by_)))
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
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPaymentRules(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPaymentRegistryIsCanonical(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPaymentAssociation(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPausedPaymentCannotSubmit(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysCurrentBeforeAction(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPaymentUsesCanonicalIdentity(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> alwaysPaymentReviewUsesCurrentContext(receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepInterruptionsKeepTask(w, "receiveProgress", receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepWakeNeverDispatchesWebsite(w, "receiveProgress", receiveProgress(w, progress, by_), []))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepEffectsRequireCurrentContext(w, receiveProgress(w, progress, by_), []))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepDepartureKeepsPaymentAttempt(w, "receiveProgress", receiveProgress(w, progress, by_)))
  ensures (inv(w) ==> canReceiveProgress(w, progress, by_) ==> stepPaymentSwitchRetainsRecords(w, "receiveProgress", receiveProgress(w, progress, by_)))
{
  if inv(w) && canReceiveProgress(w, progress, by_) {
    ComponentInvariants(w);
    if progress.destination == "" {
      app__browser_pageChanged_ensures(w.browser);
    } else {
      app__browser_pageMoved_ensures(w.browser, progress.destination);
    }
    app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
    if app__payment_canInvalidate(w.payment, app__payment_PaymentActor.BrowserHost) {
      app__payment_invalidate_ensures(w.payment, app__payment_PaymentActor.BrowserHost);
    }
    if progress.kind == ProgressKind.OrdinaryProgress {
      app__assistant_receiveStep_ensures(w.assistant, w.assistant.taskId, progress.taskVersion, w.assistant.operation, "Inspect the updated page", false, app__conversation_ConversationActor.ConversationRuntime);
    }
  }
}

lemma changePage_ensures(w: Workspace, browserInput: app__browserControls_BrowserInput, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPaymentRules(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPaymentRegistryIsCanonical(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPaymentAssociation(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPausedPaymentCannotSubmit(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysCurrentBeforeAction(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPaymentUsesCanonicalIdentity(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> alwaysPaymentReviewUsesCurrentContext(changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepInterruptionsKeepTask(w, "changePage", changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepWakeNeverDispatchesWebsite(w, "changePage", changePage(w, browserInput, by_), []))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepEffectsRequireCurrentContext(w, changePage(w, browserInput, by_), []))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepDepartureKeepsPaymentAttempt(w, "changePage", changePage(w, browserInput, by_)))
  ensures (inv(w) ==> canChangePage(w, browserInput, by_) ==> stepPaymentSwitchRetainsRecords(w, "changePage", changePage(w, browserInput, by_)))
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
  app__payment_initialHolds_ensures();
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

lemma changeLifecycle_ensures(w: Workspace, lifecycle: Lifecycle, by_: WorkspaceActor)
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
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPaymentRules(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPaymentRegistryIsCanonical(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPaymentAssociation(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPausedPaymentCannotSubmit(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysCurrentBeforeAction(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPaymentUsesCanonicalIdentity(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> alwaysPaymentReviewUsesCurrentContext(changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepInterruptionsKeepTask(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepWakeNeverDispatchesWebsite(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_), []))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepEffectsRequireCurrentContext(w, changeLifecycle(w, lifecycle, by_), []))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepDepartureKeepsPaymentAttempt(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_)))
  ensures (inv(w) ==> canChangeLifecycle(w, lifecycle, by_) ==> stepPaymentSwitchRetainsRecords(w, "changeLifecycle", changeLifecycle(w, lifecycle, by_)))
{
if inv(w) && canChangeLifecycle(w, lifecycle, by_) {
  ComponentInvariants(w);
  match lifecycle {
    case StartupSucceeded => app__shell_finishStartup_ensures(w.device, true);
    case StartupFailed => app__shell_finishStartup_ensures(w.device, false);
    case RetryStartup => app__shell_retryStartup_ensures(w.device);
    case SleepDevice => app__shell_sleep_ensures(w.device);
    case WakeDevice => app__shell_wake_ensures(w.device);
    case RestartDevice => app__shell_restart_ensures(w.device);
  }
  var device := if lifecycle.StartupSucceeded? then app__shell_finishStartup(w.device, true)
    else if lifecycle.StartupFailed? then app__shell_finishStartup(w.device, false)
    else if lifecycle.RetryStartup? then app__shell_retryStartup(w.device)
    else if lifecycle.SleepDevice? then app__shell_sleep(w.device)
    else if lifecycle.WakeDevice? then app__shell_wake(w.device)
    else app__shell_restart(w.device);
  InterruptedInvariant(device, w.browser, w);
  var stopped := interrupted(device, w.browser, w);
  if (lifecycle.SleepDevice? || lifecycle.RestartDevice?) && app__assistant_isVisible(stopped.assistant) {
    CloseQuietWorkspace(stopped);
  }
  var hidden := if (lifecycle.SleepDevice? || lifecycle.RestartDevice?) && app__assistant_isVisible(stopped.assistant)
    then stopped.(assistant := app__assistant_close(stopped.assistant, app__conversation_ConversationActor.ConversationUser)) else stopped;
  assert inv(hidden);
  if lifecycle.RestartDevice? {
    app__preferences_restart_ensures(w.preferences, app__preferences_PreferenceActor.PreferenceStore);
    if app__payment_canRestart(w.payment, app__payment_PaymentActor.DurableStore) {
      app__payment_restart_ensures(w.payment, app__payment_PaymentActor.DurableStore);
    }
  }
  var restored := if lifecycle.RestartDevice?
    then hidden.(preferences := app__preferences_restart(w.preferences, app__preferences_PreferenceActor.PreferenceStore)) else hidden;
  assert inv(restored);
  RegistryRestart(w, lifecycle, by_);
}

}
