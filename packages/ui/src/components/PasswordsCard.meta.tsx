import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { passwordsOffer } from "./GraceOffer.meta.tsx";
import type { PasswordsCardProps } from "./PasswordsCard.tsx";

const openPasswords = fn();
const addPassword = fn();

export const passwords: PasswordsCardProps = { status: "12 saved, only on this tablet", onClick: openPasswords, onAdd: addPassword };

export const passwordsEmpty: PasswordsCardProps = { status: "None saved yet", onClick: openPasswords, offer: passwordsOffer };

export const meta: ComponentMeta<PasswordsCardProps> = {
  args: { ...passwords, className: "h-[290px] w-[502px]" },
  examples: {
    Compact: { compact: true, className: "h-[402px] w-[334px]" },
  },
  states: { Empty: { ...passwordsEmpty, className: "h-[290px] w-[502px]" } },
  decorator: (story) => <div className="bg-gradient-frame-soft p-12">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Add a password" }));
      await expect(addPassword).toHaveBeenCalledTimes(1);
      await expect(openPasswords).not.toHaveBeenCalled();
      await userEvent.click(canvas.getByText("Passwords", { exact: true }));
      await expect(openPasswords).toHaveBeenCalledTimes(1);
    },
  },
};
