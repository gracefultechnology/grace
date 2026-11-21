// spec/app/workspace.md, "A read plan offered in chat waits for the person to start it"; spec/app/workspace.md, "Only a current observation of the next outcome advances the plan"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { foldApostrophes, quotedAt } from "./words.ts";

const pieces = Schema.Array(Schema.Literals(["Grace", "s", "O", "Brien", "Children", "Help", "Center", "Centre", "é", " ", "’", "‘", "'", "“", "”", "\"", ".", "1"]));
const marks = ["’", "‘", "'"];
const inWord = (text: string) => text.replace(/(?<=[A-Za-zÀ-ÖØ-öø-ɏ])[’‘](?=[A-Za-zÀ-ÖØ-öø-ɏ])/gu, "'");

const texts = Arbitrary.schema(pieces).pipe(Arbitrary.map((parts) => parts.join("")));

const offers = Arbitrary.schema(Schema.Struct({ before: pieces, name: pieces, after: pieces, typed: Schema.Boolean, lowered: Schema.Boolean, other: pieces })).pipe(
  Arbitrary.map(({ before, name, after, typed, lowered, other }) => {
    const hers = name.join("");
    const copied = other.length > 0 ? other.join("") : typed ? hers.replace(/’/gu, "'") : hers.replace(/'/gu, "’");
    return { words: before.join("") + hers + after.join(""), name: lowered ? copied.toLowerCase() : copied };
  }),
);
type Offer = { words: string; name: string };

export const folded = contract({
  input: texts,
  run: (text: string) => foldApostrophes(text),
  deterministic: true,
  idempotent: true,
  invariant: (text, out) => out === inWord(text),
});

export const quoted = contract({
  input: offers,
  run: ({ words, name }: Offer) => quotedAt(words, name),
  deterministic: true,
  invariant: ({ words, name }, at) => at === (name === "" ? -1 : inWord(words).indexOf(inWord(name)))
    && (at < 0 || [...name].every((c, k) => words[at + k] === c || (marks.includes(c) && marks.includes(words[at + k] ?? "")))),
});
