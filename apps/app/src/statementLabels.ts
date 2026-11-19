// spec/app/workspace.md, "A read plan offered in chat waits for the person to start it"

export type StatementFact = "RemainingBalance" | "AmountDue" | "DueDate";
export type Labeled = { readonly fact: StatementFact; readonly label: string; readonly value: string };

const facts: readonly StatementFact[] = ["RemainingBalance", "AmountDue", "DueDate"];
const labels: Record<StatementFact, string> = {
  RemainingBalance: String.raw`remaining\s+(?:statement\s+)?balance(?:\s+due)?`,
  AmountDue: String.raw`(?:your\s+)?(?:(?:total|current|new)\s+)?(?:amount|balance)\s+due|(?:your\s+)?total\s+due|(?:your\s+)?(?:new|statement)\s+balance(?:\s+due)?`,
  DueDate: String.raw`(?:(?:payment|bill)\s+)?due\s+date|(?:payment\s+)?due\s+(?:by|on)|payment\s+due|pay\s+by`,
};
const label = new RegExp(String.raw`(?<!\p{L}\s*)(?:${facts.map((fact) => `(?<${fact}>${labels[fact]})`).join("|")})(?!\p{L})\s*:?\s*`, "giu");
const ends = String.raw`(?=$|[\s.,;:|·)\]](?!\d))`;
const number = String.raw`\d+(?:[,.]\d{3})*(?:[.,]\d{2})?`;
const money = new RegExp(String.raw`^(?:[-−]\s*)?(?:[$£€]\s*(?:[-−]\s*)?${number}|(?:USD|EUR|GBP)\s*${number}|${number}\s*(?:USD|EUR|GBP|[£€]))${ends}`, "iu");
const month = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const weekday = String.raw`(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?`;
const day = String.raw`\d{1,2}(?:st|nd|rd|th)?`;
const date = new RegExp(String.raw`^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2})|${weekday}${month}\s+${day}(?:,?\s+\d{4})?|${weekday}${day}\s+${month},?\s+\d{4})${ends}`, "iu");

function joinedFragments(lines: readonly string[]): string[] {
  return lines.reduce<string[]>((joined, line) => {
    const last = joined.at(-1) ?? "";
    const split = (/(?:^|\s)[-−]?[$£€]$/u.test(last) && /^[-−]?\d/u.test(line)) || (/[$£€]\s*[-−]?\d+$/u.test(last) && /^[.,]\d{2}(?!\d)/u.test(line));
    return split ? [...joined.slice(0, -1), last + line] : [...joined, line];
  }, []);
}

export function statementLabels(text: string): Labeled[] {
  const lines = joinedFragments(text.split(/\r?\n|[^\S\r\n]+·[^\S\r\n]+/u).map((line) => line.trim()).filter(Boolean));
  return lines.flatMap((line, index) => [...line.matchAll(label)].flatMap((match) => {
    const fact = facts.find((name) => match.groups?.[name] !== undefined);
    const words = fact === undefined ? undefined : match.groups?.[fact];
    if (fact === undefined || words === undefined) return [];
    const rest = line.slice(match.index + match[0].length);
    const value = (fact === "DueDate" ? date : money).exec(rest === "" ? lines[index + 1] ?? "" : rest)?.[0];
    return value === undefined ? [] : [{ fact, label: words.replace(/\s+/gu, " "), value: value.replace(/\s+/gu, " ") }];
  }));
}
