// spec/app/calendarView.md, "Navigation clears detail and only accepts a validated calendar interval"; spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { civilOf, dayNumber, monday, moved, type Move, planned, repetitions, shifted, shown } from "./schedule.ts";

const day = 24 * 60 * 60 * 1000;
const within = (n: number, size: number) => ((Math.trunc(n) % size) + size) % size;
const utc = (n: number) => new Date(n * day);
const moves: Move[] = ["Today", "Earlier", "Later", "SelectDay", "SwitchMode"];

const days = Arbitrary.schema(Schema.Struct({ n: Schema.Int, k: Schema.Int, other: Schema.Int, kind: Schema.Int, month: Schema.Boolean })).pipe(
  Arbitrary.map(({ n, k, other, kind, month }) => ({ n: 800 + within(n, 60_000), k: within(k, 49) - 24, other: 800 + within(other, 60_000), kind: moves[within(kind, moves.length)], month })),
);
type Days = { n: number; k: number; other: number; kind: Move; month: boolean };

export const civil = contract({
  input: days,
  run: ({ n }: Days) => civilOf(n),
  deterministic: true,
  invariant: ({ n }, c) => {
    const d = utc(n);
    return c.year === d.getUTCFullYear() && c.month === d.getUTCMonth() && c.day === d.getUTCDate() && dayNumber(c.year, c.month, c.day) === n;
  },
});

export const weeks = contract({
  input: days,
  run: ({ n }: Days) => monday(n),
  invariant: ({ n }, first) => utc(first).getUTCDay() === 1 && n - 6 <= first && first <= n,
});

export const months = contract({
  input: days,
  run: ({ n, month }: Days) => shown(month ? "MonthView" : "WeekView", n),
  invariant: ({ n, month }, { first, until }) => {
    const inMonth = (d: Date) => d.getUTCMonth() === utc(n).getUTCMonth() && d.getUTCFullYear() === utc(n).getUTCFullYear();
    return utc(first).getUTCDay() === 1 && (until - first) % 7 === 0 && first <= n && n < until
      && (!month || (inMonth(utc(first + 6)) && inMonth(utc(until - 7)) && !inMonth(utc(first - 1)) && !inMonth(utc(until))));
  },
});

export const navigation = contract({
  input: days,
  run: ({ n, other, kind, month }: Days) => ({ before: { mode: month ? "MonthView" as const : "WeekView" as const, anchorDay: n, selectedDay: n }, after: moved({ mode: month ? "MonthView" : "WeekView", anchorDay: n, selectedDay: n }, kind, other) }),
  invariant: ({ kind }, { before, after }) => {
    const sameMonth = (a: number, b: number) => utc(a).getUTCMonth() === utc(b).getUTCMonth() && utc(a).getUTCFullYear() === utc(b).getUTCFullYear();
    const steps = (a: number, b: number) => (utc(b).getUTCFullYear() - utc(a).getUTCFullYear()) * 12 + utc(b).getUTCMonth() - utc(a).getUTCMonth();
    return kind === "Earlier" || kind === "Later"
      ? before.mode === "WeekView"
        ? after.anchorDay - before.anchorDay === (kind === "Later" ? 7 : -7)
        : utc(after.anchorDay).getUTCDate() === 1 && steps(before.anchorDay, after.anchorDay) === (kind === "Later" ? 1 : -1) && after.selectedDay === before.selectedDay
      : kind !== "SwitchMode" || before.mode === "WeekView" || sameMonth(after.anchorDay, before.selectedDay);
  },
});

export const repeating = contract({
  input: days,
  run: ({ n, k, month }: Days) => shifted(month ? "Monthly" : "Weekly", n, k),
  invariant: ({ n, k, month }, at) => {
    const d = utc(n);
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate()));
    return !month ? at === n + 7 * k : next.getUTCDate() === d.getUTCDate() ? at === Math.round(next.getTime() / day) : at === -1;
  },
});

export const series = contract({
  input: days,
  run: ({ n, k, month }: Days) => {
    const place = within(k, 6);
    const members = Array.from({ length: 6 }, (_, i) => ({ id: i === 0 ? "s" : `s@${i}`, placed: true, place: i }));
    return { place, plan: planned(members, members[place].id, place, month ? "Monthly" : "Weekly", n) };
  },
  invariant: ({ n, month }, { place, plan }) => plan.every((p, i) => {
    const d = utc(n);
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i - place, d.getUTCDate()));
    const expected = !month ? n + 7 * (i - place) : next.getUTCDate() === d.getUTCDate() ? Math.round(next.getTime() / day) : -1;
    return p.moved && p.day === expected && p.include === (expected >= 0);
  }),
});

export const repeated = contract({
  input: days,
  run: ({ n, k, month }: Days) => repetitions(
    { repeat: month ? "Monthly" : "Weekly", day: n, place: 1000 + within(k, 6) },
    { kind: "DateRange", first: n - 100, until: n + 400 },
  ),
  invariant: ({ n, k, month }, found) => {
    const anchor = utc(n);
    const expected = Array.from({ length: 73 }, (_, i) => i - 15).flatMap((offset) => {
      const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, anchor.getUTCDate()));
      const at = month ? Math.round(date.getTime() / day) : n + 7 * offset;
      return (!month || date.getUTCDate() === anchor.getUTCDate()) && n - 100 <= at && at < n + 400
        ? [{ place: 1000 + within(k, 6) + offset, day: at }] : [];
    });
    return found.length === expected.length && found.every((r, i) => r.place === expected[i].place && r.day === expected[i].day);
  },
});
