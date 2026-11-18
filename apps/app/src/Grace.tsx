// spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"; spec/app/conversation.md, "Story: Talk or type without losing the conversation"; spec/app/workspace.md, "Story: Follow one reviewed plan across apps"
// Grace's window: compact at the bottom, over the page when one shows, or expanded over everything
// right of the rail. The workspace owns the composer and its active turn.
import { AnswerChip, AnswerChips, besideRail, cn, GraceBubble, GraceDock, GraceHeader, GraceMessages, GraceWindow, PageText, UserBubble } from "@repo/ui";
import { Effect, Stream } from "effect";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { ReplyControls, replyOfferIsVisible } from "./replyControls.vibe";
import { guidedReadKind, mayGuideReadLink, type GuidedRead } from "../gen/app__workspace.ts";
import type { Interaction } from "../gen/app__interaction.ts";
import type { BrowserGuidance } from "./browserGuide.vibe";
import { OverPage } from "./PageLayer.tsx";
import { passwordDirection } from "./passwords.vibe";
import { mayOfferTalk, SpeechActions } from "./graceSpeech.vibe";
import { useDraft, useKeyboardHeight, usePasswordGuide, useRuntime, useWorkspace } from "./useApp.ts";

const replyOffers = Stream.unwrap(Effect.map(ReplyControls, (controls) => controls.state));

const checkLabels: Record<GuidedRead, string> = {
  ReadMail: "Check email",
  ReadBrowser: "Check page",
  ReadChangedBrowser: "Check page",
  ReachNamedPage: "Check page",
  ReadStatement: "Read statement",
  ReadCalendar: "Check appointment",
  SaveMailAppointment: "Check saved appointment",
  UnsupportedRead: "",
};

/** @model spec/app/assistant.md */

export function Grace({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { workspace, can, send, say, current, checkGuidedRead, pointAtReadLink } = useWorkspace();
  const guide = usePasswordGuide();
  const runtime = useRuntime();
  const { assistant, plan, review, device, browser } = workspace!;
  const conversation = assistant.conversation;
  const [unavailable, setUnavailable] = useState<number>();
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(replyOffers, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  const offered = useSyncExternalStore(subscribe, () => runtime.runSync(Effect.flatMap(ReplyControls, (controls) => controls.get())));
  const currentOffer = workspace && offered && replyOfferIsVisible(workspace, offered) ? offered : undefined;
  const choose = (id: number, index: number) => {
    void runtime.runPromise(Effect.flatMap(ReplyControls, (controls) => controls.choose(id, index))).then((accepted) => {
      if (!accepted) setUnavailable(current().assistant.conversation.generation);
      else if (current().assistant.presentation === "Expanded" && can({ type: "interact", input: { tag: "Resize", expanded: false } }))
        void send({ type: "interact", input: { tag: "Resize", expanded: false } });
    });
  };
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useDraft(conversation.draft, assistant.keyboard === "ChatKeyboard");
  const [pageCheck, setPageCheck] = useState<{ key: string; pending: boolean }>();
  const [linkFeedback, setLinkFeedback] = useState<{ key: string; result?: BrowserGuidance }>();
  // Prototype `layout()`: the window sits on the keyboard.
  const keyboard = useKeyboardHeight();
  if (assistant.presentation === "Closed") return null;
  const expanded = assistant.presentation === "Expanded";
  const canTalk = mayOfferTalk(workspace!);
  const listeningLocally = guide.mic === "GuideMicListening";
  const talk = () => { guide.stopListening(); void runtime.runPromise(Effect.flatMap(Effect.service(SpeechActions), (speech) => speech.talk())); };
  const needsMicPermission = canTalk && !device.microphoneAllowed;
  const answerEvent = (text: string): Interaction => ({ tag: "ChooseAnswer", token: conversation.generation, text });
  const answers = conversation.answers.filter((text) => can({ type: "interact", input: answerEvent(text) }));
  const interact = (input: Interaction) => { if (can({ type: "interact", input })) void send({ type: "interact", input }); };
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
  const scopeKey = [assistant.taskId, assistant.workVersion, conversation.generation, next, device.contextVersion, browser.revision].join(":");
  const guideKey = workspace && mayGuideReadLink(workspace) ? scopeKey : "";
  const namedCheck = stepKind === "ReachNamedPage" && canCheck && pageCheck?.key === scopeKey ? pageCheck : undefined;
  const check = () => {
    if (stepKind !== "ReachNamedPage") {
      void checkGuidedRead();
      return;
    }
    setPageCheck({ key: scopeKey, pending: true });
    const report = (accepted: boolean) => setPageCheck((current) =>
      current?.key === scopeKey ? (accepted ? undefined : { key: scopeKey, pending: false }) : current);
    void checkGuidedRead().then(report, () => report(false));
  };
  const feedback = guideKey && linkFeedback?.key === guideKey ? linkFeedback : undefined;
  const showLink = () => {
    setLinkFeedback({ key: guideKey });
    const report = (result: BrowserGuidance) => setLinkFeedback((current) => current?.key === guideKey ? { key: guideKey, result } : current);
    void pointAtReadLink(report).then(report, () => report({ kind: "Unavailable", words: "I could not highlight a link on this page." }));
  };

  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": compact over a
  // shown page, and expanded over one the host has not hidden yet. One window at both sizes, so resizing keeps its focus.
  return (
    <OverPage className={cn(besideRail, "z-[3]")} style={{ bottom: 6 + keyboard }}>
      <GraceWindow size={expanded ? "expanded" : "compact"} onHeightChange={onHeightChange}
        // Prototype `sizeCompact()`: an explicit height at both sizes, so every change animates.
        style={expanded ? { height: `calc(100dvh - ${12 + keyboard}px)` } : undefined}
        header={
          <GraceHeader pause={paused ? "paused" : pausable ? "live" : conversation.turn === "Paused" ? "paused" : conversation.turn === "Speaking" ? "live" : "idle"}
            onPause={() => pausable ? void send(stop) : interact({ tag: "PauseSpeech" })} onResume={() => paused ? void send(resume) : interact({ tag: "ResumeSpeech" })}
            expanded={expanded} onExpandedChange={(larger) => interact({ tag: "Resize", expanded: larger })}
            onClose={() => { if (can({ type: "closeGrace" })) void send({ type: "closeGrace" }); }} />
        }
        dock={
          <GraceDock value={draft} maxLines={expanded ? 6 : 4} mic={conversation.voice || listeningLocally} listening={listeningLocally}
            quiet={(!device.reasoningAvailable && passwordDirection(draft) === "NoPasswordGuide") || conversation.turn === "Thinking"}
            micUnavailable={needsMicPermission ? "Allow the microphone to talk to Grace" : undefined}
            onFixMic={talk} fixMicLabel="Allow mic"
            onMicChange={(on) => { if (on && canTalk) talk(); else if (on) guide.listen(); else { guide.stopListening(); interact({ tag: "StopVoice" }); } }}
            onFieldFocus={(event) => { guide.stopListening(); fieldRef.current = event.currentTarget; interact({ tag: "TypeIntoChat" }); }}
            onValueChange={(text) => { setDraft(text); interact({ tag: "EditDraft", text }); }}
            onSend={() => {
              const revision = current().assistant.conversation.draftRevision;
              void guide.request(revision).then(async (guided) => {
                if (guided) { setDraft(""); return; }
                const sent = await say({ tag: "SendDraft", revision });
                if (sent && fieldRef.current?.isConnected && current().assistant.keyboard === "NoKeyboard") fieldRef.current.blur();
              });
            }} />
        }>
        <GraceMessages>
          {conversation.messages.map((message, index) =>
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the transcript only grows at its end
            message.author === "HumanMessage" ? <UserBubble key={index}>{message.text}</UserBubble> : <GraceBubble key={index}>{message.text}</GraceBubble>)}
          {!canTalk && guide.mic === "GuideMicUnavailable" && <PageText role="status">The microphone is unavailable. You can type your request.</PageText>}
          {!canTalk && guide.mic === "GuideMicNoMatch" && <PageText role="status">I couldn’t recognize that request. Try typing it.</PageText>}
          {currentOffer && currentOffer.labels.length > 0 && (
            <AnswerChips>{currentOffer.labels.map((label, index) =>
              <AnswerChip key={label} onClick={() => choose(currentOffer.id, index)}>{label}</AnswerChip>)}</AnswerChips>
          )}
          {(currentOffer?.blocked || unavailable === conversation.generation) &&
            <PageText role="status">Grace can’t complete that action here.</PageText>}
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
                      {index < next ? plan.receipts[index]?.evidence : guidedReadKind(step) === "ReachNamedPage" ? `Find and check “${step.subject}”.` : step.outcome}
                    </li>)}
                  </ol>
                </>
              ) : <p aria-current={currentStep ? "step" : undefined}>{stepKind === "SaveMailAppointment" && plan.savedOccurrence ? "Check the appointment saved to your calendar." : stepKind === "ReachNamedPage" ? `Find and check “${currentStep?.subject}”.` : currentStep?.outcome ?? plan.receipts.at(-1)?.evidence}</p>}
            </section>
          )}
          {feedback?.result && <GraceBubble role="status" aria-label={feedback.result.kind === "Menu" ? "Open submenu guidance" : feedback.result.kind === "Link" ? "Link guide result" : "Link unavailable"}>{feedback.result.words}</GraceBubble>}
          {namedCheck?.pending === false && (
            <GraceBubble role="status" aria-label="Page check result">I couldn’t verify “{currentStep?.subject}” on this page. Check the page again or try another link.</GraceBubble>
          )}
          {canCheck && <AnswerChips>
            {guideKey && <AnswerChip disabled={namedCheck?.pending || (feedback !== undefined && (feedback.result === undefined || feedback.result.kind === "Menu"))} onClick={showLink}>Show me the link</AnswerChip>}
            <AnswerChip disabled={namedCheck?.pending} onClick={check}>{label}</AnswerChip>
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
