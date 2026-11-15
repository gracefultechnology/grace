import { cn, focusRing } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { MailContactAvatar, type MailContact } from "./MailMessageRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { SearchField } from "./TextField.tsx";

export type MailRecipientPickerProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children" | "title"> & {
  /** The window's title: "New email". */
  title?: string;
  /** The question over the people: "Who is it to?", "Who should get a copy?". */
  question?: string;
  /** The people Margaret writes to, filtered by the search. */
  people: MailContact[];
  /** Called with the person tapped. */
  onPick?: (person: MailContact) => void;
  /** The name or address typed. */
  query?: string;
  /** Called as a name or address is typed. */
  onQueryChange?: (query: string) => void;
  /** The search's placeholder and accessible name. */
  searchLabel?: string;
};

/**
 * Choosing who an email is to: a search and Margaret's people as large tiles (prototype `mailView()`, picker).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailRecipientPicker({
  title = "New email",
  question = "Who is it to?",
  people,
  onPick,
  query = "",
  onQueryChange,
  searchLabel = "Type a name or email address",
  backLabel = "Inbox",
  ...props
}: MailRecipientPickerProps) {
  return (
    <AppWindow title={title} backLabel={backLabel} {...props}>
      <div className="font-sans">
        <PageHeading level="title">{question}</PageHeading>
        <SearchField label={searchLabel} value={query} onChange={(event) => onQueryChange?.(event.target.value)} className="mt-4 mb-5" />
        {/* Prototype `.a-people`, `.a-person`. */}
        <ul className="m-0 grid list-none grid-cols-4 gap-4 p-0">
          {people.map((person) => (
            <li key={person.name}>
              <button
                type="button"
                onClick={() => onPick?.(person)}
                className={cn(
                  focusRing,
                  "flex w-full cursor-pointer flex-col items-center gap-3 rounded-day bg-panel px-2.5 py-[22px] text-center text-body-lg leading-[26px] font-bold text-chrome transition-transform duration-press ease-spring active:scale-[.99]",
                )}
              >
                {/* Prototype `.a-person .a-av`: 88px, its initial at 36px. */}
                <MailContactAvatar contact={person} size={88} style={{ fontSize: 36 }} aria-hidden />
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppWindow>
  );
}
