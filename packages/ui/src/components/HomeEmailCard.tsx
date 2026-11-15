import { HomeMailRow, type HomeMailRowProps } from "./HomeMailRow.tsx";
import { HomeWaiting } from "./HomeWaiting.tsx";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";

/** One email on the card. */
export type HomeMail = Omit<HomeMailRowProps, "className" | "id"> & { id: string | number };

export type HomeEmailCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** The newest emails, unread first; two fit. */
  messages: HomeMail[];
  /** While offline: what will arrive once back online, shown in place of the emails. */
  waiting?: string;
};

/**
 * Home's Email card: the two newest emails, or, offline, a note that new email waits for the internet.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#glass
 */
export function HomeEmailCard({ title = "Email", messages, waiting, size = "medium", ...props }: HomeEmailCardProps) {
  // Prototype `homeCards()`: the rows start 100px down, 12px apart.
  return (
    <LauncherCard title={title} size={size} {...props}>
      <span className="flex flex-col gap-3">
        {waiting ? <HomeWaiting message={waiting} /> : messages.slice(0, 2).map(({ id, ...mail }) => <HomeMailRow key={id} {...mail} />)}
      </span>
    </LauncherCard>
  );
}
