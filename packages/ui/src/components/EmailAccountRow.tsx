import type { ComponentProps } from "react";
import { CircleAlert } from "lucide-react";
import { Avatar, type AvatarProps } from "./Avatar.tsx";
import { GuideAnchor, type GuidePointing } from "./GuideAnchor.tsx";
import { ListRow } from "./ListRow.tsx";
import { emailProviders, type EmailProvider } from "./ProviderGrid.tsx";

/** What an email brings to the tablet: its email, its calendar, its contacts. */
export type AccountUses = { mail: boolean; calendar: boolean; contacts: boolean };

/** `connected`: working; `needsSignIn`: its company wants her to sign in again, and what is on the tablet stays. */
export type AccountStatus = "connected" | "needsSignIn";

/** The color that marks one email everywhere it shows: its avatar here, its dot in Email. */
export type AccountColour = NonNullable<AvatarProps["tone"]>;

const useWords: Record<keyof AccountUses, string> = { mail: "email", calendar: "calendar", contacts: "contacts" };

/** "Email, calendar, contacts", or "Nothing turned on". */
export function usesLine(uses: AccountUses) {
  const on = (Object.keys(useWords) as (keyof AccountUses)[]).filter((use) => uses[use]).map((use) => useWords[use]).join(", ");
  return on ? on.charAt(0).toUpperCase() + on.slice(1) : "Nothing turned on";
}

export type EmailAccountRowProps = Omit<ComponentProps<"div">, "children" | "title" | "onClick"> & {
  /** The email address: "margaret.h@gmail.com". */
  address: string;
  /** The company it is with. */
  provider: EmailProvider;
  /** What it brings to the tablet. */
  uses: AccountUses;
  status: AccountStatus;
  colour: AccountColour;
  /** Opens the email's own page. */
  onOpen?: () => void;
  /** Grace pointing at this email (prototype `acc-<id>`). */
  guide?: GuidePointing;
};

/**
 * One email on the tablet in Settings › Email & calendar: its address, its company and what it brings, or that it
 * needs her to sign in again (prototype `acopen` row).
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function EmailAccountRow({ address, provider, uses, status, colour, onOpen, guide, className, ...props }: EmailAccountRowProps) {
  const company = emailProviders[provider].name;
  const row = (
    <ListRow
      className={className}
      leading={<Avatar name={address} tone={colour} size={56} aria-hidden />}
      title={<span className="truncate">{address}</span>}
      subtitle={`${company} · ${status === "needsSignIn" ? "Needs you to sign in again" : usesLine(uses)}`}
      chevron={status === "connected"}
      trailing={status === "needsSignIn" ? <CircleAlert aria-hidden size={26} strokeWidth={2.2} className="text-warn" /> : undefined}
      onClick={onOpen}
      {...props}
    />
  );
  return guide ? <GuideAnchor radius={22} placement="below" className="flex [&>div]:flex-1" {...guide}>{row}</GuideAnchor> : row;
}
