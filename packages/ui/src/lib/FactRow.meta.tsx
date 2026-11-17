import type { ComponentMeta } from "vibestack/stories";
import { factList, type FactRowProps } from "./facts.tsx";

export const meta: ComponentMeta<FactRowProps> = {
  args: { label: "Amount", children: "$84.20" },
  decorator: (story) => <dl className={factList}>{story()}</dl>,
};
