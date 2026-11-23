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
