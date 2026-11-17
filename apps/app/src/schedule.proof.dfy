lemma CivilFromBounds(year: int, month: int, rest: int)
  requires (year >= 1970)
  requires (0 <= month)
  requires (month < 12)
  requires (rest >= 0)
  ensures (civilFrom(year, month, rest).year >= 1970)
  ensures (0 <= civilFrom(year, month, rest).month)
  ensures (civilFrom(year, month, rest).month < 12)
  ensures (1 <= civilFrom(year, month, rest).day)
  ensures (civilFrom(year, month, rest).day <= monthLength(civilFrom(year, month, rest).year, civilFrom(year, month, rest).month))
  ensures (civilFrom(year, month, rest).day <= (rest + 1))
  decreases rest
{
  monthLength_ensures(year, month);
  if rest >= monthLength(year, month) {
    CivilFromBounds((if (month == 11) then (year + 1) else year), (if (month == 11) then 0 else (month + 1)), (rest - monthLength(year, month)));
  }
}

lemma civilFrom_ensures(year: int, month: int, rest: int)
  requires (year >= 1970)
  requires (0 <= month)
  requires (month < 12)
  requires (rest >= 0)
  ensures (civilFrom(year, month, rest).year >= 1970)
  ensures (0 <= civilFrom(year, month, rest).month)
  ensures (civilFrom(year, month, rest).month < 12)
  ensures (1 <= civilFrom(year, month, rest).day)
  ensures (civilFrom(year, month, rest).day <= monthLength(civilFrom(year, month, rest).year, civilFrom(year, month, rest).month))
  ensures (civilFrom(year, month, rest).day <= (rest + 1))
{
  CivilFromBounds(year, month, rest);
}

lemma civilOf_ensures(n: int)
  ensures (civilOf(n).year >= 1970)
  ensures (0 <= civilOf(n).month)
  ensures (civilOf(n).month < 12)
  ensures (1 <= civilOf(n).day)
  ensures (civilOf(n).day <= monthLength(civilOf(n).year, civilOf(n).month))
  ensures ((n >= 0) ==> (civilOf(n).day <= (n + 1)))
{
  CivilFromBounds(1970, 0, (if (n < 0) then 0 else n));
}

lemma DaysBeforeBounds(year: int, month: int)
  requires (year >= 1970)
  requires (0 <= month)
  requires (month < 12)
  ensures (daysBefore(year, month) >= 0)
  decreases ((year * 12) + month)
{
  if month > 0 {
    DaysBeforeBounds(year, (month - 1));
    monthLength_ensures(year, (month - 1));
  } else if year > 1970 {
    DaysBeforeBounds((year - 1), 11);
    monthLength_ensures((year - 1), 11);
  }
}

lemma daysBefore_ensures(year: int, month: int)
  requires (year >= 1970)
  requires (0 <= month)
  requires (month < 12)
  ensures (daysBefore(year, month) >= 0)
{
  DaysBeforeBounds(year, month);
}

lemma dayNumber_ensures(year: int, month: int, day: int)
  requires (year >= 1970)
  requires (0 <= month)
  requires (month < 12)
  requires (day >= 1)
  ensures (dayNumber(year, month, day) >= 0)
{
  DaysBeforeBounds(year, month);
}

lemma monthStart_ensures(n: int)
  ensures ((n >= 0) ==> (((0 <= monthStart(n)) && (monthStart(n) <= n)) && ((n - 30) <= monthStart(n))))
{
  civilOf_ensures(n);
  monthLength_ensures(civilOf(n).year, civilOf(n).month);
}

lemma nextMonth_ensures(n: int)
  ensures ((n >= 0) ==> ((n < nextMonth(n)) && (nextMonth(n) <= (n + 31))))
{
  civilOf_ensures(n);
  monthLength_ensures(civilOf(n).year, civilOf(n).month);
}

lemma previousMonth_ensures(n: int)
  ensures ((n >= 31) ==> ((0 <= previousMonth(n)) && (previousMonth(n) < n)))
{
  monthStart_ensures(n);
  monthStart_ensures((monthStart(n) - 1));
}

lemma WeeksFromBounds(first: int, until: int, end: int)
  requires (first < until)
  ensures (weeksFrom(first, until, end) >= until)
  ensures (weeksFrom(first, until, end) >= end)
  ensures (first < weeksFrom(first, until, end))
  decreases (end - until)
{
  if until < end {
    WeeksFromBounds(first, (until + 7), end);
  }
}

lemma weeksFrom_ensures(first: int, until: int, end: int)
  requires (first < until)
  ensures (weeksFrom(first, until, end) >= until)
  ensures (weeksFrom(first, until, end) >= end)
  ensures (first < weeksFrom(first, until, end))
{
  WeeksFromBounds(first, until, end);
}

lemma shown_ensures(mode: Mode, anchor: int)
  ensures ((anchor >= 37) ==> (((0 <= shown(mode, anchor).first) && (shown(mode, anchor).first <= anchor)) && (anchor < shown(mode, anchor).until)))
{
  monday_ensures(anchor);
  monthStart_ensures(anchor);
  monday_ensures(monthStart(anchor));
  nextMonth_ensures(anchor);
  WeeksFromBounds(monday(monthStart(anchor)), (monday(monthStart(anchor)) + 7), nextMonth(anchor));
}

lemma moved_ensures(w: Days, kind: Move, chosen: int)
  ensures (kind.Earlier? ==> (w.anchorDay >= 31) ==> ((moved(w, kind, chosen).mode == w.mode) && (moved(w, kind, chosen).anchorDay < w.anchorDay)))
  ensures (kind.Later? ==> (w.anchorDay >= 31) ==> ((moved(w, kind, chosen).mode == w.mode) && (moved(w, kind, chosen).anchorDay > w.anchorDay)))
  ensures (kind.SelectDay? ==> (moved(w, kind, chosen).mode.WeekView? && (moved(w, kind, chosen).anchorDay == moved(w, kind, chosen).selectedDay)))
  ensures (kind.Today? ==> (moved(w, kind, chosen).anchorDay == moved(w, kind, chosen).selectedDay))
  ensures (kind.SwitchMode? ==> ((moved(w, kind, chosen).mode != w.mode) && (moved(w, kind, chosen).selectedDay == w.selectedDay)))
{
  previousMonth_ensures(w.anchorDay);
  nextMonth_ensures(w.anchorDay);
}

lemma monthly_ensures(from: Civil, index: int)
  ensures (monthly(from, index) >= -1)
{
  var year := (from.year + JSFloorDiv(index, 12));
  var month := (index - (12 * JSFloorDiv(index, 12)));
  if (year >= 1970) && (from.day >= 1) && (0 <= month) && (month < 12) {
    DaysBeforeBounds(year, month);
  }
}

lemma shifted_ensures(repeat: Repeat, day: int, k: int)
  ensures ((k == 0) ==> (shifted(repeat, day, k) == day))
  ensures ((k != 0) ==> repeat.Once? ==> (shifted(repeat, day, k) == -1))
  ensures ((k != 0) ==> repeat.Weekly? ==> (shifted(repeat, day, k) == (if ((day + (7 * k)) >= 0) then (day + (7 * k)) else -1)))
{
  monthly_ensures(civilOf(day), (civilOf(day).month + k));
}
