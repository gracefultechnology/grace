import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type AddressBarProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "onSubmit" | "onKeyDown" | "children"
> & {
  /** The address shown: the page's, or the draft being typed. */
  value: string;
  /** Called with the text as it is edited. */
  onValueChange?: (text: string) => void;
  /** Called by Enter: go to the address. */
  onSubmit?: () => void;
  /** Grace is typing here: the field turns white and holds her lilac ring. */
  guided?: boolean;
  /** The accessible name of the field. */
  label?: string;
};

/**
 * The browser's address capsule, with a lock before the address. Empty, it shows its placeholder.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#guidance
 */
export function AddressBar({
  value,
  onValueChange,
  onSubmit,
  guided = false,
  label = "Address",
  placeholder = "Search or type a website",
  disabled,
  className,
  ...props
}: AddressBarProps) {
  return (
    // Prototype `.addr` in `.bz-bar` (line 435): the capsule's glass; `.addr.typing` (line 273) while Grace types.
    <label
      className={cn(
        "flex h-16 min-w-0 flex-1 cursor-text items-center gap-3 rounded-full px-6 text-chrome transition-[background-color,box-shadow] duration-base",
        guided
          ? "bg-background shadow-guide"
          : "bg-glass/62 shadow-capsule backdrop-blur-capsule backdrop-saturate-160 focus-within:shadow-field-focus",
        className,
      )}
    >
      {/* Prototype `#addr` lock: narrower than Lucide's `Lock`. */}
      <svg
        aria-hidden
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-chrome-muted"
      >
        <rect x={5} y={11} width={14} height={10} rx={2} />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span className="relative flex min-w-0 flex-1 text-lead font-normal">
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          value={value}
          placeholder={placeholder}
          readOnly={!onValueChange}
          onChange={(event) => onValueChange?.(event.target.value)}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !disabled) onSubmit?.();
          }}
          className="min-w-0 flex-1 bg-transparent caret-primary outline-none placeholder:text-address-placeholder"
          {...props}
        />
        {/* Prototype `.addr .caret`: Grace's caret after the text she has typed. */}
        {guided && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-pre text-transparent"
          >
            {value}
            <span className="ml-0.5 h-[22px] w-0.5 shrink-0 animate-blink bg-primary motion-reduce:animate-none" />
          </span>
        )}
      </span>
    </label>
  );
}
