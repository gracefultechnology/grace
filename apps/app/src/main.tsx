import "@repo/ui/fonts";
import { Capacitor } from "@capacitor/core";
import { ManagedRuntime } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { PasswordBackupConsent } from "./PasswordBackupConsent.tsx";
import { pendingPasswordApproval } from "./passwordBackupConsent.vibe";
import { agentPlugin } from "./agentPlugin.ts";
import { application } from "./app.vibe";
import { devicePlugin, wifiPlugin, passwordClient } from "./surfacePlugin.ts";
import "./main.css";

const root = createRoot(document.getElementById("root")!);
const native = Capacitor.isNativePlatform();

function renderApp() {
  root.render(<StrictMode><App runtime={ManagedRuntime.make(application(devicePlugin, wifiPlugin, { native, agent: agentPlugin, vault: passwordClient }))} /></StrictMode>);
}

if (native) {
  renderApp();
} else {
  void pendingPasswordApproval().then(({ present, approval, account }) => {
    if (present) root.render(<StrictMode><PasswordBackupConsent approval={approval} account={account} /></StrictMode>);
    else renderApp();
  });
}
