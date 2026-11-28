import type { BrowserContext, BrowserContextOptions, Page, Request } from "playwright";

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

export async function openPersonPortalStatement(
  page: Page,
  credentials: { readonly identifier: string; readonly password: string },
) {
  for (let pass = 0; pass < 3; pass++) {
    const submitted = await page.evaluate((creds) => {
      const visible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      const inputs = [...document.querySelectorAll<HTMLInputElement>("input")].filter((el) => visible(el) && !el.disabled && !el.readOnly);
      const pw = inputs.find((el) => el.type === "password");
      const user = inputs.find((el) => el !== pw && ["email", "text", "tel"].includes(el.type));
      if (!pw && !user) return false;
      const fill = (el: HTMLInputElement, value: string) => {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      if (user && !user.value.trim()) fill(user, creds.identifier);
      if (pw && !pw.value) fill(pw, creds.password);
      const form = (pw ?? user)?.closest("form");
      const btn = form?.querySelector<HTMLElement>('button[type="submit"], input[type="submit"], button');
      if (btn) {
        btn.click();
        return true;
      }
      if (form) {
        form.requestSubmit();
        return true;
      }
      return false;
    }, credentials);
    if (submitted) {
      await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
      continue;
    }
    const openedSignIn = await page.evaluate(() => {
      const links = [...document.querySelectorAll<HTMLElement>("a, button")];
      const signIn = links.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && /^(?:sign in|log in|login|member login|account login)$/iu.test((el.textContent ?? "").trim());
      });
      if (!signIn) return false;
      signIn.click();
      return true;
    });
    if (openedSignIn) {
      await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
      continue;
    }
    break;
  }
  const navBill = await page.evaluate(() => {
    const body = document.body.innerText ?? "";
    if (/amount due|balance due|current balance|statement balance/iu.test(body) && /due date|due on|due\s+\d/iu.test(body)) {
      return false;
    }
    const links = [...document.querySelectorAll<HTMLElement>("a, button")];
    const billLink = links.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /\b(?:view bill|current bill|statements?|billing|account summary|my bill)\b/iu.test((el.textContent ?? "").trim());
    });
    if (!billLink) return false;
    billLink.click();
    return true;
  });
  if (navBill) {
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
  }
}
