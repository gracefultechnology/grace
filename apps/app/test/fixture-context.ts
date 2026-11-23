import type { BrowserContext, BrowserContextOptions, Request } from "playwright";

type FixtureContext = { origin: string; permits?: (request: Request, url: URL) => boolean };

export const fixtureContextOptions = { serviceWorkers: "block" } satisfies BrowserContextOptions;

export function routeFixtureContext(context: BrowserContext, { origin, permits }: FixtureContext) {
  return context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    return url.origin === origin && (permits === undefined || permits(request, url)) ? route.continue() : route.abort();
  });
}

export type FixtureUpstreamFailure = {
  phase: "headers" | "body";
  reason: "deadline" | "transport";
  upstreamStatus?: number;
};

type FixtureUpstreamResponse =
  | { tag: "Response"; status: number; contentType: string; body: string }
  | { tag: "Unavailable"; status: 503; failure: FixtureUpstreamFailure };

export async function readFixtureUpstream(url: URL, request: Pick<RequestInit, "method" | "headers" | "body">, signal: AbortSignal): Promise<FixtureUpstreamResponse> {
  let response: Response | undefined;
  try {
    response = await fetch(url, { ...request, signal, redirect: "error" });
    return { tag: "Response", status: response.status, contentType: response.headers.get("content-type") ?? "application/json", body: await response.text() };
  } catch {
    return {
      tag: "Unavailable", status: 503,
      failure: { phase: response ? "body" : "headers", reason: signal.aborted ? "deadline" : "transport", upstreamStatus: response?.status },
    };
  }
}
