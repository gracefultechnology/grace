import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { GraceAttachMenu } from "./GraceAttachMenu.tsx";
import { attachOptions } from "./GraceAttachMenu.meta.tsx";
import type { GraceDockProps } from "./GraceDock.tsx";

const send = fn();
const mic = fn();
const fixMic = fn();
const typed = fn();
const typeTap = fn();

export const dockArgs: GraceDockProps = { value: "", mic: true, attach: <GraceAttachMenu options={attachOptions} /> };

export const meta: ComponentMeta<GraceDockProps> = {
  args: { ...dockArgs, placeholder: "Talk or tap to type a message", onSend: send, onMicChange: mic },
  examples: {
    Draft: { value: "Can you help me pay my Chase bill?" },
    "Set-up": { placeholder: "Talk or tap to type", setup: true, onType: typeTap },
    "Set-up listening": { placeholder: "", listening: true, setup: true },
    "Set-up typing": { value: "margaret.ellis@gmail.com", setup: true, composerOpen: true },
    "Set-up offline": { placeholder: "Waiting for internet.", setup: true, offline: true },
    Listening: { listening: true, value: "Can you help me", placeholder: "" },
    "Grace's turn": { quiet: true, placeholder: "" },
    "Mic off": { mic: false, placeholder: "Tap to type a message, or turn on the mic" },
    "Mic unavailable": { micUnavailable: "Grace can’t hear you. Allow the microphone in Settings.", fixMicLabel: "Allow mic", onFixMic: fixMic, onValueChange: typed },
    Offline: { micUnavailable: "Grace can’t hear you right now. Tap to type a message." },
    "Long draft": { value: "Can you help me pay my Chase bill? I think it is due on Friday, and I would like to pay the full balance from my checking account if there is enough in it." },
  },
  decorator: (story) => (
    <div className="group/grace w-[1130px] bg-background p-4">
      {story()}
    </div>
  ),
  play: {
    Draft: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      send.mockClear();
      mic.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await expect(send).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("switch"));
      await expect(mic).toHaveBeenCalledWith(false);
    },
    "Set-up": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      typeTap.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Type" }));
      await expect(typeTap).toHaveBeenCalled();
      await expect(canvas.queryByRole("switch")).toBeNull();
    },
    "Mic unavailable": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      fixMic.mockClear();
      typed.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Allow mic" }));
      await expect(fixMic).toHaveBeenCalled();
      await userEvent.type(canvas.getByRole("textbox", { name: "Message to Grace" }), "H");
      await expect(typed).toHaveBeenCalledWith("H");
    },
    Offline: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const toggle = within(canvasElement).getByRole("switch");
      await expect([toggle.getAttribute("aria-checked"), toggle.getAttribute("aria-disabled")]).toEqual(["false", "true"]);
    },
  },
};
