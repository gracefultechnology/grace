import type { Page } from "playwright";
import type { BrowserCommandContext } from "vitest/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { project } from "vibestack/testing/vitest";

const base = project({ root: import.meta.dirname, plugins: [tailwindcss()] });

async function googleConsent(context: BrowserCommandContext, endpoint: string, address: string) {
  const expected = new URL(endpoint);
  if (expected.hostname !== "127.0.0.1" || expected.pathname !== "/o/oauth2/v2/auth" || !address.endsWith("@grace.test"))
    throw new Error("Google consent tests use only a local fixture and synthetic email");
  const isPopup = (page: Page) => page !== context.page && (page.url() === endpoint || page.url() === "about:blank");
  const popup = context.context.pages().find(isPopup) ?? await context.context.waitForEvent("page", { predicate: isPopup });
  try {
    await popup.waitForURL(endpoint);
    await popup.getByRole("heading", { name: "Sign in to Google" }).waitFor();
    await popup.getByLabel("Email", { exact: true }).fill(address);
    await popup.getByLabel("Password", { exact: true }).fill("fixture-password");
    const callback = new URL(expected.searchParams.get("redirect_uri") ?? "", expected);
    if (callback.origin !== expected.origin || callback.pathname !== "/fake/google/callback") throw new Error("Unexpected mock Google callback");
    const [consent] = await Promise.all([
      popup.waitForResponse((response) => response.url().startsWith(`${callback.href}?`) && response.request().method() === "GET"),
      popup.getByRole("button", { name: "Allow", exact: true }).click(),
    ]);
    if (!consent.ok()) throw new Error("Mock Google consent was refused");
  } finally {
    await popup.close();
    await context.page.bringToFront();
  }
}

declare module "vitest/browser" {
  interface BrowserCommands {
    googleConsent: (endpoint: string, address: string) => Promise<void>;
  }
}

export default defineConfig(async (env) => {
  const config = await base(env);
  const projects = config.test?.projects?.map((entry) =>
    typeof entry === "object" && "test" in entry && entry.test?.browser
      ? { ...entry, test: { ...entry.test, browser: { ...entry.test.browser, commands: { googleConsent } } } }
      : entry);
  return { ...config, test: { ...config.test, projects, globalSetup: ["test/setup.vibe"] } };
});
