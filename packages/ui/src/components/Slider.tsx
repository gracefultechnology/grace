import { useState, type ComponentProps } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Minus, Plus } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type SliderProps = Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** The value, for a slider its owner controls. */
  value?: number;
  /** The first value, for a slider that keeps its own. */
  defaultValue?: number;
  /** Called with each new value: dragged, tapped, keyed or stepped by − and +. */
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  /** How far − and + and the arrow keys move it. */
  step?: number;
  /** The name of the slider itself, such as "Screen brightness". */
  label: string;
  /** The name of −, such as "Dimmer" or "Quieter". */
  decreaseLabel?: string;
  /** The name of +, such as "Brighter" or "Louder". */
  increaseLabel?: string;
  disabled?: boolean;
};

/**
 * A level between two ends, such as brightness or volume: a track between round − and + buttons (prototype .vol).
 * @design packages/design-system/design.md#buttons
 */
export function Slider({ value, defaultValue = 50, onValueChange, min = 0, max = 100, step = 10, label, decreaseLabel = "Less", increaseLabel = "More", disabled, className, ...props }: SliderProps) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const set = (next: number) => {
    if (disabled) return;
    const clamped = Math.min(max, Math.max(min, next));
    setOwn(clamped);
    onValueChange?.(clamped);
  };
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-40", className)} {...props}>
      <Button variant="capsule" size="pill-icon" aria-label={decreaseLabel} disabled={disabled || current <= min} onClick={() => set(current - step)} className="text-chrome disabled:opacity-40">
        <Minus size={28} strokeWidth={2.6} aria-hidden />
      </Button>
      {/* .vol .tr: a 14px track; the thumb travels inside its ends. */}
      <SliderPrimitive.Root value={[current]} onValueChange={([next]) => set(next)} min={min} max={max} step={1} disabled={disabled} className="relative flex h-10 flex-1 touch-none items-center select-none">
        <SliderPrimitive.Track className="relative h-3.5 grow overflow-hidden rounded-full bg-primary/12">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb aria-label={label} className={cn(focusRing, "block size-10 rounded-full bg-card shadow-thumb focus-visible:ring-2")} />
      </SliderPrimitive.Root>
      <Button variant="capsule" size="pill-icon" aria-label={increaseLabel} disabled={disabled || current >= max} onClick={() => set(current + step)} className="text-chrome disabled:opacity-40">
        <Plus size={28} strokeWidth={2.6} aria-hidden />
      </Button>
    </div>
  );
}
