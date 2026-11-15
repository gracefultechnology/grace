import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { mailScreen, unfocus } from "./MailApp.meta.tsx";
import type { MailConnectProps } from "./MailConnect.tsx";

const connect = fn();
const disconnect = fn();
const confirm = fn();

export const meta: ComponentMeta<MailConnectProps> = {
  // Margaret's Gmail, before it is connected.
  args: {
    state: "disconnected",
    account: "margaret.hale@gmail.com",
    onConnect: connect,
    onCancel: fn(),
    onReconnect: fn(),
    onRetry: fn(),
    onDisconnect: disconnect,
    onConfirmDisconnect: confirm,
    onClose: fn(),
  },
  examples: {
    "Waiting for Google": { state: "authorizing" },
    Connected: { state: "connected" },
    "Read not allowed": { state: "readDenied" },
    "Access expired": { state: "expired" },
    "Couldn’t check": { state: "failed" },
    "Another account": { state: "otherAccount" },
    "Disconnect asked": { state: "connected", disconnectOpen: true },
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Connect Gmail" }));
      await expect(connect).toHaveBeenCalled();
      unfocus();
    },
    // Disconnect asks first; Keep it leaves the email connected.
    Connected: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Disconnect" }));
      await expect(disconnect).toHaveBeenCalled();
      await userEvent.click(within(document.body).getByRole("button", { name: "Keep it" }));
      await expect(confirm).not.toHaveBeenCalled();
      await expect(within(document.body).queryByRole("dialog")).toBeNull();
      unfocus();
    },
    "Disconnect asked": async () => {
      await userEvent.click(within(within(document.body).getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
      await expect(confirm).toHaveBeenCalled();
      unfocus();
    },
  },
};
