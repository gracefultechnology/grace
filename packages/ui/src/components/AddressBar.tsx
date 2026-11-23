import { type ComponentProps, useId } from "react";
import { Info, Lock } from "lucide-react";
import { cn } from "../lib/cn.ts";

export type AddressBarProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "onSubmit" | "onKeyDown" | "children"
> & {
  /** The address shown: the page's, or the draft being typed. */
  value: string;
  /** The address the loaded page reached over an encrypted connection; the lock shows only while `value` is that address. */
  secureAddress?: string;
  /** Called with the text as it is edited. */
  onValueChange?: (text: string) => void;
  /** Called by Enter: go to the address. */
  onSubmit?: () => void;
  /** Grace is typing here: her caret follows the text and the placeholder gives way. Her ring is the guide overlay's. */
  guided?: boolean;
  /** Why Go did nothing, under the field, such as after Go with an empty address; it stays while the person types. */
  notice?: string;
  /** The accessible name of the field. */
  label?: string;
};

/**
 * The browser's address capsule, with a lock for the loaded page's encrypted connection. Empty, it shows its placeholder; a `notice`
 * under it explains a Go that could not go.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#guidance
 */
export function AddressBar({
  value,
  secureAddress,
  onValueChange,
  onSubmit,
  guided = false,
  notice,
  label = "Address",
  placeholder = "Search or type a website",
  disabled,
  className,
  "aria-describedby": describedBy,
  ...props
}: AddressBarProps) {
  const noticeId = useId();
  const connectionId = useId();
  const encrypted = !!secureAddress && secureAddress === value;
  return (
    <label
      className={cn(
        "relative flex h-16 min-w-0 flex-1 cursor-text items-center gap-3 rounded-full bg-glass/62 px-6 text-chrome shadow-capsule backdrop-blur-capsule backdrop-saturate-160",
        className,
      )}
    >
      {encrypted && (
        <>
          <Lock aria-hidden size={22} className="shrink-0 text-chrome-muted" />
          <span id={connectionId} className="sr-only">Encrypted connection</span>
        </>
      )}
      <span className="relative flex min-w-0 flex-1 text-lead font-normal">
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-describedby={[describedBy, encrypted && connectionId, notice && noticeId].filter(Boolean).join(" ") || undefined}
          value={value}
          placeholder={guided ? undefined : placeholder}
          readOnly={!onValueChange}
          onChange={(event) => onValueChange?.(event.target.value)}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !disabled) onSubmit?.();
          }}
          className="min-w-0 flex-1 bg-transparent caret-primary outline-none placeholder:text-address-placeholder"
          {...props}
        />
        {guided && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden whitespace-pre text-transparent"
          >
            {value}
            <span className="ml-0.5 inline-block h-[22px] w-0.5 animate-blink bg-primary motion-reduce:animate-none" />
          </span>
        )}
      </span>
      {notice && (
        <span id={noticeId} role="status" className="absolute top-full left-3 z-10 mt-3 flex cursor-default items-center gap-2.5 rounded-row bg-card py-3 pr-5 pl-4 text-body leading-[26px] font-semibold whitespace-nowrap text-label-ink shadow-tag">
          <Info size={22} strokeWidth={2.2} aria-hidden className="shrink-0 text-primary" />
          {notice}
        </span>
      )}
    </label>
  );
}
