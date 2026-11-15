import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SavedDetail, SettingsPrivacyProps } from "./SettingsPrivacy.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

// What Grace might remember for Margaret: her phone, her address, and a card number kept for one pharmacy.
export const savedDetails: SavedDetail[] = [
  { id: "phone", label: "Phone number", value: "(555) 214-0187" },
  { id: "address", label: "Home address", value: "42 Maple Street, Riverside" },
  { id: "member", label: "Member number", value: "RX-448 213", site: "riversidepharmacy.com" },
];

const remove = fn();
const confirmRemove = fn();
const clearBrowsing = fn();
const confirmClear = fn();

export const meta: ComponentMeta<SettingsPrivacyProps> = {
  args: {
    details: savedDetails,
    onRemove: remove,
    onClearAll: fn(),
    onConfirmRemove: confirmRemove,
    onKeep: fn(),
    onClearBrowsing: clearBrowsing,
    onConfirmClear: confirmClear,
    onCancelClear: fn(),
  },
  examples: {
    "Nothing saved": { details: [] },
    "Confirm remove": { asking: { remove: "phone" } },
    "Confirm clear all": { asking: "clear-all" },
    "Not saved": { saveError: "That change isn’t saved yet.", onRetry: fn() },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Remove Phone number" }));
      await expect(remove).toHaveBeenCalledWith("phone");
      await userEvent.click(canvas.getByRole("button", { name: "Clear" }));
      await expect(clearBrowsing).toHaveBeenCalled();
    },
    "Confirm remove": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const dialog = within(within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Remove this phone number?" }));
      await userEvent.click(dialog.getByRole("button", { name: "Yes, remove it" }));
      await expect(confirmRemove).toHaveBeenCalledWith("phone");
    },
    "Clearing Confirm": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const dialog = within(within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Clear browsing data?" }));
      await userEvent.click(dialog.getByRole("button", { name: "Clear" }));
      await expect(confirmClear).toHaveBeenCalled();
    },
  },
};
