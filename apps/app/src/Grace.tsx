// spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"; spec/app/conversation.md, "Story: Talk or type without losing the conversation"; spec/app/workspace.md, "Story: Follow one reviewed plan across apps"
// Grace's window: compact at the bottom, over the page when one shows, or expanded over everything
// right of the rail. A sent draft or a tapped answer is the person's turn, which Grace answers.
import { AnswerChip, AnswerChips, besideRail, cn, GraceBubble, GraceDock, GraceHeader, GraceMessages, GraceWindow, UserBubble } from "@repo/ui";
import { useState } from "react";
import { guidedReadKind, mayGuideReadLink, type GuidedRead } from "../gen/app__workspace.ts";
import type { Interaction } from "../gen/app__interaction.ts";
import { OverPage } from "./PageLayer.tsx";
import { useDraft, useKeyboardHeight, useWorkspace } from "./useApp.ts";

const checkLabels: Record<GuidedRead, string> = {
  ReadMail: "Check email",
  ReadBrowser: "Check page",
  ReadChangedBrowser: "Check page",
  ReadStatement: "Read statement",
  ReadCalendar: "Check appointment",
  SaveMailAppointment: "Check saved appointment",
  UnsupportedRead: "",
};

/** @model spec/app/assistant.md */
export function Grace({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { workspace, can, send, say, checkGuidedRead, pointAtReadLink } = useWorkspace();
  const { assistant, plan, review } = workspace!;
  const conversation = assistant.conversation;
  const [draft, setDraft] = useDraft(conversation.draft, assistant.keyboard === "ChatKeyboard");
  const [linkFeedback, setLinkFeedback] = useState<{ key: string; words?: string }>();
  // Prototype `layout()`: the window sits on the keyboard.
  const keyboard = useKeyboardHeight();
  if (assistant.presentation === "Closed") return null;
  const expanded = assistant.presentation === "Expanded";
  const interact = (input: Interaction) => { if (can({ type: "interact", input })) void send({ type: "interact", input }); };
  const answers = conversation.answers.filter((text) => can({ type: "interact", input: { tag: "ChooseAnswer", token: conversation.generation, text } }));
  const start = { type: "startReadReview", reviewRevision: review.revision } as const;
  const showReview = can(start);
  const next = plan.receipts.length;
  const currentStep = plan.steps[next];
  const hasPlan = plan.steps.length > 0;
  const savePlan = plan.steps.some((step) => guidedReadKind(step) === "SaveMailAppointment");
  const status = assistant.activity === "Paused" ? "Paused" : assistant.outcome === "Completed"
    ? savePlan ? "Planned checks complete" : "Read checks complete"
    : null;
  const stop = { type: "stop" } as const;
  const resume = { type: "resume" } as const;
  const paused = hasPlan && can(resume);
  const pausable = hasPlan && assistant.activity !== "Paused" && can(stop);
  const stepKind = currentStep ? guidedReadKind(currentStep) : "UnsupportedRead";
  const label = stepKind === "SaveMailAppointment" && !plan.savedOccurrence ? "" : checkLabels[stepKind];
  const canCheck = label && (currentStep?.surface !== "Browser" || workspace?.device.observationAllowed) &&
    currentStep?.surface === workspace?.device.surface &&
    (assistant.activity === "ReadyForStep" || assistant.activity === "Rechecking") && assistant.replacementId === "" &&
    conversation.turn === "Ready" && !conversation.question;
  const observation = workspace && {
    type: "setBrowserObservation", choice: {
      allowed: !workspace.device.observationAllowed,
      deviceVersion: workspace.device.contextVersion, browserRevision: workspace.browser.revision,
    },
  } as const;
  const guideKey = workspace && mayGuideReadLink(workspace)
    ? [assistant.taskId, assistant.workVersion, conversation.generation, next, workspace.device.contextVersion, workspace.browser.revision].join(":")
    : "";
  const feedback = guideKey && linkFeedback?.key === guideKey ? linkFeedback : undefined;
  const showLink = () => {
    setLinkFeedback({ key: guideKey });
    const report = (words: string) => setLinkFeedback((current) => current?.key === guideKey ? { key: guideKey, words } : current);
    void pointAtReadLink().then(report, () => report("I could not highlight a link on this page."));
  };

  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": compact over a
  // shown page, and expanded over one the host has not hidden yet. One window at both sizes, so resizing keeps its focus.
  return (
    <OverPage className={cn(besideRail, "z-[3]")} style={{ bottom: 6 + keyboard }}>
      <GraceWindow size={expanded ? "expanded" : "compact"} onHeightChange={onHeightChange}
        // Prototype `sizeCompact()`: an explicit height at both sizes, so every change animates.
        style={expanded ? { height: `calc(100dvh - ${12 + keyboard}px)` } : undefined}
        header={
          <GraceHeader pause={paused ? "paused" : pausable ? "live" : "idle"} onPause={() => void send(stop)}
            onResume={() => void send(resume)} expanded={expanded} onExpandedChange={(larger) => interact({ tag: "Resize", expanded: larger })}
            onClose={() => { if (can({ type: "closeGrace" })) void send({ type: "closeGrace" }); }} />
        }
        dock={
          <GraceDock value={draft} maxLines={expanded ? 6 : 4} mic={conversation.voice} quiet={conversation.turn === "Thinking"}
            onMicChange={(on) => {
              if (!on) interact({ tag: "StopVoice" });
              else if (can({ type: "talk" })) void send({ type: "talk" });
            }}
            onFieldFocus={() => interact({ tag: "TypeIntoChat" })}
            onValueChange={(text) => { setDraft(text); interact({ tag: "EditDraft", text }); }}
            onSend={() => void say({ tag: "SendDraft", revision: conversation.draftRevision }).then((sent) => {
              // spec/app/assistant.md, sendDraft: Send closes the chat keyboard, so the field gives up its focus with it.
              if (sent && document.activeElement instanceof HTMLElement) document.activeElement.blur();
            })} />
        }>
        <GraceMessages>
          {conversation.messages.map((message, index) =>
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the transcript only grows at its end
            message.author === "HumanMessage" ? <UserBubble key={index}>{message.text}</UserBubble> : <GraceBubble key={index}>{message.text}</GraceBubble>)}
          {observation && can(observation) && (
            <AnswerChips>
              <AnswerChip onClick={() => void send(observation)}>
                {observation.choice.allowed ? "Allow Grace to read this browser" : "Turn off browser reading"}
              </AnswerChip>
            </AnswerChips>
          )}
          {showReview && (
            <section aria-label="Review read plan" className="flex flex-col gap-2 rounded-window bg-bubble px-5 py-2.5 text-grace-ink">
              <blockquote className="text-body">{review.request.goal}</blockquote>
              <p className="text-body">I can check the items you open. These checks leave any requested changes for separate review.</p>
              <ol aria-label="Read plan" className="list-decimal pl-6">
                {review.request.steps.map((step, index) => <li key={`${step.subject}-${index}`}>{step.subject}</li>)}
              </ol>
              <AnswerChips><AnswerChip onClick={() => void send(start)}>Start read plan</AnswerChip></AnswerChips>
            </section>
          )}
          {hasPlan && (
            <section aria-label="Task plan" className="flex flex-col gap-2 rounded-window bg-bubble px-5 py-2.5 text-grace-ink">
              {status && <p className="text-body font-medium">{status}</p>}
              {expanded ? (
                <>
                  <blockquote className="text-body">{plan.originalAsk}</blockquote>
                  <ol className="flex flex-col gap-2">
                    {plan.steps.map((step, index) => <li key={`${step.subject}-${index}`} aria-current={index === next ? "step" : undefined}>
                      {index < next ? plan.receipts[index]?.evidence : step.outcome}
                    </li>)}
                  </ol>
                </>
              ) : <p aria-current={currentStep ? "step" : undefined}>{stepKind === "SaveMailAppointment" && plan.savedOccurrence ? "Check the appointment saved to your calendar." : currentStep?.outcome ?? plan.receipts.at(-1)?.evidence}</p>}
            </section>
          )}
          {feedback?.words && <GraceBubble role="status">{feedback.words}</GraceBubble>}
          {canCheck && <AnswerChips>
            {guideKey && <AnswerChip disabled={feedback !== undefined && feedback.words === undefined} onClick={showLink}>Show me the link</AnswerChip>}
            <AnswerChip onClick={() => void checkGuidedRead()}>{label}</AnswerChip>
          </AnswerChips>}
          {answers.length > 0 && (
            <AnswerChips>
              {answers.map((text) => <AnswerChip key={text} onClick={() => void say({ tag: "ChooseAnswer", token: conversation.generation, text })}>{text}</AnswerChip>)}
            </AnswerChips>
          )}
        </GraceMessages>
      </GraceWindow>
    </OverPage>
  );
}
