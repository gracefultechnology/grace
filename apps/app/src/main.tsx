import "@repo/ui/fonts.css";
import { Capacitor } from "@capacitor/core";
import { RetryNotice } from "@repo/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, createAppRuntime } from "./App.tsx";
import { primeRuntime } from "./useApp.ts";
import "./main.css";

const root = createRoot(document.getElementById("root")!);
const native = Capacitor.isNativePlatform();
const mayBeApproval = !native && (
  window.location.pathname === "/android/passwords/approve" ||
  (window.location.pathname === "/" && window.location.hash === "#account")
);

function renderBootError(retry: () => void) {
  root.render(
    <StrictMode>
      <main className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <RetryNotice role="alert" onRetry={retry}>Grace couldn’t start. Try again.</RetryNotice>
      </main>
    </StrictMode>,
  );
}

function renderApp() {
  const runtime = createAppRuntime(native);
  void primeRuntime(runtime).then(
    () => {
      root.render(<StrictMode><App runtime={runtime} /></StrictMode>);
    },
    () => {
      void runtime.dispose();
      renderBootError(renderApp);
    },
  );
}

function start() {
  if (!mayBeApproval) {
    renderApp();
    return;
  }
  void import("./PasswordBackupConsent.tsx").then(async ({ PasswordBackupConsent, loadPendingPasswordBackupConsent }) => {
    const pending = await loadPendingPasswordBackupConsent();
    if (!pending) {
      renderApp();
      return;
    }
    root.render(<StrictMode><PasswordBackupConsent approval={pending.approval} account={pending.account} providers={pending.providers} /></StrictMode>);
  }).catch(() => renderBootError(start));
}

start();
