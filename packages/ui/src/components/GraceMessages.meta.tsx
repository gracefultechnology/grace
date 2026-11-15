import type { ComponentMeta } from "vibestack/stories";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import { GraceBubble } from "./GraceBubble.tsx";
import type { GraceMessagesProps } from "./GraceMessages.tsx";
import { UserBubble } from "./UserBubble.tsx";

// Prototype: Grace greets Margaret, still speaking (ref grace-open).
export const greeting = (
  <GraceBubble activity="speaking" rest="What can I help with?">
    Hi Margaret.
  </GraceBubble>
);

// Prototype: Margaret asks about her Chase bill and Grace asks which amount, with two answers to tap.
export const conversation = (
  <>
    <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
    <UserBubble>Can you help me pay my Chase bill?</UserBubble>
    <GraceBubble>Of course. Would you like to pay the full balance or a different amount?</GraceBubble>
    <AnswerChips>
      <AnswerChip>Full balance</AnswerChip>
      <AnswerChip>A different amount</AnswerChip>
    </AnswerChips>
  </>
);

// Prototype: Margaret has sent her question and Grace is thinking.
export const thinking = (
  <>
    <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
    <UserBubble>Can you help me pay my Chase bill?</UserBubble>
    <GraceBubble activity="thinking" />
  </>
);

export const meta: ComponentMeta<GraceMessagesProps> = {
  args: { children: conversation },
  examples: { Greeting: { children: greeting }, Thinking: { children: thinking } },
  decorator: (story) => (
    <div className="group/grace flex h-[480px] w-[1130px] flex-col bg-background" data-surface="white" data-size="expanded">
      {story()}
    </div>
  ),
};
