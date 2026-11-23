// spec/app/workspace.md, "A read plan offered in chat waits for the person to start it"
import { hasOneStatementAnswer, statementAmounts } from "../gen/app__workspace.ts";

export type StatementFact = "RemainingBalance" | "AmountDue" | "StatementBalance" | "DueDate";
export type Labeled = { readonly fact: StatementFact; readonly label: string; readonly value: string };
export type StatementAnswer =
  | { readonly tag: "Read"; readonly amount: Labeled; readonly due: Labeled }
  | { readonly tag: "Unread"; readonly reason: "NotFound" | "Several" };

const facts: readonly StatementFact[] = ["RemainingBalance", "AmountDue", "StatementBalance", "DueDate"];
const labels: Record<StatementFact, string> = {
  RemainingBalance: String.raw`remaining\s+(?:statement\s+balance|balance\s+due)`,
  AmountDue: String.raw`premium\s+due|(?:account\s+|current\s+)?balance\s+\(\s*amount\s+due\s*\)|(?:your\s+)?(?:(?:total|current|new)\s+)?amount\s+due|(?:your\s+)?(?:(?:total|current)\s+)?balance\s+due|(?:your\s+)?total\s+due|total\s+installment\s+due`,
  StatementBalance: String.raw`(?:your\s+)?(?:new|(?:last\s+)?statement)\s+balance(?:\s+due)?`,
  DueDate: String.raw`(?:next\s+)?(?:(?:payment|bill)\s+)?due\s+date|(?:payment\s+)?due\s+(?:by|on)|payment\s+due|(?:please\s+)?pay\s+by|due`,
};
const label = new RegExp(String.raw`(?<!\p{L}\s*)(?:${facts.map((fact) => `(?<${fact}>${labels[fact]})`).join("|")})(?!\p{L})\s*:?\s*`, "giu");
const ends = String.raw`(?=$|[\s.,;:|·)\]*†‡¹²³](?!\d))`;
const number = String.raw`\d+(?:[,.]\d{3})*(?:[.,]\d{2})?`;
const money = new RegExp(String.raw`^(?:[-−]\s*)?(?:[$£€]\s*(?:[-−]\s*)?${number}|(?:USD|EUR|GBP)\s*${number}|${number}\s*(?:USD|EUR|GBP|[£€]))(?:\s*CR\b)?(?!\s*credit\b)${ends}`, "iu");
const month = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const weekday = String.raw`(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?`;
const day = String.raw`\d{1,2}(?:st|nd|rd|th)?`;
const date = new RegExp(String.raw`^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2})|\d{1,2}/\d{1,2}|${weekday}${month}\s+${day}(?:,?\s+\d{4})?|${weekday}${day}\s+${month},?\s+\d{4})${ends}`, "iu");
const centsLess = /[$£€]\s*[-−]?\d+(?:[,.]\d{3})*$/u;

function joinedFragments(lines: readonly string[]): string[] {
  return lines.reduce<string[]>((joined, line) => {
    const last = joined.at(-1) ?? "";
    const glue = /(?:^|\s)[-−]?[$£€]$/u.test(last) && /^[-−]?\d/u.test(line) ? ""
      : centsLess.test(last) && /^[.,]\d{2}(?!\d)/u.test(line) ? ""
      : centsLess.test(last) && /^\d{2}$/u.test(line) ? " "
      : undefined;
    return glue === undefined ? [...joined, line] : [...joined.slice(0, -1), last + glue + line];
  }, []);
}

function statementLabels(text: string) {
  const lines = joinedFragments(text.split(/\r?\n|[^\S\r\n]+·[^\S\r\n]+/u).map((line) => line.trim()).filter(Boolean));
  const detachedDates = new Set<string>();
  const labels = lines.flatMap((line, index) => [...line.matchAll(label)].flatMap<Labeled>((match) => {
    const fact = facts.find((name) => match.groups?.[name] !== undefined);
    const words = fact === undefined ? undefined : match.groups?.[fact];
    if (fact === undefined || words === undefined) return [];
    const rest = line.slice(match.index + match[0].length);
    const candidate = rest === "" ? lines[index + 1] ?? "" : rest;
    const paymentAmount = fact === "DueDate" && /^payment\s+due$/iu.test(words) ? money.exec(candidate)?.[0] : undefined;
    const value = paymentAmount ?? (fact === "DueDate" ? date : money).exec(candidate)?.[0];
    if (value === undefined) return [];
    const found: Labeled = {
      fact: paymentAmount === undefined ? fact : "AmountDue",
      label: words.replace(/\s+/gu, " "),
      value: value.replace(/\s+/gu, " "),
    };
    const next = index + (rest === "" ? 2 : 1);
    const detachedBy = /^by(?:\s+|$)/iu.exec(lines[next] ?? "")?.[0];
    if (found.fact === "AmountDue" && candidate === value && detachedBy !== undefined) {
      const detached = lines[next]?.slice(detachedBy.length) || lines[next + 1] || "";
      const value = date.exec(detached)?.[0];
      if (value !== undefined) detachedDates.add(value.replace(/\s+/gu, " "));
    }
    const by = found.fact === "AmountDue" ? /^\s+by\s+/iu.exec(candidate.slice(value.length))?.[0] : undefined;
    const due = by === undefined ? undefined : date.exec(candidate.slice(value.length + by.length))?.[0];
    return by === undefined || due === undefined ? [found] : [found, {
      fact: "DueDate",
      label: by.trim(),
      value: due.replace(/\s+/gu, " "),
    }];
  }));
  return { labels, detachedDates };
}

export function labeledLineTotal(fragments: readonly string[]): Labeled | undefined {
  if (fragments.length !== 2) return undefined;
  const [name, value] = fragments.map((piece) => piece.trim());
  const { labels } = statementLabels(name + "\n" + value);
  const amount = labels[0];
  return labels.length === 1 && amount.fact === "AmountDue" && amount.label.toLowerCase() === name.replace(/:\s*$/u, "").toLowerCase() &&
    amount.value === value ? amount : undefined;
}

export function statementAnswer(text: string, section?: { amount: Labeled; due?: Labeled }): StatementAnswer {
  const { labels: found, detachedDates } = statementLabels(text);
  if (section) found.push(section.amount);
  if (section?.due) found.push(section.due);
  const values = (fact: StatementFact) => [...new Set(found.filter((item) => item.fact === fact).map((item) => item.value))];
  const amounts = statementAmounts(values("AmountDue"), values("StatementBalance"), values("RemainingBalance"));
  const dates = values("DueDate");
  if ([...detachedDates].some((value) => !dates.includes(value))) return { tag: "Unread", reason: "NotFound" };
  const amount = facts.flatMap((fact) => found.filter((item) => item.fact === fact && item.value === amounts[0]))[0];
  const due = found.find((item) => item.fact === "DueDate");
  if (!hasOneStatementAnswer(amounts, dates) || amount === undefined || due === undefined)
    return { tag: "Unread", reason: amounts.length > 1 || dates.length > 1 ? "Several" : "NotFound" };
  return { tag: "Read", amount, due };
}
