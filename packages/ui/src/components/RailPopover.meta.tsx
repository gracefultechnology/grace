import { Check, House, Play, Settings, Volume2, VolumeX, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { Rail, RailButton, WifiSlash } from "./Rail.tsx";
import type { RailPopoverProps } from "./RailPopover.tsx";
import { Slider } from "./Slider.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const tile = { size: 28, strokeWidth: 1.9 };
const small = { size: 22, strokeWidth: 2.2, "aria-hidden": true };
// Prototype `drawPop()`: Volume at 60%, and Wi-Fi on "Home Network"; each opens 30px above its rail button.
const volume: RailPopoverProps = {
  icon: <Volume2 size={30} strokeWidth={2} />,
  title: "Volume",
  value: "60%",
  top: 335,
  onClose: fn(),
  children: <Slider value={60} label="Volume" decreaseLabel="Quieter" increaseLabel="Louder" className="mt-5 gap-4" />,
  note: "Grace’s voice, videos and sounds all use this volume.",
  actions: (
    <>
      <Button variant="capsule" size="pill"><Play {...small} />Test sound</Button>
      <Button variant="capsule" size="pill"><VolumeX {...small} />Mute</Button>
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
      icon: <VolumeX size={30} strokeWidth={2} />,
      value: "Muted",
      note: "Grace will show her words on screen while you’re muted.",
      actions: <Button variant="prominent" size="pill"><Volume2 {...small} />Unmute</Button>,
    },
    "Wi-Fi": wifi,
    "Wi-Fi offline": {
      ...wifi,
      icon: <WifiSlash size={30} />,
      value: "Not connected",
      children: undefined,
      note: "Email and the internet need it. Grace can help you reconnect.",
      actions: <Button variant="prominent" size="pill"><Wifi {...small} />Fix Wi-Fi</Button>,
    },
  },
  // The rail it opens from, as on Home.
  decorator: (story) => (
    <TabletScreen>
      <Rail
        battery={75}
        time="8:56"
        period="PM"
        date="Fri, Nov 13"
        status={<RailButton icon={<Wifi {...tile} />} label="Wi-Fi" />}
        footer={<RailButton icon={<Settings {...tile} />} label="Settings" />}
        ask={<AskGraceButton />}
      >
        <RailButton icon={<House {...tile} />} label="Home" />
        <RailButton icon={<Volume2 {...tile} />} label="Volume" />
      </Rail>
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: async ({ args, canvasElement }: { args: RailPopoverProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Close" }));
      await expect(args.onClose).toHaveBeenCalled();
    },
  },
};
