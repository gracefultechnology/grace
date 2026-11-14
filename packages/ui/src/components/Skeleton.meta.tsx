import type { ComponentMeta } from "vibestack/stories";
import type { SkeletonProps } from "./Skeleton.tsx";

export const meta: ComponentMeta<SkeletonProps> = {
  decorator: (story) => <div className="w-[840px] bg-background p-6">{story()}</div>,
};
