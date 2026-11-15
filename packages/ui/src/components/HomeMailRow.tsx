import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Avatar, type AvatarProps } from "./Avatar.tsx";
import { Panel } from "./Panel.tsx";
import { UnreadDot } from "./UnreadDot.tsx";

export type HomeMailRowProps = Omit<ComponentProps<"div">, "children"> & {
  /** Who sent it. */
  name: string;
  /** The subject, cut to one line unless `wrap`. */
  subject: string;
  /** Their photo. */
  src?: string;
  /** The color behind their initial or icon, when there is no photo. */
  tone?: AvatarProps["tone"];
  /** An icon in place of their initial, such as a clinic's cross. */
  icon?: ReactNode;
  /** Not yet read: a violet dot after the name. */
  unread?: boolean;
  /** What the dot means, for assistive technology. */
  unreadLabel?: string;
  /** The subject runs onto more lines instead of being cut, as on Home above Grace's compact window. */
  wrap?: boolean;
};

/**
 * One new email on Home's Email card: who sent it and its subject.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#glass
 */
export function HomeMailRow({ name, subject, src, tone, icon, unread = false, unreadLabel, wrap = false, className, ...props }: HomeMailRowProps) {
  // Prototype `homeCards()`: `.lpanel` with `.a-av.hav` (a white ring) and a 10px unread dot.
  return (
    <Panel variant="white" className={cn("flex items-center gap-4 px-[18px] py-3.5", className)} {...props}>
      <Avatar name={name} src={src} tone={tone} size={52} className="ring-3 ring-glass/90">
        {icon}
      </Avatar>
      <div className="min-w-0">
        <b className="block text-body-lg leading-7">
          {name}
          {unread && <> <UnreadDot label={unreadLabel} className="ml-1.5 size-2.5 align-middle" /></>}
        </b>
        {/* Prototype `.home.cmp .lc[data-app="Email"] .lpanel span` (line 394). */}
        <span className={cn("block text-body leading-[26px] text-muted-foreground", !wrap && "truncate")}>{subject}</span>
      </div>
    </Panel>
  );
}
