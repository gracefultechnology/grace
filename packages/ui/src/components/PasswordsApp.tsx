import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { SearchField } from "./TextField.tsx";

/** One saved password, without its secret. */
export interface SavedPassword {
  id: string;
  /** The account's name: "City Water". */
  label: string;
  username?: string;
  /** Where it is used: "citywater.example.com". */
  site?: string;
}

export type PasswordsAppLabels = {
  title: string;
  list: string;
  search: string;
  add: string;
  lock: string;
  empty: string;
  noMatch: string;
  clearSearch: string;
  back: string;
  website: string;
  username: string;
  noUsername: string;
  password: string;
  hidden: string;
  show: string;
  copy: string;
  open: string;
  edit: string;
  remove: string;
};

export const passwordsAppLabels: PasswordsAppLabels = {
  title: "Passwords",
  list: "Your passwords",
  search: "Search",
  add: "Add a password",
  lock: "Lock",
  empty: "No passwords yet",
  noMatch: "No matching passwords",
  clearSearch: "Clear search",
  back: "All passwords",
  website: "Website",
  username: "Username",
  noUsername: "No username",
  password: "Password",
  hidden: "Password hidden",
  show: "Show",
  copy: "Copy",
  open: "Open website",
  edit: "Edit",
  remove: "Delete password",
};

export type PasswordsAppProps = Omit<AppWindowProps, "title" | "icon" | "children" | "backLabel" | "onBack"> & {
  /** The passwords shown, already filtered by `query`. */
  passwords: SavedPassword[];
  /** Whether any are saved at all, so an empty search says no match rather than none. */
  anySaved?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  onAdd?: () => void;
  onLock?: () => void;
  onOpenPassword?: (id: string) => void;
  /** The password open in full, in place of the list. */
  open?: SavedPassword;
  /** Its secret, once Margaret asked to see it. */
  revealed?: string;
  onBack?: () => void;
  onShow?: () => void;
  onCopy?: () => void;
  onOpenWebsite?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** What just happened, such as "Copied. Avoid pasting it into a message." */
  notice?: ReactNode;
  labels?: Partial<PasswordsAppLabels>;
};

/**
 * Grace's password vault on the tablet (senior-care PasswordsApp.tsx): the list with search, and one password with its
 * site and username, the secret hidden until asked for, in an app window like the prototype's apps.
 * @design packages/design-system/design.md#windows
 */
export function PasswordsApp({ passwords, anySaved = passwords.length > 0, query = "", onQueryChange, onAdd, onLock, onOpenPassword, open, revealed, onBack, onShow, onCopy, onOpenWebsite, onEdit, onDelete, notice, labels, ...props }: PasswordsAppProps) {
  const l = { ...passwordsAppLabels, ...labels };
  const icon = <Lock size={26} strokeWidth={2} aria-hidden />;
  if (open)
    return (
      <AppWindow title={open.label} icon={icon} backLabel={l.back} onBack={onBack} {...props}>
        <div className="mx-auto flex w-[760px] max-w-full flex-col gap-5 pb-10 font-sans">
          {open.site && <ListRow title={l.website} subtitle={open.site} />}
          <ListRow title={l.username} subtitle={open.username || l.noUsername} />
          <ListRow
            title={l.password}
            subtitle={revealed ? <span className="select-text">{revealed}</span> : <span aria-label={l.hidden}>••••••••••••</span>}
            trailing={
              <span className="flex gap-2">
                <Button variant="capsule" size="pill" onClick={onShow}>{l.show}</Button>
                <Button variant="capsule" size="pill" onClick={onCopy}>{l.copy}</Button>
              </span>
            }
          />
          <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground">{notice}</div>
          <div className="flex flex-wrap gap-3">
            {open.site && <Button variant="prominent" size="pill" onClick={onOpenWebsite}>{l.open}</Button>}
            <Button variant="capsule" size="pill" onClick={onEdit}>{l.edit}</Button>
            <Button variant="warn" size="pill" onClick={onDelete}>{l.remove}</Button>
          </div>
        </div>
      </AppWindow>
    );
  return (
    <AppWindow title={l.title} icon={icon} {...props}>
      <div className="mx-auto flex w-[760px] max-w-full flex-col gap-5 pb-10 font-sans">
        <PageHeading level="title">{l.list}</PageHeading>
        {anySaved && <SearchField label={l.search} value={query} onChange={(event) => onQueryChange?.(event.target.value)} />}
        <div className="flex flex-wrap gap-3">
          <Button variant="prominent" size="pill" onClick={onAdd}>{l.add}</Button>
          <Button variant="capsule" size="pill" onClick={onLock}>{l.lock}</Button>
        </div>
        {passwords.length ? (
          <div className="flex flex-col gap-3">
            {passwords.map((item) => (
              <ListRow key={item.id} title={item.label} subtitle={[item.username || l.noUsername, item.site].filter(Boolean).join(" · ")} chevron onClick={() => onOpenPassword?.(item.id)} />
            ))}
          </div>
        ) : (
          <EmptyState title={anySaved ? l.noMatch : l.empty}>
            {anySaved && <Button variant="capsule" size="pill" onClick={() => onQueryChange?.("")}>{l.clearSearch}</Button>}
          </EmptyState>
        )}
        <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground">{notice}</div>
      </div>
    </AppWindow>
  );
}
