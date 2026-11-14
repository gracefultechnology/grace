import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { mailScreen, unfocus } from "./MailApp.meta.tsx";
import type { PdfViewerProps } from "./PdfViewer.tsx";

const print = fn();
const line = (width: string, gap = "mt-3.5") => <i className={`block h-3 rounded-sm bg-pdf ${gap}`} style={{ width }} />;

export const meta: ComponentMeta<PdfViewerProps> = {
  // The clinic's visit form, drawn as the prototype draws it.
  args: {
    title: "Visit form.pdf",
    backLabel: "Clinic email",
    pageLabel: "Page 1 of 2",
    onBack: fn(),
    onPrint: print,
    onSave: fn(),
    onClose: fn(),
    children: (
      <>
        <div className="text-body-lg leading-7 font-extrabold text-avatar-1">Main St Clinic</div>
        <div className="mt-4 text-body leading-[26px] font-bold text-foreground">Patient visit form</div>
        {line("80%")}
        {line("100%")}
        {line("60%")}
        {line("90%", "mt-[26px]")}
        {line("70%")}
        {line("100%")}
        {line("50%")}
      </>
    ),
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Print" }));
      await expect(print).toHaveBeenCalled();
      unfocus();
    },
  },
};
