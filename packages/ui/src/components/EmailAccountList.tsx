import type { ComponentProps, ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { guided, type Guide } from "./GuideAnchor.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";

const defaultLabels = {
  title: "Email & calendar",
  introduction: "Sign in to the email you already use. Its emails, calendar and contacts come to the tablet. You sign in on your email company’s own page; Grace never sees your password.",
  heading: "On this tablet",
  add: "Add another email",
};

export type EmailAccountListProps = Omit<ComponentProps<"section">, "title"> & {
  /** No email is on the tablet yet: the page says what connecting does, and `children` is a `ProviderGrid`. */
  empty?: boolean;
  /** The emails on the tablet, as `EmailAccountRow`s, or a `ProviderGrid` while `empty`. */
  children: ReactNode;
  /** Called by Add another email; without it Add another email is shown but cannot be pressed. */
  onAdd?: () => void;
  /** Grace pointing at Add another email (prototype `acadd`); each email's row takes its own `guide`. */
  guide?: Guide<"add">;
  labels?: Partial<typeof defaultLabels>;
};

/**
 * Settings › Email & calendar: the emails on this tablet and Add another email, or, before the first, what connecting
 * one does and the companies to choose from (prototype `accPage()` with no sub-page).
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function EmailAccountList({ empty = false, children, onAdd, guide, labels, className, ...props }: EmailAccountListProps) {
  const words = { ...defaultLabels, ...labels };
  const add = (
    <Button variant="capsule" size="pill" disabled={!onAdd} onClick={onAdd}>
      <Plus size={22} strokeWidth={2.4} aria-hidden />
      {words.add}
    </Button>
  );
  return (
    <section aria-label={words.title} className={cn("flex flex-col font-sans", className)} {...props}>
      <SettingsPageHeading>{words.title}</SettingsPageHeading>
      {empty ? (
        <>
          <PageText tone="secondary" className="mt-1.5 max-w-[800px]">{words.introduction}</PageText>
          {children}
        </>
      ) : (
        <>
          <PageHeading level="section" className="mt-[18px]">{words.heading}</PageHeading>
          <div className="mt-2.5 flex flex-col gap-2.5">{children}</div>
          <div className="mt-3.5 flex">{guided(guide, "add", add, { radius: 999 })}</div>
        </>
      )}
    </section>
  );
}
