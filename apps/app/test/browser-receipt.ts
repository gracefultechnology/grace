import { Schema } from "effect";

const Document = Schema.Struct({ url: Schema.NonEmptyString, documentId: Schema.NonEmptyString });
const Hop = Schema.Struct({ ...Document.fields, checked: Schema.Boolean });
const Navigation = Schema.Struct({
  startUrl: Schema.NonEmptyString,
  decisionProvider: Schema.Literal("hosted"),
  decisionRequests: Schema.Int,
  decisionResults: Schema.Array(Schema.Unknown),
  outcome: Schema.Struct({
    start: Document, destination: Document, hops: Schema.Array(Hop), ringTap: Schema.Literal(true),
    graceTerminal: Schema.NonEmptyString, failure: Schema.optional(Schema.Null),
  }),
});
const acceptedChoice = Schema.is(Schema.Struct({
  http: Schema.Literal(200),
  candidates: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 16 })),
  result: Schema.Struct({
    status: Schema.Literal("ok"), model: Schema.Literal("clef-flash"),
    choice: Schema.String.check(Schema.isPattern(/^[1-9][0-9]*$/)),
    confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  }),
}));

export function hasHostedNavigation(input: unknown, landingUrl: string | undefined) {
  const decoded = Schema.decodeUnknownOption(Navigation)(input);
  if (decoded._tag === "None") return false;
  const { startUrl, decisionRequests, decisionResults, outcome } = decoded.value;
  const { start, destination } = outcome;
  const last = outcome.hops.at(-1);
  return start.url === startUrl && destination.url === landingUrl && start.documentId !== destination.documentId &&
    start.url.split("#", 1)[0] !== destination.url.split("#", 1)[0] &&
    last?.checked === true && last.documentId === destination.documentId && last.url === destination.url &&
    decisionRequests === decisionResults.length &&
    decisionResults.some((item) => acceptedChoice(item) && Number(item.result.choice) <= item.candidates);
}
