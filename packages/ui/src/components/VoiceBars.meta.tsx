import type { ComponentMeta } from "vibestack/stories";
import type { VoiceBarsProps } from "./VoiceBars.tsx";

export const meta: ComponentMeta<VoiceBarsProps> = {
  examples: { Idle: { state: "idle" } },
  decorator: (story) => <div className="p-6">{story()}</div>,
};
