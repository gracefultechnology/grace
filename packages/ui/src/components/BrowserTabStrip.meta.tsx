import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BrowserTabItem, BrowserTabStripProps } from "./BrowserTabStrip.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const select = fn();
const close = fn();
const pick = fn();
const shut = fn();

const chase: BrowserTabItem[] = [
  { id: 1, title: "Sign in · Chase", initial: "C" },
  { id: 2, title: "Credit card · Chase", initial: "C" },
  { id: 3, title: "Pay your card · Chase", initial: "C" },
  { id: 4, title: "Review payment · Chase", initial: "C" },
  { id: 5, title: "New tab" },
];
const crowded = { tabs: [chase[0], chase[2], chase[4]], overflow: [chase[1], chase[3]], selectedId: 3 };

export const meta: ComponentMeta<BrowserTabStripProps> = {
  args: { tabs: [{ id: 1, title: "New tab" }], selectedId: 1 },
  examples: {
    "Several tabs": { tabs: crowded.tabs, selectedId: 3, onSelectTab: select, onCloseTab: close },
    "Loading page": { tabs: [{ ...chase[2], pageLoading: true }], selectedId: 3 },
    "More tabs": { ...crowded, onSelectTab: pick, onCloseTab: shut },
    "More tabs open": { ...crowded, overflowOpen: true },
  },
  decorator: (story) => (
    <div className="h-[420px] w-[1130px]">
      <div className="overflow-hidden rounded-t-window bg-gradient-frame">
        <div className="bg-glass/42">
          {story()}
          <div className="h-20 bg-glass/78" />
        </div>
      </div>
    </div>
  ),
  play: {
    "Several tabs": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Sign in · Chase" }));
      await userEvent.click(canvas.getByRole("button", { name: "Close New tab" }));
      await expect([select.mock.calls[0], close.mock.calls[0]]).toEqual([[1], [5]]);
      unfocus();
    },
    "More tabs": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "2 more" }));
      const list = within(await screen.findByRole("dialog", { name: "More tabs" }));
      await expect(list.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["CCredit card · Chase", "CReview payment · Chase"]);
      await userEvent.click(list.getByRole("button", { name: "Close Review payment · Chase" }));
      await userEvent.click(list.getByRole("button", { name: "Credit card · Chase" }));
      await expect([shut.mock.calls[0], pick.mock.calls[0]]).toEqual([[4], [2]]);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "More tabs" })).toBeNull());
      unfocus();
    },
  },
};
