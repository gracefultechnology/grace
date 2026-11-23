// spec/app/workspace.md, "A read plan offered in chat waits for the person to start it"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { type StatementAnswer, type StatementFact, statementAnswer } from "./statementLabels.ts";

const dueLabels = ["Total amount due", "Total installment due", "Amount due", "Total due", "Balance due", "Total Balance Due", "Current amount due", "Your amount due", "AMOUNT DUE", "Payment due", "Account balance (amount due)", "Current balance (amount due)"] as const;
const balanceLabels = ["New Balance", "Statement balance", "Last statement balance", "Your new balance", "New balance due"] as const;
const remainingLabels = ["Remaining statement balance", "Remaining Balance Due", "REMAINING STATEMENT BALANCE"] as const;
const dateLabels = ["Payment due date", "Due date", "Bill due date", "Payment due", "Due by", "Payment due by", "Pay by", "Due on", "PAYMENT DUE DATE",
  "Next payment due date", "Please pay by", "Due"] as const;
const amounts = [["$84.12", "$84.12"], ["$1,284.56", "$1,284.56"], ["$ 84.12", "$ 84.12"], ["-$12.00", "-$12.00"], ["$-12.00", "$-12.00"],
  ["USD 84.12", "USD 84.12"], ["84.12 USD", "84.12 USD"], ["€84,12", "€84,12"], ["$84", "$84"], ["$40.00", "$40.00"], ["$12.00 CR", "$12.00 CR"],
  ["$612.40*", "$612.40"], ["$18,422.10", "$18,422.10"]] as const;
const dates = ["12/05/2026", "12/05/26", "2026-12-05", "Dec 5, 2026", "December 5, 2026", "Friday, December 5, 2026", "Fri, Dec 5, 2026",
  "5 December 2026", "Dec. 5, 2026", "December 5th, 2026", "Dec 5", "12/05"] as const;
const others = [
  "Minimum payment due $35.00", "Minimum Payment Due\n$35.00", "Minimum amount due: $35.00", "Previous balance $1,102.13", "Current balance $912.40",
  "Credit limit $5,000.00", "Available credit $3,715.44", "Pending charges $48.10", "Last payment $120.00 on Oct 28, 2026", "Statement date 11/09/26",
  "Balance due upon receipt", "Amount Due\nDue Date\nAccount ending 4471", "Pay by phone: 1-800-555-0100", "Due date for autopay: the 5th of each month",
  "Past due amount $0.00", "Interest charge $12.40", "Your session ends in 4:59", "Updated 3 seconds ago", "Previous statement balance $1,102.13",
  "Prior statement balance $980.00", "Remaining balance $18,422.10", "Principal balance $18,000.00", "Payoff amount $18,450.00",
  "Statement balance $12.00 credit", "Autopay date 12/03/26", "Due upon receipt",
] as const;
const layouts = ["colon", "space", "next", "dot"] as const;
const kinds = ["due", "balance", "remaining", "agreeing", "conflict", "cents", "missingDate", "unqualifiedBalance", "conflictingDue", "pairedDate", "conflictingDate", "unboundDate", "labeledDate"] as const;

const pick = <T>(values: readonly T[], n: number): T => values[((Math.trunc(n) % values.length) + values.length) % values.length];

const split = (value: string, how: number) => {
  const money = /^(-?\$)(\d[\d,]*)\.(\d{2})$/u.exec(value);
  if (money === null) return value;
  const [, sign, whole, cents] = money;
  return pick([value, `${sign}\n${whole}.${cents}`, `${sign}${whole}\n.${cents}`], how);
};

const placed = (label: string, value: string, layout: (typeof layouts)[number]) =>
  layout === "colon" ? `${label}: ${value}` : layout === "space" ? `${label} ${value}` : layout === "next" ? `${label}\n${value}` : `${label} · ${value}`;

const statements = Arbitrary.schema(Schema.Struct({
  kind: Schema.Int, dueLabel: Schema.Int, balanceLabel: Schema.Int, remainingLabel: Schema.Int, dateLabel: Schema.Int,
  amount: Schema.Int, other: Schema.Int, date: Schema.Int, amountLayout: Schema.Int, dateLayout: Schema.Int, split: Schema.Int,
  together: Schema.Boolean, noise: Schema.Array(Schema.Int), order: Schema.Boolean,
})).pipe(Arbitrary.map((drawn) => {
  const kind = pick(kinds, drawn.kind);
  const pairedDate = kind === "pairedDate" || kind === "conflictingDate";
  const [shownAmount, readAmount] = pick(pairedDate || kind === "unboundDate" || kind === "labeledDate" ? amounts.filter(([shown, read]) => shown === read) : amounts, drawn.amount);
  const [shownOther] = pick(amounts.filter(([, read]) => read !== readAmount), drawn.other);
  const date = pick(dates, drawn.date);
  const labelOf = (of: StatementFact) => of === "StatementBalance" ? pick(balanceLabels, drawn.balanceLabel)
    : of === "RemainingBalance" ? pick(remainingLabels, drawn.remainingLabel) : pick(dueLabels, drawn.dueLabel);
  const owedFact: StatementFact = kind === "remaining" || kind === "balance" ? "StatementBalance" : "AmountDue";
  const owed = placed(kind === "unqualifiedBalance" ? "Account balance" : labelOf(owedFact), kind === "cents" ? "$84\n12" : split(kind === "remaining" || kind === "conflict" ? shownOther : shownAmount, drawn.split),
    pick(layouts, drawn.amountLayout));
  const dueLabel = pick(dateLabels, drawn.dateLabel);
  const due = placed(dueLabel, kind === "conflictingDate" ? "January 1, 2001" : date, pick(layouts, drawn.dateLayout));
  const datedAmount = owed + " by " + date;
  const left = kind === "remaining" || kind === "agreeing" || kind === "conflict"
    ? [placed(labelOf("RemainingBalance"), split(shownAmount, drawn.split + 1), "colon")]
    : kind === "conflictingDue" ? [placed("Payment due", shownOther, "colon")] : [];
  const facts = kind === "unboundDate" || kind === "labeledDate"
    ? [owed + "\n by \n" + date, kind === "labeledDate" ? due : "Due date: January 1, 2001"] : pairedDate ? kind === "pairedDate" ? [datedAmount] : [datedAmount, due]
    : kind === "missingDate" ? [owed] : drawn.together && !owed.includes("\n") && !due.includes("\n") ? [`${owed}. ${due}.`] : drawn.order ? [due, owed] : [owed, due];
  const noise = drawn.noise.map((n) => pick(others, n));
  const lines = [...noise.slice(0, 2), ...facts.flatMap((line, k) => [line, ...noise.slice(2 + k * 2, 4 + k * 2)]), ...left, ...noise.slice(6)];
  const fact: StatementFact = kind === "balance" ? "StatementBalance" : kind === "remaining" || kind === "agreeing" ? "RemainingBalance" : "AmountDue";
  const expected: StatementAnswer = kind === "conflict" || kind === "conflictingDue" || kind === "conflictingDate" ? { tag: "Unread", reason: "Several" }
    : kind === "cents" || kind === "missingDate" || kind === "unqualifiedBalance" || kind === "unboundDate" ? { tag: "Unread", reason: "NotFound" }
    : { tag: "Read", amount: { fact, label: labelOf(fact), value: readAmount }, due: { fact: "DueDate", label: pairedDate ? "by" : dueLabel, value: date } };
  return { text: lines.join("\n"), expected };
}));
type Statement = { text: string; expected: StatementAnswer };

export const answered = contract({
  input: statements,
  run: ({ text }: Statement) => statementAnswer(text),
  deterministic: true,
  invariant: ({ expected }, answer) => JSON.stringify(answer) === JSON.stringify(expected),
});
