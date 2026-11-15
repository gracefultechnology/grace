import { Camera, ChevronDown, File, Image, Volume1 } from "lucide-react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import { MenuLabel, MenuOption, type MenuProps } from "./Menu.tsx";

const chose = fn();
// prototype #spdPop: Grace's reading speed, Normal chosen.
const speed = (
  <>
    <MenuLabel>Speed</MenuLabel>
    {["Slower", "Normal", "Faster"].map((t) => <MenuOption key={t} selected={t === "Normal"} onSelect={() => { chose(t); }}>{t}</MenuOption>)}
  </>
);
const icon = { size: 24, strokeWidth: 2.2, "aria-hidden": true } as const;

export const meta: ComponentMeta<MenuProps> = {
  args: {
    trigger: <Button variant="glass" size="pill">{<Volume1 size={22} strokeWidth={2.2} aria-hidden />}Voice<ChevronDown size={20} strokeWidth={2.2} aria-hidden /></Button>,
    children: speed,
  },
  examples: {
    // prototype #addPop: what Margaret can attach.
    Attach: {
      defaultOpen: true,
      trigger: <Button variant="glass" size="pill">Attach</Button>,
      children: [
        <MenuOption key="camera" icon={<Camera {...icon} />}>Take a photo</MenuOption>,
        <MenuOption key="photo" icon={<Image {...icon} />}>Choose a photo</MenuOption>,
        <MenuOption key="file" icon={<File {...icon} />}>Choose a file</MenuOption>,
      ],
      className: "min-w-[280px]",
    },
  },
  decorator: (story) => <div className="h-[420px] w-[560px] bg-gradient-frame p-6">{story()}</div>,
  play: {
    // The button opens the menu; the current speed says it is chosen; a choice closes it.
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      chose.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Voice" }));
      await expect((await screen.findByRole("menuitemradio", { name: "Normal" })).getAttribute("aria-checked")).toBe("true");
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Faster" }));
      await expect(chose).toHaveBeenCalledWith("Faster");
      await expect(screen.queryByRole("menu")).toBeNull();
    },
  },
};
