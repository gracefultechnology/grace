import { HomeMailRow, type HomeMailRowProps } from "./HomeMailRow.tsx";
import { HomeWaiting } from "./HomeWaiting.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows } from "./LauncherCard.tsx";

/** One email on the card. */
export type HomeMail = Omit<HomeMailRowProps, "className" | "id"> & { id: string | number };

export type HomeEmailCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** The newest emails, unread first; two fit. */
  messages: HomeMail[];
  /** While offline: what will arrive once back online, shown in place of the emails. */
  waiting?: string;
  /** A narrow column above Grace's compact window: the subjects run onto more lines instead of being cut. */
  compact?: boolean;
};

/**
 * Home's Email card: the two newest emails, or, offline, a note that new email waits for the internet.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#glass
 */
export function HomeEmailCard({ title = "Email", messages, waiting, compact = false, size = "medium", ...props }: HomeEmailCardProps) {
  // Prototype `homeCards()`: the rows start 100px down, 12px apart, and keep to 12px above the card's bottom.
  return (
    <LauncherCard title={title} size={size} {...props}>
      <LauncherRows className="-mb-2.5 gap-y-3">
        {waiting ? <HomeWaiting message={waiting} /> : messages.slice(0, 2).map(({ id, ...mail }) => <HomeMailRow key={id} wrap={compact} {...mail} />)}
      </LauncherRows>
    </LauncherCard>
  );
}
