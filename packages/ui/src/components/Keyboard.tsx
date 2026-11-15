import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

/** The keys that do something rather than type: each is named by this word in a layout's rows. */
export type KeyboardAction = "shift" | "backspace" | "numbers" | "letters" | "symbols" | "space" | "go" | "hide";

const actions = new Set<string>(["shift", "backspace", "numbers", "letters", "symbols", "space", "go", "hide"]);
const bottom = ["space", ".", "go", "hide"];

// Prototype `L` (line 1672): the tablet's three layers.
export const keyboardLayouts = {
  letters: [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["shift", "z", "x", "c", "v", "b", "n", "m", "backspace"], ["numbers", ...bottom]],
  numbers: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""], ["symbols", ".", ",", "?", "!", "'", "%", "backspace"], ["letters", ...bottom]],
  symbols: [["[", "]", "{", "}", "#", "%", "^", "*", "+", "="], ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"], ["numbers", ".", ",", "?", "!", "'", "backspace"], ["letters", ...bottom]],
} satisfies Record<string, string[][]>;

const defaultLabels: Record<KeyboardAction, string> = { shift: "⇧", backspace: "⌫", numbers: "123", letters: "ABC", symbols: "#+=", space: "space", go: "Send", hide: "Hide" };
const defaultNames: Partial<Record<KeyboardAction, string>> = { shift: "Shift", backspace: "Delete" };

export type KeyboardProps = Omit<ComponentProps<"div">, "onKeyDown"> & {
  /** Which layer of keys shows. */
  layout?: keyof typeof keyboardLayouts;
  /** Rows of keys, replacing the layer's: a character types itself, an action word (`shift`, `go` …) is that key. */
  rows?: string[][];
  /** Letters type in capitals, and ⇧ shows lit. */
  shift?: boolean;
  /** The text on action keys, such as `{ go: "Done" }` while a website's field is open. */
  labels?: Partial<Record<KeyboardAction, string>>;
  /** Accessible names of the keys drawn as symbols. */
  names?: Partial<Record<KeyboardAction, string>>;
  /** There is something to send: the go key turns indigo. */
  ready?: boolean;
  /** Slid up into view; when false it waits below the screen's edge. */
  open?: boolean;
  /** A key was tapped: its character (in capitals under shift), or its action word. */
  onKey?: (key: string) => void;
};

/**
 * The on-screen keyboard: a window under Grace and the apps, 6px from the rail and the screen's edges.
 * Taps never take focus from the field being typed in.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#windows
 */
export function Keyboard({ layout = "letters", rows, shift = false, labels, names, ready = false, open = true, onKey, className, ...props }: KeyboardProps) {
  const text = { ...defaultLabels, ...labels };
  const name = { ...defaultNames, ...names };
  const capitals = shift && layout === "letters";
  // Prototype `.kb`, `.kr`, `.kb button` and `drawKb()`.
  return (
    <div
      aria-hidden={!open || undefined}
      className={cn(
        "absolute bottom-1.5 left-[144px] z-[6] box-border flex h-[300px] right-1.5 flex-col gap-[9px] overflow-hidden rounded-window bg-keyboard px-2.5 py-3.5 font-sans transition-transform duration-window ease-css-default motion-reduce:transition-none",
        !open && "translate-y-[calc(100%+6px)]",
        className,
      )}
      {...props}
    >
      {(rows ?? keyboardLayouts[layout]).map((row) => (
        <div key={row.join(" ")} className="flex flex-1 justify-center gap-2">
          {row.map((key) => {
            const action = actions.has(key) ? (key as KeyboardAction) : undefined;
            const character = capitals ? key.toUpperCase() : key;
            return (
              <button
                key={key}
                type="button"
                tabIndex={-1}
                aria-label={action && name[action]}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onKey?.(action ?? character)}
                className={cn(
                  // `.kb button` keeps the browser's 1px 6px padding, which widens the flexed keys.
                  "max-w-24 flex-1 cursor-pointer touch-manipulation rounded-md bg-card px-1.5 py-px text-title-sm leading-[normal] font-medium text-grace-ink shadow-key active:bg-key-pressed",
                  action && action !== "space" && "max-w-[140px] bg-key-fn text-[19px] leading-[normal] font-semibold",
                  action === "space" && "max-w-none flex-[5]",
                  action === "go" && "max-w-[150px]",
                  action === "go" && ready && "bg-primary text-primary-foreground active:bg-primary",
                  action === "shift" && shift && "bg-card",
                )}
              >
                {action ? text[action] : character}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
