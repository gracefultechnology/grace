import type { ComponentProps } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.ts";

const headingVariants = cva("m-0 font-sans", {
  variants: {
    level: {
      // Prototype `#awin.lgmode .lgt`: the large title that collapses into the header's bar.
      large: "pr-[84px] text-display leading-[56px] font-extrabold tracking-[-.01em] text-foreground",
      // Prototype `.a-h` at 30/38: a page's own title (a settings page, an email's subject).
      page: "text-title-lg leading-[38px] font-bold text-chrome",
      // Prototype `.a-h`: a heading inside a page (a day, "Coming up").
      title: "text-title-sm leading-8 font-bold text-chrome",
      // Prototype `.a-h2`: the label over a group of rows.
      section: "text-body-lg leading-7 font-bold tracking-[.01em] text-muted-foreground",
    },
  },
  defaultVariants: { level: "page" },
});

// Under the window's title (h1): a page's title or a heading in it is h2, a group's label h3.
const tags = { large: "h1", page: "h2", title: "h2", section: "h3" } as const;

export type PageHeadingProps = ComponentProps<"h2"> & {
  /** `large` the page's large title, `page` a page's title, `title` a heading in a page, `section` the label over a group. */
  level?: "large" | "page" | "title" | "section";
};

/**
 * A heading in an app window's page, at one of the prototype's four sizes.
 * @design packages/design-system/design.md#windows
 */
export function PageHeading({ level = "page", className, children, ...props }: PageHeadingProps) {
  const Tag = tags[level];
  if (children == null) return null;
  return (
    <Tag className={cn(headingVariants({ level }), className)} {...props}>
      {children}
    </Tag>
  );
}

export type PageTextProps = ComponentProps<"p"> & {
  /** `body` reading text (prototype `.a-b`); `secondary` what matters less (prototype `.a-s`). */
  tone?: "body" | "secondary";
};

/** Text in an app window's page: body copy or a secondary line. */
export function PageText({ tone = "body", className, ...props }: PageTextProps) {
  return (
    <p
      className={cn(
        "m-0 font-sans",
        tone === "body" ? "text-body-lg leading-[30px] font-normal text-foreground" : "text-body leading-[26px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
