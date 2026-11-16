import { type ComponentProps, createContext, use } from "react";
import { cn } from "../lib/cn.ts";
import { PageHeading, type PageHeadingProps } from "./PageHeading.tsx";

/** True inside a `SettingsApp` whose large title already names the open page. */
export const SettingsLargeTitleContext = createContext(false);

export type SettingsPageHeadingProps = Omit<PageHeadingProps, "level">;

/**
 * A Settings page's own title; left out when the window's large title names the page instead
 * (prototype `axRender()` removes the page's `h3.a-h` in `X.hdrMode='large'`).
 * @design packages/design-system/design.md#windows
 */
export function SettingsPageHeading(props: SettingsPageHeadingProps) {
  return use(SettingsLargeTitleContext) ? null : <PageHeading {...props} />;
}

export type SettingsAccountPageProps = Omit<ComponentProps<"section">, "title"> & {
  /** The page's title: its heading and its name. */
  title: string;
  /** While the account is being checked. */
  busy?: boolean;
};

/** A Settings page of the person's account: its title over what it holds, marked sensitive so no capture shows it. */
export function SettingsAccountPage({ title, busy = false, className, children, ...props }: SettingsAccountPageProps) {
  return (
    <section aria-label={title} aria-busy={busy || undefined} data-sensitive="true" className={cn("flex flex-col gap-5 font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      {children}
    </section>
  );
}
