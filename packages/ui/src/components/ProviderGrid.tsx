import { Fragment, type ComponentProps } from "react";
import { Mail } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { guided, type Guide } from "./GuideAnchor.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";

export type EmailProvider = "gmail" | "outlook" | "yahoo" | "icloud" | "aol" | "other";

/**
 * Each email company the tablet signs in to: its name, the article its name takes by how it is said ("an Outlook",
 * "a Yahoo"), the letter on its tile (none: an envelope) and a line under it.
 */
export const emailProviders: Record<EmailProvider, { name: string; article: "a" | "an"; mark?: string; subtitle?: string }> = {
  gmail: { name: "Gmail", article: "a", mark: "G" },
  outlook: { name: "Outlook", article: "an", mark: "O", subtitle: "Also Hotmail, Live and MSN" },
  yahoo: { name: "Yahoo", article: "a", mark: "Y" },
  icloud: { name: "iCloud", article: "an", mark: "i", subtitle: "Apple’s email" },
  aol: { name: "AOL", article: "an", mark: "A" },
  other: { name: "Other email", article: "an" },
};

const allProviders = Object.keys(emailProviders) as EmailProvider[];

/** An email company's tile: its letter, or an envelope for Other email (prototype `.actile`). */
export function ProviderTile({ provider, className, ...props }: ComponentProps<"span"> & { provider: EmailProvider }) {
  const { mark } = emailProviders[provider];
  return (
    <span aria-hidden className={cn("flex size-[52px] flex-none items-center justify-center rounded-tile bg-accent text-lead font-extrabold text-primary", className)} {...props}>
      {mark ?? <Mail size={26} strokeWidth={2} />}
    </span>
  );
}

const defaultLabels = {
  heading: "Which email do you use?",
  helpTitle: "Not sure which?",
  helpText: "Look at your email address: the part after the @ tells you. Grace can help.",
  askGrace: "Ask Grace",
};

export type ProviderGridProps = Omit<ComponentProps<"div">, "children"> & {
  /** The companies to offer, in order. */
  providers?: readonly EmailProvider[];
  /** Called with the company she taps; without it the tiles are not pressable. */
  onChoose?: (provider: EmailProvider) => void;
  /** Only the tiles, without the question above them or the help below (prototype Add an email). */
  bare?: boolean;
  /** Called by Ask Grace in "Not sure which?"; without it Ask Grace is not offered. */
  onAskGrace?: () => void;
  /** Grace pointing at one company's tile (prototype `prov-<Name>`). */
  guide?: Guide<EmailProvider>;
  labels?: Partial<typeof defaultLabels>;
};

/**
 * The email companies to sign in to, two to a row, with a way to ask Grace which is hers (prototype `provGrid()`).
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function ProviderGrid({ providers = allProviders, onChoose, bare = false, onAskGrace, guide, labels, className, ...props }: ProviderGridProps) {
  const words = { ...defaultLabels, ...labels };
  return (
    <div className={cn("font-sans", className)} {...props}>
      {!bare && <PageHeading level="section" className="mt-[22px]">{words.heading}</PageHeading>}
      <div className={cn("grid grid-cols-2 gap-3", bare ? "mt-4" : "mt-3")}>
        {providers.map((provider) => {
          const { name, subtitle } = emailProviders[provider];
          const row = <ListRow className="min-h-[84px]" leading={<ProviderTile provider={provider} />} title={name} subtitle={subtitle} onClick={onChoose && (() => onChoose(provider))} />;
          return <Fragment key={provider}>{guided(guide, provider, row, { radius: 22, placement: "below", className: "flex [&>div]:flex-1" })}</Fragment>;
        })}
      </div>
      {!bare && (
        <Panel className="mt-[18px] flex items-center gap-4 px-5 py-4">
          <div className="flex-1">
            <p className="m-0 text-body leading-[30px] font-bold text-chrome">{words.helpTitle}</p>
            <p className="m-0 text-body leading-[26px] font-medium text-muted-foreground">{words.helpText}</p>
          </div>
          {onAskGrace && <Button variant="capsule" size="pill" onClick={onAskGrace}>{words.askGrace}</Button>}
        </Panel>
      )}
    </div>
  );
}
