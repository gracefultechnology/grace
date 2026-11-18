import { expect, fn, userEvent, within } from "storybook/test";
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

const pick = fn();
const phones = [
  { id: "mobile", value: "(555) 201-3344", tag: "Mobile" },
  { id: "home", value: "(555) 870-1122", tag: "Home" },
];

export const meta: ComponentMeta<SuggestionOfferProps> = {
  args: {
    title: "Use your saved email?",
    detail: "From your saved details.",
    options: [{ id: "home", value: "margaret.s@example.com", tag: "Personal" }],
    onPick: pick,
    answers: answers("I’ll type it"),
  },
  decorator: (story) => <div className="group/grace w-[1130px] bg-background p-6">{story()}</div>,
  examples: {
    Choice: {
      title: "Which phone number?",
      options: phones,
    },
    Address: { title: "Use your saved address?", options: [], block: "12 Elm Street\nSpringfield, IL 62704", answers: answers("Yes", "I’ll type it") },
    "Time to choose": {
      title: "Which time works for you?",
      detail: undefined,
      optionsLabel: "Times",
      options: [
        { id: "fri", value: "Fri, Dec 4, 12:00 PM", detail: "You have lunch with Ruth then" },
        { id: "mon", value: "Mon, Dec 7, 2:00 PM", detail: "Your calendar is free" },
      ],
      answers: answers("Neither"),
    },
    "Without title": { title: undefined, detail: undefined },
  },
  play: {
    Choice: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      pick.mockClear();
      const choices = within(within(canvasElement).getByRole("group", { name: "Choices" }));
      await userEvent.click(choices.getByRole("button", { name: /870-1122/ }));
      await expect(pick.mock.calls).toEqual([[phones[1]]]);
    },
  },
};
