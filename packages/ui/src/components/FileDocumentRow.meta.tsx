import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { FileDocumentRowProps } from "./FileDocumentRow.tsx";

const print = fn();

export const meta: ComponentMeta<FileDocumentRowProps> = {
  // The first of Files' documents (prototype `X.files.docs`).
  args: { name: "Visit form.pdf", detail: "From Main St Clinic · Saved today", onOpen: fn(), onPrint: print },
  examples: { "Open only": { onPrint: undefined } },
  decorator: (story) => <div className="w-[1082px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Print Visit form.pdf" }));
      await expect(print).toHaveBeenCalled();
    },
  },
};
