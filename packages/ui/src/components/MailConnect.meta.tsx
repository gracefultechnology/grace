import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { mailScreen, unfocus } from "./MailApp.meta.tsx";
import type { MailConnectProps } from "./MailConnect.tsx";

const proceed = fn();

export const meta: ComponentMeta<MailConnectProps> = {
  args: { state: "ready", onContinue: proceed, onCancel: fn(), onCheckAgain: fn(), onClose: fn() },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue with Google" }));
      await expect(proceed).toHaveBeenCalled();
      unfocus();
    },
  },
};
