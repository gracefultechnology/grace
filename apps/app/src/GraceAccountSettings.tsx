// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"; spec/app/setup.md, "An enrolled tablet offers one sign-in to update mail and calendar access"
import { AccountFacts, Button, Checkbox, Input, PageHeading, PageText, RetryNotice } from "@repo/ui";
import { Effect, Exit } from "effect";
import { useId, useState, useTransition } from "react";
import { useMachine } from "../gen/app__setup.react.ts";
import { managesOnTheWeb, mayBeginDeviceSignIn, mayBeginMailLeaseUpgrade, mayCancelMailLeaseUpgrade, mayCheckAccountAgain, mayCleanupLegacySignIn, mayOfferGoogleLink, mayOpenBillingPortal, mayStartCheckout, showsMailLeaseUpgrade, showsTabletSignIn } from "../gen/app__setup.ts";
import { AccountActions, type Operation } from "./graceAccount.vibe";
import { useRuntime } from "./useApp.ts";
import { GraceSignInCode } from "./GraceSignInCode.tsx";

/** @model spec/app/setup.md */
export function GraceAccountSettings() {
  const runtime = useRuntime();
  const setup = useMachine(runtime).state;
  const snapshot = setup?.graceAccount;
  const link = setup?.googleLink;
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState<Operation["kind"]>();
  const [returnFailed, setReturnFailed] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("authError") === "google_failed") return "Google sign-in didn’t finish.";
    if (params.get("googleConnectionError") === "authorization_failed") return "Google didn’t connect. Check which account you chose and try again.";
    return "";
  });
  const [confirmation, setConfirmation] = useState<"signOut" | "cleanupLegacySignIn">();
  const [provider, setProvider] = useState<"email" | "sms">();
  const [mail, setMail] = useState(false);
  const [trashMail, setTrashMail] = useState(false);
  const [writeCalendar, setWriteCalendar] = useState(false);
  const [sendMail, setSendMail] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [expectedEmail, setExpectedEmail] = useState("");
  const googleAddressId = useId();
  const run = (operation: Operation, onSuccess?: () => void) => startTransition(async () => {
    setFailed(undefined);
    setReturnFailed("");
    const result = await runtime.runPromiseExit(Effect.flatMap(AccountActions, (actions) => actions.run(operation)));
    if (Exit.isSuccess(result) && result.value) {
      setConfirmation(undefined);
      onSuccess?.();
    }
    else setFailed(operation.kind);
  });
  const tabletRequested = setup !== undefined && showsTabletSignIn(setup.tabletSignIn);
  const signedIn = snapshot?.tag === "GraceSignedIn";
  const needsCleanup = snapshot !== undefined && mayCleanupLegacySignIn(snapshot);
  const accountAction = needsCleanup ? "cleanupLegacySignIn" : signedIn || snapshot?.tag === "GraceDeviceSignedIn" ? "signOut" : undefined;
  const confirmingSignOut = accountAction !== undefined && confirmation === accountAction;
  const canRetry = snapshot !== undefined && mayCheckAccountAgain(snapshot);
  const active = signedIn && (snapshot.plan === "PlanActive" || snapshot.plan === "PlanActiveManaged");
  return (
    <section data-sensitive="true" aria-busy={pending || undefined} className="flex flex-col items-start gap-5">
      <PageHeading>Grace account</PageHeading>
      {returnFailed && <RetryNotice role="alert">{returnFailed}</RetryNotice>}
      {failed && (failed !== "authorizeDevice" || tabletRequested) && <RetryNotice role="alert">Grace couldn’t finish that request. Try again.</RetryNotice>}
      {snapshot === undefined || snapshot.tag === "CheckingAccount" ? <PageText role="status">Checking your account…</PageText> : null}
      {snapshot?.tag === "GraceSignedOut" && (provider === undefined ? (
        <div className="flex flex-wrap gap-3">
          {snapshot.google && <Button variant="prominent" size="pill" disabled={pending} onClick={() => run({ kind: "signIn" })}>Continue with Google</Button>}
          {snapshot.emailCode && <Button variant="capsule" size="pill" disabled={pending} onClick={() => setProvider("email")}>Use email</Button>}
          {snapshot.smsCode && <Button variant="capsule" size="pill" disabled={pending} onClick={() => setProvider("sms")}>Use a text message</Button>}
          {!snapshot.google && !snapshot.emailCode && !snapshot.smsCode && <RetryNotice role="status" retrying={pending} onRetry={() => run({ kind: "refresh" })}>Sign-in is unavailable.</RetryNotice>}
        </div>
      ) : (
        <GraceSignInCode provider={provider} pending={pending} run={run} onClose={() => setProvider(undefined)} />
      ))}
      {canRetry && <RetryNotice role="status" retrying={pending} onRetry={() => run({ kind: "refresh" })}>Grace couldn’t check your account.</RetryNotice>}
      {snapshot !== undefined && mayBeginDeviceSignIn(snapshot) && (
        <div className="flex flex-wrap gap-3">
          <Button variant="prominent" size="pill" disabled={pending} onClick={() => run({ kind: "signIn" })}>Sign in to Grace</Button>
          <Button variant="capsule" size="pill" disabled={pending} onClick={() => run({ kind: "signIn", method: "browser" })}>Other sign-in options</Button>
        </div>
      )}
      {tabletRequested && (
        <>
          <PageText>Sign in on your tablet{signedIn && snapshot.email ? ` as ${snapshot.email}` : ""}?</PageText>
          <div className="flex flex-wrap gap-3">
            {signedIn && <Button variant="prominent" size="pill" disabled={pending} onClick={() => run({ kind: "authorizeDevice", expectedAccountId: snapshot.accountId })}>Sign in on tablet</Button>}
            <Button variant="capsule" size="pill" onClick={() => run({ kind: "cancelDevice" })}>Cancel tablet sign-in</Button>
          </div>
        </>
      )}
      {snapshot !== undefined && managesOnTheWeb(snapshot) && (
        <>
          {snapshot.tag === "GraceDeviceSignedIn" && showsMailLeaseUpgrade(snapshot) ? (
            <>
              <PageText role="status">{snapshot.mailLeaseUpgrade === "LeaseUpgradeAcknowledgmentPending" ? "Finishing sign-in…" : "Sign in again to use email and calendar."}</PageText>
              {mayBeginMailLeaseUpgrade(snapshot) && <Button variant="prominent" size="pill" disabled={pending || confirmingSignOut}
                onClick={() => run({ kind: "beginLeaseUpgrade" })}>Sign in again</Button>}
              {mayCancelMailLeaseUpgrade(snapshot) && <Button variant="capsule" size="pill"
                onClick={() => run({ kind: "cancelLeaseUpgrade" })}>Cancel</Button>}
            </>
          ) : <PageText role="status">This tablet is signed in.</PageText>}
          <Button variant="prominent" size="pill" disabled={pending || confirmingSignOut} onClick={() => run({ kind: "manageAccount" })}>Manage Grace account</Button>
        </>
      )}
      {signedIn && (
        <>
          <AccountFacts facts={[
            { label: "Signed in", value: snapshot.email || "Grace member" },
            { label: "Subscription", value: active ? "Active" : snapshot.plan === "PlanUnknown" ? "Unavailable" : "Inactive" },
          ]} />
          {mayStartCheckout(snapshot) && (
            <Button variant="prominent" size="pill" disabled={pending || confirmingSignOut} onClick={() => run({ kind: "checkout" })}>Subscribe</Button>
          )}
          {mayOpenBillingPortal(snapshot) && (
            <Button variant="prominent" size="pill" disabled={pending || confirmingSignOut} onClick={() => run({ kind: "portal" })}>Manage subscription</Button>
          )}
          {link?.tag === "GoogleLinkConnected" && (
            <>
              <AccountFacts facts={[{ label: "Google connected", value: link.email }]} />
              <Button variant="capsule" size="pill" disabled={pending || confirmingSignOut} onClick={() => run({ kind: "disconnectGoogle" })}>Disconnect Google</Button>
            </>
          )}
          {link !== undefined && mayOfferGoogleLink(snapshot, link) && (
            <form className="flex flex-col items-start gap-3" onSubmit={(event) => {
              event.preventDefault();
              run({ kind: "connectGoogle", mail, calendar, sendMail: mail && sendMail, trashMail: mail && trashMail, writeCalendar: calendar && writeCalendar, expectedEmail: expectedEmail.trim() });
            }}>
              <fieldset disabled={pending || confirmingSignOut} className="flex flex-col gap-3">
                <legend>{link.tag === "GoogleLinkConnected" ? "Change Google permissions" : "Connect Google"}</legend>
                <label className="flex items-center gap-3">
                  <Checkbox checked={mail} onCheckedChange={(checked) => setMail(checked === true)} />
                  Read Gmail
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox checked={calendar} onCheckedChange={(checked) => setCalendar(checked === true)} />
                  Read Google Calendar
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox checked={mail && sendMail} disabled={!mail} onCheckedChange={(checked) => setSendMail(checked === true)} />
                  Send Gmail messages I approve
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox checked={mail && trashMail} disabled={!mail} onCheckedChange={(checked) => setTrashMail(checked === true)} />
                  Move Gmail messages to Trash and undo
                </label>
                <label className="flex items-center gap-3">
                  <Checkbox checked={calendar && writeCalendar} disabled={!calendar} onCheckedChange={(checked) => setWriteCalendar(checked === true)} />
                  Add, edit and remove appointments I approve
                </label>
                {snapshot.email === "" && (
                  <>
                    <label htmlFor={googleAddressId}>Google email address</label>
                    <Input id={googleAddressId} type="email" autoComplete="email" value={expectedEmail}
                      onChange={(event) => setExpectedEmail(event.target.value)} required />
                  </>
                )}
              </fieldset>
              <Button type="submit" variant="capsule" size="pill" disabled={pending || confirmingSignOut || (!mail && !calendar)}>Continue to Google</Button>
            </form>
          )}
        </>
      )}
      {accountAction && (confirmingSignOut ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="capsule" size="pill" disabled={pending} onClick={() => setConfirmation(undefined)}>{needsCleanup ? "Cancel" : "Stay signed in"}</Button>
          <Button variant="warn" size="pill" disabled={pending} onClick={() => run({ kind: accountAction })}>{needsCleanup ? "Confirm clearing old sign-in" : "Confirm sign out"}</Button>
        </div>
      ) : (
        <Button variant="warn" size="pill" disabled={pending} onClick={() => setConfirmation(accountAction)}>{needsCleanup ? "Clear old sign-in" : "Sign out"}</Button>
      ))}
    </section>
  );
}
