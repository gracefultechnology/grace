import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { FileDocumentRowProps } from "./FileDocumentRow.tsx";

const open = fn();

export const meta: ComponentMeta<FileDocumentRowProps> = {
  args: { name: "Visit form.pdf", detail: "From Main St Clinic · Saved today", onOpen: open },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Open Visit form.pdf" }));
      await expect(open).toHaveBeenCalled();
    },
  },
};
