import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { MailAttachmentProps } from "./MailAttachment.tsx";

const open = fn();

export const meta: ComponentMeta<MailAttachmentProps> = {
  // The clinic's form, attached to its reminder.
  args: { name: "Visit form.pdf", detail: "2 pages", onOpen: open, onPrint: fn() },
  decorator: (story) => <div className="w-[810px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Open" }));
      await expect(open).toHaveBeenCalled();
    },
  },
};
