import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ShortcutEditorProps } from "./ShortcutEditor.tsx";

export const meta: ComponentMeta<ShortcutEditorProps> = {
  args: {
    open: true,
    title: "City Water",
    name: "City Water",
    address: "citywater.example.com",
    onNameChange: fn(),
    onAddressChange: fn(),
    onSave: fn(),
    onCancel: fn(),
    onRemove: fn(),
    onConfirmRemove: fn(),
    onKeep: fn(),
  },
  examples: {
    "Needs repair": { title: "Pharmacy", name: "", address: "", needsRepair: true },
    Refused: { address: "citywater.example.com/account?id=8812", notice: "That address can’t be saved. Use the website’s main address." },
    Removing: { removing: true },
  },
};
