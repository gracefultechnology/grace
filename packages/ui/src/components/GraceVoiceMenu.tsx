import { ChevronDown, MessageSquarePlus, RotateCcw } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { press } from "./Button.tsx";
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
  /** Offers Say it again, which reads her latest message aloud even with the mic off: true when she has one, false
   * (dimmed) before she has said anything; left out, there is no such option. */
  canRepeat?: boolean;
  onRepeat?: () => void;
  repeatLabel?: string;
  /** Offers New conversation; only when no unfinished task remains. */
  canStartOver?: boolean;
  onNewConversation?: () => void;
  newConversationLabel?: string;
};

/**
 * Grace's Voice pill and its menu: voice on or off, her speed, and Say it again and New conversation where offered
 * (prototype `#spdB`, `#spdPop`). It opens upward
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
  canRepeat,
  onRepeat,
  repeatLabel = "Say it again",
  canStartOver = false,
  onNewConversation,
  newConversationLabel = "New conversation",
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
      {/* #voiceC: a 56px header pill with no fill that grows on a tap (.pill:active); the menu stays open so the switch's new state shows. */}
      <MenuOption
        role="menuitemcheckbox"
        aria-checked={voiceOn}
        className={cn(press, "h-14 justify-between gap-2.5 bg-transparent pr-5 pl-4 data-[highlighted]:bg-transparent")}
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
        // #spdPop .spdo.sel: ICON.check, 20px at stroke 2.4.
        <MenuOption key={s} selected={s === speed} className="[&>svg]:size-5 [&>svg]:stroke-[2.4]" onSelect={() => onSpeedChange?.(s)}>
          {speeds[s]}
        </MenuOption>
      ))}
      {/* spec/app/conversation.md, "Repeat reads the latest Grace response without turning on a muted microphone" */}
      {canRepeat !== undefined && (
        <MenuOption icon={<RotateCcw size={24} strokeWidth={2.2} aria-hidden />} disabled={!canRepeat} className="mt-2" onSelect={onRepeat}>
          {repeatLabel}
        </MenuOption>
      )}
      {/* spec/app/conversation.md, "A deliberate new conversation clears the old view but never reuses callback tokens" */}
      {canStartOver && (
        <MenuOption icon={<MessageSquarePlus size={24} strokeWidth={2.2} aria-hidden />} className={cn(canRepeat === undefined && "mt-2")} onSelect={onNewConversation}>
          {newConversationLabel}
        </MenuOption>
      )}
    </Menu>
  );
}
