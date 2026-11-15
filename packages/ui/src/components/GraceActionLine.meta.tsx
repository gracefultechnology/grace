import type { ComponentMeta } from "vibestack/stories";
import type { GraceActionLineProps } from "./GraceActionLine.tsx";

// Prototype siteEvent(): Margaret tapped Sign in on Chase's page while Grace guided her.
export const meta: ComponentMeta<GraceActionLineProps> = {
  args: { children: "You tapped Sign in." },
  examples: { Chose: { children: "You chose $84.20." } },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
};
