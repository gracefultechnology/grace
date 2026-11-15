import type { ComponentProps } from "react";

export type WifiSignalProps = Omit<ComponentProps<"svg">, "children"> & {
  /** Bars of signal lit, 0 (the dot only) to 3. */
  strength: number;
  /** Width and height in pixels. */
  size?: number;
  /** The strength in words, such as "Strong signal"; without it the icon is decorative. */
  label?: string;
};

/**
 * A network's signal strength: the Wi-Fi arcs, lit up to its strength and pale beyond it (prototype `sigIc`).
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiSignal({ strength, size = 26, label, ...props }: WifiSignalProps) {
  const arc = (bar: number) => (strength >= bar ? "var(--chrome)" : "var(--switch-off)");
  return (
    <svg
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      className="shrink-0"
      {...props}
    >
      <path d="M12 20h.01" stroke="var(--chrome)" strokeWidth="2.6" />
      <path d="M8.5 16.43a5 5 0 0 1 7 0" stroke={arc(1)} strokeWidth="2" />
      <path d="M5 12.86a10 10 0 0 1 14 0" stroke={arc(2)} strokeWidth="2" />
      <path d="M2 8.82a15 15 0 0 1 20 0" stroke={arc(3)} strokeWidth="2" />
    </svg>
  );
}
