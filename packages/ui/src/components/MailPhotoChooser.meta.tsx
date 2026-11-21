import { expect, fn, screen, userEvent } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { photoGroups } from "./FilesApp.meta.tsx";
import type { MailPhotoChooserProps } from "./MailPhotoChooser.tsx";

export const meta: ComponentMeta<MailPhotoChooserProps> = {
  args: {
    open: true,
    photos: photoGroups[0].photos,
    onChoose: fn(),
    onRetry: fn(),
    onCancel: fn(),
  },
  examples: {
    Opening: { photos: undefined },
    "No photos": { photos: [] },
    Failed: { failed: true },
    "Not added": { refused: true },
  },
  play: {
    Default: async ({ args }: { args: MailPhotoChooserProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Photo 2" }));
      await expect(args.onChoose).toHaveBeenCalledWith("flowers");
    },
    Failed: async ({ args }: { args: MailPhotoChooserProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
      await expect(args.onRetry).toHaveBeenCalled();
    },
  },
};
