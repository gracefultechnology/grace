import type { ReactNode } from "react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { TaskProblem } from "./TaskProblem.tsx";

export type DeviceAppHandoffProps = Omit<AppWindowProps, "children"> & {
  /** What the tablet's own app is for: "Choose who to call in your phone app." */
  text: string;
  /** The button that opens it: "Open phone". */
  openLabel: string;
  onOpen?: () => void;
  /** While it opens. */
  busy?: boolean;
  /** What happened: "Phone app opened. Choose and confirm any call there." */
  notice?: ReactNode;
  /** It did not open: why, and what she can do. */
  error?: string;
  /** The line under the error: "You can try again or close this view and continue using Grace." */
  errorHelp?: string;
};

/**
 * An app Grace hands to the tablet's own, such as Phone or Messages (senior-care DeviceApplication.tsx): what it is for,
 * the button that opens it, and what happened. Grace never calls or sends a message herself.
 * @design packages/design-system/design.md#windows
 */
export function DeviceAppHandoff({ text, openLabel, onOpen, busy = false, notice, error, errorHelp, ...props }: DeviceAppHandoffProps) {
  return (
    <AppWindow {...props}>
      <div className="mx-auto flex w-[760px] max-w-full flex-col items-start gap-6 font-sans">
        <p className="m-0 text-body-lg leading-[30px] text-foreground">{text}</p>
        <Button variant="prominent" size="pill" loading={busy} onClick={onOpen}>
          {openLabel}
        </Button>
        {error && <TaskProblem text={error} question={errorHelp} />}
        <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground">
          {!error && notice}
        </div>
      </div>
    </AppWindow>
  );
}
