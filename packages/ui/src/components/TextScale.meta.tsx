import type { ReactNode } from "react";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };
import { expect, screen } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { CalendarApp, type CalendarAppProps } from "./CalendarApp.tsx";
import { meta as calendar } from "./CalendarApp.meta.tsx";
import { Dialog, DialogContent, DialogTitle } from "./Dialog.tsx";
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
    "Dialog, Largest": {
      children: (
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Delete Doctor’s appointment?</DialogTitle>
            <p className="text-body-lg text-muted-foreground">Saturday, November 14 at 10 am.</p>
          </DialogContent>
        </Dialog>
      ),
    },
  },
  play: {
    "Dialog, Largest": async () => {
      const title = await screen.findByRole("heading", { name: "Delete Doctor’s appointment?" });
      await expect(getComputedStyle(title.ownerDocument.documentElement).getPropertyValue("--text-title-lg")).toBe(`calc(${tokens.text["title-lg"]} * 1.3)`);
    },
  },
};
