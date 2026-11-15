import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { GracePill } from "./GraceHeader.tsx";
import { Menu, MenuLabel, MenuOption, type MenuProps } from "./Menu.tsx";
import { SwitchTrack } from "./Switch.tsx";

// Prototype ICON.spkOn and ICON.spkOff, 22px.
const speaker = (on: boolean) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d={on ? "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" : "m16 9 6 6M22 9l-6 6"} />
  </svg>
);

type Speed = "slower" | "normal" | "faster";

export type GraceVoiceMenuProps = Omit<MenuProps, "trigger" | "children"> & {
  /** Whether Grace speaks her messages aloud. */
  voiceOn?: boolean;
  onVoiceChange?: (on: boolean) => void;
  /** How fast she speaks. */
  speed?: Speed;
  onSpeedChange?: (speed: Speed) => void;
  /** The pill's words. */
  label?: string;
  voiceOnLabel?: string;
  voiceOffLabel?: string;
  speedLabel?: string;
  /** The words of each speed. */
  speeds?: Record<Speed, string>;
  /** The pill's accessible name, saying the current voice and speed. */
  triggerLabel?: string;
};

/**
 * Grace's Voice pill and its menu: voice on or off, and her speed (prototype `#spdB`, `#spdPop`). It opens upward
 * over the page in the compact window; pass `side="bottom"` in the expanded one.
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#grace
 */
export function GraceVoiceMenu({
  voiceOn = true,
  onVoiceChange,
  speed = "normal",
  onSpeedChange,
  label = "Voice",
  voiceOnLabel = "Voice on",
  voiceOffLabel = "Voice off",
  speedLabel = "Speed",
  speeds = { slower: "Slower", normal: "Normal", faster: "Faster" },
  triggerLabel = `Grace’s voice: ${voiceOn ? "on" : "off"}, speed ${speeds[speed]}`,
  side = "top",
  sideOffset = 16,
  className,
  ...props
}: GraceVoiceMenuProps) {
  return (
    // .spdpop: 16px from the pill; its 270px rows inside 8px of padding.
    <Menu
      side={side}
      sideOffset={sideOffset}
      className={cn("min-w-[286px]", className)}
      trigger={
        <GracePill aria-label={triggerLabel}>
          {speaker(voiceOn)}
          {label}
          <ChevronDown size={18} strokeWidth={2.4} aria-hidden />
        </GracePill>
      }
      {...props}
    >
      {/* #voiceC: a 56px header pill with no fill; the menu stays open so the switch's new state shows. */}
      <MenuOption
        role="menuitemcheckbox"
        aria-checked={voiceOn}
        className="h-14 justify-between gap-2.5 bg-transparent pr-5 pl-4"
        onSelect={(event) => {
          event.preventDefault();
          onVoiceChange?.(!voiceOn);
        }}
      >
        {speaker(voiceOn)}
        <span>{voiceOn ? voiceOnLabel : voiceOffLabel}</span>
        <SwitchTrack checked={voiceOn} />
      </MenuOption>
      <MenuLabel className="leading-5">{speedLabel}</MenuLabel>
      {(Object.keys(speeds) as Speed[]).map((s) => (
        <MenuOption key={s} selected={s === speed} onSelect={() => onSpeedChange?.(s)}>
          {speeds[s]}
        </MenuOption>
      ))}
    </Menu>
  );
}
