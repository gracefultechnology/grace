import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { appButton } from "./MailActionStatus.tsx";

export type MailNoticeProps = Omit<ComponentProps<"div">, "children"> & {
  /** What happened, in a sentence. */
  children: ReactNode;
  /** The words on its one action: "Try again", "Reconnect"; without them there is no button. */
  actionLabel?: string;
  /** Called by the action. */
  onAction?: () => void;
};

/**
 * A caution across the top of an Email page about what could not be done, with the one action that fixes it
 * (prototype `.a-caution`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailNotice({ children, actionLabel, onAction, className, ...props }: MailNoticeProps) {
  return (
    <Alert variant="caution" className={cn(actionLabel && "py-3", className)} {...props}>
      <span className="min-w-0">{children}</span>
      {actionLabel && (
        <Button variant="capsule" size="compact" className={cn("ml-auto", appButton, "text-grace-ink")} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Alert>
  );
}
