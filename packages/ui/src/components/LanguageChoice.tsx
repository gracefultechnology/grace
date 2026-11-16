import { useId, type ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { PageHeading } from "./PageHeading.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

export interface LanguageOption {
  value: string;
  label: string;
  lang: string;
}

export type LanguageChoiceProps = Omit<ComponentProps<"section">, "onChange"> & {
  /** The heading: "Language". */
  title?: string;
  /** The languages to choose from. */
  languages: LanguageOption[];
  /** The chosen language's `value`. */
  value: string;
  /** Called with the chosen language's `value`. */
  onValueChange?: (value: string) => void;
};

/**
 * The language Grace speaks and shows, the same choice in set-up and Settings, as the prototype's segmented choice under a
 * section heading.
 * @design packages/design-system/design.md#windows
 */
export function LanguageChoice({ title = "Language", languages, value, onValueChange, className, ...props }: LanguageChoiceProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("font-sans", className)} {...props}>
      <PageHeading level="section" id={id}>
        {title}
      </PageHeading>
      <SegmentedControl
        aria-labelledby={id}
        className="mt-2.5"
        options={languages.map((language) => ({ value: language.value, label: <span lang={language.lang}>{language.label}</span> }))}
        value={value}
        onValueChange={(next) => next && onValueChange?.(next)}
      />
    </section>
  );
}
