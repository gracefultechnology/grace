// spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"; spec/app/workspace.md, "Story: Follow one reviewed plan across apps"
// Grace's window: compact at the bottom, over the page when one shows, or expanded over everything
// right of the rail. Conversation services are not connected yet; the composer keeps the draft.
import { besideRail, cn, GraceBubble, GraceDock, GraceHeader, GraceMessages, GraceWindow, UserBubble } from "@repo/ui";
import { Check } from "lucide-react";
import type { Interaction } from "../gen/app__interaction.ts";
import { OverPage } from "./PageLayer.tsx";
import { useDraft, useKeyboardHeight, useWorkspace } from "./useApp.ts";

/** @model spec/app/assistant.md */
export function Grace({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { workspace, can, send } = useWorkspace();
  const { assistant, plan } = workspace!;
  const conversation = assistant.conversation;
  const [draft, setDraft] = useDraft(conversation.draft, assistant.keyboard === "ChatKeyboard");
  // Prototype `layout()`: the window sits on the keyboard.
  const keyboard = useKeyboardHeight();
  if (assistant.presentation === "Closed") return null;
  const expanded = assistant.presentation === "Expanded";
  const next = plan.receipts.length;
  const currentStep = plan.steps[next];
  const planStatus = assistant.activity === "Paused" ? "Paused" : assistant.outcome === "Completed" ? "Complete" : null;
  const resume = { type: "resume" } as const;
  const stop = { type: "stop" } as const;
  const hasPlan = plan.steps.length > 0;
  const canResume = hasPlan && can(resume);
  const canPause = hasPlan && assistant.activity !== "Paused" && can(stop);
  const interact = (input: Interaction) => { if (can({ type: "interact", input })) void send({ type: "interact", input }); };

  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": compact over a
  // shown page, and expanded over one the host has not hidden yet. One window at both sizes, so resizing keeps its focus.
  return (
    <OverPage className={cn(besideRail, "z-[3]")} style={{ bottom: 6 + keyboard }}>
      <GraceWindow size={expanded ? "expanded" : "compact"} onHeightChange={onHeightChange}
        // Prototype `sizeCompact()`: an explicit height at both sizes, so every change animates.
        style={expanded ? { height: `calc(100dvh - ${12 + keyboard}px)` } : undefined}
        header={
          <GraceHeader pause={canResume ? "paused" : canPause ? "live" : "idle"}
            onPause={() => void send(stop)} onResume={() => void send(resume)} expanded={expanded} onExpandedChange={(larger) => interact({ tag: "Resize", expanded: larger })}
            onClose={() => { if (can({ type: "closeGrace" })) void send({ type: "closeGrace" }); }} />
        }
        dock={
          <GraceDock value={draft} maxLines={expanded ? 6 : 4} mic={conversation.voice}
            onMicChange={(on) => {
              if (!on) interact({ tag: "StopVoice" });
              else if (can({ type: "talk" })) void send({ type: "talk" });
            }}
            onFieldFocus={() => interact({ tag: "TypeIntoChat" })}
            onValueChange={(text) => { setDraft(text); interact({ tag: "EditDraft", text }); }}
            onSend={() => interact({ tag: "SendDraft", revision: conversation.draftRevision })} />
        }>
        <GraceMessages>
          {conversation.messages.map((message, index) =>
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the transcript only grows at its end
            message.author === "HumanMessage" ? <UserBubble key={index}>{message.text}</UserBubble> : <GraceBubble key={index}>{message.text}</GraceBubble>)}
          {hasPlan && (
            <section aria-label="Task plan" className="flex flex-col gap-2 rounded-window bg-bubble px-5 py-2.5 text-grace-ink">
              {planStatus && <p className="text-body font-medium">{planStatus}</p>}
              {expanded ? (
                <ol className="flex flex-col gap-3">
                  {plan.steps.map((step, index) => (
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- the task's ordered list never edits its steps
                    <li key={index} aria-current={index === next ? "step" : undefined} className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center">
                        {index < next ? <Check size={20} className="text-ok" role="img" aria-label="Observed" /> :
                          index === next ? <span aria-hidden className="size-2 rounded-full bg-primary" /> : null}
                      </span>
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p className={cn("text-body", index === next && "font-semibold")}>{step.outcome}</p>
                        <p className="text-label text-muted-foreground">{step.surface === "DeviceSettings" ? "Settings" : step.surface} · {step.subject}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : currentStep && <p aria-current="step" className="text-lead [overflow-wrap:anywhere]">{currentStep.outcome}</p>}
            </section>
          )}
        </GraceMessages>
      </GraceWindow>
    </OverPage>
  );
}
