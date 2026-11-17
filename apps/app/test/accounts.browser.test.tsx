// spec/app/accounts.md, "Story: Connect the email I already use"; spec/app/accounts.md, "Story: Choose what each email brings and take it off the tablet"
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { client, expire, otherPassword, reply, signIn } from "./cloud.vibe";
import "../src/main.css";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const cloud = inject("cloud");
const outlook = "margaret@outlook.com";
const riverview = "margaret@riverview.net";
const wrongPassword = "Not-the-password-7";

const chatBodies: string[] = [];
const fetched = globalThis.fetch;
const decoded = (body: BodyInit | null | undefined) => typeof body === "string" ? body : body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body);

let secret = "";
const start = () => ManagedRuntime.make(application(undefined, undefined, { url: cloud, key: secret }));
let app: ReturnType<typeof start>;

beforeAll(async () => {
  globalThis.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/chat/completions")) chatBodies.push(decoded(init?.body));
    return fetched(input, init);
  };
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  await page.viewport(1280, 800);
  localStorage.clear();
  secret = (await Effect.runPromise(Effect.provide(signIn(cloud), client))).secret;
  app = start();
});
afterAll(async () => {
  await app.dispose();
  localStorage.clear();
  environment.IS_REACT_ACT_ENVIRONMENT = false;
  globalThis.fetch = fetched;
});

const tap = (target: Parameters<typeof userEvent.click>[0]) => act(() => userEvent.click(target));
const settings = () => page.getByRole("navigation", { name: "Settings" });
const sheet = (company: string) => page.getByRole("dialog", { name: `${company} sign-in page` });
const providerPage = (company: string) => page.frameLocator(page.getByTitle(`${company}’s own sign-in page`));
const tile = (company: string) => page.getByRole("button", { name: new RegExp(`^${company}`) });
const caution = () => page.getByRole("alert");

async function answerOutlook(choice: "Allow" | "Not now") {
  await expect.element(sheet("Outlook")).toBeVisible();
  const frame = providerPage("Outlook");
  if (choice === "Allow") await act(() => frame.getByLabelText("Email").fill(outlook));
  await tap(frame.getByRole("button", { name: choice }));
  await expect.element(sheet("Outlook")).not.toBeInTheDocument();
}

async function openEmailSettings() {
  await tap(page.getByRole("button", { name: "Settings", exact: true }));
  await tap(settings().getByRole("button", { name: "Email & calendar" }));
}

async function closeSettings() {
  await tap(page.getByRole("button", { name: "Close Settings" }));
}

it("Connect the email I already use", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={app} />)));

  // spec/app/accounts.md, "Only the current sign-in attempt can add or renew an account": Outlook's own page, in the tablet's sheet, allows it.
  await openEmailSettings();
  await expect.element(page.getByText("Which email do you use?")).toBeVisible();
  await tap(tile("Outlook"));
  await answerOutlook("Allow");
  await expect.element(page.getByRole("heading", { name: "Outlook", level: 1 })).toBeVisible();
  await expect.element(page.getByText("Outlook · Connected")).toBeVisible();

  await closeSettings();
  await tap(page.getByRole("button", { name: /^Email/ }));
  await expect.element(page.getByRole("button", { name: /St\. Mark’s Church Office/ })).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Email" }));

  await openEmailSettings();
  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await expect.element(page.getByRole("button", { name: new RegExp(outlook) })).toBeVisible();

  // Cancel closes the page and adds nothing; a page left unfinished says so.
  await tap(page.getByRole("button", { name: "Add another email" }));
  await expect.element(page.getByRole("heading", { name: "Add an email", level: 1 })).toBeVisible();
  await tap(tile("Outlook"));
  await expect.element(sheet("Outlook")).toBeVisible();
  await tap(sheet("Outlook").getByRole("button", { name: "Cancel" }));
  await expect.element(sheet("Outlook")).not.toBeInTheDocument();
  await expect.element(caution()).not.toBeInTheDocument();

  await tap(tile("Outlook"));
  await answerOutlook("Not now");
  await expect.element(caution()).toHaveTextContent("Signing in wasn’t finished. You can try again.");

  // The same address again is refused, and the tablet keeps one account for it.
  await tap(tile("Outlook"));
  await answerOutlook("Allow");
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
  const asked = "What are mail servers?";
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Message to Grace" }), `${asked}{Enter}`));
  await expect.element(page.getByText(reply(asked))).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Grace" }));
  await act(() => servers.getByLabelText("Incoming mail server").fill("mail.wrong.net"));
  await tap(servers.getByRole("button", { name: "Connect" }));
  await expect.element(caution()).toHaveTextContent("These mail settings didn’t work. Check them on your email company’s help page, or ask Grace.");
  await act(() => servers.getByLabelText("Incoming mail server").fill("mail.riverview.net"));
  await tap(servers.getByRole("button", { name: "Connect" }));
  await expect.element(page.getByRole("heading", { name: "Riverview", level: 1 })).toBeVisible();
  await expect.element(page.getByText("Other email · Connected")).toBeVisible();

  // spec/app/accounts.md, "Nothing she types to sign in enters the tablet’s state": neither password is kept or shown to Grace.
  const kept = Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? "").join("\n");
  expect(kept).toContain(riverview);
  expect(chatBodies.join("\n")).toContain(asked);
  for (const typed of [otherPassword, wrongPassword]) {
    expect(kept).not.toContain(typed);
    expect(chatBodies.join("\n")).not.toContain(typed);
  }

  await act(() => Promise.resolve(root.unmount()));
});

it("Choose what each email brings and take it off the tablet", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={app} />)));
  const row = (address: string) => page.getByRole("button", { name: new RegExp(address) });
  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await expect.element(row(outlook)).toBeVisible();

  // spec/app/accounts.md, "Signing in again renews the same account": Outlook's sign-in ends, and signing in again brings it back.
  await Effect.runPromise(Effect.provide(expire(cloud, secret, outlook), client));
  await closeSettings();
  await tap(page.getByRole("button", { name: /^Email/ }));
  await tap(page.getByRole("button", { name: /St\. Mark’s Church Office/ }));
  await expect.element(page.getByText("Outlook needs you to sign in again")).toBeVisible();
  await tap(page.getByRole("button", { name: "Close Email" }));
  await openEmailSettings();
  await expect.element(row(outlook)).toHaveAccessibleName(/Outlook · Needs you to sign in again/);
  await tap(row(outlook));
  await tap(page.getByRole("button", { name: "Sign in again" }));
  await answerOutlook("Allow");
  await expect.element(page.getByText("Outlook · Connected")).toBeVisible();

  // spec/app/accounts.md, "Turning a use off hides it and keeps the account"
  await tap(page.getByRole("switch", { name: "Calendar" }));
  await expect.element(page.getByRole("switch", { name: "Calendar" })).not.toBeChecked();
  await tap(page.getByRole("button", { name: "Back to Email & calendar" }));
  await expect.element(row(outlook)).toHaveAccessibleName(/Outlook · Email, contacts/);

  // spec/app/accounts.md, "Removing asks first and waits for unsent email": Outlook leaves after the question, and comes back when connected again.
  await tap(row(outlook));
  await tap(page.getByRole("button", { name: "Remove from this tablet" }));
  const question = page.getByRole("dialog", { name: "Remove Outlook from this tablet?" });
  await tap(question.getByRole("button", { name: "Keep it" }));
  await expect.element(question).not.toBeInTheDocument();
  await tap(page.getByRole("button", { name: "Remove from this tablet" }));
  await tap(question.getByRole("button", { name: "Remove from tablet" }));
  await expect.element(row(outlook)).not.toBeInTheDocument();
  await expect.element(row(riverview)).toBeVisible();

  await tap(page.getByRole("button", { name: "Add another email" }));
  await tap(tile("Outlook"));
  await answerOutlook("Allow");
  await expect.element(page.getByText("Outlook · Connected")).toBeVisible();
  await closeSettings();
  await tap(page.getByRole("button", { name: /^Email/ }));
  await expect.element(page.getByRole("button", { name: /St\. Mark’s Church Office/ })).toBeVisible();

  await act(() => Promise.resolve(root.unmount()));
});
