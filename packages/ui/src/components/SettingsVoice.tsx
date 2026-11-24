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
  /** Whether "Hey Grace" is on, off, unavailable, or waiting for set-up. */
  wake: WakeState;
  onWakeChange?: (on: boolean) => void;
  /** Opens set-up or asks for microphone permission, depending on what is missing. */
  onFixWake?: () => void;
};

export type WakeState = "on" | "off" | "unavailable" | "needsSetup" | "noMicrophone";

const foreground = "Works in Grace, including her sleep screen.";

const wakeReasons: Record<WakeState, string | null> = {
  on: null,
  off: null,
  unavailable: "Not available on this device.",
  needsSetup: "Finish set-up to use “Hey Grace”.",
  noMicrophone: "Grace can’t listen until the tablet lets her use the microphone.",
};

const speedLabel = "How fast she speaks";

/**
 * Settings' page for Grace's voice: a sample, how fast she speaks, whether she speaks aloud, which uses the internet,
 * and whether she listens for "Hey Grace" (prototype `setView()`, "Grace’s voice").
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
  onFixWake,
  className,
  ...props
}: SettingsVoiceProps) {
  const reason = wakeReasons[wake];
  return (
    <section aria-label="Grace’s voice" className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>Grace’s voice</SettingsPageHeading>
      {onPlaySample && <ListRow
        className="mt-[18px] min-h-[76px]"
        title="Hear Grace"
        trailing={
          <Button variant="capsule" size="pill" className="h-13 pr-[26px] pl-[22px]" onClick={onPlaySample}>
            <PlayIcon className="size-5" />
            Play a sample
          </Button>
        }
      />}
      <PageHeading level="section" className="mt-5">{speedLabel}</PageHeading>
      <SegmentedControl aria-label={speedLabel} className="mt-2.5" options={speeds} value={speed} onValueChange={(next) => next && onSpeedChange?.(next)} />
      <SettingsSwitchRow className="mt-3.5 min-h-[76px]" title="Grace speaks out loud" subtitle="Her voice comes over the internet." checked={speaks} onCheckedChange={onSpeaksChange} />
      <SettingsSwitchRow
        className="mt-2.5"
        title="Listen for “Hey Grace”"
        subtitle={reason ? <span className="text-label-ink">{reason}</span> : foreground}
        checked={wake === "on" || wake === "needsSetup" || wake === "noMicrophone"}
        onCheckedChange={onWakeChange}
        disabled={wake === "unavailable" || onWakeChange === undefined}
      />
      {onFixWake && (wake === "needsSetup" || wake === "noMicrophone") && (
        <Button variant="capsule" size="pill" className="mt-3.5" onClick={onFixWake}>
          {wake === "needsSetup" ? "Set up “Hey Grace”" : "Allow microphone"}
        </Button>
      )}
    </section>
  );
}
