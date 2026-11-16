import { type ComponentProps, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogContent, DialogTitle } from "./Dialog.tsx";

export type NewTabShortcut = {
  url: string;
  title: string;
  favicon?: string;
};

export type NewTabLabels = {
  recent: string;
  clear: string;
  remove: (title: string) => string;
  confirmTitle: string;
  confirm: string;
  cancel: string;
};

export type NewTabPageProps = ComponentProps<"div"> & {
  /** The page's one heading. */
  heading?: string;
  /** The line under it. */
  text?: string;
  /** Recently opened websites, most recent first; as many as fill two rows are shown. */
  shortcuts?: NewTabShortcut[];
  /** Called with a shortcut's address when it is tapped. */
  onOpenShortcut?: (url: string) => void;
  /** Each shortcut has a ✕ that removes it. */
  removable?: boolean;
  /** Called with a shortcut's address by its ✕. */
  onRemoveShortcut?: (url: string) => void;
  /** The list has Clear, which asks before it forgets every website. */
  clearable?: boolean;
  /** Called by Clear. */
  onClear?: () => void;
  /** Clear is asking "Forget every website on this list?". */
  confirmingClear?: boolean;
  /** Called when the person confirms Clear. */
  onConfirmClear?: () => void;
  /** Called by Cancel, Escape or a tap outside the question. */
  onCancelClear?: () => void;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<NewTabLabels>;
};

const defaultLabels: NewTabLabels = {
  recent: "Recent websites",
  clear: "Clear",
  remove: (title) => `Remove ${title}`,
  confirmTitle: "Forget every website on this list?",
  confirm: "Clear",
  cancel: "Cancel",
};

const column = 160;

/**
 * What an empty tab shows: a heading, how to begin, and recent websites to open again, remove one by one or
 * clear after one question.
 * @model spec/app/browser.md
 */
export function NewTabPage({
  heading = "You’re ready to browse the internet.",
  text = "Type a website in the address bar above, or ask Grace.",
  shortcuts = [],
  onOpenShortcut,
  removable = false,
  onRemoveShortcut,
  clearable = false,
  onClear,
  confirmingClear = false,
  onConfirmClear,
  onCancelClear,
  labels: words,
  className,
  ...props
}: NewTabPageProps) {
  const labels = { ...defaultLabels, ...words };
  const listRef = useRef<HTMLDivElement>(null);
  const columns = useColumns(listRef, shortcuts.length > 0);
  const shown = shortcuts.slice(0, columns * 2);
  return (
    <div className={cn("size-full overflow-y-auto bg-site px-6 pt-32 pb-6 text-center font-sans text-chrome", className)} {...props}>
      <h2 className="text-title leading-[34px] font-semibold">{heading}</h2>
      <p className="mt-2.5 text-body leading-6 text-address-placeholder">{text}</p>
      {shortcuts.length > 0 && (
        <section aria-label={labels.recent} ref={listRef} className="mx-auto mt-12 max-w-[860px]">
          <div className="mx-auto w-fit">
            {clearable && (
              <div className="mb-2 flex items-center justify-between px-4">
                <h3 className="text-body-lg leading-7 font-bold text-muted-foreground">{labels.recent}</h3>
                <button type="button" onClick={onClear} className={cn(focusRing, "-mr-4 h-12 rounded-full px-4 text-body font-bold text-primary active:bg-primary/8")}>
                  {labels.clear}
                </button>
              </div>
            )}
            <ul className="grid justify-center gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(columns, shown.length)}, 9rem)` }}>
              {shown.map((s) => (
                <li key={s.url} className="relative">
                  <button
                    type="button"
                    onClick={() => onOpenShortcut?.(s.url)}
                    className={cn(focusRing, "flex w-36 flex-col items-center gap-3 rounded-row p-4 transition-transform duration-press ease-spring active:scale-105 motion-reduce:active:scale-100")}
                  >
                    {s.favicon ? (
                      <img src={s.favicon} alt="" className="size-16 rounded-full bg-card object-cover shadow-capsule" />
                    ) : (
                      <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-card text-title-sm font-bold text-primary shadow-capsule">
                        {s.title.slice(0, 1)}
                      </span>
                    )}
                    <span className="w-full truncate text-label font-medium">{s.title}</span>
                  </button>
                  {removable && (
                    <button
                      type="button"
                      aria-label={labels.remove(s.title)}
                      onClick={() => onRemoveShortcut?.(s.url)}
                      className={cn(focusRing, "absolute top-1 right-[22px] flex size-9 items-center justify-center rounded-full bg-card text-chrome-muted shadow-badge active:bg-panel")}
                    >
                      <X size={18} strokeWidth={2.4} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <Dialog open={confirmingClear} onOpenChange={(open) => !open && onCancelClear?.()}>
        <DialogContent
          className="gap-0 text-left"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
        >
          <DialogTitle>{labels.confirmTitle}</DialogTitle>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="warn" size="pill" className="w-full" onClick={onConfirmClear}>
              {labels.confirm}
            </Button>
            <Button variant="capsule" size="pill" className="w-full" onClick={onCancelClear}>
              {labels.cancel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useColumns(ref: RefObject<HTMLElement | null>, shown: boolean) {
  const [columns, setColumns] = useState(5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setColumns(Math.max(1, Math.floor((el.clientWidth + 16) / column)));
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [ref, shown]);
  return columns;
}
