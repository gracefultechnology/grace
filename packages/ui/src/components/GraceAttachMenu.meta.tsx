import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ReactNode } from "react";
import type { ComponentMeta } from "vibestack/stories";
import type { AttachOption, GraceAttachMenuProps } from "./GraceAttachMenu.tsx";
import { GraceCapsule } from "./GraceHeader.tsx";

// Prototype #addPop's icons, 24px, stroke 2.2.
const icon = (paths: ReactNode) => (
  <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);
const chose = fn();

// Prototype `#addPop`: what Margaret can attach.
export const attachOptions: AttachOption[] = [
  { id: "camera", label: "Take a photo", icon: icon(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>) },
  { id: "photo", label: "Choose a photo", icon: icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" /></>) },
  { id: "file", label: "Choose a file", icon: icon(<><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></>) },
];

export const meta: ComponentMeta<GraceAttachMenuProps> = {
  args: { options: attachOptions, onChoose: chose },
  examples: { Open: { defaultOpen: true } },
  decorator: (story) => (
    <div className="flex h-[360px] w-[560px] items-end justify-end bg-gradient-frame-soft p-6">
      <GraceCapsule>{story()}</GraceCapsule>
    </div>
  ),
  play: {
    // Attach opens its menu upward; a choice is reported by its id.
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      chose.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Attach" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Choose a photo" }));
      await expect(chose).toHaveBeenCalledWith("photo");
    },
  },
};
