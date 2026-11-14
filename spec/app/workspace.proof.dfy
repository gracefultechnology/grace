// spec/app/workspace.md, "The workspace contains the actual device, page, conversation and operation"
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
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
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
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeUser);
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


// spec/app/workspace.md, "The active bill is bound to the observed owner and origin once"
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
    app__interaction_lawInteractionPreservesAssistant_ensures(w.assistant, input, actor);
    if app__interaction_submitsContent(input) || app__interaction_changesGeometry(input) {
      if app__execution_canInvalidate(w.execution, app__execution_ExecutionActor.BrowserBridge) {
        app__execution_invalidate_ensures(w.execution, app__execution_ExecutionActor.BrowserBridge);
      }
      if app__payment_canInvalidate(w.payment, app__payment_PaymentActor.BrowserHost) {
        app__payment_invalidate_ensures(w.payment, app__payment_PaymentActor.BrowserHost);
      }
    }
    app__wake_cancel_ensures(w.wake, app__wake_WakeActor.WakeHost);
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
