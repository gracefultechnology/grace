import { TriangleAlert } from "lucide-react";
import { Alert, type AlertProps } from "./Alert.tsx";
import { Button } from "./Button.tsx";

export type RetryNoticeProps = Omit<AlertProps, "variant"> & {
  /** Called by Try again; without it the notice has no button. */
  onRetry?: () => void;
  /** The words of the retry button. */
  retryLabel?: string;
  /** The retry is under way: the button waits. */
  retrying?: boolean;
};

/**
 * What did not work, in the prototype's caution style, with Try again at its end; what it failed to change stays as it
 * was (prototype `.a-caution` with an `.a-btn`).
 * @design packages/design-system/design.md#windows
 */
export function RetryNotice({ onRetry, retryLabel = "Try again", retrying = false, children, ...props }: RetryNoticeProps) {
  return (
    // Prototype `.a-caution` with `axi('alert',26,2.2)`, as on Wi-Fi's join error.
    <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} {...props}>
      <span className="min-w-0 flex-1">{children}</span>
      {onRetry && (
        <Button variant="capsule" size="pill" className="h-13" loading={retrying} onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </Alert>
  );
}
