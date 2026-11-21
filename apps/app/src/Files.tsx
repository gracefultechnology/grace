// spec/app/files.md, "Story: Find and open something I saved"; spec/app/files.md, "Story: Save, share and remove the chosen file"; spec/app/files.md, "Delete is the explicit local action and does not delete its source email"; spec/app/files.md, "Sharing a photo opens a draft without sending it"
import { AppWindow, Button, EmptyState, FilePhotoViewer, FilesApp, type FilesPhotoGroup, Input, PageText, PdfViewer, RetryNotice } from "@repo/ui";
import { Effect, Stream } from "effect";
import { Folder } from "lucide-react";
import { type ComponentProps, useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { deviceOrigin, enabled, type Event, fileAt, type Files as Library, highlightedFile, type SavedFile } from "../gen/app__files.ts";
import { useMachine } from "../gen/app__setup.react.ts";
import { canImport, FileLibrary } from "./fileLibrary.vibe";
import { filesAccount, type Origin } from "./files.vibe";
import { useRuntime } from "./useApp.ts";

const changes = Stream.unwrap(Effect.map(FileLibrary, (files) => files.changes));
const home = Stream.unwrap(Effect.map(FileLibrary, (files) => files.home));

export function useFilesHome() {
  const runtime = useRuntime();
  const account = filesAccount(useMachine(runtime).state?.graceAccount);
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(home, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  return useSyncExternalStore(subscribe, () => account !== undefined
    ? runtime.runSync(Effect.flatMap(FileLibrary, (files) => files.getHome())) : undefined);
}

const month = new Intl.DateTimeFormat(undefined, { month: "long" });
const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const day = 86_400_000;

function savedWhen(savedAt: number, now: Date) {
  const saved = new Date(savedAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const name = (saved.getFullYear() === now.getFullYear() ? month : monthYear).format(saved);
  return { group: savedAt >= today - 6 * day ? "This week" : name, detail: savedAt >= today ? "Saved today" : `Saved in ${name}` };
}

const fromLine = ({ from, subject }: Partial<Origin>) => (from ? [`From ${from}`, subject].filter(Boolean).join(" · ") : undefined);

function photoGroups(photos: readonly SavedFile[], thumbs: Readonly<Record<string, string>>, origins: Readonly<Record<string, Partial<Origin>>>, now: Date) {
  const grouped = new Map<string, SavedFile[]>();
  for (const entry of [...photos].sort((a, b) => b.savedAt - a.savedAt)) {
    const title = savedWhen(entry.savedAt, now).group;
    grouped.set(title, [...grouped.get(title) ?? [], entry]);
  }
  return [...grouped].map(([title, entries]): FilesPhotoGroup => {
    const lines = new Set(entries.map((entry) => fromLine(origins[entry.id] ?? {})));
    const [from] = lines;
    return { title, ...(lines.size === 1 && from ? { from } : {}), photos: entries.map((entry) => ({ id: entry.id, src: thumbs[entry.id], label: entry.name })) };
  });
}

const offered = (model: Library, event: Event, act: () => void) => (enabled(model, event, "FileUser") ? act : undefined);

export function Files({ onClose, ...cover }: Pick<ComponentProps<"div">, "inert" | "aria-hidden"> & { onClose: () => void }) {
  const runtime = useRuntime();
  const account = filesAccount(useMachine(runtime).state?.graceAccount);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);
  const [unshared, setUnshared] = useState<string>();
  const [pending, startTransition] = useTransition();
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(changes, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  const snapshot = useSyncExternalStore(subscribe, () => runtime.runSync(Effect.flatMap(FileLibrary, (files) => files.get())));
  const run = (command: Parameters<FileLibrary.Shape["run"]>[0]) => startTransition(async () => {
    setFailed(false);
    setUnshared(undefined);
    const accepted = await runtime.runPromise(Effect.flatMap(FileLibrary, (files) => files.run(command)));
    if (accepted) return;
    if (command.kind === "sharePhoto") setUnshared(command.id);
    else setFailed(true);
  });
  const window = { ...cover, onClose };
  if (snapshot.kind !== "ready" || snapshot.owner !== account) {
    return <AppWindow {...window} title="Files" icon={<Folder aria-hidden />}>
      {snapshot.kind === "unsupported" ? <EmptyState title="Open Files on your Grace tablet" /> :
        snapshot.kind === "unavailable" ? <RetryNotice onRetry={() => run({ kind: "retry" })}>Grace couldn’t read your files.</RetryNotice> :
        snapshot.kind === "signedOut" ? <EmptyState title="Sign in to see your files">
          <Button variant="prominent" size="pill" onClick={() => run({ kind: "account" })}>Go to Account</Button>
        </EmptyState> : <PageText role="status">Opening Files…</PageText>}
    </AppWindow>;
  }

  const { model } = snapshot;
  const now = new Date(snapshot.listedAt);
  const selected = fileAt(model, model.selected);
  const photos = model.entries.filter((entry) => entry.kind === "Photo");
  const documents = model.entries.filter((entry) => entry.kind === "Pdf");
  const waiting = pending || snapshot.busy;
  const back = () => run({ kind: "back" });
  const retry = () => run({ kind: "retry" });
  const previewStatus = snapshot.image ? "ready" : snapshot.issue || model.feedback === "ContentFailed" ? "failed" : "loading";

  const request = snapshot.attachmentImport;
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
      if (!snapshot.image) return <AppWindow {...cover} onClose={back} closeLabel="Back to Files" title={selected.name}>
        {previewStatus === "failed" ? <RetryNotice onRetry={retry}>This photo couldn’t be shown.</RetryNotice> : <PageText role="status">Opening the photo…</PageText>}
      </AppWindow>;
      const target = { id: selected.id, lease: snapshot.lease, generation: model.generation };
      const idle = (event: Event, act: () => void) => (waiting ? undefined : offered(model, event, act));
      const remove = idle({ type: "deletePhoto", ...target }, () => run({ kind: "deletePhoto", ...target }));
      const share = selected.origin === deviceOrigin ? undefined : idle({ type: "sharePhoto", ...target }, () => run({ kind: "sharePhoto", ...target }));
      const deleteFailed = model.feedback === "WriteFailed";
      return <FilePhotoViewer {...cover} onClose={back} closeLabel="Back to Files" title={selected.name} src={snapshot.image} alt={selected.name}
        first={!enabled(model, { type: "movePhoto", direction: -1 }, "FileUser")}
        last={!enabled(model, { type: "movePhoto", direction: 1 }, "FileUser")}
        onPrevious={() => run({ kind: "photo", direction: -1 })} onNext={() => run({ kind: "photo", direction: 1 })}
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
        {snapshot.image?.startsWith("data:application/pdf;") ?
          <object data={`${snapshot.image}#page=${model.page}`} type="application/pdf" aria-label={selected.name} className="h-[640px] w-full" /> :
          snapshot.image && <img src={snapshot.image} alt={`Page ${model.page} of ${selected.name}`} className="h-auto max-w-full" />}
      </div>
    </PdfViewer>;
  }

  const open = (id: string) => run({ kind: "open", id });
  const sought = query.trim();
  const idle = (event: Event, act: () => void) => (waiting ? undefined : offered(model, event, act));
  const find = idle({ type: "findFiles", owner: snapshot.lease, query: sought }, () => run({ kind: "search", query }));
  const importing = !waiting && canImport(snapshot);
  const pick = importing ? () => run({ kind: "pick", file: model.tab === "Photos" ? "photo" : "pdf" }) : undefined;
  const capture = importing && model.tab === "Photos" ? () => run({ kind: "capture" }) : undefined;
  const tab = (next: "Photos" | "Documents") => idle({ type: "chooseTab", tab: next }, () => run({ kind: "tab", tab: next }));
  const browse = model.loaded && (
    <div className="flex flex-wrap items-end gap-3">
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); find?.(); }}>
        <label>Find a file<Input value={query} maxLength={120} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
        <Button type="submit" variant="capsule" size="pill" disabled={!find}>Find</Button>
      </form>
      {snapshot.importer && <Button variant="capsule" size="pill" disabled={!pick} onClick={pick}>
        {model.tab === "Photos" ? "Import photo" : "Import PDF"}
      </Button>}
      {snapshot.importer && model.tab === "Photos" && <Button variant="capsule" size="pill" disabled={!capture} onClick={capture}>Take photo</Button>}
      {failed || model.feedback === "WriteFailed" ? <PageText role="status">The file wasn’t saved or opened.</PageText> :
        model.feedback === "FilesSaved" && <PageText role="status">Saved in Files.</PageText>}
    </div>
  );
  return <FilesApp {...window} actions={browse} status={model.loaded ? "ready" : model.feedback === "CatalogFailed" ? "failed" : "loading"}
    onRetry={retry} tab={model.tab === "Photos" ? "photos" : "documents"} highlightId={highlightedFile(model)}
    matches={model.matches.map((id) => ({ id, label: fileAt(model, id).name }))} onPickMatch={open}
    noMatch={model.feedback === "NothingFound" ? model.query : undefined}
    onTabChange={tab(model.tab) && ((next) => tab(next === "photos" ? "Photos" : "Documents")?.())}
    photoGroups={photoGroups(photos, snapshot.thumbs, snapshot.origins, now)}
    documents={documents.map((entry) => {
      const { from } = snapshot.origins[entry.id] ?? {};
      const { detail } = savedWhen(entry.savedAt, now);
      return { id: entry.id, name: entry.name, detail: from ? `From ${from} · ${detail}` : detail };
    })}
    onOpenPhoto={open} onOpenDocument={open} />;
}
