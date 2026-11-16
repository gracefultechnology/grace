import type { ReactNode } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import type { BrowserDownload, BrowserDownloadsProps } from "./BrowserDownloads.tsx";
import { BrowserToolbar } from "./BrowserToolbar.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const openFile = fn();
const dismiss = fn();

const downloads: BrowserDownload[] = [
  { id: 4, name: "Visit form.pdf", status: "saving", progress: 40 },
  { id: 3, name: "Medicare summary.pdf", status: "saved" },
  { id: 2, name: "Book club list.pdf", status: "failed" },
  { id: 1, name: "Visit form.pdf", status: "not-saved" },
];

export const meta: ComponentMeta<BrowserDownloadsProps> = {
  args: { downloads, onOpen: openFile, onDismiss: dismiss },
  examples: {
    Open: { open: true },
  },
  decorator: (story) => (
    <div className="h-[560px] w-[1130px] bg-gradient-frame">
      <BrowserToolbar canGoBack canGo trailing={story() as ReactNode}>
        <AddressBar value="chase.com/pay" />
      </BrowserToolbar>
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      openFile.mockClear();
      dismiss.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Downloads" }));
      const list = within(await screen.findByRole("dialog", { name: "Downloads" }));
      await expect(list.getByRole("progressbar", { name: "Saving Visit form.pdf" })).toBeTruthy();
      await userEvent.click(list.getByRole("button", { name: "Open in Files" }));
      await userEvent.click(list.getByRole("button", { name: "Remove Book club list.pdf from the list" }));
      await expect([openFile.mock.calls, dismiss.mock.calls, list.getAllByRole("button", { name: /^Remove/ }).length]).toEqual([[[3]], [[2]], 3]);
      unfocus();
    },
  },
};
