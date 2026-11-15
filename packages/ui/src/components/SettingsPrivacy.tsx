import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { BrowserDialogText } from "./BrowserNoticeDialog.tsx";
import { Button } from "./Button.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import { Dialog, DialogContent, DialogTitle } from "./Dialog.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";

/** One fact Grace remembers to fill in for Margaret. */
export interface SavedDetail {
  id: string;
  /** What it is, such as "Phone number". */
  label: string;
  /** The fact itself. */
  value: string;
  /** The website it is kept for, when only one may use it. */
  site?: string;
}

/** `confirm` asks before clearing browsing data; `running` clears it; `failed` it was not cleared. */
export type BrowsingClearState = "idle" | "confirm" | "running" | "failed";

/** The words of the page, for another language. */
export type SettingsPrivacyLabels = {
  title: string;
  details: string;
  empty: string;
  remove: string;
  clearAll: string;
  /** The question before one detail is removed, from its label. */
  removeTitle: (label: string) => string;
  removeText: string;
  /** The question before every detail is removed. */
  clearAllTitle: string;
  clearAllText: string;
  keep: string;
  confirmRemove: string;
  browsing: string;
  clearBrowsing: string;
  clearBrowsingHint: string;
  clear: string;
  /** The question before browsing data is cleared. */
  clearBrowsingTitle: string;
  clearBrowsingText: string;
  cancel: string;
  /** Browsing data was not cleared. */
  notCleared: string;
  retry: string;
};

const settingsPrivacyLabels: SettingsPrivacyLabels = {
  title: "Privacy",
  details: "Saved details",
  empty: "Nothing saved yet.",
  remove: "Remove",
  clearAll: "Clear all",
  removeTitle: (label) => `Remove this ${label.toLowerCase()}?`,
  removeText: "Grace won’t offer it after that.",
  clearAllTitle: "Remove every saved detail?",
  clearAllText: "Grace won’t offer any of them after that.",
  keep: "Keep it",
  confirmRemove: "Yes, remove it",
  browsing: "Browsing",
  clearBrowsing: "Clear browsing data",
  clearBrowsingHint: "Signs you out of websites and forgets what they may use.",
  clear: "Clear",
  clearBrowsingTitle: "Clear browsing data?",
  clearBrowsingText: "You’ll be signed out of every website, and websites will ask again before using the camera or your location.",
  cancel: "Cancel",
  notCleared: "Browsing data wasn’t cleared.",
  retry: "Try again",
};

export type SettingsPrivacyProps = ComponentProps<"section"> & {
  /** What Grace remembers, in the order to show it. */
  details: SavedDetail[];
  /** Called by a detail's Remove: the app asks first, with `asking`. */
  onRemove?: (id: string) => void;
  /** Called by Clear all: the app asks first, with `asking`. */
  onClearAll?: () => void;
  /** The question showing: removing one detail, by its id, or clearing them all. */
  asking?: { remove: string } | "clear-all";
  /** Called by "Yes, remove it", with the detail asked about, or with nothing for Clear all. */
  onConfirmRemove?: (id?: string) => void;
  /** Called by Keep it and Escape. */
  onKeep?: () => void;
  /** Why the latest change to saved details was not stored; the list stays as it was. */
  saveError?: ReactNode;
  /** Called by Try again on `saveError`. */
  onRetry?: () => void;
  /** Where clearing browsing data stands. */
  clearing?: BrowsingClearState;
  /** Called by Clear: the app asks first, with `clearing="confirm"`. */
  onClearBrowsing?: () => void;
  /** Called by the confirmation's Clear, and by Try again after it failed. */
  onConfirmClear?: () => void;
  /** Called by the confirmation's Cancel and Escape. */
  onCancelClear?: () => void;
  /** The page's words, for another language. */
  labels?: Partial<SettingsPrivacyLabels>;
};

/**
 * Settings' page for what Grace keeps: the details she remembers, each removable after one question, and browsing
 * data, cleared after one confirmation (prototype `.a-row`, `calDlg` and `.a-caution`).
 * @model spec/app/memory.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsPrivacy({
  details,
  onRemove,
  onClearAll,
  asking,
  onConfirmRemove,
  onKeep,
  saveError,
  onRetry,
  clearing = "idle",
  onClearBrowsing,
  onConfirmClear,
  onCancelClear,
  labels,
  className,
  ...props
}: SettingsPrivacyProps) {
  const l = { ...settingsPrivacyLabels, ...labels };
  const asked = typeof asking === "object" ? details.find((detail) => detail.id === asking.remove) : undefined;
  const removing = asked != null || asking === "clear-all";
  return (
    <section aria-label={l.title} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{l.title}</SettingsPageHeading>
      <PageHeading level="section" className="mt-6 mb-2.5">{l.details}</PageHeading>
      {saveError != null && (
        <RetryNotice className="mb-2.5" onRetry={onRetry} retryLabel={l.retry}>
          {saveError}
        </RetryNotice>
      )}
      {details.length === 0 ? (
        <EmptyState title={l.empty} className="py-2" />
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {details.map((detail) => (
              <ListRow
                key={detail.id}
                className="min-h-[76px]"
                title={detail.label}
                subtitle={detail.site ? `${detail.value} · ${detail.site}` : detail.value}
                trailing={
                  <Button variant="capsule" size="pill" className="h-13" aria-label={`${l.remove} ${detail.label}`} onClick={() => onRemove?.(detail.id)}>
                    {l.remove}
                  </Button>
                }
              />
            ))}
          </div>
          <Button variant="warn" size="pill" className="mt-3.5" onClick={onClearAll}>
            {l.clearAll}
          </Button>
        </>
      )}
      <PageHeading level="section" className="mt-6 mb-2.5">{l.browsing}</PageHeading>
      <ListRow
        title={l.clearBrowsing}
        subtitle={<span className="whitespace-normal">{l.clearBrowsingHint}</span>}
        trailing={
          <Button variant="warn" size="pill" className="h-13" loading={clearing === "running"} onClick={onClearBrowsing}>
            {l.clear}
          </Button>
        }
      />
      {clearing === "failed" && (
        // spec/app/websiteRequests.md: browsing data stays until a clear is confirmed and succeeds.
        <RetryNotice className="mt-2.5" onRetry={onConfirmClear} retryLabel={l.retry}>
          {l.notCleared}
        </RetryNotice>
      )}
      <Confirm
        open={removing}
        title={asked ? l.removeTitle(asked.label) : l.clearAllTitle}
        text={asked ? l.removeText : l.clearAllText}
        confirm={
          <>
            <CalendarGlyph name="trash" size={22} />
            {l.confirmRemove}
          </>
        }
        onConfirm={() => onConfirmRemove?.(asked?.id)}
        dismiss={l.keep}
        onDismiss={onKeep}
      />
      {/* spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation". */}
      <Confirm
        open={clearing === "confirm"}
        title={l.clearBrowsingTitle}
        text={l.clearBrowsingText}
        confirm={l.clear}
        onConfirm={onConfirmClear}
        dismiss={l.cancel}
        onDismiss={onCancelClear}
      />
    </section>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  text: string;
  confirm: ReactNode;
  onConfirm?: () => void;
  dismiss: string;
  onDismiss?: () => void;
};

/** One question before something is removed (prototype `calDlg`): focus starts on the panel, not on the removal. */
function Confirm({ open, title, text, confirm, onConfirm, dismiss, onDismiss }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss?.()}>
      <DialogContent
        className="gap-0"
        onPointerDownOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <BrowserDialogText className="mt-2">{text}</BrowserDialogText>
        {/* Prototype `.a-dlg .a-btns`: a column of full-width buttons, 24px under the words. */}
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="warn" size="pill" className="w-full" onClick={onConfirm}>
            {confirm}
          </Button>
          <Button variant="capsule" size="pill" className="w-full" onClick={onDismiss}>
            {dismiss}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
