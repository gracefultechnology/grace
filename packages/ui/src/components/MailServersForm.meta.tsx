import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { MailServersFormProps } from "./MailServersForm.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const connect = fn();
const askGrace = fn();

export const meta: ComponentMeta<MailServersFormProps> = {
  args: { domain: "riverview.net", onConnect: connect, onCancel: fn(), onAskGrace: askGrace },
  examples: {
    "Ask Grace refused": { onAskGrace: undefined },
  },
  states: {
    Connecting: { domain: "riverview.net", connecting: true },
    Refused: { domain: "riverview.net", refused: true },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      connect.mockClear();
      await expect(canvas.getByText(/Grace can explain what they are\./)).toBeTruthy();
      const outgoing = canvas.getByRole("textbox", { name: "Outgoing mail server" });
      await userEvent.clear(outgoing);
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Connect" }).disabled).toBe(true);
      await userEvent.type(outgoing, "smtp.riverview.net");
      await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
      await expect(connect).toHaveBeenCalledWith({ incoming: "mail.riverview.net", outgoing: "smtp.riverview.net" });
      await userEvent.click(canvas.getByRole("button", { name: "Ask Grace" }));
      await expect(askGrace).toHaveBeenCalled();
    },
    "Ask Grace refused": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryByRole("button", { name: "Ask Grace" })).toBeNull(),
  },
};
