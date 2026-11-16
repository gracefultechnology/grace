import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ValueCardsProps } from "./ValueCards.tsx";

const networks = [
  { id: "home", value: "Smith Family Wi-Fi", detail: "Strong signal" },
  { id: "guest", value: "Smith Guest", detail: "Good signal" },
  { id: "cafe", value: "Corner Cafe", detail: "Weak signal" },
];

export const meta: ComponentMeta<ValueCardsProps> = {
  args: { label: "Networks", options: networks, onPick: fn() },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
  examples: {
    "Without detail": { label: "Your name", options: [{ id: "a", value: "Margaret" }, { id: "b", value: "Maggie" }] },
    One: { options: networks.slice(0, 1) },
  },
};
