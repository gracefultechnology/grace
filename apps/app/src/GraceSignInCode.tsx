// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"
import { Button, Input, PageText } from "@repo/ui";
import { useId, useState } from "react";
import type { CodeProvider, CodeSignIn } from "./graceAccount.vibe";

export function GraceSignInCode({ provider, pending, run, onClose, onBack = onClose }: {
  provider: CodeProvider;
  pending: boolean;
  run: (operation: CodeSignIn, onSuccess: () => void) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const [destination, setDestination] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const inputId = useId();
  const email = provider === "email";
  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault();
      if (challenge === "") {
        const address = destination.trim();
        run({ kind: "sendCode", provider, address }, () => setChallenge(address));
      } else {
        run({ kind: "verifyCode", provider, address: challenge, code: code.trim() }, onClose);
      }
    }}>
      {challenge === "" ? (
        <>
          <label htmlFor={inputId}>{email ? "Email address" : "Phone number with country code"}</label>
          <Input id={inputId} type={email ? "email" : "tel"} autoComplete={email ? "email" : "tel"}
            value={destination} onChange={(event) => setDestination(event.target.value)} disabled={pending} required />
        </>
      ) : (
        <>
          <PageText>We sent a code to {challenge}.</PageText>
          <label htmlFor={inputId}>Sign-in code</label>
          <Input id={inputId} inputMode="numeric" autoComplete="one-time-code" value={code}
            onChange={(event) => setCode(event.target.value)} disabled={pending} required />
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="prominent" size="pill" disabled={pending}>{challenge === "" ? "Send code" : "Sign in"}</Button>
        <Button type="button" variant="capsule" size="pill" disabled={pending} onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}
