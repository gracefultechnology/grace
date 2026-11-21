// spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"; spec/app/conversation.md, "Story: Talk or type without losing the conversation"; spec/app/workspace.md, "Story: Follow one reviewed plan across apps"
// Grace's window: compact at the bottom, over the page when one shows, or expanded over everything
// right of the rail. The workspace owns the composer and its active turn.
import { AnswerChip, AnswerChips, besideRail, cn, GraceBubble, GraceDock, GraceHeader, GraceMessages, GraceWindow, PageText, UserBubble } from "@repo/ui";
import { Effect, Stream } from "effect";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { ReplyControls, replyOfferIsVisible } from "./replyControls.vibe";
import { currentGuidedNameCorrection, guidedDetails, hasNext, localPasswordCommands, mayGuideReadLink, nextOutcome, priorGuidedMail, type GuidedStep } from "../gen/app__workspace.ts";
import type { Interaction } from "../gen/app__interaction.ts";
import type { BrowserGuidance } from "./browserGuide.vibe";
import { OverPage } from "./PageLayer.tsx";
import { passwordDirection } from "./passwords.vibe";
import { VoiceNoticeDialog } from "./VoiceNoticeDialog.tsx";
import { mayOfferTalk, SpeechActions, type VoiceNotice } from "./graceSpeech.vibe";
import { useDraft, useKeyboardHeight, usePasswordGuide, useRuntime, useWorkspace } from "./useApp.ts";

import { useMachine as useSetup } from "../gen/app__setup.react.ts";
import { privateFormRecovery } from "./nativePage.vibe";
import { guidedAuthority, guidedOwner } from "./managedReads.vibe";

const replyOffers = Stream.unwrap(Effect.map(ReplyControls, (controls) => controls.state));

function keyedSteps(steps: readonly GuidedStep[]) {
  const occurrences = new Map<string, number>();
  return steps.map((step) => {
    const content = JSON.stringify(step);
    const occurrence = occurrences.get(content) ?? 0;
    occurrences.set(content, occurrence + 1);
    return { step, key: `${content}:${occurrence}` };
  });
}

const checkLabels: Record<GuidedStep["tag"], string> = {
  ReadMail: "Check email",
  ReadBrowser: "Check page",
  ReadChangedBrowser: "Check page",
  ReachNamedPage: "Check page",
  ReadStatement: "Read statement",
  ReadCalendar: "Check appointment",
  SaveMailAppointment: "Check saved appointment",
  SurfaceOutcome: "",
};

const pageRetry = "I couldn’t verify this page. Open the page for this step and try again.";
const checkRetries: Partial<Record<GuidedStep["tag"], string>> = {
  ReadMail: "Open an email you haven’t checked in this task and try again.",
  ReadCalendar: "Open an appointment you haven’t checked in this task and try again.",
  SaveMailAppointment: "I couldn’t verify the saved appointment. Open it on your calendar and try again.",
  ReadStatement: "Open the current statement with the amount due and due date, then try again.",
};

/** @model spec/app/assistant.md */

export function Grace({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { workspace, can, send, say, current, checkGuidedRead, pointAtReadLink, confirmGuidedName, startReadReview, resumeReadPlan } = useWorkspace();
  const guide = usePasswordGuide();
  const runtime = useRuntime();
  const { assistant, plan, review, device, browser } = workspace!;
  const conversation = assistant.conversation;
  const [voiceNotice, setVoiceNotice] = useState<VoiceNotice>();
  const authority = guidedAuthority(useSetup(runtime).state, window.location.hash);
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
  const localCommands = localPasswordCommands(device);
  const [draft, setDraft] = useDraft(conversation.draft, assistant.keyboard === "ChatKeyboard");
  const [guidedCheck, setGuidedCheck] = useState<{ key: string; phase: "checking" | "retry" | "privateForm" }>();
  const [linkFeedback, setLinkFeedback] = useState<{ key: string; attempt: symbol; result?: BrowserGuidance }>();
  // Prototype `layout()`: the window sits on the keyboard.
  const keyboard = useKeyboardHeight();
  if (assistant.presentation === "Closed") return null;
  const expanded = assistant.presentation === "Expanded";
  const canTalk = mayOfferTalk(workspace!);
  const talk = (acknowledged?: VoiceNotice) => {
    if (acknowledged) setVoiceNotice(undefined);
    runtime.runFork(Effect.flatMap(SpeechActions, (speech) =>
      Effect.tap(speech.talk(acknowledged), (notice) => Effect.sync(() => setVoiceNotice(notice)))));
  };
  const needsMicPermission = canTalk && !device.microphoneAllowed;
  const answerEvent = (text: string): Interaction => ({ tag: "ChooseAnswer", token: conversation.generation, text });
  const answers = conversation.answers.filter((text) => can({ type: "interact", input: answerEvent(text) }));
  const interact = (input: Interaction) => { if (can({ type: "interact", input })) void send({ type: "interact", input }); };
  const start = { type: "startReadReview", reviewRevision: review.revision } as const;
  const showReview = can(start) && review.request.owner === guidedOwner(authority, review.request.steps);
  const next = plan.receipts.length;
  const currentStep = hasNext(plan) ? nextOutcome(plan) : undefined;
  const hasPlan = plan.steps.length > 0;
  const owner = guidedOwner(authority, plan.steps);
  const ownsPlan = plan.owner === owner;
  const abandon = { type: "abandonTask" } as const;
  const savePlan = plan.steps.some((step) => step.tag === "SaveMailAppointment");
  const status = assistant.activity === "Paused" ? "Paused" : assistant.outcome === "Completed"
    ? savePlan ? "Planned checks complete" : "Read checks complete"
    : null;
  const stop = { type: "stop" } as const;
  const resume = { type: "resume" } as const;
  const paused = hasPlan && ownsPlan && can(resume);
  const pausable = hasPlan && ownsPlan && assistant.activity !== "Paused" && can(stop);
  const stepKind = currentStep?.tag ?? "SurfaceOutcome";
  const details = currentStep && guidedDetails(currentStep);
  const recoveredSave = stepKind === "SaveMailAppointment" && plan.saveRecovery.tag === "GuidedSaveReconcile" ? plan.saveRecovery : undefined;
  const reopenMail = stepKind === "SaveMailAppointment" && !recoveredSave && !plan.mail.ref && priorGuidedMail(plan).digest !== "";
  const checkSurface = reopenMail ? "Email" : details?.surface;
  const label = reopenMail ? "Check original email" : stepKind === "SaveMailAppointment" && !plan.savedOccurrence && !recoveredSave?.occurrence ? "" : checkLabels[stepKind];
  const calendar = { type: "visit", destination: "Calendar" } as const;
  const recoveryInstruction = recoveredSave ? recoveredSave.occurrence
    ? "Open the saved appointment in Calendar to check it."
    : "The save was interrupted. Check your calendar before asking to save this appointment again."
    : reopenMail ? "Reopen the original email and check it before reviewing the appointment." : undefined;
  const canCheck = ownsPlan && label && (checkSurface !== "Browser" || workspace?.device.observationAllowed) &&
    checkSurface === workspace?.device.surface &&
    (assistant.activity === "ReadyForStep" || assistant.activity === "Rechecking") && assistant.replacementId === "" &&
    conversation.turn === "Ready" && !conversation.question;
  const observation = workspace && {
    type: "setBrowserObservation", choice: {
      allowed: !workspace.device.observationAllowed,
      deviceVersion: workspace.device.contextVersion, browserRevision: workspace.browser.revision,
    },
  } as const;
  const scopeKey = JSON.stringify([owner, assistant.taskId, assistant.workVersion, conversation.generation, next, device.contextVersion, browser.revision]);
  const guideKey = ownsPlan && workspace && mayGuideReadLink(workspace) ? scopeKey : "";
  const checking = canCheck && guidedCheck?.key === scopeKey ? guidedCheck : undefined;
  const check = () => {
    const attempt = { key: scopeKey, phase: "checking" } as const;
    setGuidedCheck(attempt);
    const report = (accepted: boolean | "PrivateForm") => setGuidedCheck((current) =>
      current === attempt ? (accepted === true ? undefined : { key: scopeKey, phase: accepted === "PrivateForm" ? "privateForm" : "retry" }) : current);
    void checkGuidedRead().then(report, () => report(false));
  };
  const checkRecovery = checking?.phase === "privateForm" ? privateFormRecovery : reopenMail ? "Open the same email you checked for this task and try again." : stepKind === "ReachNamedPage"
    ? `I couldn’t verify “${details?.subject}” on this page. Check the page again or try another link.`
    : checkRetries[stepKind] ?? pageRetry;
  const feedback = guideKey && linkFeedback?.key === guideKey ? linkFeedback : undefined;
  const alternateHref = feedback?.result && "alternateHref" in feedback.result ? feedback.result.alternateHref : undefined;
  const nameOffer = workspace && alternateHref ? currentGuidedNameCorrection(workspace) : undefined;
  const correction = nameOffer?.tag === "PendingGuidedNameCorrection" && alternateHref === nameOffer.value.href ? nameOffer.value : undefined;
  const chooseSiteName = () => {
    if (!correction) return;
    const refused = () => setLinkFeedback((current) => current === feedback
      ? { key: guideKey, attempt: Symbol(), result: { kind: "Unavailable", words: "The page or task changed. Ask me again on the page you want." } } : current);
    void confirmGuidedName(correction).then((accepted) => { if (!accepted) refused(); }, refused);
  };
  const showLink = () => {
    const attempt = Symbol();
    setLinkFeedback({ key: guideKey, attempt });
    const report = (result: BrowserGuidance) => setLinkFeedback((current) => current?.attempt === attempt ? { ...current, result } : current);
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
            onPause={() => pausable ? void send(stop) : interact({ tag: "PauseSpeech" })} onResume={() => paused ? void resumeReadPlan() : interact({ tag: "ResumeSpeech" })}
            expanded={expanded} onExpandedChange={(larger) => interact({ tag: "Resize", expanded: larger })}
            onClose={() => { if (can({ type: "closeGrace" })) void send({ type: "closeGrace" }); }} />
        }
        dock={
          <GraceDock value={draft} placeholder={localCommands ? "Type a Passwords command" : undefined} maxLines={expanded ? 6 : 4} mic={conversation.voice}
            quiet={((localCommands || !device.reasoningAvailable) && passwordDirection(draft) === "NoPasswordGuide") || conversation.turn === "Thinking"}
            micUnavailable={!canTalk ? (localCommands ? "Type a Passwords command" : "Type your request") : needsMicPermission ? "Allow the microphone to talk to Grace" : undefined}
            onFixMic={needsMicPermission ? () => talk() : undefined} fixMicLabel={needsMicPermission ? "Allow mic" : undefined}
            onMicChange={(on) => { if (on && canTalk) talk(); else if (!on) interact({ tag: "StopVoice" }); }}
            onFieldFocus={(event) => { fieldRef.current = event.currentTarget; interact({ tag: "TypeIntoChat" }); }}
            onValueChange={(text) => { setDraft(text); interact({ tag: "EditDraft", text }); }}
            onSend={() => {
              const state = current();
              const revision = state.assistant.conversation.draftRevision;
              void guide.request(revision).then(async (guided) => {
                if (guided) { setDraft(""); return; }
                if (localPasswordCommands(state.device)) return;
                const sent = await say({ tag: "SendDraft", revision });
                if (sent && fieldRef.current?.isConnected && current().assistant.keyboard === "NoKeyboard") fieldRef.current.blur();
              });
            }} />
        }>
        <GraceMessages>
          {conversation.messages.map((message, index) =>
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the transcript only grows at its end
            message.author === "HumanMessage" ? <UserBubble key={index}>{message.text}</UserBubble> : <GraceBubble key={index}>{message.text}</GraceBubble>)}
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
                {keyedSteps(review.request.steps).map(({ step, key }) => <li key={key}>{guidedDetails(step).subject}</li>)}
              </ol>
              <AnswerChips><AnswerChip onClick={() => void startReadReview(review.revision)}>Start read plan</AnswerChip></AnswerChips>
            </section>
          )}
          {hasPlan && !ownsPlan && can(abandon) && (
            <AnswerChips><AnswerChip onClick={() => void send(abandon)}>End previous task</AnswerChip></AnswerChips>
          )}
          {hasPlan && ownsPlan && (
            <section aria-label="Task plan" className="flex flex-col gap-2 rounded-window bg-bubble px-5 py-2.5 text-grace-ink">
              {status && <p className="text-body font-medium">{status}</p>}
              {expanded ? (
                <>
                  <blockquote className="text-body">{plan.originalAsk}</blockquote>
                  <ol className="flex flex-col gap-2">
                    {keyedSteps(plan.steps).map(({ step, key }, index) => {
                      const displayed = index === next && currentStep ? currentStep : step;
                      return <li key={key} aria-current={index === next ? "step" : undefined}>
                        {index < next ? plan.receipts[index]?.evidence : index === next && recoveryInstruction ? recoveryInstruction : displayed.tag === "ReachNamedPage" ? `Find and check “${displayed.subject}”.` : guidedDetails(displayed).outcome}
                      </li>;
                    })}
                  </ol>
                </>
              ) : <p aria-current={currentStep ? "step" : undefined}>{recoveryInstruction ?? (stepKind === "SaveMailAppointment" && plan.savedOccurrence ? "Check the appointment saved to your calendar." : stepKind === "ReachNamedPage" ? `Find and check “${details?.subject}”.` : details?.outcome ?? plan.receipts.at(-1)?.evidence)}</p>}
              {recoveredSave && <AnswerChips>
                {device.surface !== "Calendar" && can(calendar) && <AnswerChip onClick={() => void send(calendar)}>Open Calendar</AnswerChip>}
                {can(abandon) && <AnswerChip onClick={() => void send(abandon)}>End this task</AnswerChip>}
              </AnswerChips>}
            </section>
          )}
          {feedback?.result && <GraceBubble role="status" aria-label={feedback.result.kind === "Menu" ? "Open submenu guidance" : feedback.result.kind === "Link" ? "Link guide result" : "Link unavailable"}>{feedback.result.words}</GraceBubble>}
          {(checking?.phase === "retry" || checking?.phase === "privateForm") && (
            <GraceBubble role="status" aria-label={details?.surface === "Browser" ? "Page check result" : "Task check result"}>{checkRecovery}</GraceBubble>
          )}
          {localCommands && guide.mic === "GuideMicUnavailable" && <PageText role="status">Cloud speech is unavailable. You can type a Passwords command.</PageText>}
          {localCommands && guide.mic === "GuideMicNoMatch" && <PageText role="status">I couldn’t recognize that Passwords command. Try typing it.</PageText>}
          {canCheck && <AnswerChips>
            {correction && <AnswerChip className="mr-0 h-auto min-h-13 max-w-full shrink whitespace-normal wrap-anywhere" onClick={chooseSiteName}>Use “{correction.label}” for this step</AnswerChip>}
            {guideKey && <AnswerChip disabled={checking?.phase === "checking" || (feedback !== undefined && (feedback.result === undefined || feedback.result.kind === "Menu"))} onClick={showLink}>Show me the link</AnswerChip>}
            <AnswerChip disabled={checking?.phase === "checking"} onClick={check}>{label}</AnswerChip>
          </AnswerChips>}
          {answers.length > 0 && (
            <AnswerChips>
              {answers.map((text) => <AnswerChip key={text} onClick={() => void say({ tag: "ChooseAnswer", token: conversation.generation, text })}>{text}</AnswerChip>)}
            </AnswerChips>
          )}
        </GraceMessages>
      </GraceWindow>
      <VoiceNoticeDialog notice={voiceNotice} continueWith={talk} cancel={() => setVoiceNotice(undefined)} />
    </OverPage>
  );
}
