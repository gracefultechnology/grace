import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import type { MailActionStatusProps } from "./MailActionStatus.tsx";

const retry = fn();

export const meta: ComponentMeta<MailActionStatusProps> = {
  args: { status: "saved", onRetry: retry },
  examples: {
    Saving: { status: "saving" },
    "Save failed": { status: "failed" },
  },
  decorator: (story) => <div className="w-[640px] bg-background p-6">{story()}</div>,
  play: {
    "Save failed": tapCalls("Try again", retry, { rest: true }),
  },
};
