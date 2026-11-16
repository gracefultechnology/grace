import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import { GraceActionLine } from "./GraceActionLine.tsx";
import { GraceBubble } from "./GraceBubble.tsx";
import type { GraceMessagesProps } from "./GraceMessages.tsx";
import { UserBubble } from "./UserBubble.tsx";

export const greeting = (
  <GraceBubble activity="speaking" rest="What can I help with?">
    Hi Margaret.
  </GraceBubble>
);

export const conversation = (
  <>
    <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
    <UserBubble>Can you help me pay my Chase bill?</UserBubble>
    <GraceBubble>I'll open Chase's website. Would you like to watch me do it?</GraceBubble>
    <AnswerChips>
      <AnswerChip>Yes, show me</AnswerChip>
      <AnswerChip>No, go ahead</AnswerChip>
    </AnswerChips>
  </>
);

export const thinking = (
  <>
    <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
    <UserBubble>Can you help me pay my Chase bill?</UserBubble>
    <GraceBubble activity="thinking" />
  </>
);

export const action = (
  <>
    <UserBubble>Can you help me pay my Chase bill?</UserBubble>
    <GraceBubble>Sure. Tap Sign in.</GraceBubble>
    <GraceActionLine>You tapped Sign in.</GraceActionLine>
    <GraceBubble>Good. Now tap Pay card.</GraceBubble>
  </>
);

const jump = fn();

export const meta: ComponentMeta<GraceMessagesProps> = {
  args: { children: conversation },
  examples: {
    Greeting: { children: greeting },
    Thinking: { children: thinking },
    "Margaret acted": { children: action },
    "Reading earlier": { children: conversation, following: false, hasNewer: true, onJumpToLatest: jump },
  },
  decorator: (story) => (
    <div className="group/grace flex h-[480px] w-[1130px] flex-col bg-background" data-surface="white" data-size="expanded">
      {story()}
    </div>
  ),
  play: {
    "Reading earlier": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      jump.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Newest message" }));
      await expect(jump).toHaveBeenCalled();
    },
  },
};
