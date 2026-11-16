import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { PageHeading, PageText } from "./PageHeading.tsx";

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

export type AccountHelpLabels = {
  signInTitle: string;
  title: string;
  heading: string;
  samePerson: string;
  missingCode: string;
  google: string;
  paymentChecked: string;
  neverShare: string;
};

export const accountHelpLabels: AccountHelpLabels = {
  signInTitle: "Need help signing in?",
  title: "Account help",
  heading: "Help with your account",
  samePerson: "Already paid? Use the same email address or phone number as before. If you used to sign in with Google, use that Google account’s email address. Another email or phone may open a different account.",
  missingCode: "Missing a code? Check email spam or text messages. Use the newest code, or request a new one when the sign-in screen allows it.",
  google: "You sign in here on the tablet with a code. If you choose Google, Google’s own sign-in page opens over Grace and brings you straight back here when you’re done. Only use another email or phone if it already belongs to your account.",
  paymentChecked: "Payment still being checked? Check its status again on the payment screen. Don’t buy another plan while the result is unknown.",
  neverShare: "Never share a password, sign-in code or full card number with someone helping you.",
};

export type AccountHelpProps = Omit<AccountFoldProps, "title" | "children"> & {
  /** Under the sign-in: adds what to do about a missing code and Google. */
  signIn?: boolean;
  labels?: Partial<AccountHelpLabels>;
};

/**
 * Help with the account that works with no sign-in and no paid call, folded under its row at the foot of the sign-in
 * and plan pages.
 * @design packages/design-system/design.md#windows
 */
export function AccountHelp({ signIn = false, labels, ...props }: AccountHelpProps) {
  const l = { ...accountHelpLabels, ...labels };
  return (
    <AccountFold title={signIn ? l.signInTitle : l.title} {...props}>
      <PageHeading level="section">{l.heading}</PageHeading>
      <PageText tone="secondary">{l.samePerson}</PageText>
      {signIn ? (
        <>
          <PageText tone="secondary">{l.missingCode}</PageText>
          <PageText tone="secondary">{l.google}</PageText>
        </>
      ) : null}
      <PageText tone="secondary">{l.paymentChecked}</PageText>
      <PageText tone="secondary" className="font-bold text-foreground">{l.neverShare}</PageText>
    </AccountFold>
  );
}
