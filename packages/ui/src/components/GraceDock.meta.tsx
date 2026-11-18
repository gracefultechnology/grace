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
const talk = fn();
const focus = fn();

export const dockArgs: GraceDockProps = { value: "", mic: true, attach: <GraceAttachMenu options={attachOptions} /> };

export const meta: ComponentMeta<GraceDockProps> = {
  args: { ...dockArgs, placeholder: "Talk or tap to type a message", onSend: send, onMicChange: mic },
  examples: {
    Draft: { value: "Can you help me pay my Chase bill? I think it is due on Friday, and I would like to pay the full balance from my checking account if there is enough in it." },
    Typing: { placeholder: "Type a message", onFieldFocus: focus },
    "Set-up": { placeholder: "Talk or tap to type", setup: true, onType: typeTap, onTalk: talk },
    "Set-up listening": { placeholder: "", listening: true, setup: true },
    "Set-up typing": { value: "margaret.ellis@gmail.com", setup: true, composerOpen: true },
    "Set-up offline": { placeholder: "Waiting for internet.", setup: true, offline: true },
    Listening: { listening: true, value: "Can you help me", placeholder: "" },
    "Grace's turn": { quiet: true, placeholder: "" },
    "Mic off": { mic: false, placeholder: "Tap to type a message, or turn on the mic" },
    "Mic unavailable": { micUnavailable: "Grace can’t hear you. Allow the microphone in Settings.", fixMicLabel: "Allow mic", onFixMic: fixMic, onValueChange: typed },
    Offline: { micUnavailable: "Grace can’t hear you right now. Tap to type a message." },
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
    Typing: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      focus.mockClear();
      const field = within(canvasElement).getByRole("textbox", { name: "Message to Grace" });
      await userEvent.click(field);
      await expect(field).toHaveFocus();
      await expect(focus).toHaveBeenCalledTimes(1);
    },
    "Set-up": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      typeTap.mockClear();
      talk.mockClear();
      const canvas = within(canvasElement);
      const speak = canvas.getByRole("button", { name: "Talk" });
      await expect(speak.getAttribute("aria-pressed")).toBe("false");
      await userEvent.click(speak);
      await userEvent.click(canvas.getByRole("button", { name: "Type" }));
      await expect([talk.mock.calls.length, typeTap.mock.calls.length, canvas.queryByRole("switch")]).toEqual([1, 1, null]);
    },
    "Set-up listening": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await expect(within(canvasElement).getByRole("button", { name: "Talk" }).getAttribute("aria-pressed")).toBe("true");
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
