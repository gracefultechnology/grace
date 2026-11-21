import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ProviderGridProps } from "./ProviderGrid.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const choose = fn();
const askGrace = fn();

export const meta: ComponentMeta<ProviderGridProps> = {
  args: { onChoose: choose, onAskGrace: askGrace },
  examples: {
    "Add an email": { bare: true },
    "Ask Grace refused": { onAskGrace: undefined },
    "Choose refused": { onChoose: undefined },
    "Grace points at Outlook": { guide: { targetId: "outlook", kind: "instruction", title: "Tap Outlook", onClose: fn() } },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      choose.mockClear();
      await userEvent.click(canvas.getByRole("button", { name: /Outlook/ }));
      await expect(choose).toHaveBeenCalledWith("outlook");
      await userEvent.click(canvas.getByRole("button", { name: "Ask Grace" }));
      await expect(askGrace).toHaveBeenCalled();
    },
    "Ask Grace refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByText("Not sure which?")).toBeTruthy();
      await expect(canvas.queryByRole("button", { name: "Ask Grace" })).toBeNull();
    },
    "Choose refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByText("Outlook")).toBeTruthy();
      await expect(canvas.queryAllByRole("button").map((button) => button.textContent)).toEqual(["Ask Grace"]);
    },
    "Add an email": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.queryByRole("button", { name: "Ask Grace" })).toBeNull();
      choose.mockClear();
      await userEvent.click(canvas.getByRole("button", { name: "Other email" }));
      await expect(choose).toHaveBeenCalledWith("other");
    },
  },
};
