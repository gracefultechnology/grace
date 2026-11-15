import { Check, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { PlayIcon, SpeakerIcon, SpeakerOffIcon } from "../icons.tsx";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { Rail, WifiSlash } from "./Rail.tsx";
import { homeRail } from "./Rail.meta.tsx";
import type { RailPopoverProps } from "./RailPopover.tsx";
import { Slider } from "./Slider.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

// Prototype `drawPop()`: Volume at 60%, and Wi-Fi on "Home Network"; each opens 30px above its rail button.
const volume: RailPopoverProps = {
  icon: <SpeakerIcon strokeWidth={2} className="size-7.5" />,
  title: "Volume",
  value: "60%",
  top: 335,
  onClose: fn(),
  children: <Slider value={60} label="Volume" decreaseLabel="Quieter" increaseLabel="Louder" className="mt-5" />,
  note: "Grace’s voice, videos and sounds all use this volume.",
  actions: (
    <>
      <Button variant="capsule" size="pill"><PlayIcon className="size-5.5" />Test sound</Button>
      <Button variant="capsule" size="pill"><SpeakerOffIcon className="size-5.5" />Mute</Button>
    </>
  ),
};
const wifi: RailPopoverProps = {
  icon: <Wifi size={30} strokeWidth={2} />,
  title: "Wi-Fi",
  value: "Connected",
  top: 138,
  onClose: fn(),
  children: <ListRow className="mt-[18px] bg-glass/70" leading={<Check size={30} strokeWidth={2.6} aria-hidden className="shrink-0 text-ok" />} title="Home Network" subtitle="Strong signal" />,
  actions: <Button variant="capsule" size="pill">Choose another network</Button>,
};

export const meta: ComponentMeta<RailPopoverProps> = {
  args: volume,
  states: {
    Muted: {
      ...volume,
      icon: <SpeakerOffIcon strokeWidth={2} className="size-7.5" />,
      value: "Muted",
      note: "Grace will show her words on screen while you’re muted.",
      actions: <Button variant="prominent" size="pill"><SpeakerIcon className="size-5.5" />Unmute</Button>,
    },
    "Wi-Fi": wifi,
    "Wi-Fi offline": {
      ...wifi,
      className: "offline",
      icon: <WifiSlash size={30} />,
      value: "Not connected",
      children: undefined,
      note: "Email and the internet need it. Grace can help you reconnect.",
      actions: <Button variant="prominent" size="pill"><Wifi aria-hidden size={22} strokeWidth={2.2} />Fix Wi-Fi</Button>,
    },
  },
  // The rail it opens from (prototype `railSel()`): only the button whose popover is open is raised.
  decorator: (story) => (
    <TabletScreen className="group/tablet">
      <Rail
        {...homeRail(null, {
          raise: {
            wifi: "group-has-[[role=dialog][aria-label=Wi-Fi]]/tablet:bg-card group-has-[[role=dialog][aria-label=Wi-Fi]]/tablet:text-primary group-has-[[role=dialog][aria-label=Wi-Fi]]/tablet:shadow-raised",
            volume: "group-has-[[role=dialog][aria-label=Volume]]/tablet:bg-card group-has-[[role=dialog][aria-label=Volume]]/tablet:text-primary group-has-[[role=dialog][aria-label=Volume]]/tablet:shadow-raised",
          },
          offline: { wifi: "group-has-[.offline]/tablet:hidden", slash: "hidden group-has-[.offline]/tablet:block" },
        })}
      />
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: async ({ args, canvasElement }: { args: RailPopoverProps; canvasElement: HTMLElement }) => {
      const close = within(canvasElement).getByRole("button", { name: "Close" });
      await userEvent.click(close);
      await expect(args.onClose).toHaveBeenCalled();
      close.blur();
    },
  },
};
