import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { mailScreen, unfocus } from "./MailApp.meta.tsx";
import type { PdfViewerProps } from "./PdfViewer.tsx";

const print = fn();
const retry = fn();
const line = (width: string, gap = "mt-3.5") => <i className={`block h-3 rounded-line bg-pdf ${gap}`} style={{ width }} />;
/** The prototype's drawing of a page: a heading, the email's form its subheading, then lines of text. */
const page = (heading: string, subheading?: string) => (
  <>
    <div className="text-body-lg leading-7 font-bold text-avatar-1">{heading}</div>
    {subheading && <div className="mt-4 text-body leading-[26px] font-bold text-foreground">{subheading}</div>}
    {line("80%")}
    {line("100%")}
    {line("60%")}
    {line("90%", "mt-[26px]")}
    {line("70%")}
    {line("100%")}
    {line("50%")}
  </>
);

export const meta: ComponentMeta<PdfViewerProps> = {
  // The clinic's visit form, drawn as the prototype draws it (its 800 draws at 700, the heaviest Figtree it loads).
  args: {
    title: "Visit form.pdf",
    backLabel: "Clinic email",
    pageLabel: "Page 1 of 2",
    onBack: fn(),
    onPrint: print,
    onSave: fn(),
    onClose: fn(),
    children: page("Main St Clinic", "Patient visit form"),
  },
  examples: {
    Loading: { status: "loading" },
    "Can’t show": { status: "failed", errorLabel: "This PDF can’t be shown on this tablet.", onRetry: retry },
    Printed: { printStatus: "accepted" },
    "Print unknown": { printStatus: "unknown" },
    "Print failed": { printStatus: "failed", onRetryAction: fn() },
    // Prototype `filesView()` pdf (JS 1985): `{ name: "Medicare summary.pdf", pages: 4 }`, back to Files, Print only.
    "From Files": { title: "Medicare summary.pdf", backLabel: "Files", pageLabel: "Page 1 of 4", onSave: undefined, children: page("Medicare summary") },
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Print" }));
      await expect(print).toHaveBeenCalled();
      unfocus();
    },
    "Can’t show": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Print" }).disabled).toBe(true);
      await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
      unfocus();
    },
  },
};
