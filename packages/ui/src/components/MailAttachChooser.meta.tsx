import { expect, fn, screen, userEvent } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { photoGroups, photos } from "./FilesApp.meta.tsx";
import type { MailAttachChooserProps } from "./MailAttachChooser.tsx";

export const meta: ComponentMeta<MailAttachChooserProps> = {
  args: {
    open: true,
    source: "photos",
    items: photoGroups[0].photos,
    onChoose: fn(),
    onRetry: fn(),
    onCancel: fn(),
  },
  examples: {
    Opening: { items: undefined },
    "No photos": { items: [] },
    Failed: { failed: true },
    "Not added": { refused: true },
    "Choose a file": { source: "file", items: [{ id: "visit", src: photos.flowers, label: "Visit form.pdf" }] },
    "No files": { source: "file", items: [] },
  },
  play: {
    Default: async ({ args }: { args: MailAttachChooserProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Photo 2" }));
      await expect(args.onChoose).toHaveBeenCalledWith("flowers");
    },
    Failed: async ({ args }: { args: MailAttachChooserProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
      await expect(args.onRetry).toHaveBeenCalled();
    },
    "Choose a file": async ({ args }: { args: MailAttachChooserProps }) => {
      await expect(await screen.findByRole("heading", { name: "Choose a file" })).toBeVisible();
      await userEvent.click(await screen.findByRole("button", { name: "Visit form.pdf" }));
      await expect(args.onChoose).toHaveBeenCalledWith("visit");
    },
  },
};
