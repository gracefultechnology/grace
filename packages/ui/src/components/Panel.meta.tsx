import type { ComponentMeta } from "vibestack/stories";
import type { PanelProps } from "./Panel.tsx";

export const meta: ComponentMeta<PanelProps> = {
  args: {
    className: "w-[880px]",
    children: (
      <>
        <div className="text-lead leading-[30px] font-bold text-chrome">Grace tablet · Prototype</div>
        <div className="mt-1.5 text-body leading-[26px] font-medium text-muted-foreground">Everything is up to date.</div>
      </>
    ),
  },
  examples: {
    // Home's Calendar card: an appointment on white over the card's glass.
    White: {
      variant: "white",
      className: "flex w-[472px] items-center gap-[18px]",
      children: (
        <>
          <div className="w-[74px] flex-none text-center">
            <b className="block text-lg leading-[22px] tracking-[.06em] text-rose">FRI</b>
            <span className="block text-body-lg leading-7 font-bold">10 am</span>
          </div>
          <div className="w-0.5 self-stretch rounded-full bg-rose" />
          <div>
            <b className="block text-lead leading-[30px]">Doctor’s appointment</b>
            <span className="block text-body leading-[26px] text-muted-foreground">Dr. Patel · Main St clinic</span>
          </div>
        </>
      ),
    },
  },
  decorator: (story) => <div className="bg-gradient-frame p-6">{story()}</div>,
};
