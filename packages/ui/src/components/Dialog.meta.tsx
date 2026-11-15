import { expect, screen, userEvent, waitFor } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import { DialogClose, DialogContent, type DialogProps, DialogTitle, DialogTrigger } from "./Dialog.tsx";

// The prototype's trash can, without the two lines Lucide's has now.
const trash = <svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;

// Deleting an appointment in Calendar (prototype `calDlg`).
const children = (
  <>
    <DialogTrigger asChild>
      <Button variant="warn" size="pill">
        {trash}
        Delete
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogTitle>Delete Doctor’s appointment?</DialogTitle>
      <p className="text-body-lg leading-[30px] text-muted-foreground">Saturday, November 14 at 10 am.</p>
      <div className="mt-4 flex flex-col gap-3">
        <Button variant="warn" size="pill" className="w-full">
          {trash}
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
