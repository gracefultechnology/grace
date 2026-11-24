import "@repo/ui/fonts.css";
import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, createAppRuntime } from "./App.tsx";
import "./main.css";

const root = createRoot(document.getElementById("root")!);
const native = Capacitor.isNativePlatform();
const mayBeApproval = !native && (
  window.location.pathname === "/android/passwords/approve" ||
  (window.location.pathname === "/" && window.location.hash === "#account")
);

function renderApp() {
  root.render(<StrictMode><App runtime={createAppRuntime(native)} /></StrictMode>);
}

if (!mayBeApproval) {
  renderApp();
} else {
  void import("./PasswordBackupConsent.tsx").then(async ({ PasswordBackupConsent, loadPendingPasswordBackupConsent }) => {
    const pending = await loadPendingPasswordBackupConsent();
    if (!pending) {
      renderApp();
      return;
    }
    root.render(<StrictMode><PasswordBackupConsent approval={pending.approval} account={pending.account} providers={pending.providers} /></StrictMode>);
  });
}
