import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { mailScreen, retriesUnshown } from "./MailApp.meta.tsx";
import type { PdfViewerProps } from "./PdfViewer.tsx";

const print = fn();
const retry = fn();
const line = (width: string, gap = "mt-3.5") => <i className={`block h-3 rounded-line bg-pdf ${gap}`} style={{ width }} />;
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
  args: {
    title: "Visit form.pdf",
    backLabel: "Clinic email",
    pageLabel: "Page 1 of 2",
    onBack: fn(),
    onPrint: print,
    savable: true,
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
    "From Files": { title: "Medicare summary.pdf", backLabel: "Files", pageLabel: "Page 1 of 4", savable: false, children: page("Medicare summary") },
  },
  decorator: mailScreen,
  play: {
    Default: tapCalls("Print", print, { rest: true }),
    "Can’t show": retriesUnshown("Print", retry),
  },
};
