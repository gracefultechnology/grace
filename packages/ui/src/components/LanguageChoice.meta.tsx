import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { LanguageChoiceProps } from "./LanguageChoice.tsx";

const languages = [
  { value: "English", label: "English", lang: "en" },
  { value: "Spanish", label: "Español", lang: "es" },
];

export const meta: ComponentMeta<LanguageChoiceProps> = {
  args: { languages, value: "English", onValueChange: fn() },
  decorator: (story) => <div className="w-[760px] bg-background p-6">{story()}</div>,
  examples: {
    Spanish: { value: "Spanish", title: "Idioma" },
  },
};
