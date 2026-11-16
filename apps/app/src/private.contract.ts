// spec/app/conversation.md, "Detected private content is removed before the conversation continues"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { withhold, type Leaving } from "./private.ts";

const leaving = Arbitrary.schema(Schema.Struct({ before: Schema.String, passwords: Schema.Array(Schema.String), after: Schema.String })).pipe(
  Arbitrary.map(({ before, passwords, after }): Leaving => ({ text: [before, ...passwords, after].join(" "), passwords: [...passwords] })),
);

export const withheld = contract({
  input: leaving,
  run: withhold,
  deterministic: true,
  invariant: ({ text, passwords }, out) =>
    out.length === text.length && passwords.every((word) => word === "" || word.includes("*") || !out.includes(word)),
});
