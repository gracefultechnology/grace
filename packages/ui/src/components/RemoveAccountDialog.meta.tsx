import { expect, fn, screen, userEvent } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { RemoveAccountDialogProps } from "./RemoveAccountDialog.tsx";

const openChange = fn();

export const meta: ComponentMeta<RemoveAccountDialogProps> = {
  args: { open: true, name: "Outlook", keeper: "Outlook", onRemove: fn(), onRemoveAnyway: fn(), onDiscard: fn(), onKeep: fn() },
  examples: {
    "Other email": { name: "Riverview", keeper: "Riverview" },
    "Email waiting": { waiting: 1 },
    "Discard waiting email": { waiting: 2, discarding: 2 },
    "Remove refused": { onRemove: undefined, onKeep: undefined, onOpenChange: openChange },
  },
  play: {
    Default: async ({ args }: { args: RemoveAccountDialogProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Remove from tablet" }));
      await expect(args.onRemove).toHaveBeenCalled();
    },
    "Email waiting": async ({ args }: { args: RemoveAccountDialogProps }) => {
      await expect(screen.queryByRole("button", { name: "Remove from tablet" })).toBeNull();
      await userEvent.click(await screen.findByRole("button", { name: "Remove anyway" }));
      await expect(args.onRemoveAnyway).toHaveBeenCalled();
      await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
      await expect(args.onKeep).toHaveBeenCalled();
    },
    "Discard waiting email": async ({ args }: { args: RemoveAccountDialogProps }) => {
      await expect(await screen.findByText("The 2 pending emails will be removed from this tablet. This can’t be undone.")).toBeTruthy();
      await expect(screen.queryByRole("button", { name: "Remove anyway" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Discard 2 emails and remove" }));
      await expect(args.onDiscard).toHaveBeenCalled();
    },
    "Remove refused": async () => {
      await expect(await screen.findByRole("button", { name: "Remove from tablet" })).toBeDisabled();
      openChange.mockClear();
      await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
      await expect(openChange).toHaveBeenCalledWith(false);
    },
  },
};
