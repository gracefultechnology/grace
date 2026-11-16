import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { PageText } from "./PageHeading.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
import { Panel } from "./Panel.tsx";
import { SettingsSwitchRow } from "./SettingsSwitchRow.tsx";
import { Slider } from "./Slider.tsx";

export type SettingsBrightnessProps = Omit<ComponentProps<"section">, "onChange"> & {
  /** Screen brightness, `min` to 100. */
  brightness: number;
  /** The dimmest the screen goes (spec/app/preferences.md: never below 20). */
  min?: number;
  /** Called with the new brightness: dragged, tapped or stepped by − and +. */
  onBrightnessChange?: (brightness: number) => void;
  /** The screen dims itself at night. */
  nightDim: boolean;
  onNightDimChange?: (on: boolean) => void;
  title?: string;
  /** What brightness is for, under the title. */
  description?: string;
  /** The slider's name. */
  brightnessLabel?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** The night dimming setting's name. */
  nightDimLabel?: string;
  /** When night dimming applies, as the app formats it: "From 9 pm to 7 am, easier on the eyes". */
  nightDimHint?: string;
};

export type SunIconProps = Omit<ComponentProps<"svg">, "children"> & {
  /** Width and height in pixels. */
  size?: number;
};

/** Brightness's sun, as Settings' list and page show it. Decorative. */
export function SunIcon({ size = 28, ...props }: SunIconProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  );
}

/**
 * Settings' Brightness page: the screen's brightness between − and +, and dimming at night
 * (prototype `setView()`, "Brightness").
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsBrightness({
  brightness,
  min = 20,
  onBrightnessChange,
  nightDim,
  onNightDimChange,
  title = "Brightness",
  description = "How bright the screen is. Lower it in the evening if the screen feels glaring.",
  brightnessLabel = "Screen brightness",
  decreaseLabel = "Dimmer",
  increaseLabel = "Brighter",
  nightDimLabel = "Dim the screen at night",
  nightDimHint,
  className,
  ...props
}: SettingsBrightnessProps) {
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      <PageText tone="secondary" className="mt-1.5">{description}</PageText>
      <Panel className="mt-[22px]">
        <div className="flex items-center gap-3 text-title-sm leading-8 font-bold text-chrome">
          <SunIcon />
          {brightnessLabel}
          <span className="ml-auto text-body leading-[26px] font-bold text-muted-foreground">{`${brightness}%`}</span>
        </div>
        <Slider
          className="mt-[18px]"
          label={brightnessLabel}
          decreaseLabel={decreaseLabel}
          increaseLabel={increaseLabel}
          min={min}
          value={brightness}
          onValueChange={onBrightnessChange}
        />
      </Panel>
      <SettingsSwitchRow className="mt-3.5" title={nightDimLabel} subtitle={nightDimHint} checked={nightDim} onCheckedChange={onNightDimChange} />
    </section>
  );
}
