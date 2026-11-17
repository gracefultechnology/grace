import type { ReactNode } from "react";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };
import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { CalendarApp, type CalendarAppProps } from "./CalendarApp.tsx";
import { meta as calendar } from "./CalendarApp.meta.tsx";
import { GraceWindow, type GraceWindowProps } from "./GraceWindow.tsx";
import { meta as grace } from "./GraceWindow.meta.tsx";
import { HomeScreen, type HomeScreenProps } from "./HomeScreen.tsx";
import { meta as home } from "./HomeScreen.meta.tsx";
import type { TextScaleProps } from "./TextScale.tsx";

const homeScreen = home.decorator?.(() => <HomeScreen {...(home.args as HomeScreenProps)} />) as ReactNode;

export const meta: ComponentMeta<TextScaleProps> = {
  args: { percent: 130, children: homeScreen },
  examples: {
    Smaller: { percent: 90 },
    Larger: { percent: 115 },
    "Grace, Largest": { children: grace.decorator?.(() => <GraceWindow {...(grace.args as GraceWindowProps)} />) as ReactNode },
    "Calendar, Largest": { children: calendar.decorator?.(() => <CalendarApp {...(calendar.args as CalendarAppProps)} />) as ReactNode },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const greeting = within(canvasElement).getByRole("heading", { name: /Good evening/ });
      const scaled = greeting.closest<HTMLElement>('[style*="--text-display-sm"]');
      await expect(scaled && getComputedStyle(scaled).getPropertyValue("--text-display-sm")).toBe(`calc(${tokens.text["display-sm"]} * 1.3)`);
    },
  },
};
