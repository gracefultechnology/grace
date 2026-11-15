import { createContext, use } from "react";
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
