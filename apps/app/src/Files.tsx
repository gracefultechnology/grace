// spec/app/files.md, "Story: Find and open something I saved"; spec/app/files.md, "Story: Save, share and remove the chosen file"; spec/app/files.md, "Delete is the explicit local action and does not delete its source email"; spec/app/files.md, "Sharing a photo opens a draft without sending it"
import { AppWindow, Button, EmptyState, FilePhotoViewer, FilesApp, type FilesPhotoGroup, Input, PageText, PdfViewer, RetryNotice, Toast } from "@repo/ui";
import { Effect } from "effect";
import { Camera, Folder, Search, Upload } from "lucide-react";
import { type ComponentProps, useMemo, useState, useTransition } from "react";
import { deviceOrigin, enabled, type Event, fileAt, type Files as Library, highlightedFile, type SavedFile } from "../gen/app__files.ts";
import type { Setup } from "../gen/app__setup.ts";
import { canImport, FileLibrary } from "./fileLibrary.vibe";
import { filesAccount, type Origin } from "./files.vibe";
import { useFileLibrarySnapshot, useRuntime, useSetupSelector } from "./useApp.ts";

const month = new Intl.DateTimeFormat(undefined, { month: "long" });
const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const day = 86_400_000;

function savedWhen(savedAt: number, todayStart: number, currentYear: number) {
  const saved = new Date(savedAt);
  const name = (saved.getFullYear() === currentYear ? month : monthYear).format(saved);
  return { group: savedAt >= todayStart - 6 * day ? "This week" : name, detail: savedAt >= todayStart ? "Saved today" : `Saved in ${name}` };
}

const fromLine = ({ from, subject }: Partial<Origin>) => (from ? [`From ${from}`, subject].filter(Boolean).join(" · ") : undefined);

function photoGroups(
  photos: readonly SavedFile[],
  thumbs: Readonly<Record<string, string>>,
  origins: Readonly<Record<string, Partial<Origin>>>,
  todayStart: number,
  currentYear: number,
) {
  const grouped = new Map<string, SavedFile[]>();
  const sorted = [...photos].sort((a, b) => b.savedAt - a.savedAt);
  for (const entry of sorted) {
    const title = savedWhen(entry.savedAt, todayStart, currentYear).group;
    const list = grouped.get(title);
    if (list) list.push(entry);
    else grouped.set(title, [entry]);
  }
  const result: FilesPhotoGroup[] = [];
  for (const [title, entries] of grouped) {
    const lines = new Set<string | undefined>();
    const groupPhotos: FilesPhotoGroup["photos"] = [];
    for (const entry of entries) {
      lines.add(fromLine(origins[entry.id] ?? {}));
      groupPhotos.push({ id: entry.id, src: thumbs[entry.id], label: entry.name });
    }
    const [from] = lines;
    result.push({ title, ...(lines.size === 1 && from ? { from } : {}), photos: groupPhotos });
  }
  return result;
}

const offered = (model: Library, event: Event, act: () => void) => (enabled(model, event, "FileUser") ? act : undefined);
const selectFilesAccount = (setup: Setup | undefined) => filesAccount(setup?.graceAccount);
const emptyGroups: FilesPhotoGroup[] = [];
const emptyDocuments: { id: string; name: string; detail: string }[] = [];

export function Files({ onClose, ...cover }: Pick<ComponentProps<"div">, "inert" | "aria-hidden"> & { onClose: () => void }) {
  const runtime = useRuntime();
  const account = useSetupSelector(selectFilesAccount);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  const [unshared, setUnshared] = useState<string>();
  const [pending, startTransition] = useTransition();
  const snapshot = useFileLibrarySnapshot();

  const readySnapshot = snapshot.kind === "ready" && snapshot.owner === account ? snapshot : undefined;
  const activeTab = readySnapshot?.model.tab;
  const entries = readySnapshot?.model.entries;
  const listedAt = readySnapshot?.listedAt;
  const thumbs = readySnapshot?.thumbs;
  const origins = readySnapshot?.origins;

  const groupedPhotos = useMemo(() => {
    if (!entries || !thumbs || !origins || listedAt === undefined || activeTab !== "Photos") return emptyGroups;
    const now = new Date(listedAt);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const photos = entries.filter((entry) => entry.kind === "Photo");
    return photoGroups(photos, thumbs, origins, todayStart, now.getFullYear());
  }, [entries, thumbs, origins, listedAt, activeTab]);

  const formattedDocuments = useMemo(() => {
    if (!entries || !origins || listedAt === undefined || activeTab !== "Documents") return emptyDocuments;
    const now = new Date(listedAt);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const currentYear = now.getFullYear();
    const docs: { id: string; name: string; detail: string }[] = [];
    for (const entry of entries) {
      if (entry.kind !== "Pdf") continue;
      const { from } = origins[entry.id] ?? {};
      const { detail } = savedWhen(entry.savedAt, todayStart, currentYear);
      docs.push({ id: entry.id, name: entry.name, detail: from ? `From ${from} · ${detail}` : detail });
    }
    return docs;
  }, [entries, origins, listedAt, activeTab]);

  const run = (command: Parameters<FileLibrary.Shape["run"]>[0]) => startTransition(async () => {
    setFailed(false);
    setUnshared(undefined);
    const accepted = await runtime.runPromise(Effect.flatMap(FileLibrary, (files) => files.run(command)));
    if (accepted) return;
    if (command.kind === "sharePhoto") setUnshared(command.id);
    else setFailed(true);
  });
  const windowProps = { ...cover, onClose };
  if (!readySnapshot) {
    return <AppWindow {...windowProps} title="Files" icon={<Folder aria-hidden />}>
      {snapshot.kind === "unsupported" ? <EmptyState title="Open Files on your Grace tablet" /> :
        snapshot.kind === "unavailable" ? <RetryNotice onRetry={() => run({ kind: "retry" })}>Grace couldn’t read your files.</RetryNotice> :
        snapshot.kind === "signedOut" ? <EmptyState title="Sign in to see your files">
          <Button variant="prominent" size="pill" onClick={() => run({ kind: "account" })}>Go to Account</Button>
        </EmptyState> : <PageText role="status">Opening Files…</PageText>}
    </AppWindow>;
  }

  const { model } = readySnapshot;
  const selected = fileAt(model, model.selected);
  const waiting = pending || readySnapshot.busy;
  const back = () => run({ kind: "back" });
  const retry = () => run({ kind: "retry" });
  const previewStatus = readySnapshot.image ? "ready" : readySnapshot.issue || model.feedback === "ContentFailed" ? "failed" : "loading";

  const request = readySnapshot.attachmentImport;
  if (request && model.loaded) {
    return <AppWindow {...cover} title="Save attachment to Files?" icon={<Folder aria-hidden />}>
      <div className="flex flex-wrap gap-3">
        <Button variant="prominent" size="pill" disabled={waiting} onClick={() => run({ kind: "confirmAttachment", request })}>Save attachment</Button>
        <Button variant="capsule" size="pill" disabled={waiting} onClick={() => run({ kind: "cancelAttachment", request })}>Cancel</Button>
      </div>
      {waiting && <PageText role="status">Saving attachment…</PageText>}
      {failed && <PageText role="status">The attachment couldn’t be saved.</PageText>}
    </AppWindow>;
  }

  if (selected.id !== "") {
    if (selected.kind === "Photo") {
      if (!readySnapshot.image) return <AppWindow {...cover} onClose={back} closeLabel="Back to Files" title={selected.name}>
        {previewStatus === "failed" ? <RetryNotice onRetry={retry}>This photo couldn’t be shown.</RetryNotice> : <PageText role="status">Opening the photo…</PageText>}
      </AppWindow>;
      const target = { id: selected.id, lease: readySnapshot.lease, generation: model.generation };
      const idle = (event: Event, act: () => void) => (waiting ? undefined : offered(model, event, act));
      const remove = idle({ type: "deletePhoto", ...target }, () => run({ kind: "deletePhoto", ...target }));
      const share = selected.origin === deviceOrigin ? undefined : idle({ type: "sharePhoto", ...target }, () => run({ kind: "sharePhoto", ...target }));
      const previous = idle({ type: "movePhoto", direction: -1 }, () => run({ kind: "photo", direction: -1 }));
      const next = idle({ type: "movePhoto", direction: 1 }, () => run({ kind: "photo", direction: 1 }));
      const deleteFailed = model.feedback === "WriteFailed";
      return <FilePhotoViewer {...cover} onClose={back} closeLabel="Back to Files" title={selected.name} src={readySnapshot.image} alt={selected.name}
        first={!enabled(model, { type: "movePhoto", direction: -1 }, "FileUser")}
        last={!enabled(model, { type: "movePhoto", direction: 1 }, "FileUser")}
        onPrevious={previous} onNext={next}
        onShare={share} onDelete={remove}
        deleteError={deleteFailed ? "This photo wasn’t deleted." : unshared === selected.id ? "This photo couldn’t be shared." : undefined}
        onRetryDelete={deleteFailed ? remove : share} />;
    }
    return <PdfViewer {...cover} onClose={back} closeLabel="Back to Files" title={selected.name} pageLabel={`Page ${model.page} of ${selected.pages}`}
      status={previewStatus} errorLabel="This page couldn’t be shown." onRetry={retry}>
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex gap-3">
          {([-1, 1] as const).map((direction) => {
            const turn = waiting ? undefined : offered(model, { type: "movePage", direction }, () => run({ kind: "page", direction }));
            return <Button key={direction} variant="capsule" size="pill" disabled={!turn} onClick={turn}>{direction < 0 ? "Previous page" : "Next page"}</Button>;
          })}
        </div>
        {readySnapshot.image?.startsWith("data:application/pdf;") ?
          <object data={`${readySnapshot.image}#page=${model.page}`} type="application/pdf" aria-label={selected.name} className="h-[640px] w-full" /> :
          readySnapshot.image && <img src={readySnapshot.image} alt={`Page ${model.page} of ${selected.name}`} className="h-auto max-w-full" />}
      </div>
    </PdfViewer>;
  }

  const open = (id: string) => run({ kind: "open", id });
  const sought = query.trim();
  const idle = (event: Event, act: () => void) => (waiting ? undefined : offered(model, event, act));
  const find = idle({ type: "findFiles", owner: readySnapshot.lease, query: sought }, () => run({ kind: "search", query }));
  const importing = !waiting && canImport(readySnapshot);
  const pick = importing ? () => run({ kind: "pick", file: model.tab === "Photos" ? "photo" : "pdf" }) : undefined;
  const capture = importing && model.tab === "Photos" ? () => run({ kind: "capture" }) : undefined;
  const tab = (next: "Photos" | "Documents") => idle({ type: "chooseTab", tab: next }, () => run({ kind: "tab", tab: next }));
  const statusNote = failed || model.feedback === "WriteFailed" ? "The file wasn’t saved or opened." :
    model.feedback === "FilesSaved" ? "Saved in Files." : undefined;
  const browse = (model.loaded || model.pending === "ReadingCatalog") && (
    <>
      <form className="flex items-center gap-0.5 pl-2.5" onSubmit={(event) => { event.preventDefault(); find?.(); }}>
        <Search size={20} strokeWidth={2.2} className="shrink-0 text-muted-foreground" aria-hidden />
        <Input aria-label="Find a file" placeholder="Find a file" value={query} maxLength={120}
          className="h-12 w-40 bg-transparent px-2.5 shadow-none focus:shadow-none"
          onChange={(event) => setQuery(event.currentTarget.value)} />
        <Button type="submit" variant="plain" size="compact" disabled={!find}>Find</Button>
      </form>
      {readySnapshot.importer && (
        <Button variant="plain" size="compact" disabled={!pick} onClick={pick}>
          <Upload size={20} strokeWidth={2.2} aria-hidden />
          {model.tab === "Photos" ? "Import photo" : "Import PDF"}
        </Button>
      )}
      {readySnapshot.importer && model.tab === "Photos" && (
        <Button variant="plain" size="compact" disabled={!capture} onClick={capture}>
          <Camera size={20} strokeWidth={2.2} aria-hidden />
          Take photo
        </Button>
      )}
    </>
  );
  return (
    <>
      <FilesApp {...windowProps} actions={browse} status={model.loaded ? "ready" : model.feedback === "CatalogFailed" ? "failed" : "loading"}
        onRetry={retry} tab={model.tab === "Photos" ? "photos" : "documents"} highlightId={highlightedFile(model)}
        matches={model.matches.map((id) => ({ id, label: fileAt(model, id).name }))} onPickMatch={open}
        noMatch={model.feedback === "NothingFound" ? model.query : undefined}
        onTabChange={tab(model.tab) && ((next) => tab(next === "photos" ? "Photos" : "Documents")?.())}
        photoGroups={groupedPhotos}
        documents={formattedDocuments}
        onOpenPhoto={open} onOpenDocument={open} />
      {statusNote && <Toast placement="screen">{statusNote}</Toast>}
    </>
  );
}
