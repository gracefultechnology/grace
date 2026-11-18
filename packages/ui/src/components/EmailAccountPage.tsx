import type { ComponentProps, ReactNode } from "react";
import { CalendarDays, Check, Mail, Trash2, Users } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Avatar } from "./Avatar.tsx";
import { Button } from "./Button.tsx";
import type { AccountColour, AccountStatus, AccountUses } from "./EmailAccountRow.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { emailProviders, type EmailProvider } from "./ProviderGrid.tsx";
import { SettingsSwitchRow } from "./SettingsSwitchRow.tsx";

const switches: { use: keyof AccountUses; icon: ReactNode; title: string; subtitle: string }[] = [
  { use: "mail", icon: <Mail size={28} strokeWidth={2} aria-hidden />, title: "Email", subtitle: "Your inbox, sent emails and folders" },
  { use: "calendar", icon: <CalendarDays size={28} strokeWidth={2} aria-hidden />, title: "Calendar", subtitle: "Appointments show in Calendar with yours" },
  { use: "contacts", icon: <Users size={28} strokeWidth={2} aria-hidden />, title: "Contacts", subtitle: "Names and addresses when you write" },
];

export type EmailAccountPageProps = Omit<ComponentProps<"section">, "title"> & {
  /** The email address: "margaret.h@gmail.com". */
  address: string;
  /** The company it is with. */
  provider: EmailProvider;
  status: AccountStatus;
  /** What it brings to the tablet, one switch each. */
  uses: AccountUses;
  colour: AccountColour;
  /** Called with a switch she flips and its new value. */
  onUseChange?: (use: keyof AccountUses, on: boolean) => void;
  /** Called by Sign in again, shown while it needs her to. */
  onSignInAgain?: () => void;
  /** Called by Remove from this tablet: the app asks first, with `RemoveAccountDialog`. */
  onRemove?: () => void;
};

/**
 * One email's page in Settings › Email & calendar: whether it works, what it brings to the tablet, and Remove from this
 * tablet (prototype `accPage()` on an account). The window's title is the email's name.
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function EmailAccountPage({ address, provider, status, uses, colour, onUseChange, onSignInAgain, onRemove, className, ...props }: EmailAccountPageProps) {
  const company = emailProviders[provider].name;
  const connected = status === "connected";
  return (
    <section aria-label={address} className={cn("flex flex-col font-sans", className)} {...props}>
      <ListRow
        leading={<Avatar name={address} tone={colour} size={56} aria-hidden />}
        title={<span className="truncate">{address}</span>}
        subtitle={
          <span className={cn("flex items-center gap-1.5", connected && "text-ok")}>
            {connected && <Check size={20} strokeWidth={2.6} aria-hidden />}
            {company} · {connected ? "Connected" : "Needs you to sign in again"}
          </span>
        }
        trailing={connected ? undefined : <Button variant="capsule" size="pill" onClick={onSignInAgain}>Sign in again</Button>}
      />
      <PageHeading level="section" className="mt-6">Use on this tablet</PageHeading>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {switches.map(({ use, icon, title, subtitle }) => (
          <SettingsSwitchRow
            key={use}
            className="min-h-[84px]"
            leading={<span className="flex text-primary">{icon}</span>}
            title={title}
            subtitle={subtitle}
            checked={uses[use]}
            onCheckedChange={(on) => onUseChange?.(use, on)}
          />
        ))}
      </div>
      <Button variant="warn" size="pill" className="mt-[22px] self-start" onClick={onRemove}>
        <Trash2 size={22} strokeWidth={2.2} aria-hidden />
        Remove from this tablet
      </Button>
    </section>
  );
}
