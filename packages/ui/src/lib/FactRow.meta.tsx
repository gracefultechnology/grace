import type { ComponentMeta } from "vibestack/stories";
import { factList, type FactRow } from "./facts.tsx";

export const meta: ComponentMeta<Parameters<typeof FactRow>[0]> = {
  decorator: (story) => <dl className={factList}>{story()}</dl>,
};
