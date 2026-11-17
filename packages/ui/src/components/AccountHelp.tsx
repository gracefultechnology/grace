import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { PageText } from "./PageHeading.tsx";

export type AccountHelpProps = ComponentProps<"div"> & {
  /** Where to write to have the Grace account deleted: "help@example.com". */
  support: string;
};

/**
 * Help with the account at the foot of the Account page: where to ask for the account to be deleted, and never to
 * share a password or code.
 * @design packages/design-system/design.md#windows
 */
export function AccountHelp({ support, className, ...props }: AccountHelpProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-row bg-panel px-[22px] py-5 font-sans", className)} {...props}>
      <PageText tone="secondary">To delete your Grace account, write to {support}.</PageText>
      <PageText tone="secondary" className="font-bold text-foreground">Never share a password or sign-in code with someone helping you.</PageText>
    </div>
  );
}
