// spec/app/conversation.md, "Story: Talk or type without losing the conversation"
import { Button, Dialog, DialogContent, DialogTitle, PageText } from "@repo/ui";
import { voiceDisclosure } from "../gen/app__conversation.ts";
import type { VoiceNotice } from "./graceSpeech.vibe";

export function VoiceNoticeDialog({ notice, continueWith, cancel }: {
  notice: VoiceNotice | undefined;
  continueWith: (acknowledged: VoiceNotice) => void;
  cancel: () => void;
}) {
  const instructions = notice?.use === "instructions";
  return (
    <Dialog open={notice !== undefined} onOpenChange={(open) => { if (!open) cancel(); }}>
      <DialogContent>
        <DialogTitle>{instructions ? "Read Passwords instructions aloud" : "Talk to Grace"}</DialogTitle>
        <PageText>{voiceDisclosure}</PageText>
        {notice?.use === "command" && <PageText>Say a Passwords command, such as “Open Passwords.” Keep saved passwords and codes private. Grace uses this recording to recognize the command.</PageText>}
        {instructions && <PageText>Grace sends the fixed help text for speech. Your microphone stays off.</PageText>}
        <Button variant="capsule" size="pill" onClick={() => { if (notice) continueWith(notice); }}>{instructions ? "Read aloud" : "Continue to Talk"}</Button>
        <Button variant="plain" size="pill" onClick={cancel}>Cancel</Button>
      </DialogContent>
    </Dialog>
  );
}
