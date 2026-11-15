import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsSwitchRow } from "./SettingsSwitchRow.tsx";

export type BillDiscoverySettingProps = Omit<ComponentProps<"div">, "onChange"> & {
  /** The setting's name: "Look for new bills". */
  title: string;
  /** What turning it on lets Grace do, under the name. */
  about: string;
  /** What Grace still never does, and that it can be turned off. */
  limits: string;
  /** Why it is off again, when what it covers changed since it was turned on. */
  askedAgain?: string;
  /** Whether Grace looks for new bills. */
  checked: boolean;
  /** Called with the new value when the row is tapped. */
  onCheckedChange?: (checked: boolean) => void;
  /** While the change is being made: the switch waits. */
  busy?: boolean;
  /** Why the last change did not happen, such as Gmail not being connected. */
  notice?: string;
  /** Called by Try again beside the notice. */
  onRetry?: () => void;
};

const note = "px-6 text-body leading-[26px] font-medium text-muted-foreground";

/**
 * Settings → Gmail → Look for new bills (senior-care apps/app/src/BillDiscoverySetting.tsx): Margaret's separate,
 * revocable yes to Grace reading Gmail for bills that arrive, with what it allows and what Grace still never does.
 * @design packages/design-system/design.md#windows
 */
export function BillDiscoverySetting({ title, about, limits, askedAgain, checked, onCheckedChange, busy = false, notice, onRetry, className, ...props }: BillDiscoverySettingProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      {askedAgain && <p className={note}>{askedAgain}</p>}
      <SettingsSwitchRow title={title} subtitle={about} checked={checked} onCheckedChange={onCheckedChange} disabled={busy} />
      <p className={note}>{limits}</p>
      {notice && (
        <RetryNotice role="status" onRetry={onRetry}>
          {notice}
        </RetryNotice>
      )}
    </div>
  );
}
