import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { OtherEmailFormProps } from "./OtherEmailForm.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const next = fn();
const cancel = fn();

export const meta: ComponentMeta<OtherEmailFormProps> = {
  args: { defaultName: "Margaret Hill", onNext: next, onCancel: cancel },
  examples: {
    "Listed provider": { defaultAddress: "margaret@yahoo.com", problem: { kind: "listedProvider", provider: "yahoo" } },
    "Wrong password": { defaultAddress: "margaret@riverview.net", problem: { kind: "passwordRefused" } },
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
    "Wrong password": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Cancel" }));
      await expect(cancel).toHaveBeenCalled();
    },
  },
};
