import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../lib/cn.ts";
import { usePortalContainer } from "../lib/portal.tsx";
import { Button } from "./Button.tsx";

export type SignInSheetProps = Omit<DialogPrimitive.DialogContentProps, "title"> & {
  /** Whose sign-in page this is: an email company, such as "Gmail", or a public network. */
  owner: string;
  /** Where the page comes from, such as "accounts.google.com". */
  host?: string;
  /** The line under the owner's name; by default it says the page is the owner's own, and from where. */
  subtitle?: string;
  /** The sheet is showing. */
  open?: boolean;
  /** Called by Cancel and Escape. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Where the sheet's portal mounts; defaults to the enclosing `PortalContainerProvider` or inline when none is provided. */
  container?: HTMLElement | null;
  /** The owner's own web page, as the owner serves it: its fields and branding are not the tablet's, and the tablet never reads what is typed there. */
  children: ReactNode;
};

/**
 * The tablet's sheet around someone else's sign-in page: Cancel and whose page it is, above the page that an email
 * company or a public network serves (prototype `.psheet` and `.psheet.acsheet` over `.a-scrim`). It covers the screen
 * it is placed in.
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function SignInSheet({
  owner,
  host,
  subtitle = host ? `${owner}’s own sign-in page · ${host}` : `${owner}’s own sign-in page`,
  open = true,
  onCancel,
  cancelLabel = "Cancel",
  container,
  className,
  children,
  ...props
}: SignInSheetProps) {
  const contextContainer = usePortalContainer();
  const portalContainer = container ?? contextContainer;
  const positioning = portalContainer ? "fixed" : "absolute";
  const sheet = (
    <>
      <DialogPrimitive.Overlay className={cn(positioning, "inset-0 z-20 bg-scrim/32")} />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          positioning,
          "top-1/2 left-1/2 z-20 flex h-[min(700px,calc(100%-3rem))] w-[min(900px,calc(100%-3rem))] -translate-1/2 flex-col overflow-hidden rounded-screen bg-card font-sans shadow-dialog outline-none",
          className,
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        {...props}
      >
        <div className="relative flex items-center justify-between border-b border-primary/8 p-4">
          <div className="flex h-16 items-center rounded-full bg-glass/82 p-1 shadow-capsule">
            <Button variant="plain" size="compact" className="px-[22px] text-grace-ink active:bg-transparent" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
          <div className="flex flex-col items-center text-control leading-[normal] text-muted-foreground">
            <DialogPrimitive.Title className="m-0 text-body-lg font-bold text-foreground">
              {owner}
              <span className="sr-only"> sign-in page</span>
            </DialogPrimitive.Title>
            <span>{subtitle}</span>
          </div>
          <span className="w-[120px]" />
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </DialogPrimitive.Content>
    </>
  );
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onCancel?.()}>
      {portalContainer ? <DialogPrimitive.Portal container={portalContainer}>{sheet}</DialogPrimitive.Portal> : sheet}
    </DialogPrimitive.Root>
  );
}
