import { expect, fn, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import type { MailAttachmentProps } from "./MailAttachment.tsx";

const open = fn();
const retry = fn();

export const meta: ComponentMeta<MailAttachmentProps> = {
  args: { name: "Visit form.pdf", detail: "2 pages", onOpen: open },
  examples: {
    Saved: { saveStatus: "saved" },
    "Save failed": { saveStatus: "failed", onRetry: retry },
    "Open refused": { onOpen: undefined },
  },
  decorator: (story) => <div className="w-[810px] bg-background p-6">{story()}</div>,
  play: {
    Default: tapCalls("Open", open, { rest: true }),
    "Save failed": tapCalls("Try again", retry, { rest: true }),
    "Open refused": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryByRole("button", { name: "Open" })).toBeNull(),
  },
};
