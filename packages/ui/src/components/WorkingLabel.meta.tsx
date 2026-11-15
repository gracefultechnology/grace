import type { ComponentMeta } from "vibestack/stories";
import { GuideRing } from "./GuideRing.tsx";
import { TabletScreen } from "./TabletScreen.tsx";
import type { WorkingLabelProps } from "./WorkingLabel.tsx";

// The prototype's Chase payment form: Grace types the payment date (`showWork`), her ring held still around the field.
const field = { x: 208, y: 530, width: 472, height: 46 };

export const meta: ComponentMeta<WorkingLabelProps> = {
  args: { text: "Grace is typing", className: "absolute left-[702px] bottom-[225px]" },
  examples: {
    // `.glab.wl.below`: no room beside the field, so under it, 36px in.
    "Placement below": { placement: "below", className: "absolute left-[244px] top-[594px]" },
  },
  decorator: (story) => (
    <TabletScreen>
      <div className="absolute rounded-md bg-card shadow-panel" style={{ left: 185, top: 235, width: 518, height: 430 }} />
      <div className="absolute flex items-center rounded-sm bg-card px-3 text-lg text-muted-foreground ring-1 ring-border" style={{ left: field.x, top: field.y, width: field.width, height: field.height }}>MM/DD/YYYY</div>
      <GuideRing rect={field} gap={6} tight motion="still" />
      {story()}
    </TabletScreen>
  ),
};
