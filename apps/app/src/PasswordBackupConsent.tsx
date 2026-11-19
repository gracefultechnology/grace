// spec/app/setup.md, "Story: Approve a password backup in my browser"
import { Button } from "@repo/ui";
import { GraceSignInCode } from "./GraceSignInCode.tsx";
import type { CodeProvider, CodeSignIn } from "./graceAccount.vibe";
import { useState, useTransition } from "react";
import { mayOfferBackupApproval } from "../gen/app__setup.ts";
import {
  cancelPasswordApproval, confirmPasswordApproval, noBackupSignInProviders, signInForApproval, signInWithBackupCode,
  type Approval, type ConsentResult, type SignedInAccount,
} from "./passwordBackupConsent.vibe";

const titles = {
  read: "Restore your passwords",
  save: "Back up your passwords",
  delete: "Delete your password backup",
  verify: "Verify this tablet",
};

export function PasswordBackupConsent({ approval, account: originalAccount, providers = noBackupSignInProviders }: {
  approval: Approval | null;
  account: SignedInAccount | null;
  providers?: typeof noBackupSignInProviders;
}) {
  const [pending, run] = useTransition();
  const [account, setAccount] = useState(originalAccount);
  const [provider, setProvider] = useState<CodeProvider>();
  const [codeFailed, setCodeFailed] = useState(false);
  const [status, setStatus] = useState<ConsentResult | null>(null);
  const runCode = (operation: CodeSignIn, onSuccess: () => void) => run(async () => {
    setCodeFailed(false);
    const result = await signInWithBackupCode(operation);
    if (result.kind === "unavailable") {
      setCodeFailed(true);
      return;
    }
    if (result.kind === "signedIn") {
      setAccount(result.account);
      setStatus(null);
    }
    onSuccess();
  });
  const needsSignIn = !account || status?.kind === "signInRequired" || status?.kind === "accountChanged";
  const offersApproval = mayOfferBackupApproval(approval !== null, status?.kind !== "signInRequired", account !== null && status?.kind !== "accountChanged");
  const message = !approval ? "Open Passwords on your tablet and try again." :
    status?.kind === "unavailable" ? "Grace couldn’t finish. Please try again." :
    status?.kind === "accountChanged" ? "Your signed-in account changed. Sign in to continue." :
    status?.kind === "returning" ? "Return to the Grace app to finish." :
    needsSignIn ? "Sign in with the Grace account you use on this tablet." : account.email ?? "Your signed-in Grace account";
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="w-full max-w-lg flex flex-col items-start gap-5" aria-busy={pending || undefined}>
        <h1 className="text-title font-semibold">{approval ? titles[approval.purpose] : "Password backup unavailable"}</h1>
        {message && <p role={status ? "status" : undefined}>{message}</p>}
        {codeFailed && <p role="alert">Grace couldn’t verify the request. Try again.</p>}
        {approval && needsSignIn && provider && (
          <GraceSignInCode provider={provider} pending={pending} run={runCode} onClose={() => {
            setCodeFailed(false);
            setProvider(undefined);
          }} />
        )}
        <div className="flex flex-wrap gap-3">
          {approval && needsSignIn && !provider && (
            <>
              {providers.google && <Button variant="prominent" size="pill" disabled={pending} onClick={() => run(async () => {
                if (!await signInForApproval(approval)) setCodeFailed(true);
              })}>Continue with Google</Button>}
              {providers.email && <Button variant="capsule" size="pill" disabled={pending} onClick={() => setProvider("email")}>Use email</Button>}
              {providers.sms && <Button variant="capsule" size="pill" disabled={pending} onClick={() => setProvider("sms")}>Use a text message</Button>}
              {!providers.google && !providers.email && !providers.sms && <p role="status">Sign-in is unavailable.</p>}
            </>
          )}
          {approval && account && offersApproval && status?.kind !== "returning" && (
            <Button variant="prominent" size="pill" disabled={pending} onClick={() => run(async () => {
              setStatus(await confirmPasswordApproval(approval, account.id));
            })}>Approve</Button>
          )}
          {status?.kind === "returning" && <a href={status.href} rel="noreferrer" className="text-primary underline">Return to Grace</a>}
          <Button variant="capsule" size="pill" disabled={pending} onClick={() => void cancelPasswordApproval()}>Cancel</Button>
        </div>
      </section>
    </main>
  );
}
