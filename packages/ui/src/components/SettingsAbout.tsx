import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { PageText } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";

export type SettingsAboutProps = ComponentProps<"section"> & {
  /** The tablet and its version, such as "Grace tablet · 1.4". */
  device: string;
  /** Whether its software is current, such as "Everything is up to date." */
  status: string;
};

/**
 * Settings' About page: the tablet's name and version, and whether it is up to date (prototype `setView()`, "About this
 * tablet").
 * @design packages/design-system/design.md#windows
 */
export function SettingsAbout({ device, status, className, ...props }: SettingsAboutProps) {
  return (
    <section aria-label="About this tablet" className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>About this tablet</SettingsPageHeading>
      <Panel className="mt-[18px]">
        <PageText>{device}</PageText>
        <PageText tone="secondary" className="mt-1.5">{status}</PageText>
      </Panel>
    </section>
  );
}
