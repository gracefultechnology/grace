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

export function publicSearchQuery(intent: string): string | undefined {
  return /^Search for "([^"\p{Cc}\p{Cf}]{1,160})"$/u.exec(intent)?.[1];
}

export const PublicSearch = Schema.Struct({
  query: Schema.NonEmptyString,
  action: Schema.NonEmptyString,
  field: Schema.NonEmptyString,
});

export function matchesPublicSearch(address: URL, search: typeof PublicSearch.Type): boolean {
  const action = URL.parse(search.action);
  const fields = [...address.searchParams];
  return action !== null && action.origin === address.origin && action.pathname === address.pathname &&
    !address.username && !address.password && !address.hash &&
    fields.length === 1 && fields[0]?.[0] === search.field && fields[0]?.[1] === search.query;
}

const UserAssistedSearch = Schema.Struct({
  startUrl: Schema.NonEmptyString,
  intent: Schema.NonEmptyString,
  decisionProvider: Schema.Literal("none"),
  decisionRequests: Schema.Literal(0),
  decisionResults: Schema.Array(Schema.Unknown),
  chatStatus: Schema.Literal(200),
  syntheticStorageState: Schema.Literal(true),
  outcome: Schema.Struct({
    operator: Schema.Literal("trusted Chromium keyboard input in the website search field"),
    chatProvider: Schema.Literal("upstream"),
    start: Document, destination: Document, hops: Schema.Array(Hop),
    publicSearch: PublicSearch, resumed: Schema.Literal(true), ringTap: Schema.optional(Schema.Literal(false)),
    reviewedSteps: Schema.Array(Schema.Struct({ kind: Schema.Literal("SearchPublicSite"), subject: Schema.NonEmptyString })),
    graceTerminal: Schema.NonEmptyString, failure: Schema.optional(Schema.Null),
  }),
});

export type CompletedPublicSearch = {
  search: typeof PublicSearch.Type;
  start: typeof Document.Type;
  destination: typeof Document.Type;
};

export function hasUserAssistedSearch(input: unknown, completed: CompletedPublicSearch | undefined, current: typeof Document.Type | undefined) {
  const decoded = Schema.decodeUnknownOption(UserAssistedSearch)(input);
  if (decoded._tag === "None" || !completed || !current) return false;
  const { startUrl, intent, decisionResults, outcome } = decoded.value;
  const { start, destination, publicSearch, reviewedSteps, hops } = outcome;
  const landed = URL.parse(destination.url);
  return start.url === startUrl && start.url === completed.start.url && start.documentId === completed.start.documentId &&
    destination.url === current.url && destination.documentId === current.documentId &&
    destination.url === completed.destination.url && destination.documentId === completed.destination.documentId &&
    publicSearch.query === completed.search.query && publicSearch.action === completed.search.action &&
    publicSearch.field === completed.search.field && landed !== null &&
    landed.origin === URL.parse(startUrl)?.origin && destination.documentId !== start.documentId &&
    publicSearch.query === publicSearchQuery(intent) && reviewedSteps.length === 1 &&
    reviewedSteps[0]?.subject === publicSearch.query && matchesPublicSearch(landed, publicSearch) &&
    hops.length === 1 && hops[0]?.checked === true && hops[0].url === destination.url &&
    hops[0].documentId === destination.documentId && decisionResults.length === 0;
}
