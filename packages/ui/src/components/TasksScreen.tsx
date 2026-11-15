import type { ReactNode } from "react";
import { CircleCheck, ListChecks } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { PageHeading } from "./PageHeading.tsx";

/** One group of the list, such as "Waiting on you" or "Finished". */
export interface TaskGroup {
  id: string;
  title: string;
  /** Its tasks, as `TaskCard`s. */
  cards: ReactNode;
}

export type TasksScreenProps = Omit<AppWindowProps, "icon" | "children" | "title"> & {
  /** The window's name: "Tasks". */
  title?: string;
  /** The groups that have tasks, in order. None shows the empty state. */
  groups: TaskGroup[];
  /** The empty state's words: "Nothing waiting on you." */
  emptyTitle?: string;
  /** A line under them. */
  emptyText?: string;
};

/**
 * Every task Grace started, grouped by what it needs (senior-care apps/app/src/TasksScreen.tsx), in an app window like
 * the prototype's apps, with an empty state when there is none.
 * @design packages/design-system/design.md#windows
 */
export function TasksScreen({ title = "Tasks", groups, emptyTitle = "Nothing waiting on you.", emptyText, ...props }: TasksScreenProps) {
  return (
    <AppWindow title={title} icon={<ListChecks size={26} strokeWidth={2} aria-hidden />} {...props}>
      {groups.length ? (
        <div className="mx-auto flex w-[760px] max-w-full flex-col gap-10 pb-10">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.title} className="flex flex-col gap-4">
              <PageHeading level="section">{group.title}</PageHeading>
              {group.cards}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} icon={<CircleCheck size={64} strokeWidth={2} aria-hidden />} className="h-full">
          {emptyText}
        </EmptyState>
      )}
    </AppWindow>
  );
}
