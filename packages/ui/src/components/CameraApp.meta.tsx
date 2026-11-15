import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onTablet } from "./CalendarApp.meta.tsx";
import type { CameraAppProps } from "./CameraApp.tsx";

export const meta: ComponentMeta<CameraAppProps> = {
  args: { state: "live", zooms: [1, 2], zoom: 1, flash: false, onZoom: fn(), onFlash: fn(), onTake: fn(), onFlip: fn(), onOpenPhotos: fn(), onRetry: fn(), onClose: fn() },
  decorator: onTablet,
  examples: {
    Starting: { state: "starting" },
    Refused: { state: "refused", problem: "Camera access is turned off for Grace in Settings." },
    Failed: { state: "failed", problem: "The camera is being used by another app." },
    Unavailable: { state: "unavailable", problem: "This tablet has no camera." },
    "Flash on": { flash: true, zoom: 2 },
  },
};
