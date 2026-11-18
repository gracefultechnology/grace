import { MailIcon } from "../icons.tsx";
import { HomeMailRow, type HomeMailRowProps } from "./HomeMailRow.tsx";
import { HomeWaiting } from "./HomeWaiting.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows } from "./LauncherCard.tsx";

export type HomeMail = Omit<HomeMailRowProps, "className" | "id"> & { id: string | number };

export type HomeEmailCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** The newest emails, unread first; two fit. */
  messages: HomeMail[];
  /** While offline: what will arrive once back online, shown in place of the emails. */
  waiting?: string;
  /** No email account shows mail: the card says so and how to change it, in place of the emails. */
  notConnected?: boolean;
  /** What it says with no email account. */
  notConnectedLabel?: string;
  /** Its status with no email account, in place of `status`. */
  notConnectedStatus?: string;
  /** A narrow column above Grace's compact window: the subjects run onto more lines instead of being cut. */
  compact?: boolean;
};

/**
 * Home's Email card: the two newest emails; offline, a note that new email waits for the internet; with no email
 * account, a note to connect one.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#glass
 */
export function HomeEmailCard({
  title = "Email",
  messages,
  waiting,
  notConnected = false,
  notConnectedLabel = "Connect your email to see it here.",
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
          <HomeWaiting message={notConnectedLabel} icon={<MailIcon size={26} strokeWidth={2} />} />
        ) : (
          messages.slice(0, 2).map(({ id, ...mail }) => <HomeMailRow key={id} wrap={compact} {...mail} />)
        )}
      </LauncherRows>
    </LauncherCard>
  );
}
