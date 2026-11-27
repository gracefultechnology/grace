// spec/app/accounts.md, "Mail settings can be looked up from her address, and fill the form for her to check"
import { Schema } from "effect";
import type { FoundServer, Security, ServerKind } from "../gen/app__accounts.ts";

const hostname = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
export const validHostname = (host: string) => hostname.test(host);
const kinds = new Map<string, ServerKind>([["imap", "ImapServer"], ["smtp", "SmtpServer"], ["pop3", "PopServer"]]);
const securities = new Map<string, Security>([["SSL", "SecureDirect"], ["STARTTLS", "SecureUpgrade"], ["plain", "Insecure"]]);
const serviceRecord = 33;

export const Resolved = Schema.Struct({ Answer: Schema.optionalKey(Schema.Array(Schema.Struct({ type: Schema.Number, data: Schema.String }))) });

function server(kind: ServerKind | undefined, host: string, port: number, security: Security | undefined): FoundServer[] {
  const valid = kind !== undefined && security !== undefined && validHostname(host) && Number.isInteger(port) && port > 0 && port <= 65535;
  return valid ? [{ kind, host: host.toLowerCase(), port, security }] : [];
}

export function serversIn(xml: string, domain: string): FoundServer[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return [];
  const nodes = doc.querySelectorAll("clientConfig > emailProvider > incomingServer, clientConfig > emailProvider > outgoingServer");
  return [...nodes].flatMap((node) => {
    const field = (tag: string) => node.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? "";
    return server(kinds.get(node.getAttribute("type") ?? ""), field("hostname").replaceAll("%EMAILDOMAIN%", domain), Number(field("port")), securities.get(field("socketType")));
  });
}

export function serversListed(answer: typeof Resolved.Type, kind: ServerKind, security: Security): FoundServer[] {
  return (answer.Answer ?? []).filter((a) => a.type === serviceRecord).flatMap((a) => {
    const [, , port = "", target = ""] = a.data.trim().split(/\s+/);
    return server(kind, target.replace(/\.$/, ""), Number(port), security);
  });
}
