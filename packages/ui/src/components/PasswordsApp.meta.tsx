import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onTablet } from "./CalendarApp.meta.tsx";
import type { PasswordsAppProps } from "./PasswordsApp.tsx";

const passwords = [
  { id: "water", label: "City Water", username: "margaret.s", site: "citywater.example.com" },
  { id: "pharmacy", label: "Pharmacy", username: "msmith", site: "pharmacy.example.com" },
  { id: "library", label: "Library card", site: "library.example.org" },
];

export const meta: ComponentMeta<PasswordsAppProps> = {
  args: { passwords, onQueryChange: fn(), onAdd: fn(), onLock: fn(), onOpenPassword: fn(), onClose: fn() },
  decorator: onTablet,
  examples: {
    Empty: { passwords: [], anySaved: false },
    "No match": { passwords: [], anySaved: true, query: "bank" },
    Open: { open: passwords[0], onBack: fn(), onShow: fn(), onCopy: fn(), onOpenWebsite: fn(), onEdit: fn(), onDelete: fn() },
    Copied: { open: passwords[0], notice: "Copied. Avoid pasting it into a message." },
    Shown: { open: passwords[0], revealed: "correct-horse-7" },
  },
};
