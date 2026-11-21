// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/accounts.md, "Story: Choose what each email brings and take it off the tablet"; spec/app/mailboxes.md, "Story: See all my email in one place"
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { afterAll, beforeAll, beforeEach, expect, inject, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import type { WiFiPlugin } from "../src/surfacePlugin.ts";
import { client, expire, otherPassword, outage, reply, signIn } from "./cloud.vibe";
import { mount, actOnScreen, captureSignedOutChat } from "./screen.tsx";
import "../src/main.css";

actOnScreen();
const cloud = inject("cloud");
const outlook = "margaret@outlook.com";
const riverview = "margaret@riverview.net";
const yahoo = "margaret@yahoo.com";
const wrongPassword = "Not-the-password-7";

const otherChecks: string[] = [];
const providerPages: string[] = [];
const toasts: string[] = [];
const seen = new WeakSet<Element>();
const watcher = new MutationObserver(() => {
  for (const toast of document.querySelectorAll('[role="status"]')) if (!seen.has(toast)) {
    seen.add(toast);
    toasts.push(toast.textContent ?? "");
  }
});
const fetched = globalThis.fetch;
const opened = window.open.bind(window);
const network = { online: true };
const wifi: Pick<WiFiPlugin, "getConnectivity"> = { getConnectivity: () => Promise.resolve({ online: network.online, validated: network.online, captivePortal: false, ssid: null }) };

let secret = "";
let firstListing: Promise<void> | undefined;
const chatBodies: string[] = [];
beforeEach(() => captureSignedOutChat(chatBodies, (url) => {
  if (url.includes("/connections/other")) otherChecks.push(url);
  return url.includes("/mail/outlook/search") ? firstListing : undefined;
}));

beforeAll(() => {
  window.open = (url, ...rest) => {
    providerPages.push(String(url));
    return opened(url, ...rest);
  };
  watcher.observe(document.body, { childList: true, subtree: true });
});
beforeEach(async () => {
  localStorage.clear();
  toasts.length = 0;
  otherChecks.length = 0;
  providerPages.length = 0;
  network.online = true;
  firstListing = undefined;
  secret = (await Effect.runPromise(Effect.provide(signIn(cloud), client))).secret;
  const app = ManagedRuntime.make(application(undefined, wifi as WiFiPlugin, { url: cloud, key: secret }));
  await mount(app);
  onTestFinished(() => { localStorage.clear(); });
});
afterAll(() => {
  watcher.disconnect();
  window.open = opened;
});

const tap = (target: Parameters<typeof userEvent.click>[0]) => act(() => userEvent.click(target));
const settings = () => page.getByRole("navigation", { name: "Settings" });
const sheet = (company: string) => page.getByRole("dialog", { name: `${company} sign-in page` });
const tile = (company: string) => page.getByRole("button", { name: new RegExp(`^${company}`) });
const caution = () => page.getByRole("alert");

async function providerPage() {
  await expect.poll(() => providerPages.length).toBeGreaterThan(0);
  return providerPages.shift() ?? "";
}

async function answerOutlook(choice: "allow" | "unfinished") {
  await expect.element(sheet("Outlook")).toBeVisible();
  const body = new URLSearchParams({ address: choice === "allow" ? outlook : "", choice });
  await act(async () => { await fetched(await providerPage(), { method: "POST", body }); });
  await expect.element(sheet("Outlook")).not.toBeInTheDocument();
}

async function toasted(text: string) {
  await expect.poll(() => toasts).toContain(text);
  toasts.splice(toasts.indexOf(text), 1);
}

async function openEmailSettings() {
  await tap(page.getByRole("button", { name: "Settings", exact: true }));
  await tap(settings().getByRole("button", { name: "Email & calendar" }));
}

async function closeSettings() {
  await tap(page.getByRole("button", { name: "Close Settings" }));
}

async function host(online: boolean) {
  network.online = online;
  await act(() => Promise.resolve(window.dispatchEvent(new Event(online ? "online" : "offline"))));
  await expect.element(page.getByRole("button", { name: online ? "Wi-Fi" : "Wi-Fi, not connected", exact: true })).toBeVisible();
}

async function askGrace(said: string) {
  const composer = page.getByRole("textbox", { name: "Message to Grace" });
  await tap(page.getByRole("button", { name: "Ask Grace", exact: true }));
  await expect.element(composer).toBeVisible();
  await act(() => userEvent.type(composer, `${said}{Enter}`));
  await expect.element(page.getByText(reply(said))).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Grace" }));
}

const told = () => chatBodies.join("\n");
const emailCard = () => page.getByRole("button", { name: /^Email/ });

async function readOutlookFromHome() {
  await closeSettings();
  await tap(emailCard());
  await expect.element(page.getByRole("button", { name: /St\. Mark’s Church Office/ })).toBeVisible();
}

it("Connect the email I already use", async () => {
  // spec/app/accounts.md, "Only the current sign-in attempt can add or renew an account"
  await openEmailSettings();
  await expect.element(page.getByText("Which email do you use?")).toBeVisible();
  let release = () => {};
  firstListing = new Promise((resolve) => { release = resolve; });
  await tap(tile("Outlook"));
  await answerOutlook("allow");
  await expect.element(page.getByRole("heading", { name: "Outlook", level: 1 })).toBeVisible();
  await expect.element(page.getByText("Outlook · Connected")).toBeVisible();
  await toasted("Outlook connected");

  // spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"
  const syncing = page.getByText("Getting your Outlook email…");
  await closeSettings();
  await tap(emailCard());
  await expect.element(syncing).toBeVisible();
  release();
  await expect.element(page.getByRole("button", { name: /St\. Mark’s Church Office/ })).toBeVisible();
  await expect.element(syncing).not.toBeInTheDocument();
  await tap(page.getByRole("button", { name: "Write" }));
  await expect.element(page.getByRole("button", { name: "Susan" })).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Email" }));

  // spec/app/accounts.md, "Turning a use off hides it and keeps the account"; spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"
  const use = (name: string) => page.getByRole("switch", { name });
  const outlookRow = page.getByRole("button", { name: new RegExp(outlook) });
  await openEmailSettings();
  await tap(outlookRow);
  await tap(use("Email"));
  await expect.element(use("Email")).not.toBeChecked();
  await closeSettings();
  await expect.element(page.getByText("Not connected", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Connect your email to see it here.")).toBeVisible();
  await tap(emailCard());
  await expect.element(page.getByText("Get your email on this tablet")).toBeVisible();
  await tap(page.getByRole("button", { name: "Connect your email" }));
  await expect.element(settings().getByRole("button", { name: "Email & calendar" })).toHaveAttribute("aria-current", "page");
  await tap(outlookRow);
  await tap(use("Email"));
  await tap(use("Contacts"));
  await expect.element(use("Contacts")).not.toBeChecked();
  await closeSettings();
  await expect.element(page.getByRole("button", { name: /St\. Mark’s Church Office/ })).toBeVisible();
  await tap(page.getByRole("button", { name: "Write" }));
  await expect.element(page.getByRole("heading", { name: "New email" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Susan" })).not.toBeInTheDocument();
  await tap(page.getByRole("button", { name: "Close Email" }));

  // spec/app/accounts.md, "The settings pages go back one step at a time"
  await openEmailSettings();
  await expect.element(page.getByRole("button", { name: new RegExp(outlook) })).toBeVisible();

  await tap(page.getByRole("button", { name: "Add another email" }));
  await expect.element(page.getByRole("heading", { name: "Add an email", level: 1 })).toBeVisible();
  await tap(tile("Outlook"));
  await expect.element(sheet("Outlook")).toBeVisible();
  await providerPage();
  await expect.element(sheet("Outlook").getByText(`Outlook’s own sign-in page · ${new URL(cloud).host}`)).toBeVisible();
  await tap(sheet("Outlook").getByRole("button", { name: "Cancel" }));
  await expect.element(sheet("Outlook")).not.toBeInTheDocument();
  await expect.element(caution()).not.toBeInTheDocument();

  await tap(tile("Outlook"));
  await answerOutlook("unfinished");
  await expect.element(caution()).toHaveTextContent("Signing in wasn’t finished. You can try again.");

  await tap(tile("Outlook"));
  await answerOutlook("allow");
  await expect.element(caution()).toHaveTextContent("This email is already on the tablet.");

  // spec/app/accounts.md, "An address at a listed company goes to that company’s own page"
  await tap(tile("Other email"));
  await expect.element(page.getByRole("heading", { name: "Other email", level: 1 })).toBeVisible();
  const form = page.getByRole("form", { name: "Other email" });
  await act(() => form.getByLabelText("Your name").fill("Margaret Hill"));
  await act(() => form.getByLabelText("Email address").fill("margaret@yahoo.com"));
  await act(() => form.getByLabelText("Password").fill(wrongPassword));
  await tap(form.getByRole("button", { name: "Next" }));
  await expect.element(caution()).toHaveTextContent("This is a Yahoo address. Go back and choose Yahoo, so you can sign in on Yahoo’s own page.");
  expect(otherChecks).toEqual([]);

  // spec/app/accounts.md, "Other email connects through its own servers, asking for them when the tablet cannot find them"
  await act(() => form.getByLabelText("Email address").fill(riverview));
  await act(() => form.getByLabelText("Password").fill(wrongPassword));
  await tap(form.getByRole("button", { name: "Next" }));
  await expect.element(caution()).toHaveTextContent("That password didn’t work. Check it and try again. Some email companies give you a special password for apps; Grace can explain.");
  await act(() => form.getByLabelText("Password").fill(otherPassword));
  await tap(form.getByRole("button", { name: "Next" }));

  const servers = page.getByRole("form", { name: "Mail settings" });
  await expect.element(page.getByRole("heading", { name: "Mail settings", level: 1 })).toBeVisible();
  await expect.element(servers.getByLabelText("Incoming mail server")).toHaveValue("mail.riverview.net");
  await tap(servers.getByRole("button", { name: "Ask Grace" }));
  const composer = page.getByRole("textbox", { name: "Message to Grace" });
  await expect.element(composer).toBeVisible();
  const asked = "What are mail servers?";
  await act(() => userEvent.type(composer, `${asked}{Enter}`));
  await expect.element(page.getByText(reply(asked))).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Grace" }));
  await act(() => servers.getByLabelText("Incoming mail server").fill("mail.wrong.net"));
  await tap(servers.getByRole("button", { name: "Connect" }));
  await expect.element(caution()).toHaveTextContent("These mail settings didn’t work. Check them on your email company’s help page, or ask Grace.");
  await act(() => servers.getByLabelText("Incoming mail server").fill("mail.riverview.net"));
  await tap(servers.getByRole("button", { name: "Connect" }));
  await expect.element(page.getByRole("heading", { name: "Riverview", level: 1 })).toBeVisible();
  await expect.element(page.getByText("Other email · Connected")).toBeVisible();
  await toasted("Riverview connected");

  // spec/app/accounts.md, "Grace is told what happened to the accounts, never what was typed"
  expect(told()).toContain("The person chose Outlook. Outlook’s own sign-in page is open on the tablet; they type their own email address and password there, and you cannot see it.");
  expect(told()).toContain(`The person connected their Outlook email (${outlook}) to the tablet.`);

  // spec/app/accounts.md, "Nothing she types to sign in enters the tablet’s state"
  const kept = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? "").join("\n");
  expect(kept).toContain(riverview);
  expect(told()).toContain(asked);
  for (const typed of [otherPassword, wrongPassword]) {
    expect(kept).not.toContain(typed);
    expect(told()).not.toContain(typed);
  }
}, 600_000);

it("Choose what each email brings and take it off the tablet", async () => {
  const row = (address: string) => page.getByRole("button", { name: new RegExp(address) });
  await openEmailSettings();
  await tap(tile("Outlook"));
  await answerOutlook("allow");
  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await tap(page.getByRole("button", { name: "Add another email" }));
  await tap(tile("Other email"));
  const form = page.getByRole("form", { name: "Other email" });
  await act(() => form.getByLabelText("Your name").fill("Margaret Hill"));
  await act(() => form.getByLabelText("Email address").fill(riverview));
  await act(() => form.getByLabelText("Password").fill(otherPassword));
  await tap(form.getByRole("button", { name: "Next" }));
  await tap(page.getByRole("form", { name: "Mail settings" }).getByRole("button", { name: "Connect" }));
  await expect.element(page.getByRole("heading", { name: "Riverview", exact: true })).toBeVisible();
  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await expect.element(row(outlook)).toBeVisible();

  // spec/app/accounts.md, "Signing in again renews the same account"
  await Effect.runPromise(Effect.provide(expire(cloud, secret, outlook), client));
  await closeSettings();
  await tap(page.getByRole("button", { name: /^Email/ }));
  await tap(page.getByRole("button", { name: /St\. Mark’s Church Office/ }));
  await expect.element(page.getByRole("alert")).toBeVisible();
  await tap(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Outlook needs you to sign in again")).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Email" }));
  await openEmailSettings();
  await expect.element(row(outlook)).toHaveAccessibleName(/Outlook · Needs you to sign in again/);
  await tap(row(outlook));
  await tap(page.getByRole("button", { name: "Sign in again" }));
  await answerOutlook("allow");
  await expect.element(page.getByText("Outlook · Connected")).toBeVisible();
  await toasted("Outlook connected");

  // spec/app/accounts.md, "Turning a use off hides it and keeps the account"
  await tap(page.getByRole("switch", { name: "Calendar" }));
  await expect.element(page.getByRole("switch", { name: "Calendar" })).not.toBeChecked();
  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await expect.element(row(outlook)).toHaveAccessibleName(/Outlook · Email, contacts/);

  // spec/app/accounts.md, "Removing asks first and waits for unsent email"; spec/app/mailboxes.md, "Outbox gathers the shown accounts’ waiting email, and an account with unsent email stays"
  await closeSettings();
  await tap(emailCard());
  await tap(page.getByRole("button", { name: /St\. Mark’s Church Office/ }));
  await expect.element(page.getByRole("button", { name: "Reply" })).toBeVisible();
  await host(false);
  await Effect.runPromise(Effect.provide(outage(cloud, secret, true), client));
  await tap(page.getByRole("button", { name: "Reply" }));
  await act(() => userEvent.fill(page.getByRole("textbox", { name: "Write your message, or ask Grace to help" }), "Thank you, I’ll be there."));
  await tap(page.getByRole("button", { name: "Send" }));
  await expect.element(page.getByRole("navigation", { name: "Folders" }).getByRole("button", { name: /^Outbox 1/ })).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Email" }));
  await openEmailSettings();
  await tap(row(outlook));
  await tap(page.getByRole("button", { name: "Remove from this tablet" }));
  const question = page.getByRole("dialog", { name: "Remove Outlook from this tablet?" });
  await expect.element(question.getByText(/^An email is waiting in Outbox to go from Outlook\./)).toBeVisible();
  expect(question.getByRole("button", { name: "Remove from tablet" }).query()).toBeNull();
  await tap(question.getByRole("button", { name: "Keep it" }));
  await expect.element(question).not.toBeInTheDocument();
  await Effect.runPromise(Effect.provide(outage(cloud, secret, false), client));
  await host(true);
  await tap(page.getByRole("button", { name: "Remove from this tablet" }));
  await tap(question.getByRole("button", { name: "Remove from tablet" }));
  await expect.element(row(outlook)).not.toBeInTheDocument();
  await toasted("Outlook removed from this tablet");
  await expect.element(row(riverview)).toBeVisible();

  await tap(page.getByRole("button", { name: "Add another email" }));
  await tap(tile("Outlook"));
  await answerOutlook("allow");
  await expect.element(page.getByText("Outlook · Connected")).toBeVisible();

  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await tap(page.getByRole("button", { name: "Add another email" }));
  await tap(tile("Yahoo"));
  const provider = page.frameLocator(sheet("Yahoo").getByTitle("Yahoo’s own sign-in page"));
  await expect.element(sheet("Yahoo").getByText(`Yahoo’s own sign-in page · ${new URL(cloud).host}`)).toBeVisible();
  await act(() => provider.getByLabelText("Email").fill(yahoo));
  await tap(provider.getByRole("button", { name: "Allow" }));
  await expect.element(sheet("Yahoo")).not.toBeInTheDocument();
  await expect.element(page.getByText("Yahoo · Connected")).toBeVisible();
  await toasted("Yahoo connected");
  expect(providerPages).toEqual([]);
  await readOutlookFromHome();

  // spec/app/accounts.md, "Signing in again renews the same account"
  await Effect.runPromise(Effect.provide(expire(cloud, secret, riverview), client));
  await tap(page.getByRole("button", { name: /Riverview Internet/ }));
  await expect.element(page.getByRole("alert")).toBeVisible();
  await tap(page.getByRole("button", { name: "Back to Inbox" }));
  await expect.element(page.getByText("Riverview needs you to sign in again")).toBeVisible();
  await tap(page.getByRole("button", { name: "Sign in again" }));
  const again = page.getByRole("form", { name: "Other email" });
  await expect.element(page.getByRole("heading", { name: "Other email", level: 1 })).toBeVisible();
  await expect.element(again.getByLabelText("Email address")).toHaveValue(riverview);
  await act(() => again.getByLabelText("Your name").fill("Margaret Hill"));
  await act(() => again.getByLabelText("Password").fill(otherPassword));
  await tap(again.getByRole("button", { name: "Next" }));
  await tap(page.getByRole("form", { name: "Mail settings" }).getByRole("button", { name: "Connect" }));
  await expect.element(page.getByText("Other email · Connected")).toBeVisible();
  await toasted("Riverview connected");

  // spec/app/accounts.md, "Grace is told what happened to the accounts, never what was typed"
  await closeSettings();
  await askGrace("Is my email working now?");
  expect(told()).toContain("The person signed in to Outlook again.");
  expect(told()).toContain("The person signed in to Riverview again.");
  expect(told()).toContain("The person chose Yahoo.");
  expect(told()).not.toContain(otherPassword);
}, 600_000);
