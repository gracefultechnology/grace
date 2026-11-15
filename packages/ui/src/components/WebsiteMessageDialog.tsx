import { useId, useState } from "react";
import { LogOut, MessageSquareText } from "lucide-react";
import { Button } from "./Button.tsx";
import { BrowserDialog } from "./BrowserNoticeDialog.tsx";
import { PageText } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";
import { TextField } from "./TextField.tsx";

/** The website's kind of message: `alert` (OK), `confirm` (Cancel / OK), `prompt` (typed text) or `beforeunload` (leave the page?). */
export type WebsiteMessageKind = "alert" | "confirm" | "prompt" | "beforeunload";

/** The words of the dialog around the website's own. */
export type WebsiteMessageLabels = {
  /** The title, given the site: "chase.com says". */
  says: (site: string) => string;
  /** The title of a leave-page warning. */
  leaveTitle: string;
  /** The line that keeps the website's words apart from Grace's. */
  fromWebsite: string;
  /** The name of a prompt's text field. */
  answer: string;
  ok: string;
  cancel: string;
  stay: string;
  leave: string;
};

export type WebsiteMessageDialogProps = {
  kind: WebsiteMessageKind;
  /** The website, as the address shows it. */
  site: string;
  /** What the website wrote; shown as the website's, never as Grace's. */
  message: string;
  /** A prompt's starting text, as the website gave it. */
  defaultText?: string;
  /** Called once with the person's answer: OK or Leave is `true`, Cancel, Stay or Escape `false`, and a prompt's text with OK. */
  onAnswer: (accept: boolean, text?: string) => void;
  /** The message is showing. */
  open?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<WebsiteMessageLabels>;
  className?: string;
};

const defaultLabels: WebsiteMessageLabels = {
  says: (site) => `${site} says`,
  leaveTitle: "Leave this page?",
  fromWebsite: "This message is from the website, not from Grace.",
  answer: "Your answer",
  ok: "OK",
  cancel: "Cancel",
  stay: "Stay on this page",
  leave: "Leave",
};

/**
 * A website's own message over its paused page: its words quoted on a panel, apart from Grace's voice, and
 * answered once with OK, Cancel, typed text, or Stay / Leave. Escape is Cancel (OK for an alert, its only answer).
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function WebsiteMessageDialog({ kind, site, message, defaultText = "", onAnswer, open = true, labels: words, className }: WebsiteMessageDialogProps) {
  const labels = { ...defaultLabels, ...words };
  const [text, setText] = useState(defaultText);
  const quoteId = useId();
  const leaving = kind === "beforeunload";
  // spec/app/websiteRequests.md, "A website message is answered once with OK, Cancel or typed text".
  const answer = (accept: boolean) => onAnswer(accept, kind === "prompt" && accept ? text : undefined);
  return (
    <BrowserDialog
      open={open}
      title={leaving ? labels.leaveTitle : labels.says(site)}
      icon={leaving ? <LogOut size={28} strokeWidth={2} /> : <MessageSquareText size={28} strokeWidth={2} />}
      onEscape={() => answer(kind === "alert")}
      className={className}
      actions={
        leaving ? (
          <>
            <Button variant="prominent" size="pill" onClick={() => answer(false)}>{labels.stay}</Button>
            <Button variant="capsule" size="pill" onClick={() => answer(true)}>{labels.leave}</Button>
          </>
        ) : (
          <>
            <Button variant="prominent" size="pill" onClick={() => answer(true)}>{labels.ok}</Button>
            {kind !== "alert" && <Button variant="capsule" size="pill" onClick={() => answer(false)}>{labels.cancel}</Button>}
          </>
        )
      }
    >
      {/* The website's words, quoted on a panel: never in Grace's voice. */}
      <Panel id={quoteId} className="mt-3.5 px-5 py-4">
        <blockquote className="m-0 text-body-lg leading-[30px] break-words whitespace-pre-line text-foreground before:content-['“'] after:content-['”']">
          {message}
        </blockquote>
      </Panel>
      <PageText tone="secondary" className="mt-3.5">{labels.fromWebsite}</PageText>
      {kind === "prompt" && (
        <TextField
          label={labels.answer}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") answer(true);
          }}
          aria-describedby={quoteId}
          className="mt-3.5"
        />
      )}
    </BrowserDialog>
  );
}
