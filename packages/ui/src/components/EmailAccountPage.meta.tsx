import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { EmailAccountPageProps } from "./EmailAccountPage.tsx";
import { allUses } from "./EmailAccountRow.meta.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const use = fn();
const remove = fn();
const signIn = fn();

export const meta: ComponentMeta<EmailAccountPageProps> = {
  args: { address: "margaret.h@gmail.com", provider: "gmail", status: "connected", uses: allUses, colour: 1, onUseChange: use, onRemove: remove, onSignInAgain: signIn },
  examples: {
    "Needs sign in": { address: "margaret@outlook.com", provider: "outlook", colour: 2, status: "needsSignIn" },
    "Calendar off": { uses: { ...allUses, calendar: false } },
    Refused: { address: "margaret@outlook.com", provider: "outlook", colour: 2, status: "needsSignIn", onUseChange: undefined, onSignInAgain: undefined, onRemove: undefined },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      use.mockClear();
      await userEvent.click(canvas.getByRole("switch", { name: "Calendar" }));
      await expect(use).toHaveBeenCalledWith("calendar", false);
      await userEvent.click(canvas.getByRole("button", { name: "Remove from this tablet" }));
      await expect(remove).toHaveBeenCalled();
    },
    "Needs sign in": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Sign in again" }));
      await expect(signIn).toHaveBeenCalled();
    },
    Refused: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByText(/Needs you to sign in again/)).toBeTruthy();
      await expect(["Email", "Calendar", "Contacts"].map((name) => canvas.getByRole<HTMLButtonElement>("switch", { name }).disabled)).toEqual([true, true, true]);
      await expect(["Sign in again", "Remove from this tablet"].map((name) => canvas.queryByRole("button", { name }))).toEqual([null, null]);
    },
    "Calendar off": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      use.mockClear();
      await userEvent.click(within(canvasElement).getByRole("switch", { name: "Calendar" }));
      await expect(use).toHaveBeenCalledWith("calendar", true);
    },
  },
};
