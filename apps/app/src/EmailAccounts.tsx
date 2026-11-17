// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/accounts.md, "Story: Choose what each email brings and take it off the tablet"; spec/app/accounts.md, "Only the current sign-in attempt can add or renew an account"; spec/app/accounts.md, "An address at a listed company goes to that company’s own page"; spec/app/accounts.md, "Other email connects through its own servers, asking for them when the tablet cannot find them"; spec/app/accounts.md, "Nothing she types to sign in enters the tablet’s state"; spec/app/accounts.md, "The settings pages go back one step at a time"; spec/app/accounts.md, "Signing in again renews the same account"; spec/app/accounts.md, "Turning a use off hides it and keeps the account"; spec/app/accounts.md, "Removing asks first and waits for unsent email"; spec/app/accounts.md, "Grace is told what happened to the accounts, never what was typed"
import {
  type AccountColour, Alert, EmailAccountList, EmailAccountPage, EmailAccountRow, type EmailProvider, emailProviders, MailServersForm,
  OtherEmailForm, type OtherEmailProblem, ProviderGrid, RemoveAccountDialog, SettingsApp, type SettingsAppProps, SignInSheet, Spinner, Toast,
} from "@repo/ui";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { type Account, type AccountPage, type Accounts, type Event, type Problem, type Provider, providerOf } from "../gen/app__accounts.ts";
import { accountStatus, unsent } from "../gen/app__mailboxes.ts";
import { domainOf } from "./accounts.vibe";
import { secretPassword } from "./connector.vibe";
import { type MailInstance, useAccounts, useSignIns, useWorkspace, WithMailboxes } from "./useApp.ts";

type Frame = Omit<SettingsAppProps, "children" | "pageTitle" | "backLabel" | "onBack">;

const providers = { Gmail: "gmail", Outlook: "outlook", Yahoo: "yahoo", ICloud: "icloud", Aol: "aol", OtherEmail: "other" } as const satisfies Record<Provider, EmailProvider>;
const chosen: Record<EmailProvider, Provider> = { gmail: "Gmail", outlook: "Outlook", yahoo: "Yahoo", icloud: "ICloud", aol: "Aol", other: "OtherEmail" };
const colours = [1, 2, 3, 4, 5] as const satisfies readonly AccountColour[];
const home = "Email & calendar";
const add = "Add an email";
const other = "Other email";

const notices: Partial<Record<Problem, string>> = {
  AlreadyOnTablet: "This email is already on the tablet.",
  SignInUnfinished: "Signing in wasn’t finished. You can try again.",
};

function header(page: AccountPage, registry: Accounts, shown: Account | undefined): { pageTitle?: string; backLabel?: string } {
  switch (page) {
    case "AccountList": return {};
    case "AddAccount": return { pageTitle: add, backLabel: home };
    case "OtherEmailPage": return { pageTitle: other, backLabel: registry.accounts.length > 0 ? add : home };
    case "MailServersPage": return { pageTitle: "Mail settings", backLabel: other };
    case "AccountDetail": return { pageTitle: shown?.name, backLabel: home };
    default: {
      const _exhaustive: never = page;
      return _exhaustive;
    }
  }
}

function otherProblem(registry: Accounts): OtherEmailProblem | undefined {
  const listed = providerOf(registry.signIn.domain);
  if (registry.problem === "ListedProvider" && listed !== "OtherEmail") return { kind: "listedProvider", provider: providers[listed] };
  return registry.problem === "PasswordRefused" ? { kind: "passwordRefused" } : undefined;
}

/** @model spec/app/accounts.md */
export function EmailAccounts(frame: Frame) {
  const { accounts } = useAccounts();
  if (!accounts) return null;
  return <WithMailboxes ids={accounts.accounts.map((a) => a.id)}>{(boxes) => <Settings registry={accounts} boxes={boxes} frame={frame} />}</WithMailboxes>;
}

function Settings({ registry, boxes, frame }: { registry: Accounts; boxes: readonly MailInstance[]; frame: Frame }) {
  const { can, send } = useAccounts();
  const workspace = useWorkspace();
  const flows = useSignIns();
  const offer = (event: Event) => can(event) ? () => void send(event) : undefined;
  const sources = boxes.map((b) => ({ account: b.id, mailbox: b.state }));
  const status = (id: number) => boxes.some((b) => b.id === id && accountStatus(b.state) === "MailNeedsSignIn") ? "needsSignIn" : "connected";
  const colour = (a: Account) => colours[a.colour] ?? colours[0];
  const shown = registry.accounts.find((a) => a.id === registry.shown);
  const { signIn, page, problem } = registry;

  const askGrace = () => { if (workspace.can({ type: "openGrace" })) void workspace.send({ type: "openGrace" }); };
  const choose = (provider: EmailProvider) => offer({ type: "chooseProvider", provider: chosen[provider] })?.();
  const notice = notices[problem];
  const alert = notice && <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mb-4 max-w-[620px]">{notice}</Alert>;

  const content = (): ReactNode => {
    switch (page) {
      case "AccountList":
        return registry.accounts.length === 0 ? (
          <EmailAccountList empty>
            {alert}
            <ProviderGrid onChoose={choose} onAskGrace={askGrace} />
          </EmailAccountList>
        ) : (
          <EmailAccountList onAdd={offer({ type: "addAccount" })}>
            {registry.accounts.map((a) => (
              <EmailAccountRow key={a.id} address={a.address} provider={providers[a.provider]} uses={a.use} status={status(a.id)} colour={colour(a)}
                onOpen={offer({ type: "openAccount", id: a.id })} />
            ))}
          </EmailAccountList>
        );
      case "AddAccount":
        return <>{alert}<ProviderGrid bare onChoose={choose} /></>;
      case "OtherEmailPage": {
        const renewing = registry.accounts.find((a) => a.id === signIn.renewing)?.address ?? "";
        return (
          <>
            {problem === "SignInUnfinished" && alert}
            <OtherEmailForm key={renewing} defaultAddress={renewing} problem={otherProblem(registry)} checking={signIn.stage === "CheckingOther"}
              onNext={({ address, password }) => { if (can({ type: "submitOther", domain: domainOf(address) })) void flows.other({ address, password: secretPassword(password) }); }}
              onCancel={offer({ type: "goBack" })} />
          </>
        );
      }
      case "MailServersPage":
        return (
          <MailServersForm key={signIn.domain} domain={signIn.domain} connecting={signIn.stage === "CheckingServers"} refused={problem === "ServersRefused"}
            onConnect={(servers) => { if (can({ type: "submitServers" })) void flows.servers(servers); }}
            onCancel={offer({ type: "goBack" })} onAskGrace={askGrace} />
        );
      case "AccountDetail": {
        if (!shown) return null;
        const waiting = unsent(sources, shown.id);
        return (
          <>
            {alert}
            <EmailAccountPage address={shown.address} provider={providers[shown.provider]} status={status(shown.id)} uses={shown.use} colour={colour(shown)}
              onUseChange={(use, on) => offer({ type: "setUse", id: shown.id, use: { ...shown.use, [use]: on } })?.()}
              onSignInAgain={offer({ type: "signInAgain", id: shown.id })} onRemove={offer({ type: "requestRemoval", id: shown.id })} />
            <RemoveAccountDialog open={registry.removing === shown.id} name={shown.name} keeper={shown.provider === "OtherEmail" ? shown.name : emailProviders[providers[shown.provider]].name}
              waiting={waiting} onRemove={offer({ type: "removeAccount", id: shown.id, waiting })} onKeep={offer({ type: "keepAccount" })}
              onOpenChange={(open) => { if (!open) offer({ type: "keepAccount" })?.(); }} />
          </>
        );
      }
      default: {
        const _exhaustive: never = page;
        return _exhaustive;
      }
    }
  };

  const company = emailProviders[providers[signIn.provider]].name;
  return (
    <SettingsApp {...frame} {...header(page, registry, shown)} onBack={offer({ type: "goBack" })}>
      {content()}
      <SignInSheet open={signIn.stage === "ProviderPage"} owner={company} onCancel={offer({ type: "cancelSignIn" })}>
        <div className="m-auto flex max-w-[460px] flex-col items-center gap-6 p-8 text-center text-body">
          <Spinner />
          <p>Sign in on {company}’s own page. The tablet waits here until you finish.</p>
        </div>
      </SignInSheet>
      {flows.note && <Toast key={flows.note.id} placement="screen">{flows.note.text}</Toast>}
    </SettingsApp>
  );
}
