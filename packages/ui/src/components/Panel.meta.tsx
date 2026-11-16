import type { ComponentMeta } from "vibestack/stories";
import { PageText } from "./PageHeading.tsx";
import type { PanelProps } from "./Panel.tsx";

export const meta: ComponentMeta<PanelProps> = {
  args: {
    className: "w-[804px]",
    children: (
      <>
        <PageText>Grace tablet · Prototype</PageText>
        <PageText tone="secondary" className="mt-1.5">Everything is up to date.</PageText>
      </>
    ),
  },
  examples: {
    White: {
      variant: "white",
      className: "flex w-[432px] items-center gap-[18px]",
      children: (
        <>
          <div className="w-[74px] flex-none text-center">
            <b className="block text-lg leading-[22px] tracking-[.06em] text-rose">SAT</b>
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
