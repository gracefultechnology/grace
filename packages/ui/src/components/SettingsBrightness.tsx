import type { ComponentProps } from "react";
import { Sun } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";
import { SettingsSwitchRow } from "./SettingsSwitchRow.tsx";
import { Slider } from "./Slider.tsx";

export type SettingsBrightnessProps = Omit<ComponentProps<"section">, "onChange"> & {
  /** Screen brightness, 0 to 100. */
  brightness: number;
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

/**
 * Settings' Brightness page: the screen's brightness between − and +, and dimming at night
 * (prototype `setView()`, "Brightness").
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsBrightness({
  brightness,
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
      <PageHeading>{title}</PageHeading>
      <PageText tone="secondary" className="mt-1.5">{description}</PageText>
      <Panel className="mt-[22px]">
        {/* Prototype `.a-panel .a-h` with the value at its end. */}
        <div className="flex items-center gap-3 text-title-sm leading-8 font-bold text-chrome">
          <Sun size={28} strokeWidth={2} aria-hidden />
          {brightnessLabel}
          <span className="ml-auto text-body leading-[26px] font-bold text-muted-foreground">{brightness}%</span>
        </div>
        <Slider
          className="mt-[18px]"
          label={brightnessLabel}
          decreaseLabel={decreaseLabel}
          increaseLabel={increaseLabel}
          value={brightness}
          onValueChange={onBrightnessChange}
        />
      </Panel>
      <SettingsSwitchRow className="mt-3.5" title={nightDimLabel} subtitle={nightDimHint} checked={nightDim} onCheckedChange={onNightDimChange} />
    </section>
  );
}
