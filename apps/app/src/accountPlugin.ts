// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"
import { Capacitor, type PluginListenerHandle, registerPlugin } from "@capacitor/core";

type AccountStatus = { kind: "signedIn"; voiceDisclosureScope: string } | { kind: "signedOut"; legacySignInNeedsCleanup?: true };

interface AccountPlugin {
  status(): Promise<AccountStatus>;
  beginSignIn(options?: { method: "browser" }): Promise<void>;
  signOut(): Promise<void>;
  cleanupLegacySignIn(): Promise<void>;
  passwordRecoveryStatus(): Promise<unknown>;
  showPasswordRecovery(): Promise<void>;
  dismissPasswordRecovery(): Promise<void>;
  manageAccount(): Promise<void>;
  openHostedView(options: { view: "email" | "calendar" }): Promise<void>;
  browserGuideLease(): Promise<unknown>;
  chooseBrowserLink(input: { lease: string; goal: string; candidates: readonly { id: string; label: string }[] }): Promise<unknown>;
  startSpeech(): Promise<unknown>;
  stopSpeech(input: { sessionId: string }): Promise<void>;
  addListener(event: "sessionChanged", listener: (status: AccountStatus) => void): Promise<PluginListenerHandle>;
}

export type AccountBridge = Pick<AccountPlugin, "status" | "beginSignIn" | "signOut" | "cleanupLegacySignIn" | "manageAccount" | "addListener">;

export const accountPlugin = Capacitor.isPluginAvailable("GraceAccount") ? registerPlugin<AccountPlugin>("GraceAccount") : undefined;

export interface ReminderPlugin {
  enableManagedReminders(): Promise<void>;
  managedDue(): Promise<unknown>;
  dismissManagedDue(input: { id: string }): Promise<unknown>;
  openManagedDue(input: { id: string }): Promise<void>;
  addListener(event: "managedDueChanged", listener: () => void): Promise<PluginListenerHandle>;
}

export const reminderPlugin = Capacitor.isPluginAvailable("GraceReminders")
  ? registerPlugin<ReminderPlugin>("GraceReminders") : undefined;
