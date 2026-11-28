function hostBaseDomain(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(lower) || lower.startsWith("[")) return lower;
  const parts = lower.split(".").filter(Boolean);
  if (parts.length <= 2) return lower;
  const second = parts[parts.length - 2] ?? "";
  const last = parts[parts.length - 1] ?? "";
  if (last.length === 2 && (second === "co" || second === "org" || second === "gov" || second === "ac" || second === "com" || second === "edu")) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/** @throws {never} */
export function sameSiteOrigin(candidateUrl: string, expectedOrigin: string): boolean {
  const current = URL.parse(candidateUrl);
  const expected = URL.parse(expectedOrigin);
  if (!current || !expected) return false;
  if (current.origin === expected.origin) return true;
  if (current.protocol !== expected.protocol) return false;
  if (current.port !== expected.port) return false;
  return hostBaseDomain(current.hostname) === hostBaseDomain(expected.hostname);
}
