import { useCallback, useMemo, useRef, type ComponentProps, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { play } from "../lib/motion.ts";
import { useSize } from "../lib/observe.ts";
import { FilesCard, type FilesCardProps } from "./FilesCard.tsx";
import { HomeCalendarCard, type HomeCalendarCardProps } from "./HomeCalendarCard.tsx";
import { HomeEmailCard, type HomeEmailCardProps } from "./HomeEmailCard.tsx";
import { HomeGreeting } from "./HomeGreeting.tsx";
import { LauncherCard, type LauncherCardProps, showTurn, type Turning, turningOf } from "./LauncherCard.tsx";
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
  /** Opens Passwords from its own page after Files, without previewing any sign-ins. */
  passwords?: Pick<LauncherCardProps, "disabled" | "onClick">;
  /** How Home fills its space; give a `compact` or `greeting` Home a `bottom` that clears Grace's window. */
  layout?: HomeLayout;
  /** The page in view. */
  page?: HomePage;
  /** Asks for another page: an arrow or a dot was tapped, or Home was swiped sideways. False refuses it, and a swipe settles back. */
  onPageChange?: (page: HomePage) => boolean | undefined;
  /** The pager's accessible names. */
  pager?: Pick<HomePagerProps, "nextLabel" | "backLabel" | "pageLabel">;
};

const VIEW = 1042;
const columnGap = 20;
const SWIPE = { threshold: 12, overscroll: 60 };
const filesSlot = { x: 990, top: 0, w: 520, h: 560 };
const filesEnd = filesSlot.x + filesSlot.w;
const passwordsStart = filesEnd + columnGap;
const slots = {
  calendar: { x: 0, top: 0, w: 480, h: 560 },
  email: { x: 500, top: 0, w: 470, h: 290 },
  internet: { x: 500, top: 310, w: 470, h: 250 },
  files: filesSlot,
  passwords: { ...filesSlot, x: passwordsStart + (VIEW - filesSlot.w) / 2 },
};
const shifts: Record<HomePage, number> = { MainCards: 0, FilesCard: filesEnd - VIEW, PasswordsCard: passwordsStart };
const columns: Record<keyof typeof slots, number> = { calendar: 0, email: 1, internet: 2, files: 3, passwords: 5 };
const COLUMNS_IN_VIEW = 3;
const columnShifts: Record<HomePage, number> = { MainCards: 0, FilesCard: 1, PasswordsCard: 4 };
const RADIUS = 400;
const STAGE = { width: 1268, height: 788, rail: 138 };

type Slot = keyof typeof slots;
const pageCards: Record<HomePage, readonly Slot[]> = {
  MainCards: ["calendar", "email", "internet"],
  FilesCard: ["email", "internet", "files"],
  PasswordsCard: ["passwords"],
};
type Pose = { transform: string; away: number; side: 1 | -1; level: 0 | 1 | 2 };
type Rail = { stage: HTMLElement; cards: { slot: Slot; frame: HTMLElement; face: HTMLElement; turning: Turning }[] };
type Swipe = { pointer: number; x: number; k: number; from: number; shift: number; moved: boolean };

const isSlot = (name: string | undefined): name is Slot => name !== undefined && name in slots;

function drum({ x, top, w }: (typeof slots)[Slot], shift: number): Pose {
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
  const side = onRight ? 1 : -1;
  const angle = side * ((theta * 180) / Math.PI);
  const pivot = VIEW / 2 + shift - x;
  const level = 280 - top;
  const near = onRight ? 0 : w;
  return {
    away: Math.min(1, theta / 0.9),
    side,
    level: past > 0 ? 0 : over > 0 ? 1 : 2,
    transform: `translate(${pivot.toFixed(1)}px, ${level}px) perspective(1200px) translateX(${(-shift + nearTo - nearFlat).toFixed(1)}px) translateZ(${depth.toFixed(1)}px) translateX(${(near - pivot).toFixed(1)}px) rotateY(${angle.toFixed(2)}deg) translate(${-near}px, ${-level}px)`,
  };
}

const poseAt = (full: boolean, slot: Slot, shift: number): Pose => (full ? drum(slots[slot], shift) : { transform: `translateX(${(-shift).toFixed(1)}px)`, away: 0, side: 1, level: 2 });

function railOf(stage: HTMLElement): Rail {
  const cards = [...stage.querySelectorAll<HTMLElement>("[data-home-card]")].flatMap((face) => {
    const slot = face.dataset.homeCard;
    const frame = face.parentElement;
    return isSlot(slot) && frame ? [{ slot, frame, face, turning: turningOf(face) }] : [];
  });
  return { stage, cards };
}

function paint({ cards }: Rail, full: boolean, shift: number) {
  for (const { slot, frame, face, turning } of cards) {
    const { transform, away, side, level } = poseAt(full, slot, shift);
    face.style.transform = transform;
    frame.style.zIndex = String(level);
    showTurn(turning, away, side);
  }
}

const keyArt = <KeyRound aria-hidden className="m-auto size-24 text-primary" strokeWidth={1.5} />;

/**
 * Home: the greeting, the launcher cards in one carousel that turns them away round its edges like the side of a drum,
 * the pager, and a banner when there is news. Files follows Calendar, Email and Internet, and Passwords has its own
 * page after Files. Above Grace's compact window the cards stand in narrow columns that slide flat, with Passwords
 * centered on the last page. With the keyboard up as well, only the greeting
 * stays. It lies under the rail, which is glass, so a card rolling off the left shows through it. Place it on the
 * `TabletScreen` beside the `Rail`. A swipe moves the cards by their transforms until it settles on a page.
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
  const columnStep = (stageWidth - STAGE.rail + columnGap) / COLUMNS_IN_VIEW;
  const lastPage: HomePage = passwords ? "PasswordsCard" : "FilesCard";
  const shown = pages.slice(0, pages.indexOf(lastPage) + 1);
  const stop = (of: HomePage) => compact ? columnShifts[of] * columnStep : shifts[of];
  const nearestTo = (at: number) => shown.reduce((best, next) => Math.abs(stop(next) - at) < Math.abs(stop(best) - at) ? next : best);
  const committed = shown.includes(page) ? page : "MainCards";
  const rest = stop(committed);
  const railRef = useRef<Rail | null>(null);
  const swipeRef = useRef<Swipe | null>(null);
  const swipedRef = useRef(false);
  const settle = useCallback((stage: HTMLDivElement | null) => {
    if (!stage) return;
    const entering = railRef.current?.stage !== stage;
    const rail = railOf(stage);
    railRef.current = rail;
    paint(rail, full, rest);
    if (entering) play(stage, [{ opacity: 0 }, { opacity: 1 }], { duration: "quick", ease: "out-cubic" });
  }, [full, rest]);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    swipedRef.current = false;
    if (layout === "greeting" || (event.target as Element).closest("[data-home-pager] button")) return;
    const home = event.currentTarget;
    const k = ((home.getBoundingClientRect().width / home.offsetWidth) || 1) * scale;
    swipeRef.current = { pointer: event.pointerId, x: event.clientX, k, from: rest, shift: rest, moved: false };
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    const rail = railRef.current;
    if (!swipe || !rail || event.pointerId !== swipe.pointer || event.buttons === 0) return;
    const dx = (event.clientX - swipe.x) / swipe.k;
    if (!swipe.moved) {
      if (Math.abs(dx) <= SWIPE.threshold) return;
      swipe.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      rail.stage.dataset.dragging = "";
    }
    swipe.shift = Math.max(stop("MainCards") - SWIPE.overscroll, Math.min(stop(lastPage) + SWIPE.overscroll, swipe.from - dx));
    paint(rail, full, swipe.shift);
  };
  const release = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const swipe = swipeRef.current;
    if (swipe?.pointer !== event.pointerId) return;
    const rail = railRef.current;
    swipeRef.current = null;
    if (!swipe?.moved || !rail) return;
    swipedRef.current = true;
    delete rail.stage.dataset.dragging;
    const over = cancelled ? committed : nearestTo(swipe.shift);
    const to = over === committed || onPageChange?.(over) !== false ? over : committed;
    paint(rail, full, stop(to));
  };
  const swallowSwipeClick = (event: MouseEvent) => {
    if (!swipedRef.current) return;
    swipedRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  };
  const cards: Record<Slot, ReactNode> = {
    calendar: useMemo(() => <HomeCalendarCard {...calendar} compact={compact} turns={full} className={cn("size-full", calendar.className)} />, [calendar, compact, full]),
    email: useMemo(() => <HomeEmailCard {...email} compact={compact} turns={full} className={cn("size-full", email.className)} />, [email, compact, full]),
    internet: useMemo(() => <InternetCard {...internet} compact={compact} turns={full} className={cn("size-full", internet.className)} />, [internet, compact, full]),
    files: useMemo(() => <FilesCard {...files} compact={compact} turns={full} className={cn("size-full", files.className)} />, [files, compact, full]),
    passwords: useMemo(() => passwords && <LauncherCard {...passwords} title="Passwords" compact={compact} turns={full} className="size-full">{keyArt}</LauncherCard>, [passwords, compact, full]),
  };
  const place = (slot: Slot) => {
    const frame = full ? { left: slots[slot].x, top: slots[slot].top, width: slots[slot].w, height: slots[slot].h } : { left: columns[slot] * columnStep, top: 0, width: columnStep - columnGap, height: "100%" };
    const offPage = !pageCards[committed].includes(slot);
    return (
      <div key={slot} aria-hidden={offPage || undefined} inert={offPage} className="absolute" style={frame}>
        <div data-home-card={slot} className="size-full origin-top-left backface-hidden transition-transform duration-slow ease-out-cubic will-change-transform group-data-dragging/home:transition-none motion-reduce:transition-none">
          {cards[slot]}
        </div>
      </div>
    );
  };
  return (
    <div
      ref={measure}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={(event) => release(event)}
      onPointerCancel={(event) => release(event, true)}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget) release(event, true);
      }}
      onClickCapture={swallowSwipeClick}
      className={cn("absolute inset-1.5 z-[1] touch-pan-y touch-pinch-zoom overflow-hidden font-sans", className)}
      {...props}
    >
      <div className="absolute top-0 left-0" style={{ width: stageWidth, height: full ? STAGE.height : box.height / scale, transformOrigin: `${STAGE.rail}px 0`, scale: String(scale), translate: `${x}px 0` }}>
        {!compact && <HomeGreeting greeting={greeting} name={name} line={line} compact={!full} className={cn("absolute left-[182px]", full ? "top-[34px]" : "top-[22px]")} />}
        {banner ? <div className="absolute top-4 right-5 left-[614px] z-[310]">{banner}</div> : null}
        {layout !== "greeting" && (
          <div key={passwords ? layout : `${layout}-short`} ref={settle} className={cn("group/home absolute", full ? "top-40 left-[182px] h-[560px] w-[1042px]" : "inset-y-0 right-0 left-[138px] overflow-clip")}>
            {(["calendar", "email", "internet", "files"] as const).map(place)}
            {passwords && place("passwords")}
          </div>
        )}
        <HomePager data-home-pager page={shown.indexOf(committed)} count={shown.length} compact={compact} arrows={layout !== "greeting"} onPageChange={(i) => onPageChange?.(shown[i] ?? "MainCards")} {...pager} />
      </div>
    </div>
  );
}
