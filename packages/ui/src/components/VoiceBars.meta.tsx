import type { ComponentMeta } from "vibestack/stories";
import type { VoiceBarsProps } from "./VoiceBars.tsx";

export const meta: ComponentMeta<VoiceBarsProps> = {
  // Prototype `.eq.idle`: breathing in the answer field while Grace waits for Margaret.
  examples: { Idle: { state: "idle" } },
  decorator: (story) => <div className="p-6">{story()}</div>,
};
