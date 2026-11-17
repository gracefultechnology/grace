import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import type { SuggestionOfferProps } from "./SuggestionOffer.tsx";

const answers = (...words: string[]) => (
  <AnswerChips>
    {words.map((word) => (
      <AnswerChip key={word} onClick={fn()}>{word}</AnswerChip>
    ))}
  </AnswerChips>
);

export const meta: ComponentMeta<SuggestionOfferProps> = {
  args: {
    title: "Use your saved email?",
    detail: "From your saved details.",
    options: [{ id: "home", value: "margaret.s@example.com", tag: "Personal" }],
    onPick: fn(),
    answers: answers("I’ll type it"),
  },
  decorator: (story) => <div className="group/grace w-[1130px] bg-background p-6">{story()}</div>,
  examples: {
    Choice: {
      title: "Which phone number?",
      options: [
        { id: "mobile", value: "(555) 201-3344", tag: "Mobile" },
        { id: "home", value: "(555) 870-1122", tag: "Home" },
      ],
    },
    Address: { title: "Use your saved address?", options: [], block: "12 Elm Street\nSpringfield, IL 62704", answers: answers("Yes", "I’ll type it") },
    "Without title": { title: undefined, detail: undefined },
  },
};
