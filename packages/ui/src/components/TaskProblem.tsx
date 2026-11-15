import type { ReactNode } from "react";
import { Alert, type AlertProps } from "./Alert.tsx";

export type TaskProblemProps = Omit<AlertProps, "variant" | "children"> & {
  /** What stopped the task, in Grace's words: "The Gmail account connected now isn’t the one you confirmed." */
  text: string;
  /** What Grace asks next: "Shall we check which Gmail account is connected?" */
  question?: string;
  /** The answers, as `Button`s: the way forward first, then Pause or doing it herself. */
  actions?: ReactNode;
};

/**
 * Why a task Grace was doing has stopped, the question it leaves and the ways on (senior-care BillTaskPanel.tsx: a blocked
 * bill, such as the wrong account, sign-in unavailable or a payment the site does not allow, and CodeStepGmail), on the
 * caution notice.
 * @design packages/design-system/design.md#windows
 */
export function TaskProblem({ text, question, actions, ...props }: TaskProblemProps) {
  return (
    <Alert variant="caution" {...props}>
      <span className="flex flex-col gap-3">
        <span>{text}</span>
        {question && <span className="font-bold">{question}</span>}
        {actions ? <span className="flex flex-wrap gap-3">{actions}</span> : null}
      </span>
    </Alert>
  );
}
