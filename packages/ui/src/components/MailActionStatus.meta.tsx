import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { unfocus } from "./MailApp.meta.tsx";
import type { MailActionStatusProps } from "./MailActionStatus.tsx";

const retry = fn();

export const meta: ComponentMeta<MailActionStatusProps> = {
  args: { action: "save", status: "saved", onRetry: retry },
  examples: {
    Saving: { status: "saving" },
    "Save failed": { status: "failed" },
    Printing: { action: "print", status: "pending" },
    Printed: { action: "print", status: "accepted" },
    "Print failed": { action: "print", status: "failed" },
    "Print unknown": { action: "print", status: "unknown" },
  },
  decorator: (story) => <div className="w-[640px] bg-background p-6">{story()}</div>,
  play: {
    "Save failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
      unfocus();
    },
    // Uncertain is not a failure: nothing to retry until the printer answers.
    "Print unknown": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryByRole("button")).toBeNull(),
  },
};
