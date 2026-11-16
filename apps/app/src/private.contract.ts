// spec/app/conversation.md, "Detected private content is removed before the conversation continues"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { isPrivateAt, withhold, type Leaving } from "./private.ts";

interface Outgoing extends Leaving { plain: string; secrets: [number, number][] }

const digit = (value: number) => Math.abs(Math.trunc(value)) % 10;
const pick = (values: number[], k: number, size: number) => digit(values[k] ?? k) * 11 % size;
const two = (value: number) => String(value).padStart(2, "0");

const cardNumber = (body: number[], separator: string) => {
  const sum = body.reduceRight((total, value, k) => {
    const twice = value * 2 > 9 ? value * 2 - 9 : value * 2;
    return total + ((body.length - 1 - k) % 2 === 0 ? twice : value);
  }, 0);
  const digits = [...body, (10 - (sum % 10)) % 10].join("");
  return [0, 4, 8, 12].map((at) => digits.slice(at, at + 4)).join(separator);
};

const dayGrid = (values: number[], separator: string) => {
  const days = Array.from({ length: 28 + pick(values, 0, 4) }, (_, k) => String(k + 1));
  const offset = pick(values, 1, 7);
  return Array.from({ length: Math.ceil((days.length + offset) / 7) }, (_, row) =>
    days.slice(Math.max(0, row * 7 - offset), row * 7 + 7 - offset).join(separator)).join("\n");
};

const date = (values: number[], k: number) => `2026-${two(1 + pick(values, k, 12))}-${two(1 + pick(values, k + 1, 28))}`;
const amount = (values: number[], k: number) => `${10 + pick(values, k, 9) * 97}.${two(pick(values, k + 1, 100))}`;
const phone = (values: number[], k: number) => `${200 + pick(values, k, 8) * 97}-${555 + pick(values, k + 1, 9)}-${1000 + pick(values, k + 2, 9) * 997}`;

const plainKinds = {
  grid: dayGrid,
  range: (values: number[]) => `${date(values, 0)} ${1 + pick(values, 2, 12)}.${two(pick(values, 3, 4) * 15)} - ${date(values, 4)} ${1 + pick(values, 6, 12)}.30`,
  amounts: (values: number[]) => [0, 2, 4, 6].map((k) => amount(values, k)).join("\t"),
  statement: (values: number[]) => `${date(values, 0)} ${amount(values, 2)} ${amount(values, 4)}`,
  phones: (values: number[]) => `${phone(values, 0)} ${phone(values, 3)}`,
  years: (values: number[], separator: string) => Array.from({ length: 4 }, (_, k) => String(1990 + pick(values, 0, 9) * 4 + k)).join(separator),
};

const outgoing = Arbitrary.schema(
  Schema.Struct({
    before: Schema.String,
    passwords: Schema.Array(Schema.String),
    after: Schema.String,
    body: Schema.Array(Schema.Int),
    separator: Schema.Literals(["", " ", "-", "  ", ".", " - ", "/", "    "]),
    cue: Schema.Literals(["code", "PIN", "otp", "Passcode", "verification codes:"]),
    told: Schema.Literals(["before", "after"]),
    code: Schema.Array(Schema.Int),
    kind: Schema.Literals(["grid", "range", "amounts", "statement", "phones", "years"]),
    gap: Schema.Literals([" ", "\t", "\n", "  "]),
    numbers: Schema.Array(Schema.Int),
  }),
).pipe(
  Arbitrary.map(({ before, passwords, after, body, separator, cue, told, code, kind, gap, numbers }): Outgoing => {
    const card = cardNumber(Array.from({ length: 15 }, (_, k) => (k === 0 ? 3 + digit(body[0] ?? 1) % 4 : digit(body[k] ?? k))), separator);
    const secret = Array.from({ length: 6 }, (_, k) => digit(code[k] ?? k)).join("");
    const plain = plainKinds[kind]([...numbers], gap);
    const head = [plain, "ok", before, ...passwords, ""].join(" ");
    const middle = told === "before" ? `${card} ${cue} is ` : `${card} ok `;
    const tail = told === "before" ? ` ${after}` : ` is your ${cue} ${after}`;
    return {
      text: `${head}${middle}${secret}${tail}`,
      passwords: [...passwords],
      plain,
      secrets: [[head.length, head.length + card.length], [head.length + middle.length, head.length + middle.length + secret.length]],
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
    && (passwords.some((word) => word.length >= 4 && text.slice(0, plain.length + word.length).includes(word)) || out.startsWith(plain))
    && withhold({ text: out, passwords }) === out,
});
