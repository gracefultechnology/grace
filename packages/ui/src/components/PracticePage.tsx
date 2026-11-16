import { useId, type ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { GuideLabel } from "./GuideLabel.tsx";
import { GuideRing } from "./GuideRing.tsx";

export type PracticePageLabels = {
  name: string;
  note: string;
  title: string;
  text: string;
  continue: string;
  done: string;
  tapHere: string;
  guideDetail: string;
};

export const practicePageLabels: PracticePageLabels = {
  name: "Practice page",
  note: "Nothing here is real",
  title: "A page to practise on",
  text: "This is what a website looks like with Grace beside it. Nothing you do here changes anything.",
  continue: "Continue",
  done: "Thank you — that’s all there is to it",
  tapHere: "Tap here",
  guideDetail: "On real websites I point like this. Passwords and paying are always yours.",
};

export type PracticePageProps = ComponentProps<"section"> & {
  /** Grace points at Continue: her ring round it and her label under it. */
  guided?: boolean;
  /** Continue was tapped: the done bar in its place. */
  done?: boolean;
  onContinue?: () => void;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<PracticePageLabels>;
};

/**
 * Set-up step 16, Websites: a local practice website where Grace shows how she points at what to tap. It is a website,
 * not Grace, so it keeps the site's own navy; nothing on it is sent anywhere, and Continue only changes the page.
 * @design packages/design-system/design.md#guidance
 * @design packages/design-system/design.md#screens
 */
export function PracticePage({ guided = false, done = false, onContinue, labels: words, className, ...props }: PracticePageProps) {
  const labels = { ...practicePageLabels, ...words };
  const labelId = useId();
  return (
    <section aria-label={labels.name} className={cn("flex size-full flex-col overflow-hidden bg-site font-site text-site-ink", className)} {...props}>
      <div className="flex h-16 flex-none items-center justify-between px-8 text-body font-bold text-primary-foreground bg-site-brand">
        <span>{labels.name}</span>
        <span className="text-sm font-normal opacity-80">{labels.note}</span>
      </div>
      <div className="mx-12 mt-9 flex flex-col gap-[18px] rounded-sm bg-card p-9 shadow-site-card">
        <h2 className="m-0 text-title leading-[1.2] font-bold">{labels.title}</h2>
        <p className="m-0 text-label leading-normal text-site-muted">{labels.text}</p>
        {done ? (
          <div role="status" className="mt-2 flex h-[60px] items-center justify-center gap-2.5 rounded-tag bg-ok/14 text-body font-bold text-ok">
            <Check size={22} strokeWidth={2.4} aria-hidden />
            {labels.done}
          </div>
        ) : (
          <div className="relative mt-2">
            <button
              type="button"
              aria-describedby={guided ? labelId : undefined}
              onClick={onContinue}
              className={cn(focusRing, "block h-[60px] w-full cursor-pointer rounded-tag bg-site-brand px-6 text-body font-bold text-primary-foreground hover:bg-site-ink active:bg-site-ink")}
            >
              {labels.continue}
            </button>
            {guided ? (
              <>
                <GuideRing radius={14} motion="tap" />
                <GuideLabel id={labelId} placement="below" title={labels.tapHere} detail={labels.guideDetail} className="absolute top-[calc(100%+18px)] left-0 z-6" />
              </>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
