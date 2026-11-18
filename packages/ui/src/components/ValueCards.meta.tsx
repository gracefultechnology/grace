import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ValueCardsProps } from "./ValueCards.tsx";

const networks = [
  { id: "home", value: "Smith Family Wi-Fi", detail: "Strong signal" },
  { id: "guest", value: "Smith Guest", detail: "Good signal" },
  { id: "cafe", value: "Corner Cafe", detail: "Weak signal" },
];
const pick = fn();

export const meta: ComponentMeta<ValueCardsProps> = {
  args: { label: "Networks", options: networks, onPick: pick },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
  examples: {
    "Without detail": { label: "Your name", options: [{ id: "a", value: "Margaret" }, { id: "b", value: "Maggie" }] },
    One: { options: networks.slice(0, 1) },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      pick.mockClear();
      const offers = within(within(canvasElement).getByRole("group", { name: "Networks" }));
      await userEvent.click(offers.getByRole("button", { name: /Smith Guest/ }));
      await expect(pick.mock.calls).toEqual([[networks[1]]]);
    },
  },
};
