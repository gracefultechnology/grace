// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"
import { Capacitor, type PluginListenerHandle, registerPlugin } from "@capacitor/core";

type AccountStatus = { kind: "signedIn" | "signedOut" };

interface AccountPlugin {
  status(): Promise<AccountStatus>;
  beginSignIn(): Promise<void>;
  signOut(): Promise<void>;
  manageAccount(): Promise<void>;
  addListener(event: "sessionChanged", listener: (status: AccountStatus) => void): Promise<PluginListenerHandle>;
}

export const accountPlugin = Capacitor.isPluginAvailable("GraceAccount") ? registerPlugin<AccountPlugin>("GraceAccount") : undefined;
