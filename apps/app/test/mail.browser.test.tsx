// spec/app/mailboxes.md, "Story: See all my email in one place"
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Accounts, type Event as AccountEvent, Machine as AccountsMachine } from "../gen/app__accounts.effect.vibe";
import { addAccount, allowedUse, chooseProvider, goBack, initial, type Provider, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { client, expire, signIn } from "./cloud.vibe";
import "../src/main.css";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });

const cloud = inject("cloud");
const gmail = "owner@grace.test";
const outlook = "margaret@outlook.com";

/** Margaret allows the tablet on Outlook's own page, as the fake serves it. */
async function allowOutlook(key: string) {
  const started = await fetch(`${cloud}/api/v1/eliza/connections/outlook/sessions`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ loginHint: "" }),
  });
  const { pageUrl } = await started.json() as { pageUrl: string };
  await fetch(pageUrl, { method: "POST", body: new URLSearchParams({ address: outlook, choice: "allow" }) });
}

/** The accounts the tablet already keeps: Gmail and Outlook, each allowed on its company's own page. */
function kept(): Accounts {
  const connected = (a: Accounts, provider: Provider, address: string, name: string) => {
    const chosen = chooseProvider(a, provider, "AccountPerson");
    return sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address, granted: allowedUse }, name, "AccountConnector");
  };
  return connected(addAccount(goBack(connected(initial, "Gmail", gmail, "Gmail"), "AccountPerson"), "AccountPerson"), "Outlook", outlook, "Outlook");
}

it("See all my email in one place", async () => {
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  await allowOutlook(secret);
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(kept()));
  const runtime = ManagedRuntime.make(application(undefined, undefined, { url: cloud, key: secret }));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  const host = (availability: "Online" | "Offline") => act(() => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.flatMap(w.get(), ({ device }) =>
    w.send({ type: "setAvailability", availability: { connection: availability, reasoning: device.reasoningAvailable, microphone: device.microphoneAllowed, observation: device.observationAllowed } }, "Host")))));
  const person = (event: AccountEvent) => act(() => runtime.runPromise(Effect.flatMap(Effect.service(AccountsMachine), (a) => a.send(event, "AccountPerson"))));

  // spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes": each account's mailbox fills from its own company,
  // and Home shows the newest unread of them.
  const card = page.getByRole("button", { name: /^Email/ });
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);
  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"
  await host("Offline");
  await expect.element(card).toHaveAccessibleName(/Waiting for the internet/);
  await host("Online");
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);

  await act(() => userEvent.click(card));
  const folders = page.getByRole("navigation", { name: "Folders" });
  const row = (name: string) => folders.getByRole("button", { name: new RegExp(`^${name}`) });
  await expect.element(row("All inboxes 5")).toBeVisible();
  await expect.element(row("Gmail 4")).toBeVisible();
  await expect.element(row("Outlook 1")).toBeVisible();
  const clinic = page.getByRole("button", { name: /Main St Clinic/ });
  const church = page.getByRole("button", { name: /St\. Mark’s Church Office/ });
  await expect.element(clinic).toBeVisible();
  await expect.element(church).toBeVisible();

  await act(() => userEvent.click(row("Outlook")));
  await expect.element(row("Outlook")).toHaveAttribute("aria-current", "page");
  await expect.element(clinic).not.toBeInTheDocument();
  await expect.element(church).toBeVisible();
  await act(() => userEvent.click(row("All inboxes")));
  await expect.element(clinic).toBeVisible();

  // spec/app/email.md, "Each search or content read needs current access and the user's choice": opening reads the message from its company.
  await act(() => userEvent.click(clinic));
  await expect.element(page.getByText(/appointment with Dr\. Patel tomorrow at 10:00 am/)).toBeVisible();
  await expect.element(page.getByText("Visit form.pdf")).toBeVisible();
  await act(() => userEvent.click(page.getByRole("button", { name: "Back to Inbox" })));
  await expect.element(row("Gmail 3")).toBeVisible();

  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account": Outlook's sign-in ends,
  // its banner says so, and its mail stays on the tablet.
  await Effect.runPromise(Effect.provide(expire(cloud, secret, outlook), client));
  await act(() => userEvent.click(church));
  await expect.element(page.getByText("Outlook needs you to sign in again")).toBeVisible();
  await expect.element(church).toBeVisible();

  // spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere": Outlook's Email switch goes off.
  await person({ type: "setUse", id: 2, use: { mail: false, calendar: true, contacts: true } });
  await expect.element(church).not.toBeInTheDocument();
  await expect.element(page.getByText("Outlook needs you to sign in again")).not.toBeInTheDocument();
  await expect.element(row("Inbox 3")).toBeVisible();
  await expect.element(row("Outlook")).not.toBeInTheDocument();

  await act(() => userEvent.click(page.getByRole("button", { name: "Close Email" })));
  await expect.element(card).toHaveAccessibleDescription(/Your Riverside Power bill is ready/);

  await act(() => Promise.resolve(root.unmount()));
  await runtime.dispose();
  localStorage.clear();
});
