import { useState, type ComponentProps } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Minus, Plus } from "lucide-react";
import { cn } from "../lib/cn.ts";
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
  // prototype .vol .rb: the capsule look, pressed to 96%; at an end it stays as it is and a tap changes nothing.
  const end = "text-chrome active:scale-96";
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-40", className)} {...props}>
      <Button variant="capsule" size="pill-icon" aria-label={decreaseLabel} disabled={disabled} onClick={() => set(current - step)} className={end}>
        <Minus size={28} strokeWidth={2.6} aria-hidden />
      </Button>
      {/* .vol .tr: a 14px track, 22px in from the buttons, under a pointer; the thumb's centre travels its whole length, and the fill starts under the thumb at the low end. */}
      <SliderPrimitive.Root value={[current]} onValueChange={([next]) => set(next)} min={min} max={max} step={1} disabled={disabled} className="relative mx-[22px] flex h-10 flex-1 cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed">
        <SliderPrimitive.Track className="relative h-3.5 grow rounded-full bg-primary/12">
          <SliderPrimitive.Range className="absolute -ml-[22px] h-full rounded-full bg-primary" />
        </SliderPrimitive.Track>
        {/* A thumb of no size of its own, so its centre sits on the value, as .vol .tr i does. */}
        <SliderPrimitive.Thumb aria-label={label} className="group relative block size-0 outline-none">
          <span className="absolute -top-5 -left-5 size-10 rounded-full bg-card shadow-thumb group-focus-visible:ring-2 group-focus-visible:ring-ring" />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>
      <Button variant="capsule" size="pill-icon" aria-label={increaseLabel} disabled={disabled} onClick={() => set(current + step)} className={end}>
        <Plus size={28} strokeWidth={2.6} aria-hidden />
      </Button>
    </div>
  );
}
