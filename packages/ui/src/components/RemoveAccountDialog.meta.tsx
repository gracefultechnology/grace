import { expect, fn, screen, userEvent } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { RemoveAccountDialogProps } from "./RemoveAccountDialog.tsx";

const openChange = fn();

export const meta: ComponentMeta<RemoveAccountDialogProps> = {
  args: { open: true, name: "Outlook", keeper: "Outlook", onRemove: fn(), onKeep: fn() },
  examples: {
    "Other email": { name: "Riverview", keeper: "Riverview" },
    "Email waiting": { waiting: 1 },
    "Remove refused": { onRemove: undefined, onKeep: undefined, onOpenChange: openChange },
  },
  play: {
    Default: async ({ args }: { args: RemoveAccountDialogProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Remove from tablet" }));
      await expect(args.onRemove).toHaveBeenCalled();
    },
    "Email waiting": async ({ args }: { args: RemoveAccountDialogProps }) => {
      await expect(screen.queryByRole("button", { name: "Remove from tablet" })).toBeNull();
      await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
      await expect(args.onKeep).toHaveBeenCalled();
    },
    "Remove refused": async () => {
      await expect(await screen.findByRole("button", { name: "Remove from tablet" })).toBeDisabled();
      openChange.mockClear();
      await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
      await expect(openChange).toHaveBeenCalledWith(false);
    },
  },
};
