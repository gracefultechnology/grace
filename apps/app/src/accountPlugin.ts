// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"
import { Capacitor, type PluginListenerHandle, registerPlugin } from "@capacitor/core";
import type { TabletMailAuthority } from "../gen/app__setup.ts";
import type { TabletGoogleRead } from "./cloudRequests.vibe";

type AccountStatus =
  | { kind: "signedIn"; voiceDisclosureScope: string; mailLease?: TabletMailAuthority; mailLeaseUpgrade?: "required" | "signInPending" | "acknowledgmentPending" }
  | { kind: "signedOut"; legacySignInNeedsCleanup?: true };

export type TabletAccountRequest =
  | { action: "profile" }
  | { action: "billing" | "plans"; accountId: string }
  | { action: "redeem"; accountId: string; code: string; idempotencyKey: string };

export type TabletGoogleConsent = {
  accountId: string;
  mail: boolean;
  calendar: boolean;
  sendMail: boolean;
  trashMail: boolean;
  writeCalendar: boolean;
};

interface AccountPlugin {
  status(): Promise<AccountStatus>;
  accountRequest?(request: TabletAccountRequest): Promise<unknown>;
  connectGoogle?(request: TabletGoogleConsent): Promise<unknown>;
  disconnectGoogle?(request: { accountId: string }): Promise<void>;
  beginSignIn(): Promise<void>;
  beginLeaseUpgrade?(): Promise<void>;
  cancelLeaseUpgrade?(): Promise<void>;
  readGoogle?(input: TabletMailAuthority & { route: TabletGoogleRead; query: Record<string, string> }): Promise<unknown>;
  signOut(): Promise<void>;
  cleanupLegacySignIn(): Promise<void>;
  passwordRecoveryStatus(): Promise<unknown>;
  showPasswordRecovery(): Promise<void>;
  dismissPasswordRecovery(): Promise<void>;
  browserGuideLease(): Promise<unknown>;
  inboxArrival(input: { lease: string; cursor?: string }): Promise<unknown>;
  chooseBrowserLink(input: { lease: string; goal: string; candidates: readonly { id: string; label: string }[] }): Promise<unknown>;
  startSpeech(): Promise<unknown>;
  stopSpeech(input: { sessionId: string }): Promise<void>;
  addListener(event: "sessionChanged", listener: (status: AccountStatus) => void): Promise<PluginListenerHandle>;
}

export type AccountBridge = Pick<AccountPlugin, "status" | "accountRequest" | "beginSignIn" | "beginLeaseUpgrade" | "cancelLeaseUpgrade" | "connectGoogle" | "disconnectGoogle" | "readGoogle" | "signOut" | "cleanupLegacySignIn" | "addListener">;

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

export function accountReadResponse(status: number, body: string) {
  return new Response(status === 204 || status === 205 || status === 304 ? null : body, { status });
}
