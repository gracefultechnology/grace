import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

/** A website opened recently, offered as a shortcut. */
export type NewTabShortcut = {
  /** The address the shortcut opens. */
  url: string;
  /** The site's name. */
  title: string;
  /** The site's icon, an image URL; without it, the name's first letter. */
  favicon?: string;
};

export type NewTabPageProps = ComponentProps<"div"> & {
  /** The page's one heading. */
  heading?: string;
  /** The line under it. */
  text?: string;
  /** Recently opened websites, most recent first. */
  shortcuts?: NewTabShortcut[];
  /** Called with a shortcut's address when it is tapped. */
  onOpenShortcut?: (url: string) => void;
};

/**
 * What an empty tab shows: a heading, how to begin, and recent websites to open again.
 * @model spec/app/browser.md
 */
export function NewTabPage({
  heading = "You’re ready to browse the internet.",
  text = "Type a website in the address bar above, or ask Grace.",
  shortcuts = [],
  onOpenShortcut,
  className,
  ...props
}: NewTabPageProps) {
  return (
    // Prototype `.site` and `.newtab`: centred, 128px down the page.
    <div className={cn("size-full overflow-y-auto bg-panel px-6 pt-32 pb-6 text-center font-sans text-chrome", className)} {...props}>
      <h2 className="text-title leading-[34px] font-semibold">{heading}</h2>
      <p className="mt-2.5 text-body leading-6 text-address-placeholder">{text}</p>
      {shortcuts.length > 0 && (
        <ul className="mx-auto mt-12 flex max-w-[860px] flex-wrap justify-center gap-4">
          {shortcuts.map((s) => (
            <li key={s.url}>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
