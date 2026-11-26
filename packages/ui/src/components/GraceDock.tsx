import { useCallback, useId, useState, type ComponentProps, type FocusEvent, type ReactNode } from "react";
import { ArrowUp, Keyboard } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, GracePill, press } from "./Button.tsx";
import { GraceCapsule } from "./GraceHeader.tsx";
import { SwitchTrack } from "./Switch.tsx";
import { VoiceBars } from "./VoiceBars.tsx";

const LINE = 32;
const dockProminent = cn(press, "pr-[26px] pl-[22px] shadow-none active:bg-primary-pressed");

const micIcon = (on: boolean) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {on ? (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ) : (
      <>
        <path d="M2 2l20 20" />
        <path d="M18.89 13.23A7 7 0 0 0 19 12v-1" />
        <path d="M5 11v1a7 7 0 0 0 12 5" />
        <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        <path d="M12 19v3" />
      </>
    )}
  </svg>
);

export type GraceDockProps = Omit<ComponentProps<"div">, "onChange"> & {
  /** Margaret's draft. */
  value: string;
  onValueChange?: (value: string) => void;
  /** Called by Send, and by Enter in the field. */
  onSend?: () => void;
  /** The field's helper words, such as "Talk or tap to type a message"; empty while Grace talks. */
  placeholder?: string;
  /** Margaret is talking: the bars in the field move and Send waits. */
  listening?: boolean;
  /** Whether the microphone is on. */
  mic?: boolean;
  onMicChange?: (on: boolean) => void;
  /** Why Grace cannot hear, such as no microphone permission or no speech service: the mic stays off, the reason takes the
   * field's place-holder, and typing still works. */
  micUnavailable?: string;
  /** Called by the mic pill while the mic is unavailable and `fixMicLabel` is given, such as to open Settings. */
  onFixMic?: () => void;
  /** The mic pill's words when it offers a fix, such as "Allow mic"; without them the pill is a dimmed switch. */
  fixMicLabel?: string;
  /** Grace's turn: the field dims and offers no Send, though tapping it still works. */
  quiet?: boolean;
  /** The most lines the field grows to before it scrolls: 4 compact, 6 expanded. */
  maxLines?: number;
  /** The Attach pill and its menu, a `GraceAttachMenu`. */
  attach?: ReactNode;
  /** Called when the field takes focus, such as to open the tablet's keyboard. */
  onFieldFocus?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  sendLabel?: string;
  micOnLabel?: string;
  micOffLabel?: string;
  /** The field's accessible name. */
  fieldLabel?: string;
  /** Set-up's Talk in place of the Mic switch: filled on Margaret's turn, a keyline while she is `listening`. */
  setup?: boolean;
  /** Called by Talk during set-up. */
  onTalk?: () => void;
  talkLabel?: string;
  /** Set-up's composer is open (the keyboard is up), so Type gives way. */
  composerOpen?: boolean;
  /** Called by Type during set-up, to open the composer and the keyboard. */
  onType?: () => void;
  typeLabel?: string;
  /** Set-up without internet: Talk gives way and Type is the main button. */
  offline?: boolean;
};

/**
 * Grace's answer row: the field, Send when there is a draft, and Attach with the Mic switch (prototype `.dock`), or during
 * set-up Talk and Type.
 * The field grows upward a line at a time.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceDock({
  value,
  onValueChange,
  onSend,
  placeholder,
  listening = false,
  mic = true,
  onMicChange,
  micUnavailable,
  onFixMic,
  fixMicLabel,
  quiet = false,
  maxLines = 4,
  attach,
  onFieldFocus,
  sendLabel = "Send",
  micOnLabel = "Mic on",
  micOffLabel = "Mic off",
  fieldLabel = "Message to Grace",
  setup = false,
  onTalk,
  talkLabel = "Talk",
  composerOpen = false,
  onType,
  typeLabel = "Type",
  offline = false,
  className,
  ...props
}: GraceDockProps) {
  const [multi, setMulti] = useState(false);
  const fieldRef = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize[0]?.blockSize;
      if (height !== undefined) setMulti(height > LINE);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const reasonId = useId();
  const draft = value.trim().length > 0;
  const hears = mic && !micUnavailable;
  return (
    <div className={cn("flex items-end gap-2", className)} {...props}>
      <label
        data-multi={multi || undefined}
        className={cn(
          "flex min-h-16 min-w-0 flex-1 cursor-text items-center gap-3 rounded-full bg-glass/62 py-4 pr-4 pl-6 shadow-capsule backdrop-blur-capsule backdrop-saturate-160 group-data-moving/grace:bg-glass/92 group-data-moving/grace:backdrop-blur-none group-data-moving/grace:backdrop-saturate-100 data-multi:items-end data-multi:rounded-window",
          quiet && "opacity-70",
        )}
      >
        {!quiet && hears && (listening || !draft) && <VoiceBars state={listening ? "live" : "idle"} />}
        <textarea
          ref={fieldRef}
          rows={1}
          aria-label={fieldLabel}
          value={value}
          placeholder={micUnavailable ?? placeholder}
          onChange={(event) => onValueChange?.(event.target.value)}
          onFocus={onFieldFocus}
          style={{ maxHeight: maxLines * LINE }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend?.();
            }
          }}
          className="m-0 min-h-8 min-w-0 flex-1 resize-none field-sizing-content overflow-y-auto border-0 bg-transparent p-0 font-sans text-lead leading-8 font-medium text-grace-ink caret-primary outline-none placeholder:text-placeholder placeholder:opacity-100"
        />
      </label>
      {!quiet && draft && !listening && (
        <Button variant="prominent" size="pill" className={dockProminent} onClick={onSend}>
          <ArrowUp size={24} strokeWidth={2.4} aria-hidden />
          {sendLabel}
        </Button>
      )}
      <GraceCapsule className="self-end">
        {attach}
        {setup && offline && !listening ? null : setup ? (
          <Button
            variant={listening ? "capsule" : "prominent"}
            size="pill"
            aria-pressed={listening}
            className={listening ? "pr-[26px] pl-[22px] shadow-none inset-ring-2 inset-ring-primary" : dockProminent}
            onClick={onTalk}
          >
            {micIcon(true)}
            {talkLabel}
          </Button>
        ) : micUnavailable === undefined ? (
          <GracePill role="switch" aria-checked={mic} onClick={() => onMicChange?.(!mic)} className="pr-3">
            {micIcon(mic)}
            {mic ? micOnLabel : micOffLabel}
            <SwitchTrack checked={mic} />
          </GracePill>
        ) : fixMicLabel ? (
          <GracePill aria-describedby={reasonId} onClick={onFixMic}>
            {micIcon(false)}
            {fixMicLabel}
          </GracePill>
        ) : (
          <GracePill role="switch" aria-checked={false} aria-disabled aria-describedby={reasonId} className="pr-3">
            {micIcon(false)}
            {micOffLabel}
            <SwitchTrack checked={false} className="opacity-40" />
          </GracePill>
        )}
        {setup && !composerOpen ? (
          offline && !listening ? (
            <Button variant="prominent" size="pill" data-open-keyboard className={dockProminent} onClick={onType}>
              <Keyboard size={22} strokeWidth={2} aria-hidden />
              {typeLabel}
            </Button>
          ) : (
            <GracePill data-open-keyboard onClick={onType}>
              <Keyboard size={22} strokeWidth={2} aria-hidden />
              {typeLabel}
            </GracePill>
          )
        ) : null}
        {micUnavailable !== undefined && (
          <span id={reasonId} hidden>
            {micUnavailable}
          </span>
        )}
      </GraceCapsule>
    </div>
  );
}
