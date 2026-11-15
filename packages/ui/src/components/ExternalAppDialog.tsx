import type { ReactNode } from "react";
import { ExternalLink, Mail, MapPin, MessageSquare, Phone, ShoppingBag } from "lucide-react";
import { Button } from "./Button.tsx";
import { BrowserDialog } from "./BrowserNoticeDialog.tsx";
import { PageText } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";

/** What a tapped link would do in another app: `tel:`, `mailto:`, `sms:`, `geo:`, `market:`, or another app's `intent:`. */
export type ExternalAppKind = "call" | "email" | "message" | "map" | "store" | "other";

/** The words of the question. */
export type ExternalAppLabels = {
  /** The question, given the kind and target: "Call 555-0100?". */
  title: (kind: ExternalAppKind, target: string) => string;
  /** The title when the link can never open on this tablet. */
  cannotTitle: string;
  /** Why, for a link that can never open. */
  cannotMessage: string;
  continue: string;
  cancel: string;
  close: string;
};

export type ExternalAppDialogProps = {
  kind: ExternalAppKind;
  /** What the link names: a phone number, an email address, a place or an app. */
  target: string;
  /** Some app on the tablet can open it; when not, only Close is offered. */
  canOpen: boolean;
  /** Called by Continue: the person's confirmation to open the other app. */
  onContinue?: () => void;
  /** Called by Cancel, Close and Escape: the person stays on the page. */
  onCancel: () => void;
  /** The question is showing. */
  open?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<ExternalAppLabels>;
  className?: string;
};

const questions: Record<ExternalAppKind, (target: string) => string> = {
  call: (target) => `Call ${target}?`,
  email: (target) => `Write an email to ${target}?`,
  message: (target) => `Send a text to ${target}?`,
  map: () => "Open Maps for this place?",
  store: () => "Open the Play Store?",
  other: () => "Open another app?",
};

const defaultLabels: ExternalAppLabels = {
  title: (kind, target) => questions[kind](target),
  cannotTitle: "This link can’t open on this tablet",
  cannotMessage: "Nothing was opened. You can stay on this page.",
  continue: "Continue",
  cancel: "Cancel",
  close: "Close",
};

const icons: Record<ExternalAppKind, ReactNode> = {
  call: <Phone size={28} strokeWidth={2.2} />,
  email: <Mail size={28} strokeWidth={2.2} />,
  message: <MessageSquare size={28} strokeWidth={2.2} />,
  map: <MapPin size={28} strokeWidth={2.2} />,
  store: <ShoppingBag size={28} strokeWidth={2.2} />,
  other: <ExternalLink size={28} strokeWidth={2.2} />,
};

// The question names the target; these kinds show it below instead.
const shown: ExternalAppKind[] = ["map", "store", "other"];

/**
 * Asks before a tapped phone, email, text, map or store link opens another app: Continue or Cancel. A link no
 * app can open is explained, with Close only.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function ExternalAppDialog({ kind, target, canOpen, onContinue, onCancel, open = true, labels: words, className }: ExternalAppDialogProps) {
  const labels = { ...defaultLabels, ...words };
  // spec/app/websiteRequests.md, "Another app opens only after my tap and my confirmation": a link that can never open gets no Continue.
  if (!canOpen)
    return (
      <BrowserDialog
        open={open}
        title={labels.cannotTitle}
        tone="caution"
        icon={icons[kind]}
        onEscape={onCancel}
        className={className}
        actions={<Button variant="prominent" size="pill" onClick={onCancel}>{labels.close}</Button>}
      >
        <PageText className="mt-3.5">{labels.cannotMessage}</PageText>
      </BrowserDialog>
    );
  return (
    <BrowserDialog
      open={open}
      title={labels.title(kind, target)}
      icon={icons[kind]}
      onEscape={onCancel}
      className={className}
      actions={
        <>
          <Button variant="prominent" size="pill" onClick={onContinue}>{labels.continue}</Button>
          <Button variant="capsule" size="pill" onClick={onCancel}>{labels.cancel}</Button>
        </>
      }
    >
      {shown.includes(kind) && (
        <Panel className="mt-3.5 px-5 py-4">
          <p className="m-0 text-body-lg leading-[30px] font-bold break-words text-chrome">{target}</p>
        </Panel>
      )}
    </BrowserDialog>
  );
}
