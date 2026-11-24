// spec/app/conversation.md, "Story: Talk or type without losing the conversation"; spec/app/wake.md, "Story: Call Grace from any app or while the screen sleeps"
import { Button, Dialog, DialogContent, DialogTitle, PageText } from "@repo/ui";
import { voiceDisclosure } from "../gen/app__conversation.ts";
import type { VoiceNotice } from "./graceSpeech.vibe";

export function VoiceNoticeDialog({ notice, continueWith, cancel }: {
  notice: VoiceNotice | undefined;
  continueWith: (acknowledged: VoiceNotice) => void;
  cancel: () => void;
}) {
  const wake = notice?.use === "wake";
  return (
    <Dialog open={notice !== undefined} onOpenChange={(open) => { if (!open) cancel(); }}>
      <DialogContent>
        <DialogTitle>{wake ? "Set up “Hey Grace”" : "Talk to Grace"}</DialogTitle>
        <PageText>{wake ? "Grace listens for “Hey Grace” on this tablet. After Grace wakes, what you say goes to Grace’s cloud service to be understood." : voiceDisclosure}</PageText>
        {notice?.use === "command" && <PageText>Say a Passwords command, such as “Open Passwords.” Keep saved passwords and codes private. Grace uses this recording to recognize the command.</PageText>}
        <Button variant="capsule" size="pill" onClick={() => { if (notice) continueWith(notice); }}>{wake ? "Continue" : "Continue to Talk"}</Button>
        <Button variant="plain" size="pill" onClick={cancel}>Cancel</Button>
      </DialogContent>
    </Dialog>
  );
}
