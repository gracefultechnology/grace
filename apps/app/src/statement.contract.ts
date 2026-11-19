// spec/app/workspace.md, "A read plan offered in chat waits for the person to start it"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { type Labeled, type StatementFact, statementLabels } from "./statementLabels.ts";

const amountLabels = ["Total amount due", "Amount due", "Total due", "Balance due", "Total Balance Due", "Current amount due", "New Balance", "Statement balance", "Your amount due", "AMOUNT DUE"] as const;
const remainingLabels = ["Remaining statement balance", "Remaining balance due", "Remaining Balance"] as const;
const dateLabels = ["Payment due date", "Due date", "Bill due date", "Payment due", "Due by", "Payment due by", "Pay by", "Due on", "PAYMENT DUE DATE"] as const;
const amounts = ["$84.12", "$1,284.56", "$ 84.12", "-$12.00", "$-12.00", "USD 84.12", "84.12 USD", "€84,12", "$84", "$40.00"] as const;
const dates = ["12/05/2026", "12/05/26", "2026-12-05", "Dec 5, 2026", "December 5, 2026", "Friday, December 5, 2026", "Fri, Dec 5, 2026", "5 December 2026", "Dec. 5, 2026", "December 5th, 2026", "Dec 5"] as const;
const others = [
  "Minimum payment due $35.00", "Minimum Payment Due\n$35.00", "Minimum amount due: $35.00", "Previous balance $1,102.13", "Current balance $912.40",
  "Credit limit $5,000.00", "Available credit $3,715.44", "Pending charges $48.10", "Last payment $120.00 on Oct 28, 2026", "Statement date 11/09/26",
  "Balance due upon receipt", "Amount Due\nDue Date\nAccount ending 4471", "Pay by phone: 1-800-555-0100", "Due date for autopay: the 5th of each month",
  "Past due amount $0.00", "Interest charge $12.40", "Your session ends in 4:59", "Updated 3 seconds ago",
] as const;
const layouts = ["colon", "space", "next", "dot"] as const;

const pick = <T>(values: readonly T[], n: number): T => values[((Math.trunc(n) % values.length) + values.length) % values.length];

const placed = (label: string, value: string, layout: (typeof layouts)[number], split: boolean) => {
  const money = /^\$(\d+)\.(\d{2})$/u.exec(value);
  const shown = split && money ? `$${money[1]}\n.${money[2]}` : value;
  return layout === "colon" ? `${label}: ${shown}` : layout === "space" ? `${label} ${shown}` : layout === "next" ? `${label}\n${shown}` : `${label} · ${shown}`;
};

const statements = Arbitrary.schema(Schema.Struct({
  amountLabel: Schema.Int, remainingLabel: Schema.Int, dateLabel: Schema.Int, amount: Schema.Int, remaining: Schema.Int, date: Schema.Int,
  amountLayout: Schema.Int, dateLayout: Schema.Int, withRemaining: Schema.Boolean, split: Schema.Boolean, together: Schema.Boolean,
  noise: Schema.Array(Schema.Int), order: Schema.Boolean,
})).pipe(Arbitrary.map((drawn) => {
  const amount = pick(amounts, drawn.amount);
  const remaining = pick(amounts.filter((value) => value !== amount), drawn.remaining);
  const date = pick(dates, drawn.date);
  const owed = placed(pick(amountLabels, drawn.amountLabel), amount, pick(layouts, drawn.amountLayout), drawn.split);
  const due = placed(pick(dateLabels, drawn.dateLabel), date, pick(layouts, drawn.dateLayout), false);
  const left = drawn.withRemaining ? [placed(pick(remainingLabels, drawn.remainingLabel), remaining, "colon", drawn.split)] : [];
  const facts = drawn.together && !owed.includes("\n") && !due.includes("\n") ? [`${owed}. ${due}.`] : drawn.order ? [due, owed] : [owed, due];
  const noise = drawn.noise.map((n) => pick(others, n));
  const lines = [...noise.slice(0, 2), ...facts.flatMap((fact, k) => [fact, ...noise.slice(2 + k * 2, 4 + k * 2)]), ...left, ...noise.slice(6)];
  return { text: lines.join("\n"), amount, remaining: drawn.withRemaining ? remaining : undefined, date };
}));
type Statement = { text: string; amount: string; remaining?: string; date: string };

const values = (found: readonly Labeled[], fact: StatementFact) => [...new Set(found.filter((item) => item.fact === fact).map((item) => item.value))];

export const labeled = contract({
  input: statements,
  run: ({ text }: Statement) => statementLabels(text),
  deterministic: true,
  invariant: ({ amount, remaining, date }, found) =>
    JSON.stringify([values(found, "AmountDue"), values(found, "RemainingBalance"), values(found, "DueDate")]) ===
    JSON.stringify([[amount], remaining === undefined ? [] : [remaining], [date]]),
});
