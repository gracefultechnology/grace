import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { GraceAttachMenu } from "./GraceAttachMenu.tsx";
import { attachOptions } from "./GraceAttachMenu.meta.tsx";
import type { GraceDockProps } from "./GraceDock.tsx";

const send = fn();
const mic = fn();

export const dockArgs: GraceDockProps = { value: "", mic: true, attach: <GraceAttachMenu options={attachOptions} /> };

// Prototype `.dock`: the answer row on Margaret's turn, mic on.
export const meta: ComponentMeta<GraceDockProps> = {
  args: { ...dockArgs, placeholder: "Talk or tap to type a message", onSend: send, onMicChange: mic },
  examples: {
    Draft: { value: "Can you help me pay my Chase bill?" },
    Listening: { listening: true, value: "Can you help me", placeholder: "" },
    "Grace's turn": { quiet: true, placeholder: "" },
    "Mic off": { mic: false, placeholder: "Tap to type a message, or turn on the mic" },
    "Long draft": { value: "Can you help me pay my Chase bill? I think it is due on Friday, and I would like to pay the full balance from my checking account if there is enough in it." },
  },
  decorator: (story) => (
    <div className="group/grace w-[1130px] bg-background p-4" data-surface="white">
      {story()}
    </div>
  ),
  play: {
    // Send sends the draft; the Mic pill is its switch.
    Draft: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      send.mockClear();
      mic.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await expect(send).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("switch"));
      await expect(mic).toHaveBeenCalledWith(false);
    },
  },
};
