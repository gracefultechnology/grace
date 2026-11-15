import { ExternalLink, LogIn } from "lucide-react";
import { Button } from "./Button.tsx";
import { BrowserDialog } from "./BrowserNoticeDialog.tsx";
import { PageText } from "./PageHeading.tsx";

/** The words of the explanation. */
export type RefusedSignInLabels = {
  /** The title, given the provider: "Sign in with Google won’t work inside Grace". */
  title: (provider: string) => string;
  /** Why, given the provider and the website. */
  why: (provider: string, site: string) => string;
  continue: string;
  cancel: string;
};

export type RefusedSignInDialogProps = {
  /** Who the website's sign-in button signs in with: "Google", "Facebook". */
  provider: string;
  /** The website the person is signing in to. */
  site: string;
  /** Called by "Continue in the phone’s browser". */
  onContinue: () => void;
  /** Called by Cancel and Escape: the person stays on the website. */
  onCancel: () => void;
  /** The explanation is showing; it waits on its own tab. */
  open?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<RefusedSignInLabels>;
  className?: string;
};

const defaultLabels: RefusedSignInLabels = {
  title: (provider) => `Sign in with ${provider} won’t work inside Grace`,
  why: (provider, site) => `${provider} only lets you sign in to ${site} from the phone’s own browser.`,
  continue: "Continue in the phone’s browser",
  cancel: "Cancel",
};

/**
 * Explains a "Sign in with Google" (or Facebook) that refuses to run inside Grace, with the choice to continue
 * in the phone's browser or stay on the website.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function RefusedSignInDialog({ provider, site, onContinue, onCancel, open = true, labels: words, className }: RefusedSignInDialogProps) {
  const labels = { ...defaultLabels, ...words };
  return (
    <BrowserDialog
      open={open}
      title={labels.title(provider)}
      icon={<LogIn size={28} strokeWidth={2.2} />}
      onEscape={onCancel}
      className={className}
      actions={
        <>
          {/* spec/app/websiteRequests.md, "A refused sign-in is explained with the option to continue in the phone's browser". */}
          <Button variant="prominent" size="pill" onClick={onContinue}>
            <ExternalLink size={22} strokeWidth={2.2} aria-hidden />
            {labels.continue}
          </Button>
          <Button variant="capsule" size="pill" onClick={onCancel}>{labels.cancel}</Button>
        </>
      }
    >
      <PageText className="mt-3.5">{labels.why(provider, site)}</PageText>
    </BrowserDialog>
  );
}
