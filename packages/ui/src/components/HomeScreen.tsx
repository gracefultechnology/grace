import { useCallback, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { FilesCard, type FilesCardProps } from "./FilesCard.tsx";
import { HomeCalendarCard, type HomeCalendarCardProps } from "./HomeCalendarCard.tsx";
import { HomeEmailCard, type HomeEmailCardProps } from "./HomeEmailCard.tsx";
import { HomeGreeting } from "./HomeGreeting.tsx";
import { HomePager, type HomePagerProps } from "./HomePager.tsx";
import { InternetCard, type InternetCardProps } from "./InternetCard.tsx";

/** Home's two pages: the main cards, and the page that brings the Files card into view. */
export type HomePage = "main" | "files";

/**
 * How Home fills its space: `full` on the whole screen; `compact` above Grace's compact window, the four cards in
 * equal columns at whatever height is left; `greeting` when the keyboard is up as well, the greeting alone.
 */
export type HomeLayout = "full" | "compact" | "greeting";

export type HomeScreenProps = Omit<ComponentProps<"div">, "children"> & {
  /** The greeting for the time of day: "Good evening". */
  greeting: string;
  /** Who it greets, when Grace knows. */
  name?: string;
  /** The line under the greeting: "Here’s your day". */
  line?: string;
  /** A notification at the top right, beside the greeting: a `Banner`. */
  banner?: ReactNode;
  /** The Calendar card: today and the next events. */
  calendar: HomeCalendarCardProps;
  /** The Email card: the newest emails, or what waits for the internet. */
  email: HomeEmailCardProps;
  /** The Internet card: a preview of the browser's page and Open. */
  internet: InternetCardProps;
  /** The Files card: the newest photos and document. */
  files: FilesCardProps;
  /** How Home fills its space; give a `compact` or `greeting` Home a `bottom` that clears Grace's window. */
  layout?: HomeLayout;
  /** The page in view. */
  page?: HomePage;
  /** Asks for the other page: an arrow or a dot was tapped. */
  onPageChange?: (page: HomePage) => void;
  /** The pager's accessible names. */
  pager?: Pick<HomePagerProps, "nextLabel" | "backLabel" | "pageLabel">;
};

const pages: HomePage[] = ["main", "files"];
// Prototype `hmGeom()`: where each page starts along the row of cards, in mode G and when compact.
const shifts: Record<HomePage, number> = { main: 0, files: 468 };
const compactShifts: Record<HomePage, number> = { main: 0, files: 354 };
// Prototype `hmGeom()` mode G: the cards in a 1042×560 grid; Email and Internet share one column.
const slots = {
  calendar: { x: 0, top: 0, w: 480, h: 560 },
  email: { x: 500, top: 0, w: 470, h: 290 },
  internet: { x: 500, top: 310, w: 470, h: 250 },
  files: { x: 990, top: 0, w: 520, h: 560 },
};
// Prototype `.home.cmp .lc[data-app=…]` (lines 395–397, 635): four 334px columns, 20px apart, as tall as the grid.
const columns: Record<keyof typeof slots, number> = { calendar: 0, email: 354, internet: 708, files: 1062 };
const VIEW = 1042;
const RADIUS = 400;
// Home as drawn on the 1280×800 screen, 6px in; what is right of the rail (138px) scales to fit a smaller Home.
const STAGE = { width: 1268, height: 788, rail: 138 };

/**
 * Where a card stands for a page (prototype `hmApply`, mode G "3D + progressive blur"): the cards in view are flat;
 * one running off an edge rolls round a drum of radius 400px, its near edge on the circle, seen from the view's centre.
 */
function drum({ x, top, w, h }: (typeof slots)[keyof typeof slots], shift: number): { style: CSSProperties; turn: number } {
  const left = x - shift;
  const right = left + w;
  const onRight = (left + right) / 2 > VIEW / 2;
  const past = onRight ? left - VIEW : -right; // how far the near edge is past the view's edge
  const over = Math.min(w, onRight ? Math.max(0, right - VIEW) : Math.max(0, -left)); // how much of the card is past it
  const theta = past > 0 ? (past + w / 2) / RADIUS : over / (2 * RADIUS);
  const phi = Math.max(0, past) / RADIUS;
  const nearFlat = onRight ? left : right;
  const nearTo = past > 0 ? (onRight ? VIEW + RADIUS * Math.sin(phi) : -RADIUS * Math.sin(phi)) : nearFlat;
  const depth = past > 0 ? -RADIUS * (1 - Math.cos(phi)) : 0;
  const away = Math.min(1, theta / 0.9);
  const angle = (onRight ? 1 : -1) * ((theta * 180) / Math.PI);
  const pivot = VIEW / 2 + shift - x;
  const near = onRight ? 0 : w;
  return {
    turn: (onRight ? 1 : -1) * away,
    style: {
      left: x,
      top,
      width: w,
      height: h,
      zIndex: 100 - Math.round(away * 100),
      transformOrigin: `${pivot.toFixed(1)}px ${(280 - top).toFixed(1)}px`,
      transform: `perspective(1200px) translateX(${(-shift + nearTo - nearFlat).toFixed(1)}px) translateZ(${depth.toFixed(1)}px) translateX(${(near - pivot).toFixed(1)}px) rotateY(${angle.toFixed(2)}deg) translateX(${(pivot - near).toFixed(1)}px)`,
    },
  };
}

/**
 * Home: the greeting, the launcher cards on two pages that turn away round the edges like the side of a drum, the
 * pager, and a banner when there is news. Above Grace's compact window the cards stand in four narrow columns that
 * slide flat; with the keyboard up as well, only the greeting stays. It lies under the rail, which is glass, so a card
 * rolling off the left shows through it. Place it on the `TabletScreen` beside the `Rail`.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function HomeScreen({ greeting, name, line, banner, calendar, email, internet, files, layout = "full", page = "main", onPageChange, pager, className, ...props }: HomeScreenProps) {
  const full = layout === "full";
  const compact = !full;
  // Smaller than the screen (portrait): the cards shrink, centred across, never cut. Compact, Home keeps its scale
  // across and takes the height it is given (prototype `.home.cmp .hgrid`: `height: calc(100% - 120px)`).
  const [box, setBox] = useState({ width: STAGE.width, height: STAGE.height });
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const across = (box.width - STAGE.rail) / (STAGE.width - STAGE.rail);
  const scale = Math.min(1, across, full ? box.height / STAGE.height : 1);
  const x = Math.max(0, (box.width - STAGE.rail - (STAGE.width - STAGE.rail) * scale) / 2);
  const place = (slot: keyof typeof slots, card: (turn: number) => ReactNode) => {
    // Compact, the cards slide flat (prototype `hmIs3D()` is false and `hmApply` translates them).
    const { style, turn } = full ? drum(slots[slot], shifts[page]) : { turn: 0, style: { left: columns[slot], top: 0, width: 334, height: "100%", transform: `translateX(${-compactShifts[page]}px)` } };
    return (
      <div className="absolute transition-[transform,transform-origin,left,top,width,height] duration-slow ease-out will-change-transform motion-reduce:transition-none" style={style}>
        {card(turn)}
      </div>
    );
  };
  // Prototype `.home` (left 6px under the rail), `.hgr`, `.hgrid` (lines 307–309, 644–650); `.home.cmp` (lines 389–401)
  // and `.home.tight .hgrid` (line 615).
  return (
    <div ref={measure} className={cn("absolute inset-1.5 z-[1] overflow-hidden font-sans", className)} {...props}>
      <div className="absolute top-0 left-0" style={{ width: STAGE.width, height: full ? STAGE.height : box.height / scale, transformOrigin: `${STAGE.rail}px 0`, scale: String(scale), translate: `${x}px 0` }}>
        <HomeGreeting greeting={greeting} name={name} line={line} compact={compact} className={cn("absolute left-[182px] transition-[top] duration-window", full ? "top-[34px]" : "top-[22px]")} />
        {/* Prototype `drawBanner()`: left 620px and right 26px of the screen, 22px down. */}
        {banner ? <div className="absolute top-4 right-5 left-[614px] z-[310]">{banner}</div> : null}
        {layout !== "greeting" && (
          <div className={cn("absolute left-[182px] w-[1042px]", full ? "top-40 h-[560px]" : "top-24 bottom-6")}>
            {place("calendar", (turn) => <HomeCalendarCard {...calendar} compact={compact} turn={turn} className={cn("size-full", calendar.className)} />)}
            {place("email", (turn) => <HomeEmailCard {...email} compact={compact} turn={turn} className={cn("size-full", email.className)} />)}
            {place("internet", (turn) => <InternetCard {...internet} compact={compact} turn={turn} className={cn("size-full", internet.className)} />)}
            {place("files", (turn) => <FilesCard {...files} compact={compact} turn={turn} className={cn("size-full", files.className)} />)}
          </div>
        )}
        <HomePager page={pages.indexOf(page)} count={pages.length} compact={compact} arrows={layout !== "greeting"} onPageChange={(i) => onPageChange?.(pages[i] ?? "main")} {...pager} />
      </div>
    </div>
  );
}
