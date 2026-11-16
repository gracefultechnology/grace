import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { PageText } from "./PageHeading.tsx";

export type AccountFoldProps = Omit<ComponentProps<"div">, "title"> & {
  /** The row's words: "Need help signing in?". */
  title: string;
  /** It starts open. */
  defaultOpen?: boolean;
  children: ReactNode;
};

/** A row that opens in place to show what it holds, as Settings' licences do (prototype `.a-row`). */
export function AccountFold({ title, defaultOpen = false, className, children, ...props }: AccountFoldProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className={cn("rounded-row bg-panel font-sans has-[>button:active]:scale-[.99]", className)} {...props}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className={cn(focusRing, "flex min-h-24 w-full cursor-pointer items-center gap-5 rounded-row px-[22px] py-4 text-left text-lead leading-[30px] font-bold text-chrome")}
      >
        <span className="flex-1">{title}</span>
        <ChevronDown aria-hidden size={26} strokeWidth={2.4} className={cn("flex-none text-chevron transition-transform duration-base motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-3 px-[22px] pt-0 pb-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type AccountHelpProps = Omit<AccountFoldProps, "title" | "children"> & {
  /** Where to write to have the Grace account deleted: "help@example.com". */
  support: string;
};

/**
 * Help with the account that works with no sign-in, folded under its row at the foot of the account page: where to ask
 * for the account to be deleted, and never to share a password or code.
 * @design packages/design-system/design.md#windows
 */
export function AccountHelp({ support, ...props }: AccountHelpProps) {
  return (
    <AccountFold title="Account help" {...props}>
      <PageText tone="secondary">To delete your Grace account, write to {support}.</PageText>
      <PageText tone="secondary" className="font-bold text-foreground">Never share a password or sign-in code with someone helping you.</PageText>
    </AccountFold>
  );
}
