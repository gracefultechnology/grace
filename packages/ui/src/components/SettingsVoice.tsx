import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { SegmentedControl, type SegmentedOption } from "./SegmentedControl.tsx";
import { SettingsSwitchRow } from "./SettingsSwitchRow.tsx";

export type SettingsVoiceProps = Omit<ComponentProps<"section">, "onChange"> & {
  /** The speeds Grace can speak at, slowest first. */
  speeds: SegmentedOption[];
  /** The chosen speed's value. */
  speed: string;
  onSpeedChange?: (speed: string) => void;
  /** Called by "Play a sample": Grace says a line at the chosen speed. */
  onPlaySample?: () => void;
  /** Grace speaks her words aloud. */
  speaks: boolean;
  onSpeaksChange?: (on: boolean) => void;
  /** The tablet listens for "Hey Grace". */
  wake: boolean;
  onWakeChange?: (on: boolean) => void;
  title?: string;
  sampleTitle?: string;
  sampleLabel?: string;
  speedLabel?: string;
  speaksLabel?: string;
  wakeLabel?: string;
  /** What listening for "Hey Grace" means. */
  wakeHint?: string;
};

/**
 * Settings' page for Grace's voice: a sample, how fast she speaks, whether she speaks aloud and whether she listens for
 * "Hey Grace" (prototype `setView()`, "Grace’s voice").
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsVoice({
  speeds,
  speed,
  onSpeedChange,
  onPlaySample,
  speaks,
  onSpeaksChange,
  wake,
  onWakeChange,
  title = "Grace’s voice",
  sampleTitle = "Hear Grace",
  sampleLabel = "Play a sample",
  speedLabel = "How fast she speaks",
  speaksLabel = "Grace speaks out loud",
  wakeLabel = "Listen for “Hey Grace”",
  wakeHint = "Works any time, even when the screen is asleep. Turn off to use Ask Grace only.",
  className,
  ...props
}: SettingsVoiceProps) {
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <PageHeading>{title}</PageHeading>
      <ListRow
        className="mt-[18px] min-h-[76px]"
        title={sampleTitle}
        trailing={
          <Button variant="capsule" size="pill" className="h-13 pr-[26px] pl-[22px]" onClick={onPlaySample}>
            {/* Prototype `axi('play',20,2.2)`: a smaller, sharper triangle than Lucide's Play. */}
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 5v14l12-7z" />
            </svg>
            {sampleLabel}
          </Button>
        }
      />
      <PageHeading level="section" className="mt-5">{speedLabel}</PageHeading>
      <SegmentedControl aria-label={speedLabel} className="mt-2.5" options={speeds} value={speed} onValueChange={(next) => next && onSpeedChange?.(next)} />
      <SettingsSwitchRow className="mt-3.5 min-h-[76px]" title={speaksLabel} checked={speaks} onCheckedChange={onSpeaksChange} />
      <SettingsSwitchRow className="mt-2.5" title={wakeLabel} subtitle={wakeHint} checked={wake} onCheckedChange={onWakeChange} />
    </section>
  );
}
