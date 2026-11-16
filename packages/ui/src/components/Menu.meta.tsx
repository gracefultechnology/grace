import type { ReactNode } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import { MenuLabel, MenuOption, type MenuProps } from "./Menu.tsx";
import { SwitchTrack } from "./Switch.tsx";

const chose = fn();
const draw = (paths: ReactNode, size = 24, stroke = 2.2) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
const voice = draw(<><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>, 22, 2);
const speed = (
  <>
    <MenuOption role="menuitemcheckbox" aria-checked onSelect={(event) => event.preventDefault()} className="h-14 justify-between gap-2.5 bg-transparent pr-5 pl-4">
      {voice}<span>Voice on</span><SwitchTrack checked />
    </MenuOption>
    <MenuLabel>Speed</MenuLabel>
    {["Slower", "Normal", "Faster"].map((t) => <MenuOption key={t} selected={t === "Normal"} onSelect={() => { chose(t); }}>{t}</MenuOption>)}
  </>
);

export const meta: ComponentMeta<MenuProps> = {
  args: {
    trigger: <Button variant="glass" size="pill">{voice}Voice<ChevronDown size={18} strokeWidth={2.4} aria-hidden /></Button>,
    children: speed,
  },
  examples: {
    Attach: {
      defaultOpen: true,
      trigger: <Button variant="glass" size="pill"><Paperclip size={24} strokeWidth={2.2} aria-hidden />Attach</Button>,
      className: "w-[286px]",
      side: "top",
      align: "end",
      children: [
        <MenuOption key="camera" className="min-w-[280px]" icon={draw(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx={12} cy={13} r={3.5} /></>)}>Take a photo</MenuOption>,
        <MenuOption key="photo" className="min-w-[280px]" icon={draw(<><rect x={3} y={4} width={18} height={16} rx={2} /><circle cx={9} cy={10} r={2} /><path d="m21 17-5-5-9 8" /></>)}>Choose a photo</MenuOption>,
        <MenuOption key="file" className="min-w-[280px]" icon={draw(<><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></>)}>Choose a file</MenuOption>,
      ],
    },
  },
  decorator: (story) => <div className="flex h-[800px] w-[640px] items-center justify-center bg-gradient-frame">{story()}</div>,
  play: {
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
