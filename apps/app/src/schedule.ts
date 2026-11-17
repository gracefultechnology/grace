//@ backend dafny
// spec/app/calendarView.md, "Navigation clears detail and only accepts a validated calendar interval"; spec/app/calendarView.md, "Saving a repeating event updates its whole series through the same form"

export type Mode = "WeekView" | "MonthView";
export type Move = "Today" | "Earlier" | "Later" | "SelectDay" | "SwitchMode";
export type Repeat = "Once" | "Weekly" | "Monthly";

export interface Civil { year: number; month: number; day: number }
export interface Days { mode: Mode; anchorDay: number; selectedDay: number }
export interface Shown { first: number; until: number }
export interface Member { id: string; placed: boolean; place: number }
export interface Planned { id: string; include: boolean; moved: boolean; day: number }
export interface Repetition { place: number; day: number }

//@ pure
export function leap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

//@ pure
export function monthLength(year: number, month: number): number {
  //@ ensures 28 <= \result && \result <= 31
  return month === 1 ? (leap(year) ? 29 : 28) : month === 3 || month === 5 || month === 8 || month === 10 ? 30 : 31;
}

//@ pure
export function civilFrom(year: number, month: number, rest: number): Civil {
  //@ requires year >= 1970 && 0 <= month && month < 12 && rest >= 0
  //@ ensures \result.year >= 1970 && 0 <= \result.month && \result.month < 12
  //@ ensures 1 <= \result.day && \result.day <= monthLength(\result.year, \result.month) && \result.day <= rest + 1
  //@ decreases rest
  return rest < monthLength(year, month)
    ? { year, month, day: rest + 1 }
    : civilFrom(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, rest - monthLength(year, month));
}

//@ pure
export function civilOf(n: number): Civil {
  //@ ensures \result.year >= 1970 && 0 <= \result.month && \result.month < 12
  //@ ensures 1 <= \result.day && \result.day <= monthLength(\result.year, \result.month)
  //@ ensures n >= 0 ==> \result.day <= n + 1
  return civilFrom(1970, 0, n < 0 ? 0 : n);
}

//@ pure
export function daysBefore(year: number, month: number): number {
  //@ requires year >= 1970 && 0 <= month && month < 12
  //@ ensures \result >= 0
  //@ decreases year * 12 + month
  return month > 0
    ? daysBefore(year, month - 1) + monthLength(year, month - 1)
    : year > 1970 ? daysBefore(year - 1, 11) + monthLength(year - 1, 11) : 0;
}

//@ pure
export function dayNumber(year: number, month: number, day: number): number {
  //@ requires year >= 1970 && 0 <= month && month < 12 && day >= 1
  //@ ensures \result >= 0
  return daysBefore(year, month) + day - 1;
}

//@ pure
export function monday(n: number): number {
  //@ ensures n >= 0 ==> n - 6 <= \result && \result <= n
  return n - (n + 3) % 7;
}

//@ pure
export function monthStart(n: number): number {
  //@ ensures n >= 0 ==> 0 <= \result && \result <= n && n - 30 <= \result
  return n - civilOf(n).day + 1;
}

//@ pure
export function nextMonth(n: number): number {
  //@ ensures n >= 0 ==> n < \result && \result <= n + 31
  return monthStart(n) + monthLength(civilOf(n).year, civilOf(n).month);
}

//@ pure
export function previousMonth(n: number): number {
  //@ ensures n >= 31 ==> 0 <= \result && \result < n
  return monthStart(monthStart(n) - 1);
}

//@ pure
export function weeksFrom(first: number, until: number, end: number): number {
  //@ requires first < until
  //@ ensures \result >= until && \result >= end && first < \result
  //@ decreases end - until
  return until >= end ? until : weeksFrom(first, until + 7, end);
}

//@ pure
export function shown(mode: Mode, anchor: number): Shown {
  //@ ensures anchor >= 37 ==> 0 <= \result.first && \result.first <= anchor && anchor < \result.until
  return mode === "WeekView"
    ? { first: monday(anchor), until: monday(anchor) + 7 }
    : { first: monday(monthStart(anchor)), until: weeksFrom(monday(monthStart(anchor)), monday(monthStart(anchor)) + 7, nextMonth(anchor)) };
}

//@ pure
export function moved(w: Days, kind: Move, chosen: number): Days {
  //@ ensures kind === "Earlier" && w.anchorDay >= 31 ==> \result.mode === w.mode && \result.anchorDay < w.anchorDay
  //@ ensures kind === "Later" && w.anchorDay >= 31 ==> \result.mode === w.mode && \result.anchorDay > w.anchorDay
  //@ ensures kind === "SelectDay" ==> \result.mode === "WeekView" && \result.anchorDay === \result.selectedDay
  //@ ensures kind === "Today" ==> \result.anchorDay === \result.selectedDay
  //@ ensures kind === "SwitchMode" ==> \result.mode !== w.mode && \result.selectedDay === w.selectedDay
  const week = w.mode === "WeekView";
  return kind === "Today" ? { mode: w.mode, anchorDay: chosen, selectedDay: chosen }
    : kind === "SelectDay" ? { mode: "WeekView", anchorDay: chosen, selectedDay: chosen }
    : kind === "SwitchMode" ? (week ? { mode: "MonthView", anchorDay: w.anchorDay, selectedDay: w.selectedDay } : { mode: "WeekView", anchorDay: w.selectedDay, selectedDay: w.selectedDay })
    : kind === "Earlier" ? (week ? { mode: w.mode, anchorDay: w.anchorDay - 7, selectedDay: w.selectedDay - 7 } : { mode: w.mode, anchorDay: previousMonth(w.anchorDay), selectedDay: w.selectedDay })
    : week ? { mode: w.mode, anchorDay: w.anchorDay + 7, selectedDay: w.selectedDay + 7 } : { mode: w.mode, anchorDay: nextMonth(w.anchorDay), selectedDay: w.selectedDay };
}

//@ pure
export function shifted(repeat: Repeat, day: number, k: number): number {
  //@ ensures k === 0 ==> \result === day
  //@ ensures k !== 0 && repeat === "Once" ==> \result === -1
  //@ ensures k !== 0 && repeat === "Weekly" ==> \result === (day + 7 * k >= 0 ? day + 7 * k : -1)
  return k === 0 ? day
    : repeat === "Once" ? -1
    : repeat === "Weekly" ? (day + 7 * k >= 0 ? day + 7 * k : -1)
    : monthly(civilOf(day), civilOf(day).month + k);
}

//@ pure
export function monthly(from: Civil, index: number): number {
  //@ ensures \result >= -1
  const year = from.year + Math.floor(index / 12);
  const month = index - 12 * Math.floor(index / 12);
  return year >= 1970 && from.day >= 1 && 0 <= month && month < 12 && from.day <= monthLength(year, month) ? dayNumber(year, month, from.day) : -1;
}

//@ pure
export function plan(m: Member, selected: string, at: number, repeat: Repeat, draftDay: number): Planned {
  //@ ensures \result.id === m.id
  //@ ensures m.id === selected ==> \result.include && \result.moved && \result.day === draftDay
  //@ ensures m.id !== selected && repeat === "Once" ==> !\result.include
  //@ ensures m.id !== selected && repeat !== "Once" && m.placed ==> \result.moved && \result.day === shifted(repeat, draftDay, m.place - at) && \result.include === (\result.day >= 0)
  //@ ensures m.id !== selected && repeat !== "Once" && !m.placed ==> !\result.moved && \result.include
  return m.id === selected ? { id: m.id, include: true, moved: true, day: draftDay }
    : repeat === "Once" ? { id: m.id, include: false, moved: false, day: -1 }
    : m.placed ? { id: m.id, include: shifted(repeat, draftDay, m.place - at) >= 0, moved: true, day: shifted(repeat, draftDay, m.place - at) }
    : { id: m.id, include: true, moved: false, day: -1 };
}

export function planned(members: Member[], selected: string, at: number, repeat: Repeat, draftDay: number): Planned[] {
  //@ ensures \result.length === members.length
  //@ ensures forall(i, 0 <= i && i < members.length ==> \result[i] === plan(members[i], selected, at, repeat, draftDay))
  const out: Planned[] = [];
  let i = 0;
  while (i < members.length) {
    //@ invariant 0 <= i && i <= members.length && out.length === i
    //@ invariant forall(j, 0 <= j && j < i ==> out[j] === plan(members[j], selected, at, repeat, draftDay))
    out.push(plan(members[i], selected, at, repeat, draftDay));
    i = i + 1;
  }
  return out;
}

export function repetitions(repeat: Repeat, day: number, place: number, untilDay: number): Repetition[] {
  //@ ensures forall(i, 0 <= i && i < \result.length ==> \result[i].place >= 0 && \result[i].day === shifted(repeat, day, \result[i].place - place) && 0 <= \result[i].day && \result[i].day < untilDay)
  const out: Repetition[] = [];
  let n = 0;
  let going = true;
  while (going && n < 1000) {
    //@ invariant n >= 0
    //@ invariant forall(i, 0 <= i && i < out.length ==> out[i].place >= 0 && out[i].day === shifted(repeat, day, out[i].place - place) && 0 <= out[i].day && out[i].day < untilDay)
    //@ decreases 1000 - n
    const at = shifted(repeat, day, n - place);
    if (at >= untilDay) {
      going = false;
    } else if (at >= 0) {
      out.push({ place: n, day: at });
    }
    n = n + 1;
  }
  return out;
}
