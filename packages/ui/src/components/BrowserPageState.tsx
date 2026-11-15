import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, Globe, RotateCw, ShieldAlert, Wifi } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { WifiSlash } from "./Rail.tsx";
import { Spinner } from "./Spinner.tsx";

/** What stands in the website's place: it did not open, the tablet is offline, Grace stopped it, or it is being checked. */
export type BrowserPageStateKind = "failed" | "offline" | "blocked" | "checking";

/** The words of Grace's page. */
export type BrowserPageStateLabels = {
  /** The heading when the page did not open, given the site. */
  failed: (site: string) => string;
  offline: string;
  blocked: string;
  checking: string;
  retry: string;
  back: string;
  fixWifi: string;
};

export type BrowserPageStateProps = ComponentProps<"div"> & {
  kind: BrowserPageStateKind;
  /** The website, as the address shows it: "chase.com". */
  site?: string;
  /** Why, under the heading: the reason the load failed, or the reason Grace stopped the page. */
  message?: string;
  /** Called by Try again, after a failed load. */
  onRetry?: () => void;
  /** Called by Back, after Grace stopped a page; there is no way past the block. */
  onBack?: () => void;
  /** Called by Fix Wi-Fi, when the tablet is offline. */
  onFixWifi?: () => void;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<BrowserPageStateLabels>;
};

const defaultLabels: BrowserPageStateLabels = {
  failed: (site) => `${site} didn’t open`,
  offline: "Not connected to the internet",
  blocked: "Grace stopped this page",
  checking: "Checking website…",
  retry: "Try again",
  back: "Back",
  fixWifi: "Fix Wi-Fi",
};

const glyph = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

/**
 * Grace's own page in the browser's content area when no website is drawn: a load that failed, no internet,
 * a page Grace stopped for safety (with Back and no way past it), or a website being checked.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#windows
 */
export function BrowserPageState({ kind, site = "", message, onRetry, onBack, onFixWifi, labels: words, className, ...props }: BrowserPageStateProps) {
  const labels = { ...defaultLabels, ...words };
  const heading = { failed: labels.failed(site), offline: labels.offline, blocked: labels.blocked, checking: labels.checking }[kind];
  const mark: Record<BrowserPageStateKind, ReactNode> = {
    failed: <Globe size={34} strokeWidth={2} />,
    offline: <WifiSlash size={34} />,
    // spec/app/browser.md, "Load results must match the tab and request that produced them": a security block is its own result and grants no bypass.
    blocked: <ShieldAlert size={34} strokeWidth={2} />,
    checking: <Spinner size="lg" label={labels.checking} className="size-[34px]" />,
  };
  const action = {
    failed: <Button variant="prominent" size="pill" onClick={onRetry}><RotateCw {...glyph} />{labels.retry}</Button>,
    offline: <Button variant="prominent" size="pill" onClick={onFixWifi}><Wifi {...glyph} />{labels.fixWifi}</Button>,
    blocked: <Button variant="capsule" size="pill" onClick={onBack}><ArrowLeft {...glyph} />{labels.back}</Button>,
    checking: null,
  }[kind];
  return (
    // Prototype `.site` and `.newtab`: centred, 128px down the page, as an empty tab's words are.
    <div
      role={kind === "blocked" ? "alert" : "status"}
      className={cn("flex size-full flex-col items-center overflow-y-auto bg-site px-6 pt-32 pb-6 text-center font-sans text-chrome", className)}
      {...props}
    >
      {/* The icon tile of the app windows' dialogs (prototype `.a-dlg` icons), larger on the page. */}
      <span
        aria-hidden
        className={cn("flex size-[72px] items-center justify-center rounded-row", kind === "blocked" ? "bg-caution text-destructive inset-ring-[1.5px] inset-ring-destructive/22" : "bg-card text-primary shadow-panel")}
      >
        {mark[kind]}
      </span>
      <h2 className="mt-6 text-title leading-[34px] font-semibold">{heading}</h2>
      {message && kind !== "checking" && <p className="mt-2.5 max-w-[640px] text-body leading-[26px] text-address-placeholder">{message}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
