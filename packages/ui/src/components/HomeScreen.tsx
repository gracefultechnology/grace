import { useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { useSize } from "../lib/observe.ts";
import { FilesCard, type FilesCardProps } from "./FilesCard.tsx";
import { HomeCalendarCard, type HomeCalendarCardProps } from "./HomeCalendarCard.tsx";
import { HomeEmailCard, type HomeEmailCardProps } from "./HomeEmailCard.tsx";
import { HomeGreeting } from "./HomeGreeting.tsx";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";
import { HomePager, type HomePagerProps } from "./HomePager.tsx";
import { InternetCard, type InternetCardProps } from "./InternetCard.tsx";

const pages = ["MainCards", "FilesCard", "PasswordsCard"] as const;

export type HomePage = (typeof pages)[number];

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
  /** Opens Passwords from its own Home page, after Files, without previewing any sign-ins. */
  passwords?: Pick<LauncherCardProps, "disabled" | "onClick">;
  /** How Home fills its space; give a `compact` or `greeting` Home a `bottom` that clears Grace's window. */
  layout?: HomeLayout;
  /** The page in view. */
  page?: HomePage;
  /** Asks for another page: an arrow or a dot was tapped, or Home was swiped sideways. */
  onPageChange?: (page: HomePage) => void;
  /** The pager's accessible names. */
  pager?: Pick<HomePagerProps, "nextLabel" | "backLabel" | "pageLabel">;
};

const VIEW = 1042;
const columnGap = 20;
const SWIPE = { threshold: 12, overscroll: 60 };
const filesSlot = { x: 990, top: 0, w: 520, h: 560 };
const filesEnd = filesSlot.x + filesSlot.w;
const slots = {
  calendar: { x: 0, top: 0, w: 480, h: 560 },
  email: { x: 500, top: 0, w: 470, h: 290 },
  internet: { x: 500, top: 310, w: 470, h: 250 },
  files: filesSlot,
  passwords: { ...filesSlot, x: filesEnd + columnGap + (VIEW - filesSlot.w) / 2 },
};
const shifts: Record<HomePage, number> = { MainCards: 0, FilesCard: filesEnd - VIEW, PasswordsCard: filesEnd + columnGap };
const columns: Record<keyof typeof slots, number> = { calendar: 0, email: 1, internet: 2, files: 3, passwords: 5 };
const columnShifts: Record<HomePage, number> = { MainCards: 0, FilesCard: 1, PasswordsCard: 4 };
const RADIUS = 400;
const STAGE = { width: 1268, height: 788, rail: 138 };

function drum({ x, top, w, h }: (typeof slots)[keyof typeof slots], shift: number): { style: CSSProperties; turn: number } {
  const left = x - shift;
  const right = left + w;
  const onRight = (left + right) / 2 > VIEW / 2;
  const past = onRight ? left - VIEW : -right;
  const over = Math.min(w, onRight ? Math.max(0, right - VIEW) : Math.max(0, -left));
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
 * Home: the greeting, the launcher cards on three pages that turn away round the edges like the side of a drum, the
 * pager, and a banner when there is news. Above Grace's compact window the cards stand in narrow columns that slide
 * flat, three to a page and Passwords alone in the middle of its own; with the keyboard up as well, only the greeting
 * stays. It lies under the rail, which is glass, so a card rolling off the left shows through it. Place it on the
 * `TabletScreen` beside the `Rail`.
 * The prototype's `#home[data-hmode]` control-panel modes A–F and H are experiments; only mode G, progressive blur and
 * its default, is the design.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 * @design packages/design-system/design.md#screens
 */
export function HomeScreen({ greeting, name, line, banner, calendar, email, internet, files, passwords, layout = "full", page = "MainCards", onPageChange, pager, className, ...props }: HomeScreenProps) {
  const full = layout === "full";
  const compact = layout === "compact";
  const [measure, measured] = useSize<HTMLDivElement>();
  const box = measured ?? STAGE;
  const across = (box.width - STAGE.rail) / (STAGE.width - STAGE.rail);
  const scale = Math.min(1, across, full ? box.height / STAGE.height : 1);
  const stageWidth = compact ? Math.max(STAGE.width, box.width) : STAGE.width;
  const x = compact ? 0 : Math.max(0, (box.width - STAGE.rail - (STAGE.width - STAGE.rail) * scale) / 2);
  const columnStep = (stageWidth - STAGE.rail + columnGap) / 3;
  const viewWidth = compact ? 3 * columnStep - columnGap : VIEW;
  const lastPage: HomePage = passwords ? "PasswordsCard" : "FilesCard";
  const shown = pages.slice(0, pages.indexOf(lastPage) + 1);
  const stop = (of: HomePage) => compact ? columnShifts[of] * columnStep : shifts[of];
  const nearestTo = (at: number) => shown.reduce((best, next) => Math.abs(stop(next) - at) < Math.abs(stop(best) - at) ? next : best);
  const [dragShift, setDragShift] = useState<number | null>(null);
  const dragRef = useRef<{ x: number; k: number; from: number; shift: number; moved: boolean } | null>(null);
  const swipedRef = useRef(false);
  const shift = dragShift ?? stop(shown.includes(page) ? page : "MainCards");
  const nearest = nearestTo(shift);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    swipedRef.current = false;
    if (layout === "greeting" || (event.target as Element).closest("[data-home-pager] button")) return;
    const home = event.currentTarget;
    const k = ((home.getBoundingClientRect().width / home.offsetWidth) || 1) * scale;
    dragRef.current = { x: event.clientX, k, from: shift, shift, moved: false };
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state || event.buttons === 0) return;
    const dx = (event.clientX - state.x) / state.k;
    if (!state.moved && Math.abs(dx) > SWIPE.threshold) {
      state.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!state.moved) return;
    state.shift = Math.max(stop("MainCards") - SWIPE.overscroll, Math.min(stop(lastPage) + SWIPE.overscroll, state.from - dx));
    setDragShift(state.shift);
  };
  const settle = () => {
    const state = dragRef.current;
    dragRef.current = null;
    if (!state?.moved) return;
    swipedRef.current = true;
    setDragShift(null);
    onPageChange?.(nearestTo(state.shift));
  };
  const swallowSwipeClick = (event: MouseEvent) => {
    if (!swipedRef.current) return;
    swipedRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  };
  const place = (slot: keyof typeof slots, card: (turn: number) => ReactNode) => {
    const flat = full ? { left: slots[slot].x, width: slots[slot].w } : { left: columns[slot] * columnStep, width: columnStep - columnGap };
    const { style, turn } = full ? drum(slots[slot], shift) : { turn: 0, style: { ...flat, top: 0, height: "100%", transform: `translateX(${-shift}px)` } };
    const { transform, transformOrigin, ...frame } = style;
    const still = dragShift !== null && "transition-none";
    const resting = flat.left - stop(nearest);
    const offPage = resting >= viewWidth || resting + flat.width <= 0;
    return (
      <div aria-hidden={offPage || undefined} inert={offPage} className={cn("absolute transition-[left,top,width,height] duration-slow ease-settle motion-reduce:transition-none", still)} style={frame}>
        <div className={cn("size-full backface-hidden transition-[transform,transform-origin] duration-[320ms] ease-out-cubic will-change-transform motion-reduce:transition-none", still)} style={{ transform, transformOrigin }}>
          {card(turn)}
        </div>
      </div>
    );
  };
  return (
    <div
      ref={measure}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={settle}
      onPointerCancel={settle}
      onClickCapture={swallowSwipeClick}
      className={cn("absolute inset-1.5 z-[1] touch-pan-y touch-pinch-zoom overflow-hidden font-sans transition-[bottom] duration-slow ease-settle motion-reduce:transition-none", className)}
      {...props}
    >
      <div className="absolute top-0 left-0" style={{ width: stageWidth, height: full ? STAGE.height : box.height / scale, transformOrigin: `${STAGE.rail}px 0`, scale: String(scale), translate: `${x}px 0` }}>
        {!compact && <HomeGreeting greeting={greeting} name={name} line={line} compact={!full} className={cn("absolute left-[182px] transition-[top] duration-slow ease-settle motion-reduce:transition-none", full ? "top-[34px]" : "top-[22px]")} />}
        {banner ? <div className="absolute top-4 right-5 left-[614px] z-[310]">{banner}</div> : null}
        {layout !== "greeting" && (
          <div className={cn("absolute transition-[top,height] duration-slow ease-settle motion-reduce:transition-none", full ? "top-40 left-[182px] h-[560px] w-[1042px]" : "inset-y-0 right-0 left-[138px] overflow-clip")}>
            {place("calendar", (turn) => <HomeCalendarCard {...calendar} compact={compact} turn={turn} className={cn("size-full", calendar.className)} />)}
            {place("email", (turn) => <HomeEmailCard {...email} compact={compact} turn={turn} className={cn("size-full", email.className)} />)}
            {place("internet", (turn) => <InternetCard {...internet} compact={compact} turn={turn} className={cn("size-full", internet.className)} />)}
            {place("files", (turn) => <FilesCard {...files} compact={compact} turn={turn} className={cn("size-full", files.className)} />)}
            {passwords && place("passwords", (turn) => (
              <LauncherCard {...passwords} title="Passwords" compact={compact} turn={turn} className="size-full">
                <KeyRound aria-hidden className="m-auto size-24 text-primary" strokeWidth={1.5} />
              </LauncherCard>
            ))}
          </div>
        )}
        <HomePager data-home-pager page={shown.indexOf(nearest)} count={shown.length} compact={compact} arrows={layout !== "greeting"} onPageChange={(i) => onPageChange?.(shown[i] ?? "MainCards")} {...pager} />
      </div>
    </div>
  );
}
