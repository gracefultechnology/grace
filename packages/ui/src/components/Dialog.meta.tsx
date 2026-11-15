import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Trash2 } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import { DialogClose, DialogContent, type DialogProps, DialogTitle, DialogTrigger } from "./Dialog.tsx";

// Deleting an appointment in Calendar (prototype `calDlg`).
const children = (
  <>
    <DialogTrigger asChild>
      <Button variant="warn" size="pill">
        <Trash2 size={22} strokeWidth={2.2} />
        Delete
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogTitle>Delete Doctor’s appointment?</DialogTitle>
      <p className="text-body-lg leading-[30px] text-muted-foreground">Saturday, November 14 at 10 am.</p>
      <div className="mt-4 flex flex-col gap-3">
        <Button variant="warn" size="pill" className="w-full">
          <Trash2 size={22} strokeWidth={2.2} />
          Delete it
        </Button>
        <DialogClose asChild>
          <Button variant="capsule" size="pill" className="w-full">Keep it</Button>
        </DialogClose>
      </div>
    </DialogContent>
  </>
);

export const meta: ComponentMeta<DialogProps> = {
  args: { children },
  examples: { Open: { defaultOpen: true } },
  play: {
    // Opened from the keyboard, it takes focus; Escape and Keep it dismiss it, and focus goes back to the trigger.
    Default: async () => {
      // Focus goes back a moment after the dialog closes.
      const trigger = screen.getByRole("button", { name: "Delete" });
      trigger.focus();
      await userEvent.keyboard("{Enter}");
      await expect((await screen.findByRole("dialog", { name: "Delete Doctor’s appointment?" })).contains(document.activeElement)).toBe(true);
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect([screen.queryByRole("dialog"), document.activeElement]).toEqual([null, trigger]));
      await userEvent.click(trigger);
      await userEvent.click(await screen.findByRole("button", { name: "Keep it" }));
      await waitFor(() => expect([screen.queryByRole("dialog"), document.activeElement]).toEqual([null, trigger]));
    },
  },
};
