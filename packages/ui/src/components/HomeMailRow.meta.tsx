import type { ComponentMeta } from "vibestack/stories";
import { susan } from "./Avatar.meta.tsx";
import type { HomeMailRowProps } from "./HomeMailRow.tsx";

export const meta: ComponentMeta<HomeMailRowProps> = {
  args: { name: "Susan", src: susan, subject: "Photos from Lily’s recital", unread: true },
  examples: {
    Clinic: {
      name: "Main St Clinic",
      tone: 1,
      icon: (
        <svg aria-hidden width="30" height="30" viewBox="0 0 24 24">
          <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" />
        </svg>
      ),
      subject: "Reminder: your appointment tomorrow at 10 am",
      unread: true,
    },
    Wrap: { wrap: true, className: "w-[290px]" },
  },
  decorator: (story) => <div className="w-[470px] bg-gradient-frame-soft px-[22px] py-6">{story()}</div>,
};
