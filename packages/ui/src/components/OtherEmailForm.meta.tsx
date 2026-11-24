import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { OtherEmailFormProps } from "./OtherEmailForm.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const next = fn();
const cancel = fn();

export const meta: ComponentMeta<OtherEmailFormProps> = {
  args: { defaultName: "Margaret Hill", onNext: next, onCancel: cancel, accepts: () => true },
  examples: {
    "Listed provider": { defaultAddress: "margaret@outlook.com", problem: { kind: "listedProvider", provider: "outlook" } },
    "Listed iCloud": { defaultAddress: "margaret@icloud.com", problem: { kind: "listedProvider", provider: "icloud" } },
    "Listed AOL": { defaultAddress: "margaret@aol.com", problem: { kind: "listedProvider", provider: "aol" } },
    "Listed Yahoo": { defaultAddress: "margaret@yahoo.com", problem: { kind: "listedProvider", provider: "yahoo" } },
    "Wrong password": { defaultAddress: "margaret@riverview.net", problem: { kind: "passwordRefused" } },
    "Next refused": { defaultAddress: "margaret@riverview.net", onNext: undefined, onCancel: undefined },
    "Address refused": { defaultAddress: "margaret@riverview.net", accepts: (address: string) => !address.endsWith("@riverview.net") },
  },
  states: {
    Checking: { defaultAddress: "margaret@riverview.net", checking: true },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      next.mockClear();
      const go = canvas.getByRole<HTMLButtonElement>("button", { name: "Next" });
      await userEvent.type(canvas.getByRole("textbox", { name: "Email address" }), "margaret@riverview.net");
      await expect(go.disabled).toBe(true);
      const password = canvas.getByPlaceholderText("Your email password");
      await userEvent.type(password, "garden42");
      await userEvent.click(go);
      await expect(next).toHaveBeenCalledWith({ name: "Margaret Hill", address: "margaret@riverview.net", password: "garden42" });
      await expect(password).toHaveValue("");
      await expect(go.disabled).toBe(true);
    },
    "Next refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.type(canvas.getByPlaceholderText("Your email password"), "garden42");
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled).toBe(true);
      await expect(canvas.queryByRole("button", { name: "Cancel" })).toBeNull();
    },
    "Address refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      const go = canvas.getByRole<HTMLButtonElement>("button", { name: "Next" });
      await userEvent.type(canvas.getByPlaceholderText("Your email password"), "garden42");
      await expect(go.disabled).toBe(true);
      const address = canvas.getByRole("textbox", { name: "Email address" });
      await userEvent.clear(address);
      await userEvent.type(address, "margaret@hillside.org");
      await expect(go.disabled).toBe(false);
    },
    "Listed provider": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("alert")).toHaveTextContent("This is an Outlook address. Go back and choose Outlook, so you can sign in on Outlook’s own page."),
    "Listed iCloud": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("alert")).toHaveTextContent("This is an iCloud address. Go back and choose iCloud, so you can sign in on iCloud’s own page."),
    "Listed AOL": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("alert")).toHaveTextContent("This is an AOL address. Go back and choose AOL, so you can sign in on AOL’s own page."),
    "Listed Yahoo": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("alert")).toHaveTextContent("This is a Yahoo address. Go back and choose Yahoo, so you can sign in on Yahoo’s own page."),
    "Wrong password": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Cancel" }));
      await expect(cancel).toHaveBeenCalled();
    },
  },
};
