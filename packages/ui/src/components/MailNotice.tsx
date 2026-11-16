import type { ComponentProps, ReactNode } from "react";
import { Wifi } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { appButton, appProminent } from "./MailActionStatus.tsx";
import { WifiSlash } from "./Rail.tsx";

export type MailNoticeProps = Omit<ComponentProps<"div">, "children"> & {
  /** `caution` something failed and can be tried again (prototype `.a-caution`); `offline` Email is waiting for the internet. */
  tone?: "caution" | "offline";
  /** What happened, in a sentence. */
  children: ReactNode;
  /** The words on its one action: "Try again", "Reconnect", "Fix Wi-Fi"; without them there is no button. */
  actionLabel?: string;
  /** Called by the action. */
  onAction?: () => void;
};

/**
 * A line across the top of an Email page about what could not be done, with the one action that fixes it: a caution
 * with Try again, or, offline, the Wi-Fi struck through with Fix Wi-Fi (the prototype's offline `.lwait` and banner).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailNotice({ tone = "caution", children, actionLabel, onAction, className, ...props }: MailNoticeProps) {
  const offline = tone === "offline";
  const action = actionLabel && (
    <Button variant={offline ? "prominent" : "capsule"} size="compact" className={cn("ml-auto", offline ? appProminent : cn(appButton, "text-grace-ink"))} onClick={onAction}>
      {offline && <Wifi size={22} strokeWidth={2.2} aria-hidden />}
      {actionLabel}
    </Button>
  );
  if (!offline)
    return (
      <Alert variant="caution" className={cn(action && "py-3", className)} {...props}>
        <span className="min-w-0">{children}</span>
        {action}
      </Alert>
    );
  return (
    <div role="status" className={cn("flex items-center gap-3.5 rounded-row bg-card/88 px-5 text-body-lg leading-7 font-medium text-foreground shadow-panel", action ? "py-3" : "py-[18px]", className)} {...props}>
      <WifiSlash size={26} className="flex-none" />
      <span className="min-w-0">{children}</span>
      {action}
    </div>
  );
}
