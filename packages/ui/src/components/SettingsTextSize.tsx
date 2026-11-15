import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { PageText } from "./PageHeading.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
import { Panel } from "./Panel.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

export type SettingsTextSizeProps = Omit<ComponentProps<"section">, "onChange"> & {
  /** The sizes to choose from, smallest first. */
  sizes: string[];
  /** The chosen size. */
  value: string;
  /** Called with the size a person chooses; the preview and every word on the tablet follow it. */
  onValueChange?: (size: string) => void;
  /** The preview's greeting, as Home shows it: "Good morning, Margaret". */
  greeting: string;
  /** The preview's appointment: when, such as "SAT 10 am". */
  eventWhen: string;
  /** The preview's appointment: what. */
  eventTitle: string;
  /** The preview's line from Grace. */
  graceMessage: string;
  title?: string;
  /** What the setting changes, under the title. */
  description?: string;
};

/**
 * Settings' Text size page: a preview of Home, an appointment and Grace's words, over the sizes to choose from
 * (prototype `setView()`, "Text size").
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsTextSize({
  sizes,
  value,
  onValueChange,
  greeting,
  eventWhen,
  eventTitle,
  graceMessage,
  title = "Text size",
  description = "Changes the size of words everywhere on the tablet: Home, every app, websites, the left side and Grace’s messages.",
  className,
  ...props
}: SettingsTextSizeProps) {
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      <PageText tone="secondary" className="mt-1.5">{description}</PageText>
      <Panel className="mt-[22px] flex flex-col gap-3.5">
        <div className="text-title-sm leading-[1.25] font-bold text-chrome">{greeting}</div>
        <div className="flex items-center gap-3.5 rounded-tab bg-card px-4 py-2.5 text-body-lg leading-[1.25] font-bold text-chrome">
          <span className="text-alert">{eventWhen}</span>
          {eventTitle}
        </div>
        <div className="flex">
          {/* Prototype `.chat-white .gb`: Grace's lilac bubble. */}
          <div className="ml-2 rounded-day bg-bubble px-[22px] py-3 text-lead leading-8 font-medium text-grace-ink">{graceMessage}</div>
        </div>
      </Panel>
      <SegmentedControl
        aria-label={title}
        className="mt-[22px]"
        options={sizes.map((size) => ({ value: size, label: size }))}
        value={value}
        onValueChange={(next) => next && onValueChange?.(next)}
      />
    </section>
  );
}
