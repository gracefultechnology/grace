import { expect, fn, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
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
    "Save failed": tapCalls("Try again", retry, { rest: true }),
    "Print unknown": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryByRole("button")).toBeNull(),
  },
};
