import type { ComponentMeta } from "vibestack/stories";
import type { HomeWaitingProps } from "./HomeWaiting.tsx";

export const meta: ComponentMeta<HomeWaitingProps> = {
  // Prototype `.lwait` on the Email card while offline.
  args: { message: "New email will arrive when you’re back online." },
  decorator: (story) => <div className="w-[470px] bg-gradient-frame-soft p-6">{story()}</div>,
};
