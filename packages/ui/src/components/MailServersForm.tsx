import { useState, type ComponentProps, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { PageText } from "./PageHeading.tsx";
import { TextField } from "./TextField.tsx";

/** The two mail servers she types: where email comes in, and where it goes out. */
export type MailServers = { incoming: string; outgoing: string };

export type MailServersFormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  /** The part of her address after the @: "riverview.net". */
  domain: string;
  /** The servers to start with; by default `mail.` and `smtp.` before the domain. */
  defaultServers?: MailServers;
  /** What Look them up found: `found` when the servers to start with came from it, `missing` when it found none. */
  lookup?: "looking" | "found" | "missing";
  /** The email company is being reached with these servers: Connect waits. */
  connecting?: boolean;
  /** The last Connect did not work with these servers. */
  refused?: boolean;
  /** Called by Connect once both servers are typed; without it Connect is shown but cannot be pressed. */
  onConnect?: (servers: MailServers) => void;
  /** Leaves the page; without it Cancel is not offered. */
  onCancel?: () => void;
  /** Called by Ask Grace; without it Ask Grace is not offered. */
  onAskGrace?: () => void;
  /** Called by Look them up; without it Look them up is not offered. */
  onLookUp?: () => void;
};

/**
 * Settings' page for the mail servers of an email the tablet could not set up by itself (prototype `accPage()` on
 * `servers`). The window's title is Mail settings.
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function MailServersForm({
  domain,
  defaultServers = { incoming: `mail.${domain}`, outgoing: `smtp.${domain}` },
  connecting = false,
  refused = false,
  onConnect,
  onCancel,
  onAskGrace,
  onLookUp,
  lookup,
  className,
  ...props
}: MailServersFormProps) {
  const [servers, setServers] = useState(defaultServers);
  const ready = servers.incoming.trim() !== "" && servers.outgoing.trim() !== "" && !connecting;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) onConnect?.({ incoming: servers.incoming.trim(), outgoing: servers.outgoing.trim() });
  };
  const field = (key: keyof MailServers, label: string) => (
    <TextField
      label={label}
      value={servers[key]}
      onChange={(event) => setServers({ ...servers, [key]: event.target.value })}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      className="mt-3.5 max-w-[620px]"
    />
  );
  return (
    <form aria-label="Mail settings" onSubmit={submit} className={cn("font-sans", className)} {...props}>
      {lookup !== "found" ? (
        <PageText tone="secondary">
          The tablet couldn’t find the mail settings for {domain} by itself. Your email company lists them on its help page, or Grace can look them up.
        </PageText>
      ) : !refused && (
        <PageText tone="secondary" role="status">
          Grace found the mail settings for {domain}. Check them, then tap Connect.
        </PageText>
      )}
      {lookup === "missing" && (
        <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mt-4 max-w-[620px]">
          Grace couldn’t find the mail settings for {domain}. Your email company lists them on its help page.
        </Alert>
      )}
      {refused && (
        <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mt-4 max-w-[620px]">
          These mail settings didn’t work. Check them on your email company’s help page, or ask Grace.
        </Alert>
      )}
      {field("incoming", "Incoming mail server")}
      {field("outgoing", "Outgoing mail server")}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" variant="prominent" size="pill" loading={connecting} disabled={!ready || !onConnect}>
          {connecting ? "Connecting…" : "Connect"}
        </Button>
        {onLookUp && (
          <Button variant="capsule" size="pill" loading={lookup === "looking"} disabled={connecting} onClick={onLookUp}>
            {lookup === "looking" ? "Looking them up…" : "Look them up"}
          </Button>
        )}
        {onCancel && <Button variant="capsule" size="pill" onClick={onCancel}>Cancel</Button>}
        {onAskGrace && <Button variant="capsule" size="pill" onClick={onAskGrace}>Ask Grace</Button>}
      </div>
    </form>
  );
}
