// spec/app/index.md, "Story: Manage my saved passwords privately"
import { Button, Dialog, DialogActions, DialogClose, DialogContent, DialogTitle, DialogTrigger, EmptyState, GuideRing, SearchField } from "@repo/ui";
import { Effect } from "effect";
import { ChevronRight, KeyRound, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { type LoginSummary, type PasswordGuide, type VaultIssue, type VaultNotice } from "../gen/app.ts";
import { useMachine } from "../gen/app.react.ts";
import { Passwords, type PasswordAction } from "./passwords.vibe";
import { useRuntime } from "./useApp.ts";

const vaultMessage: Record<VaultIssue, string> = {
  LegacyAuthorization: "Android needs your permission to open passwords saved by an earlier version of Grace.",
  UnsupportedVault: "Passwords is available on your Grace tablet.",
  LostVaultKey: "This tablet can no longer open these saved passwords. Use each website’s password recovery.",
  VaultClosed: "Grace can’t verify the account that owns the saved passwords on this tablet.",
};
const noticeText: Record<VaultNotice, string> = {
  QuietVault: "",
  CancelledVaultAction: "Your saved passwords are still protected.",
  BackupUnavailable: "Backup and recovery is unavailable right now.",
  FailedVaultAction: "Something went wrong. Please try again.",
  SavedLogin: "Password saved.",
  DeletedLogin: "Password deleted.",
  ChangedLogin: "This sign-in changed. Check its details and try again.",
};

type OpenLoginsProps = {
  entries: LoginSummary[];
  selected: string;
  choose: (id: string) => void;
  act: (action: PasswordAction) => void;
  guide: PasswordGuide;
  finishGuide: () => void;
};

const focusEntryHeading = (heading: HTMLHeadingElement | null) => { heading?.focus(); };

function OpenLogins({ entries, selected, choose, act, guide, finishGuide }: OpenLoginsProps) {
  const [query, setQuery] = useState("");
  const returnFocusRef = useRef<string | undefined>(undefined);
  const entry = entries.find((row) => row.id === selected);
  const search = query.trim().toLocaleLowerCase();
  const matching = entries.filter(({ label, username, bindings }) =>
    [label, username, ...bindings.map(({ display }) => display)].join(" ").toLocaleLowerCase().includes(search),
  ).toSorted((first, second) => first.label.localeCompare(second.label));
  if (entry) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Button variant="capsule" size="pill" onClick={() => { returnFocusRef.current = entry.id; choose(""); }}>All passwords</Button>
        <h2 ref={focusEntryHeading} tabIndex={-1} className="text-title-lg font-bold">{entry.label}</h2>
        {entry.username && <p className="text-body-lg">{entry.username}</p>}
        <ul aria-label="Websites and apps" className="text-body text-muted-foreground">
          {entry.bindings.map((binding) => <li key={binding.facet}>{binding.display}</li>)}
        </ul>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            {guide === "ShowPasswordGuide" && <GuideRing motion="tap" tight />}
            <Button variant="capsule" size="pill" onClick={() => { finishGuide(); act({ kind: "Show", id: entry.id, revision: entry.revision }); }}>Show password</Button>
          </div>
          <div className="relative">
            {guide === "CopyPasswordGuide" && <GuideRing motion="tap" tight />}
            <Button variant="capsule" size="pill" onClick={() => { finishGuide(); act({ kind: "Copy", id: entry.id, revision: entry.revision }); }}>Copy password</Button>
          </div>
          <Button variant="capsule" size="pill" onClick={() => act({ kind: "Edit", id: entry.id, revision: entry.revision })}>Edit</Button>
          <Dialog key={entry.id}>
            <DialogTrigger asChild><Button variant="capsule" size="pill">Delete</Button></DialogTrigger>
            <DialogContent>
              <DialogTitle>Delete this saved password?</DialogTitle>
              <p className="text-body">This will remove {entry.label} from Passwords.</p>
              <DialogActions>
                <DialogClose asChild><Button variant="capsule" size="pill">Cancel</Button></DialogClose>
                <DialogClose asChild><Button variant="capsule" size="pill" onClick={() => act({ kind: "Delete", id: entry.id, revision: entry.revision })}>Delete saved password</Button></DialogClose>
              </DialogActions>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="capsule" size="pill" onClick={() => act({ kind: "Add" })}><Plus aria-hidden /> Add password</Button>
        <Button variant="capsule" size="pill" onClick={() => act({ kind: "Autofill" })}>Set up autofill in Android</Button>
        {entries.length > 0 && (
          <div className="relative">
            {guide === "FindPasswordGuide" && <GuideRing motion="tap" tight />}
            <SearchField label="Find a saved password" value={query} onChange={(event) => { setQuery(event.target.value); if (guide === "FindPasswordGuide") finishGuide(); }} />
          </div>
        )}
      </div>
      {matching.length === 0 && <div role="status"><EmptyState title={entries.length === 0 ? "No saved passwords yet." : "No passwords match your search."} /></div>}
      {matching.length > 0 && (guide === "ShowPasswordGuide" || guide === "CopyPasswordGuide") && <p role="status" className="text-body">Choose a sign-in first.</p>}
      {matching.length > 0 && (
        <ul aria-label="Saved sign-ins" className="flex flex-col gap-3">
          {matching.map(({ id, label, username, bindings }) => (
            <li key={id}>
              <Button ref={(control) => {
                if (control && returnFocusRef.current === id) {
                  returnFocusRef.current = undefined;
                  control.focus();
                }
              }} variant="capsule" size="pill" className="w-full justify-start" onClick={() => choose(id)}>
                <KeyRound aria-hidden className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{label || bindings[0]?.display || "Saved sign-in"}{username && <span className="ml-3 text-muted-foreground">{username}</span>}</span>
                <ChevronRight aria-hidden className="shrink-0" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PasswordsApp() {
  const runtime = useRuntime();
  const { state, can, send } = useMachine(runtime);
  const act = (action: PasswordAction) => void runtime.runPromiseExit(Effect.flatMap(Effect.service(Passwords), (service) => service.act(action)));
  const vault = state?.vault;
  const guide = state?.guide ?? "NoPasswordGuide";
  const finishGuide = () => void runtime.runPromiseExit(Effect.flatMap(Effect.service(Passwords), (service) => service.finishGuide()));
  const choose = (id: string) => {
    const event = { type: "selectLogin", id } as const;
    if (can(event, "PasswordsPerson")) void send(event, "PasswordsPerson");
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {(!vault || vault.tag === "ClosedPasswords" || vault.tag === "CheckingVault") && <p role="status" className="text-body">Checking Passwords…</p>}
      {vault?.tag === "UnavailableVault" && (
        <EmptyState title={vaultMessage[vault.reason]}>
          {vault.reason === "LegacyAuthorization" && <Button variant="capsule" size="pill" onClick={() => act({ kind: "Unlock" })}>Open saved passwords</Button>}
        </EmptyState>
      )}
      {vault?.tag === "LockedVault" && <p role="status" className="text-body">Waiting for Passwords…</p>}
      {vault?.tag === "OpenVault" && <OpenLogins entries={vault.entries} selected={vault.selected} choose={choose} act={act} guide={guide} finishGuide={finishGuide} />}
      {state && state.notice !== "QuietVault" && <p role="status" className="text-body">{noticeText[state.notice]}</p>}
      {state?.backupReady && <Button className="self-start" variant="capsule" size="pill" onClick={() => act({ kind: "Backup" })}>Backup and recovery</Button>}
    </div>
  );
}
