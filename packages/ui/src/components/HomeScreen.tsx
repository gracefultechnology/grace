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
  /** The page in view. */
  page?: HomePage;
  /** Asks for the other page: an arrow or a dot was tapped. */
  onPageChange?: (page: HomePage) => void;
  /** The pager's accessible names. */
  pager?: Pick<HomePagerProps, "nextLabel" | "backLabel" | "pageLabel">;
};

const pages: HomePage[] = ["main", "files"];
// Prototype `hmGeom()` for mode G: where each page starts along the row of cards.
const shifts: Record<HomePage, number> = { main: 0, files: 468 };
// Prototype `hmGeom()` mode G: the cards in a 1042×560 grid; Email and Internet share one column.
const slots = {
  calendar: { x: 0, top: 0, w: 480, h: 560 },
  email: { x: 500, top: 0, w: 470, h: 290 },
  internet: { x: 500, top: 310, w: 470, h: 250 },
  files: { x: 990, top: 0, w: 520, h: 560 },
};
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
 * pager, and a banner when there is news. It lies under the rail, which is glass, so a card rolling off the left shows
 * through it. Place it on the `TabletScreen` beside the `Rail`.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function HomeScreen({ greeting, name, line, banner, calendar, email, internet, files, page = "main", onPageChange, pager, className, ...props }: HomeScreenProps) {
  const shift = shifts[page];
  // Smaller than the screen (portrait, or above Grace's compact window): the cards shrink, centred across, never cut.
  const [fit, setFit] = useState({ scale: 1, x: 0 });
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const scale = Math.min(1, (width - STAGE.rail) / (STAGE.width - STAGE.rail), height / STAGE.height);
      setFit({ scale, x: Math.max(0, (width - STAGE.rail - (STAGE.width - STAGE.rail) * scale) / 2) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const place = (slot: keyof typeof slots, card: (turn: number) => ReactNode) => {
    const { style, turn } = drum(slots[slot], shift);
    return (
      <div className="absolute transition-[transform,transform-origin] duration-slow ease-out will-change-transform motion-reduce:transition-none" style={style}>
        {card(turn)}
      </div>
    );
  };
  // Prototype `.home` (left 6px under the rail), `.hgr`, `.hgrid` (lines 307–309, 644–650).
  return (
    <div ref={measure} className={cn("absolute inset-1.5 z-[1] overflow-hidden font-sans", className)} {...props}>
      <div className="absolute top-0 left-0" style={{ width: STAGE.width, height: STAGE.height, transformOrigin: `${STAGE.rail}px 0`, scale: String(fit.scale), translate: `${fit.x}px 0` }}>
        <HomeGreeting greeting={greeting} name={name} line={line} className="absolute top-[34px] left-[182px]" />
        {/* Prototype `drawBanner()`: left 620px and right 26px of the screen, 22px down. */}
        {banner ? <div className="absolute top-4 right-5 left-[614px] z-[310]">{banner}</div> : null}
        <div className="absolute top-40 left-[182px] h-[560px] w-[1042px]">
          {place("calendar", (turn) => <HomeCalendarCard {...calendar} turn={turn} className={cn("size-full", calendar.className)} />)}
          {place("email", (turn) => <HomeEmailCard {...email} turn={turn} className={cn("size-full", email.className)} />)}
          {place("internet", (turn) => <InternetCard {...internet} turn={turn} className={cn("size-full", internet.className)} />)}
          {place("files", (turn) => <FilesCard {...files} turn={turn} className={cn("size-full", files.className)} />)}
        </div>
        <HomePager page={pages.indexOf(page)} count={pages.length} onPageChange={(i) => onPageChange?.(pages[i] ?? "main")} {...pager} />
      </div>
    </div>
  );
}
