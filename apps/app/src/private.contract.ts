// spec/app/conversation.md, "Detected private content is removed before the conversation continues"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { isPrivateAt, withhold, type Leaving } from "./private.ts";

interface Outgoing extends Leaving { secrets: [number, number][] }

const digit = (value: number) => Math.abs(Math.trunc(value)) % 10;

const cardNumber = (body: number[], separator: string) => {
  const sum = body.reduceRight((total, value, k) => {
    const twice = value * 2 > 9 ? value * 2 - 9 : value * 2;
    return total + ((body.length - 1 - k) % 2 === 0 ? twice : value);
  }, 0);
  const digits = [...body, (10 - (sum % 10)) % 10].join("");
  return [0, 4, 8, 12].map((at) => digits.slice(at, at + 4)).join(separator);
};

const outgoing = Arbitrary.schema(
  Schema.Struct({
    before: Schema.String,
    passwords: Schema.Array(Schema.String),
    after: Schema.String,
    body: Schema.Array(Schema.Int),
    separator: Schema.Literals(["", " ", "-", "  ", ".", " - "]),
    cue: Schema.Literals(["code", "PIN", "otp", "Passcode"]),
    code: Schema.Array(Schema.Int),
  }),
).pipe(
  Arbitrary.map(({ before, passwords, after, body, separator, cue, code }): Outgoing => {
    const card = cardNumber(Array.from({ length: 15 }, (_, k) => digit(body[k] ?? k)), separator);
    const secret = Array.from({ length: 6 }, (_, k) => digit(code[k] ?? k)).join("");
    const head = [before, ...passwords, ""].join(" ");
    const middle = `${card} ${cue} `;
    return {
      text: `${head}${middle}${secret} ${after}`,
      passwords: [...passwords],
      secrets: [[head.length, head.length + card.length], [head.length + middle.length, head.length + middle.length + secret.length]],
    };
  }),
);

export const withheld = contract({
  input: outgoing,
  run: ({ text, passwords }: Outgoing) => withhold({ text, passwords }),
  deterministic: true,
  invariant: ({ text, passwords, secrets }, out) =>
    out.length === text.length
    && secrets.every(([from, to]) => !/[0-9]/.test(out.slice(from, to)))
    && Array.from({ length: text.length }, (_, k) => !isPrivateAt(text, passwords, k) || out[k] === "*").every(Boolean)
    && passwords.every((word) => word.length < 4 || word.includes("*") || !out.includes(word))
    && withhold({ text: out, passwords }) === out,
});
