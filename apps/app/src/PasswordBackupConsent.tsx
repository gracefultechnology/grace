// spec/app/setup.md, "Story: Approve a password backup in my browser"
import { Button } from "@repo/ui";
import { useState, useTransition } from "react";
import {
  cancelPasswordApproval, confirmPasswordApproval, signInForApproval, type Approval, type ConsentResult, type SignedInAccount,
} from "./passwordBackupConsent.vibe";

const titles = {
  read: "Restore your passwords",
  save: "Back up your passwords",
  delete: "Delete your password backup",
  verify: "Verify this tablet",
};

export function PasswordBackupConsent({ approval, account }: { approval: Approval | null; account: SignedInAccount | null }) {
  const [pending, run] = useTransition();
  const [status, setStatus] = useState<ConsentResult | null>(null);
  const needsSignIn = !account || status?.kind === "signInRequired" || status?.kind === "accountChanged";
  const message = !approval ? "Open Passwords on your tablet and try again." :
    status?.kind === "unavailable" ? "Grace couldn’t finish. Please try again." :
    status?.kind === "accountChanged" ? "Your signed-in account changed. Sign in to continue." :
    status?.kind === "returning" ? "Return to the Grace app to finish." :
    needsSignIn ? "Sign in with the Grace account you use on this tablet." : account.email ?? "Your signed-in Grace account";
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="w-full max-w-lg flex flex-col items-start gap-5" aria-busy={pending || undefined}>
        <h1 className="text-2xl font-semibold">{approval ? titles[approval.purpose] : "Password backup unavailable"}</h1>
        {message && <p role={status ? "status" : undefined}>{message}</p>}
        <div className="flex flex-wrap gap-3">
          {approval && status?.kind !== "returning" && (
            <Button variant="prominent" size="pill" disabled={pending} onClick={() => run(async () => {
              if (needsSignIn) {
                if (!await signInForApproval(approval)) setStatus({ kind: "unavailable" });
              } else {
                setStatus(await confirmPasswordApproval(approval, account.id));
              }
            })}>{needsSignIn ? "Sign in to continue" : "Approve"}</Button>
          )}
          {status?.kind === "returning" && <a href={status.href} rel="noreferrer" className="text-primary underline">Return to Grace</a>}
          <Button variant="capsule" size="pill" disabled={pending} onClick={() => void cancelPasswordApproval()}>Cancel</Button>
        </div>
      </section>
    </main>
  );
}
