// spec/app/conversation.md, "Detected private content is removed before the conversation continues"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { isPrivateAt, withhold, type Leaving } from "./private.ts";

interface Outgoing extends Leaving { plain: string; secrets: [number, number][] }

const digit = (value: number) => Math.abs(Math.trunc(value)) % 10;
const pick = (values: number[], k: number, size: number) => digit(values[k] ?? k) * 11 % size;
const two = (value: number) => String(value).padStart(2, "0");

const cardNumber = (body: number[], gaps: string[], grouping: number[]) => {
  const sum = body.reduceRight((total, value, k) => {
    const twice = value * 2 > 9 ? value * 2 - 9 : value * 2;
    return total + ((body.length - 1 - k) % 2 === 0 ? twice : value);
  }, 0);
  const digits = [...body, (10 - (sum % 10)) % 10].join("");
  const first = gaps[0] ?? " ";
  const gapAt = (k: number) => (first === "" || first === "\n" || gaps[k] === "" || gaps[k] === "\n" ? first : gaps[k] ?? first);
  const cuts = grouping.map((_, k) => grouping.slice(0, k).reduce((sum, size) => sum + size, 0));
  return cuts.slice(1).reduce((card, at, k) => `${card}${gapAt(k)}${digits.slice(at, cuts[k + 2] ?? digits.length)}`, digits.slice(0, grouping[0]));
};

const dayGrid = (values: number[], separator: string) => {
  const days = Array.from({ length: 28 + pick(values, 0, 4) }, (_, k) => String(k + 1));
  const offset = pick(values, 1, 7);
  return Array.from({ length: Math.ceil((days.length + offset) / 7) }, (_, row) =>
    days.slice(Math.max(0, row * 7 - offset), row * 7 + 7 - offset).join(separator)).join("\n");
};

const date = (values: number[], k: number) => `2026-${two(1 + pick(values, k, 12))}-${two(1 + pick(values, k + 1, 28))}`;
const amount = (values: number[], k: number) => `${10 + pick(values, k, 9) * 97}.${two(pick(values, k + 1, 100))}`;
const dialled = (values: number[]) => `${2 + pick(values, 0, 8)}${Array.from({ length: 9 }, (_, k) => digit(values[k + 1] ?? k)).join("")}`;
const phone = (values: number[], k: number) => `${200 + pick(values, k, 8) * 97}-${555 + pick(values, k + 1, 9)}-${1000 + pick(values, k + 2, 9) * 997}`;

const plainKinds = {
  grid: dayGrid,
  range: (values: number[]) => `${date(values, 0)} ${1 + pick(values, 2, 12)}.${two(pick(values, 3, 4) * 15)} - ${date(values, 4)} ${1 + pick(values, 6, 12)}.30`,
  amounts: (values: number[]) => [0, 2, 4, 6].map((k) => amount(values, k)).join("\t"),
  statement: (values: number[]) => `${date(values, 0)} ${amount(values, 2)} ${amount(values, 4)}`,
  phones: (values: number[]) => `${phone(values, 0)} ${phone(values, 3)}`,
  years: (values: number[], separator: string) => Array.from({ length: 4 }, (_, k) => String(1990 + pick(values, 0, 9) * 4 + k)).join(separator),
  answers: (values: number[], separator: string) => Array.from({ length: 20 }, (_, k) => String(1 + pick(values, k, 5))).join(separator),
  fraction: (values: number[]) => `0.${Array.from({ length: 16 }, (_, k) => digit(values[k] ?? k)).join("")}`,
  call: (values: number[]) => `Call ${dialled(values)} to verify your account`,
  texted: (values: number[]) => `We texted a code to ${dialled(values)}`,
  meeting: (values: number[]) => `Meeting ID ${phone(values, 0).replaceAll("-", " ")}\nPasscode garden\nAmount: ${amount(values, 3).split(".")[0]}`,
};

const placements = {
  before: (cue: string) => `${cue} is #`,
  after: (cue: string) => `ok # is your ${cue}`,
  colon: (cue: string) => `ok use this ${cue} to finish signing in: #`,
  below: (cue: string) => `ok your ${cue} is below.\n\n#\n`,
  verb: () => "ok enter # to continue",
  earlier: (cue: string) => `ok they sent me a ${cue}. It's #.`,
  bold: (cue: string) => `ok your ${cue} is **#**`,
  list: (cue: string) => `ok your backup ${cue}\n1. #\n2. #\n`,
  row: (cue: string) => `ok backup ${cue}: # # #`,
  spaced: (cue: string) => `ok your ${cue} is #.`,
  far: (cue: string) => `ok the ${cue} they sent to my phone this morning is #.`,
  next: (cue: string) => `ok I asked for a ${cue}.\n# is the one.`,
};

const groupings = { "4-4-4-4": [4, 4, 4, 4], "8-8": [8, 8], "8-4-4": [8, 4, 4], "5-5-6": [5, 5, 6], "3-4-4-5": [3, 4, 4, 5] };

const outgoing = Arbitrary.schema(
  Schema.Struct({
    before: Schema.String,
    passwords: Schema.Array(Schema.String),
    after: Schema.String,
    body: Schema.Array(Schema.Int),
    gaps: Schema.Array(Schema.Literals(["", " ", "-", "  ", ".", " - ", "/", "    ", "\u00a0", "\n", "\u200b"])),
    named: Schema.Literals(["", "card ", "Visa "]),
    extra: Schema.Literals(["", " 12 27", " 12 2027 123", ",123", "/12/27", " 415 555 0123", " next"]),
    cue: Schema.Literals(["code", "PIN", "otp", "Passcode", "verification codes:"]),
    placement: Schema.Literals(["before", "after", "colon", "below", "verb", "earlier", "bold", "list", "row", "spaced", "far", "next"]),
    grouping: Schema.Literals(["4-4-4-4", "8-8", "8-4-4", "5-5-6", "3-4-4-5"]),
    code: Schema.Array(Schema.Int),
    kind: Schema.Literals(["grid", "range", "amounts", "statement", "phones", "years", "answers", "fraction", "call", "texted", "meeting"]),
    gap: Schema.Literals([" ", "\t", "\n", "  "]),
    numbers: Schema.Array(Schema.Int),
  }),
).pipe(
  Arbitrary.map(({ before, passwords, after, body, gaps, named, extra, cue, placement, grouping, code, kind, gap, numbers }): Outgoing => {
    const card = cardNumber(Array.from({ length: 15 }, (_, k) => (k === 0 ? 3 + digit(body[0] ?? 1) % 4 : digit(body[k] ?? k))), [...gaps], groupings[named === "" || extra === " next" ? "4-4-4-4" : grouping]);
    const secret = Array.from({ length: 6 }, (_, k) => digit(code[k] ?? k)).join(placement === "spaced" ? " " : "");
    const plain = plainKinds[kind]([...numbers], gap);
    const head = [`${plain}.`, "ok", before, ...passwords, "ok", named].join(" ");
    const parts = [card, ...(extra === " next" ? [" ", card] : [extra]), " ", ...placements[placement](cue).split("#").flatMap((part, k) => (k === 0 ? [part] : [secret, part])), ` ${after}`];
    const starts = parts.map((_, k) => head.length + parts.slice(0, k).join("").length);
    return {
      text: head + parts.join(""),
      passwords: [...passwords],
      plain,
      secrets: parts.flatMap((part, k): [number, number][] => (part === card || part === secret ? [[starts[k], starts[k] + part.length]] : [])),
    };
  }),
);

export const withheld = contract({
  input: outgoing,
  run: ({ text, passwords }: Outgoing) => withhold({ text, passwords }),
  deterministic: true,
  invariant: ({ text, passwords, plain, secrets }, out) =>
    out.length === text.length
    && secrets.every(([from, to]) => !/[0-9]/.test(out.slice(from, to)))
    && Array.from({ length: text.length }, (_, k) => !isPrivateAt(text, passwords, k) || out[k] === "*").every(Boolean)
    && passwords.every((word) => word.length < 4 || word.includes("*") || !out.includes(word))
    && (passwords.some((word) => word.length >= 4 && text.slice(0, plain.length + word.length).toLowerCase().includes(word.toLowerCase())) || out.startsWith(plain))
    && withhold({ text: out, passwords }) === out,
});
