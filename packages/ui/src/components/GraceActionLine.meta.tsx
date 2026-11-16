import type { ComponentMeta } from "vibestack/stories";
import type { GraceActionLineProps } from "./GraceActionLine.tsx";

export const meta: ComponentMeta<GraceActionLineProps> = {
  args: { children: "You tapped Sign in." },
  examples: {
    Chose: { children: "You chose $84.20." },
    Record: { tone: "record", children: "Grace opened City Water’s website." },
    Result: { tone: "result", children: "Paid $84.20 to City Water." },
    Problem: { tone: "problem", children: "The website stopped answering." },
    Transient: { tone: "record", transient: true, children: "Checking the website…" },
  },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
};
