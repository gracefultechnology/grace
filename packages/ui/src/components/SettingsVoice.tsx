import type { ComponentProps } from "react";
import { PlayIcon } from "../icons.tsx";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
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
  /** Why the tablet cannot listen for "Hey Grace" now, such as no microphone permission: its switch is off and waits. */
  wakeUnavailable?: string;
  /** Shows a button under `wakeUnavailable` that fixes it, such as "Allow microphone". */
  canFixWake?: boolean;
  /** Called by that button. */
  onFixWake?: () => void;
  /** The words of that button. */
  fixWakeLabel?: string;
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
  wakeUnavailable,
  canFixWake = false,
  onFixWake,
  fixWakeLabel = "Allow microphone",
  className,
  ...props
}: SettingsVoiceProps) {
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      <ListRow
        className="mt-[18px] min-h-[76px]"
        title={sampleTitle}
        trailing={
          <Button variant="capsule" size="pill" className="h-13 pr-[26px] pl-[22px]" onClick={onPlaySample}>
            <PlayIcon className="size-5" />
            {sampleLabel}
          </Button>
        }
      />
      <PageHeading level="section" className="mt-5">{speedLabel}</PageHeading>
      <SegmentedControl aria-label={speedLabel} className="mt-2.5" options={speeds} value={speed} onValueChange={(next) => next && onSpeedChange?.(next)} />
      <SettingsSwitchRow className="mt-3.5 min-h-[76px]" title={speaksLabel} checked={speaks} onCheckedChange={onSpeaksChange} />
      <SettingsSwitchRow
        className="mt-2.5"
        title={wakeLabel}
        subtitle={wakeUnavailable ? <span className="text-label-ink">{wakeUnavailable}</span> : wakeHint}
        checked={wake && !wakeUnavailable}
        onCheckedChange={onWakeChange}
        disabled={!!wakeUnavailable}
      />
      {wakeUnavailable && canFixWake && (
        <Button variant="capsule" size="pill" className="mt-3.5" onClick={onFixWake}>
          {fixWakeLabel}
        </Button>
      )}
    </section>
  );
}
