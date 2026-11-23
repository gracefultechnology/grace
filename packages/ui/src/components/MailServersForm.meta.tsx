import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { MailServersFormProps } from "./MailServersForm.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const connect = fn();
const askGrace = fn();
const lookUp = fn();

export const meta: ComponentMeta<MailServersFormProps> = {
  args: { domain: "riverview.net", onConnect: connect, onCancel: fn(), onAskGrace: askGrace, onLookUp: lookUp },
  examples: {
    "Ask Grace refused": { onAskGrace: undefined },
    "Looked up": { lookup: "found", defaultServers: { incoming: "imap.riverview.net", outgoing: "smtp.riverview.net" } },
    "Not found": { lookup: "missing" },
  },
  states: {
    Connecting: { domain: "riverview.net", connecting: true },
    Refused: { domain: "riverview.net", refused: true },
    Looking: { domain: "riverview.net", lookup: "looking" },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      connect.mockClear();
      await expect(canvas.getByText(/or Grace can look them up\./)).toBeTruthy();
      const outgoing = canvas.getByRole("textbox", { name: "Outgoing mail server" });
      await userEvent.clear(outgoing);
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Connect" }).disabled).toBe(true);
      await userEvent.type(outgoing, "smtp.riverview.net");
      await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
      await expect(connect).toHaveBeenCalledWith({ incoming: "mail.riverview.net", outgoing: "smtp.riverview.net" });
      await userEvent.click(canvas.getByRole("button", { name: "Ask Grace" }));
      await expect(askGrace).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("button", { name: "Look them up" }));
      await expect(lookUp).toHaveBeenCalled();
    },
    "Looked up": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      connect.mockClear();
      await expect(canvas.getByRole("status")).toHaveTextContent("Grace found the mail settings for riverview.net. Check them, then tap Connect.");
      await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
      await expect(connect).toHaveBeenCalledWith({ incoming: "imap.riverview.net", outgoing: "smtp.riverview.net" });
    },
    "Not found": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("alert")).toHaveTextContent("Grace couldn’t find the mail settings for riverview.net. Your email company lists them on its help page."),
    "Ask Grace refused": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryByRole("button", { name: "Ask Grace" })).toBeNull(),
  },
};
