// spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"; spec/app/surface.md, "Story: Use the website under Grace's controls"
import { Arbitrary, Schema } from "effect";
import { contract } from "vibestack/testing";
import { LoopbackPage, SecurePage } from "./nativePage.schema.ts";

const schemes = ["https", "HTTPS", "http", "ftp", "intent", "javascript"];
const credentials = ["", "name@", "name:secret@"];
const hosts = ["www.chase.com", "bank.example", "localhost", "LocalHost", "127.0.0.1", "[::1]", "app.localhost", "localhost.bank.example"];
const rests = ["", "/", "/pay?bill=1", "#top", ":8443/sign-in", "/@bank.example"];

type Parts = { scheme: string; credential: string; host: string; rest: string };

const pick = (values: readonly string[], n: number) => values[Math.abs(Math.trunc(n)) % values.length];
const parts = Arbitrary.schema(Schema.Struct({ scheme: Schema.Int, credential: Schema.Int, host: Schema.Int, rest: Schema.Int })).pipe(
  Arbitrary.map(({ scheme, credential, host, rest }): Parts =>
    ({ scheme: pick(schemes, scheme), credential: pick(credentials, credential), host: pick(hosts, host), rest: pick(rests, rest) })),
);
const address = ({ scheme, credential, host, rest }: Parts) => `${scheme}://${credential}${host}${rest}`;
const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host.toLowerCase()) || host.toLowerCase().endsWith(".localhost");

export const securePages = contract({
  input: parts,
  run: (p: Parts) => Schema.is(SecurePage)(address(p)),
  invariant: (p, secure) => secure === (p.scheme.toLowerCase() === "https" && p.credential === "" && !p.host.startsWith("[")),
});

export const loopbackPages = contract({
  input: parts,
  run: (p: Parts) => Schema.is(LoopbackPage)(address(p)),
  invariant: (p, framed) => framed === (["http", "https"].includes(p.scheme.toLowerCase()) && p.credential === "" && loopback(p.host)),
});
