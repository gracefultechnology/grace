import { HomeMailRow, type HomeMailRowProps } from "./HomeMailRow.tsx";
import { HomeWaiting } from "./HomeWaiting.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows } from "./LauncherCard.tsx";
import { PlaceholderRows } from "./PlaceholderRows.tsx";

export type HomeMail = Omit<HomeMailRowProps, "className" | "id"> & { id: string | number };

export type HomeEmailCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** The newest emails, unread first; two fit. */
  messages: HomeMail[];
  /** While offline: what will arrive once back online, shown in place of the emails. */
  waiting?: string;
  /** No email account shows mail: faded rows in place of the emails; Home's banner asks to add one. */
  notConnected?: boolean;
  /** Its status with no email account, in place of `status`. */
  notConnectedStatus?: string;
  /** A narrow column above Grace's compact window: the subjects run onto more lines instead of being cut. */
  compact?: boolean;
};

/**
 * Home's Email card: the two newest emails; offline, a note that new email waits for the internet; with no email
 * account, faded rows, since Home's banner asks for one.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#glass
 * @design packages/design-system/design.md#empty-states
 */
export function HomeEmailCard({
  title = "Email",
  messages,
  waiting,
  notConnected = false,
  notConnectedStatus = "Not connected",
  compact = false,
  size = "medium",
  status,
  ...props
}: HomeEmailCardProps) {
  const unconnected = notConnected && !waiting;
  return (
    <LauncherCard title={title} size={size} compact={compact} status={unconnected ? notConnectedStatus : status} {...props}>
      <LauncherRows className="-mb-2.5 gap-y-3">
        {waiting ? (
          <HomeWaiting message={waiting} />
        ) : unconnected ? (
          <PlaceholderRows mark="avatar" className="mt-auto pb-2.5" />
        ) : (
          messages.slice(0, 2).map(({ id, ...mail }) => <HomeMailRow key={id} wrap={compact} {...mail} />)
        )}
      </LauncherRows>
    </LauncherCard>
  );
}
