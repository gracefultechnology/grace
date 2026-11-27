import { useCallback, useMemo, useRef, type ComponentProps, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { play, prefersStill } from "../lib/motion.ts";
import { useSize } from "../lib/observe.ts";
import { FilesCard, type FilesCardProps } from "./FilesCard.tsx";
import { HomeCalendarCard, type HomeCalendarCardProps } from "./HomeCalendarCard.tsx";
import { HomeEmailCard, type HomeEmailCardProps } from "./HomeEmailCard.tsx";
import { HomeGreeting } from "./HomeGreeting.tsx";
import { showTurn, type Turning, turningOf, turnsFar } from "./LauncherCard.tsx";
import { HomePager, type HomePagerProps } from "./HomePager.tsx";
import { InternetCard, type InternetCardProps } from "./InternetCard.tsx";
import { PasswordsCard, type PasswordsCardProps } from "./PasswordsCard.tsx";

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
  /** The Passwords card, half height on the last page of Home's carousel beside Files; it never previews a sign-in. */
  passwords?: PasswordsCardProps;
  /** How Home fills its space; give a `compact` or `greeting` Home a `bottom` that clears Grace's window. */
  layout?: HomeLayout;
  /** Space reserved at the bottom for Grace's compact window or caption strip while Home stays full-screen so card shadows are never clipped. */
  bottomInset?: number;
  /** The page in view. */
  page?: HomePage;
  /** Asks for another page: an arrow or a dot was tapped, or Home was swiped sideways. False refuses it, and a swipe settles back. */
  onPageChange?: (page: HomePage) => boolean | undefined;
  /** The pager's accessible names. */
  pager?: Pick<HomePagerProps, "nextLabel" | "backLabel" | "pageLabel">;
};

const VIEW = 1042;
const columnGap = 20;
const SWIPE = { threshold: 6, overscroll: 60, flick: 0.5, stale: 80 };
const filesSlot = { x: 990, top: 0, w: 520, h: 560 };
const passwordsSlot = { x: filesSlot.x + filesSlot.w + columnGap, top: 0, w: VIEW - filesSlot.w - columnGap, h: 290 };
const slots = {
  calendar: { x: 0, top: 0, w: 480, h: 560 },
  email: { x: 500, top: 0, w: 470, h: 290 },
  internet: { x: 500, top: 310, w: 470, h: 250 },
  files: filesSlot,
  passwords: passwordsSlot,
};
const endsAt = ({ x, w }: typeof filesSlot) => x + w - VIEW;
const shifts: Record<HomePage, number> = { MainCards: 0, FilesCard: endsAt(filesSlot), PasswordsCard: endsAt(passwordsSlot) };
const columns: Record<keyof typeof slots, number> = { calendar: 0, email: 1, internet: 2, files: 3, passwords: 4 };
const COLUMNS_IN_VIEW = 3;
const columnShifts: Record<HomePage, number> = { MainCards: 0, FilesCard: columns.files + 1 - COLUMNS_IN_VIEW, PasswordsCard: columns.passwords + 1 - COLUMNS_IN_VIEW };
const RADIUS = 400;
const STAGE = { width: 1268, height: 788, rail: 138 };

type Slot = keyof typeof slots;
type Pose = { transform: string; away: number; side: 1 | -1; level: 0 | 1 | 2 };
type CardPose = { slot: Slot; frame: HTMLElement; face: HTMLElement; turning: Turning; transform?: string; level?: number };
type Rail = { stage: HTMLElement; cards: CardPose[] };
type Swipe = { pointer: number; x: number; k: number; from: number; shift: number; moved: boolean; at: number; speed: number };

const isSlot = (name: string | undefined): name is Slot => name !== undefined && name in slots;

function drum({ x, top, w }: (typeof slots)[Slot], shift: number): Pose {
  const left = x - shift;
  const right = left + w;
  const onRight = (left + right) / 2 > VIEW / 2;
  const past = onRight ? left - VIEW : -right;
  const over = Math.min(w, onRight ? Math.max(0, right - VIEW) : Math.max(0, -left));
  const side = onRight ? 1 : -1;
  if (past <= 0 && over === 0) {
    return {
      away: 0,
      side,
      level: 2,
      transform: `translate3d(${(-shift).toFixed(1)}px, 0, 0)`,
    };
  }
  const theta = past > 0 ? (past + w / 2) / RADIUS : over / (2 * RADIUS);
  const phi = Math.max(0, past) / RADIUS;
  const nearFlat = onRight ? left : right;
  const nearTo = past > 0 ? (onRight ? VIEW + RADIUS * Math.sin(phi) : -RADIUS * Math.sin(phi)) : nearFlat;
  const depth = past > 0 ? -RADIUS * (1 - Math.cos(phi)) : 0;
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

const poseAt = (full: boolean, slot: Slot, shift: number): Pose => (full ? drum(slots[slot], shift) : { transform: `translate3d(${(-shift).toFixed(1)}px, 0, 0)`, away: 0, side: 1, level: 2 });

function railOf(stage: HTMLElement): Rail {
  const cards = [...stage.querySelectorAll<HTMLElement>("[data-home-card]")].flatMap((face) => {
    const slot = face.dataset.homeCard;
    const frame = face.parentElement;
    return isSlot(slot) && frame ? [{ slot, frame, face, turning: turningOf(face) }] : [];
  });
  return { stage, cards };
}

const posed = ({ cards }: Rail) => cards.map((card) => card.face.style.transform).join();

function turnTo(rail: Rail, full: boolean, shift: number) {
  const from = posed(rail);
  paint(rail, full, shift);
  if (!prefersStill() && posed(rail) !== from) rail.stage.dataset.turning = "";
  else delete rail.stage.dataset.turning;
}

function paint({ cards }: Rail, full: boolean, shift: number) {
  for (const card of cards) {
    const { transform, away, side, level } = poseAt(full, card.slot, shift);
    if (card.transform !== transform) {
      card.transform = transform;
      card.face.style.transform = transform;
    }
    if (card.level !== level) {
      card.level = level;
      card.frame.style.zIndex = String(level);
    }
    showTurn(card.turning, away, side);
  }
}

/**
 * Home: the greeting, the launcher cards in one carousel that turns them away round its edges like the side of a drum,
 * the pager, and a banner when there is news. Each page shows two neighbouring sections and the next steps on by one:
 * Calendar with Email and Internet, Email and Internet with Files, then Files with Passwords. Above Grace's compact
 * window the cards stand in narrow columns that slide flat, three to a page. With the keyboard up as well, only the
 * greeting stays. It lies under the rail, which is glass, so a card rolling off the left shows through it. Place it on the
 * `TabletScreen` beside the `Rail`. A swipe moves the cards by their transforms until it settles on a page: the
 * nearest, or the next one in the direction of a quick flick. The far side of a turning card dims under one haze
 * that only fades, so the card's content is in the page once and nothing repaints.
 * The prototype's `#home[data-hmode]` control-panel modes A–F and H are experiments; only mode G, progressive blur and
 * its default, is the design.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 * @design packages/design-system/design.md#screens
 */
export function HomeScreen({ greeting, name, line, banner, calendar, email, internet, files, passwords, layout = "full", bottomInset = 0, page = "MainCards", onPageChange, pager, className, ...props }: HomeScreenProps) {
  const full = layout === "full";
  const compact = layout === "compact";
  const [measure, measured] = useSize<HTMLDivElement>();
  const box = measured ?? STAGE;
  const availableHeight = Math.max(0, box.height - bottomInset);
  const across = (box.width - STAGE.rail) / (STAGE.width - STAGE.rail);
  const scale = Math.min(1, across, full ? box.height / STAGE.height : 1);
  const stageWidth = compact ? Math.max(STAGE.width, box.width) : STAGE.width;
  const x = compact ? 0 : Math.max(0, (box.width - STAGE.rail - (STAGE.width - STAGE.rail) * scale) / 2);
  const columnStep = (stageWidth - STAGE.rail + columnGap) / COLUMNS_IN_VIEW;
  const viewWidth = compact ? COLUMNS_IN_VIEW * columnStep - columnGap : VIEW;
  const lastPage: HomePage = passwords ? "PasswordsCard" : "FilesCard";
  const shown = pages.slice(0, pages.indexOf(lastPage) + 1);
  const stop = (of: HomePage) => compact ? columnShifts[of] * columnStep : shifts[of];
  const nearestTo = (at: number) => shown.reduce((best, next) => Math.abs(stop(next) - at) < Math.abs(stop(best) - at) ? next : best);
  const committed = shown.includes(page) ? page : "MainCards";
  const rest = stop(committed);
  const railRef = useRef<Rail | null>(null);
  const swipeRef = useRef<Swipe | null>(null);
  const swipedRef = useRef(false);
  const lastLayoutRef = useRef<HomeLayout | undefined>(undefined);
  const settle = useCallback((stage: HTMLDivElement | null) => {
    if (!stage) {
      railRef.current = null;
      return;
    }
    const entering = railRef.current?.stage !== stage;
    const layoutChanged = lastLayoutRef.current !== undefined && lastLayoutRef.current !== layout;
    lastLayoutRef.current = layout;
    const rail = entering || layoutChanged || !railRef.current ? railOf(stage) : railRef.current;
    railRef.current = rail;
    if (entering || layoutChanged) {
      delete rail.stage.dataset.turning;
      paint(rail, full, rest);
    } else {
      turnTo(rail, full, rest);
    }
    if (entering) play(stage, [{ opacity: 0 }, { opacity: 1 }], { duration: "quick", ease: "out-cubic" });
  }, [full, layout, rest]);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    swipedRef.current = false;
    if (layout === "greeting" || (event.target as Element).closest("[data-home-pager] button")) return;
    const home = event.currentTarget;
    const ratio = measured && home.offsetWidth ? measured.width / home.offsetWidth : (home.getBoundingClientRect().width / home.offsetWidth) || 1;
    const k = ratio * scale;
    swipeRef.current = { pointer: event.pointerId, x: event.clientX, k, from: rest, shift: rest, moved: false, at: event.timeStamp, speed: 0 };
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    const rail = railRef.current;
    if (!swipe || !rail || event.pointerId !== swipe.pointer || event.buttons === 0) return;
    if (!swipe.moved) {
      const travelled = (event.clientX - swipe.x) / swipe.k;
      if (Math.abs(travelled) <= SWIPE.threshold) return;
      swipe.moved = true;
      swipe.x += Math.sign(travelled) * SWIPE.threshold * swipe.k;
      event.currentTarget.setPointerCapture(event.pointerId);
      rail.stage.dataset.dragging = "";
    }
    const shift = Math.max(stop("MainCards") - SWIPE.overscroll, Math.min(stop(lastPage) + SWIPE.overscroll, swipe.from - (event.clientX - swipe.x) / swipe.k));
    const elapsed = event.timeStamp - swipe.at;
    if (elapsed > 0) swipe.speed = (shift - swipe.shift) / elapsed;
    swipe.at = event.timeStamp;
    swipe.shift = shift;
    paint(rail, full, shift);
  };
  const release = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const swipe = swipeRef.current;
    if (swipe?.pointer !== event.pointerId) return;
    const rail = railRef.current;
    swipeRef.current = null;
    if (!swipe?.moved || !rail) return;
    swipedRef.current = true;
    delete rail.stage.dataset.dragging;
    const near = nearestTo(swipe.shift);
    const flick = event.timeStamp - swipe.at <= SWIPE.stale && Math.abs(swipe.speed) >= SWIPE.flick ? Math.sign(swipe.speed) : 0;
    const onward = near === committed ? shown[shown.indexOf(committed) + flick] ?? committed : near;
    const over = cancelled ? committed : flick === 0 ? near : flick === Math.sign(swipe.shift - swipe.from) ? onward : committed;
    const to = over === committed || onPageChange?.(over) !== false ? over : committed;
    turnTo(rail, full, stop(to));
  };
  const swallowSwipeClick = (event: MouseEvent) => {
    if (!swipedRef.current) return;
    swipedRef.current = false;
    if (event.detail === 0) return;
    event.stopPropagation();
    event.preventDefault();
  };
  const cards: Record<Slot, ReactNode> = {
    calendar: useMemo(() => <HomeCalendarCard {...calendar} compact={compact} className={cn("size-full", calendar.className)} />, [calendar, compact]),
    email: useMemo(() => <HomeEmailCard {...email} compact={compact} className={cn("size-full", email.className)} />, [email, compact]),
    internet: useMemo(() => <InternetCard {...internet} compact={compact} className={cn("size-full", internet.className)} />, [internet, compact]),
    files: useMemo(() => <FilesCard {...files} compact={compact} className={cn("size-full", files.className)} />, [files, compact]),
    passwords: useMemo(() => passwords && <PasswordsCard {...passwords} compact={compact} className={cn("size-full", passwords.className)} />, [passwords, compact]),
  };
  const place = (slot: Slot) => {
    const frame = full ? { left: slots[slot].x, top: slots[slot].top, width: slots[slot].w, height: slots[slot].h } : { left: columns[slot] * columnStep, top: 0, width: columnStep - columnGap, height: "100%" };
    const resting = frame.left - rest;
    const offPage = resting >= viewWidth || resting + frame.width <= 0;
    return (
      <div key={slot} aria-hidden={offPage || undefined} inert={offPage} data-offpage={offPage || undefined} className="group/card absolute" style={frame}>
        <div data-home-card={slot} className="size-full origin-top-left backface-hidden transition-transform duration-slow ease-out-cubic will-change-transform group-data-dragging/home:transition-none motion-reduce:transition-none">
          {cards[slot]}
          {full && <span aria-hidden {...turnsFar} className={cn("pointer-events-none absolute inset-0 rounded-card bg-linear-to-r from-glass/0 from-30% to-glass/70 to-90% data-[side=left]:bg-linear-to-l", turnsFar.className)} />}
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
      className={cn("absolute inset-1.5 z-[1] touch-none overflow-hidden font-sans", className)}
      {...props}
    >
      <div className="absolute top-0 left-0" style={{ width: stageWidth, height: full ? STAGE.height : availableHeight / scale, transformOrigin: `${STAGE.rail}px 0`, scale: String(scale), translate: `${x}px 0` }}>
        {!compact && <HomeGreeting greeting={greeting} name={name} line={line} compact={!full} className={cn("absolute left-[182px]", full ? "top-[34px]" : "top-[22px]")} />}
        {!compact && banner ? <div className="absolute top-4 right-5 left-[614px] z-[310]">{banner}</div> : null}
        {layout !== "greeting" && (
          <div
            key={passwords ? "cards-with-passwords" : "cards"}
            ref={settle}
            onTransitionEnd={(event) => {
              if (event.propertyName === "transform" && event.target instanceof HTMLElement && "homeCard" in event.target.dataset) delete event.currentTarget.dataset.turning;
            }}
            className={cn("group/home absolute", full ? "top-40 left-[182px] h-[560px] w-[1042px]" : "top-2 right-0 bottom-0 left-[138px] overflow-x-clip overflow-y-visible")}>
            {(["calendar", "email", "internet", "files"] as const).map(place)}
            {passwords && place("passwords")}
          </div>
        )}
        <HomePager data-home-pager page={shown.indexOf(committed)} count={shown.length} compact={compact} arrows={layout !== "greeting"} onPageChange={(i) => onPageChange?.(shown[i] ?? "MainCards")} {...pager} />
      </div>
    </div>
  );
}
