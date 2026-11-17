import { type ComponentProps, useId } from "react";
import { X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { useSize } from "../lib/observe.ts";
import { Spinner } from "./Spinner.tsx";

export type BrowserTabProps = Omit<ComponentProps<"div">, "title"> & {
  /** The page's title, or "New tab". */
  title: string;
  /** The site's icon, an image URL; without it, `initial` shows on a tile. */
  favicon?: string;
  /** The site's first letter, on the site's dark tile, when there is no `favicon`; without it, a new tab's grey tile with "·". */
  initial?: string;
  /** The tab's page is loading: a spinner stands in place of its favicon, and the tab can still be chosen or closed. */
  pageLoading?: boolean;
  /** What a screen reader hears for the spinner. */
  loadingLabel?: string;
  /** The tab shown in the window: a folder tab joined to the toolbar. */
  selected?: boolean;
  /** Called when the tab is tapped. */
  onSelect?: () => void;
  /** Called by the tab's ✕. */
  onClose?: () => void;
  /** The accessible name of the tab's ✕; by default "Close" and the title. */
  closeLabel?: string;
};

/**
 * One tab of the browser: favicon, title and ✕. The selected tab is a white folder tab whose concave feet
 * flow into the toolbar, with a soft shadow round both.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#selected
 */
export function BrowserTab({ title, favicon, initial, pageLoading = false, loadingLabel = "Loading", selected = false, onSelect, onClose, closeLabel = `Close ${title}`, className, ...props }: BrowserTabProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-14 w-60 min-w-0 shrink items-center gap-2.5 rounded-t-tab pr-1 pb-2 pl-[18px] text-chrome",
        selected && "z-[3] bg-glass/78",
        className,
      )}
      {...props}
    >
      {selected && (
        <>
          <TabShadow width={size?.width ?? 240} />
          <span aria-hidden className="absolute bottom-0 -left-3 size-3 bg-[radial-gradient(circle_at_0_0,transparent_11.5px,var(--glass)_12px)] opacity-78" />
          <span aria-hidden className="absolute -right-3 bottom-0 size-3 bg-[radial-gradient(circle_at_100%_0,transparent_11.5px,var(--glass)_12px)] opacity-78" />
        </>
      )}
      <button
        type="button"
        aria-current={selected ? "page" : undefined}
        onClick={onSelect}
        className={cn(focusRing, "flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-lg text-left")}
      >
        <TabFavicon favicon={favicon} initial={initial} pageLoading={pageLoading} loadingLabel={loadingLabel} />
        <span className="min-w-0 flex-1 truncate text-body leading-[normal] font-medium">{title}</span>
      </button>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={cn(focusRing, "flex size-12 shrink-0 items-center justify-center rounded-xl text-chrome-muted")}
      >
        <X size={22} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

export type TabFaviconProps = Pick<BrowserTabProps, "favicon" | "initial" | "pageLoading" | "loadingLabel">;

/** A tab's 20px mark: its favicon, its site's letter, a new tab's "·", or a spinner while it loads. */
export function TabFavicon({ favicon, initial, pageLoading = false, loadingLabel = "Loading" }: TabFaviconProps) {
  if (pageLoading) return <Spinner label={loadingLabel} className="size-5" />;
  if (favicon) return <img src={favicon} alt="" className="size-5 shrink-0 rounded-tag object-cover" />;
  return (
    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-tag text-xs leading-[normal] font-bold text-primary-foreground", initial ? "bg-site-brand" : "bg-favicon")}>
      {initial ?? "·"}
    </span>
  );
}

function TabShadow({ width }: { width: number }) {
  const id = `tab-shadow${useId().replace(/[^\w-]/g, "")}`;
  const far = 4000;
  const d = `M ${-far} 56 H -12 A 12 12 0 0 0 0 44 V 18 A 18 18 0 0 1 18 0 H ${width - 18} A 18 18 0 0 1 ${width} 18 V 44 A 12 12 0 0 0 ${width + 12} 56 H ${far} V 136 H ${-far} Z`;
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 left-0 -z-10 overflow-visible" width={width} height={56}>
      <filter id={id} x={-far} y={-40} width={far * 2} height={220} filterUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
        <feOffset dy="-1" result="b" />
        <feFlood style={{ floodColor: "var(--primary)" }} floodOpacity=".15" />
        <feComposite in2="b" operator="in" />
        <feComposite in2="SourceAlpha" operator="out" />
      </filter>
      <path d={d} filter={`url(#${id})`} />
    </svg>
  );
}
