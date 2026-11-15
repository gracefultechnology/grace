import { useId, useState, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { PageText } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";

/** One piece of on-device speech software and the licence it ships under. */
export interface VoiceCredit {
  /** Its name, such as "Kokoro-82M". */
  name: string;
  /** Who made it. */
  by: string;
  /** What it does on the tablet, such as "Grace’s voice". */
  part: string;
  /** Its licence, such as "Apache License 2.0". */
  license: string;
  /** Any attribution its licence asks for. */
  note?: string;
  /** Where its source and licence are. */
  links: string[];
}

export type SettingsAboutProps = ComponentProps<"section"> & {
  /** The tablet and its version, such as "Grace tablet · 1.4". */
  device: string;
  /** Whether its software is current, such as "Everything is up to date." */
  status: string;
  title?: string;
  /** The on-device speech software, credited as its licences require wherever the voice ships. */
  credits?: VoiceCredit[];
  /** The name of the section that lists `credits`. */
  creditsLabel?: string;
  /** The credits start open. */
  defaultCreditsOpen?: boolean;
};

/**
 * Settings' About page: the tablet's name and version, whether it is up to date (prototype `setView()`, "About this
 * tablet"), and the voice software's credits, folded away until asked for.
 * @design packages/design-system/design.md#windows
 */
export function SettingsAbout({
  device,
  status,
  title = "About this tablet",
  credits = [],
  creditsLabel = "Voice software and licences",
  defaultCreditsOpen = false,
  className,
  ...props
}: SettingsAboutProps) {
  const [open, setOpen] = useState(defaultCreditsOpen);
  const listId = useId();
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      <Panel className="mt-[18px]">
        <PageText>{device}</PageText>
        <PageText tone="secondary" className="mt-1.5">{status}</PageText>
      </Panel>
      {credits.length > 0 && (
        // Prototype `.a-row`: the section folds like a row that opens in place.
        <div className="mt-3.5 rounded-row bg-panel">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
            className={cn(focusRing, "flex min-h-[76px] w-full cursor-pointer items-center gap-5 rounded-row px-[22px] text-left text-lead leading-[30px] font-bold text-chrome")}
          >
            <span className="flex-1">{creditsLabel}</span>
            <ChevronDown aria-hidden size={26} strokeWidth={2.4} className={cn("flex-none text-chevron transition-transform duration-base motion-reduce:transition-none", open && "rotate-180")} />
          </button>
          {open && (
            <ul id={listId} className="m-0 flex list-none flex-col gap-2.5 px-3.5 pt-0 pb-3.5">
              {credits.map((credit) => (
                <li key={credit.name} className="rounded-tab bg-card px-5 py-4">
                  <div className="text-body-lg leading-[30px] font-bold text-chrome">{credit.name}</div>
                  <PageText tone="secondary">{`${credit.part} · ${credit.by}`}</PageText>
                  <PageText tone="secondary">{credit.license}</PageText>
                  {credit.note && <PageText tone="secondary">{credit.note}</PageText>}
                  <div className="mt-1.5 flex flex-wrap gap-x-5">
                    {credit.links.map((link) => (
                      <a key={link} href={link} className={cn(focusRing, "rounded-sm text-body leading-[26px] font-semibold break-all text-link underline underline-offset-2")}>
                        {link.replace(/^https?:\/\//, "")}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
