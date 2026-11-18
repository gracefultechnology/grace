// spec/app/files.md, "Story: Find and open something I saved"; spec/app/files.md, "Story: Save, share and remove the chosen file"
import { AppWindow, Button, Dialog, DialogContent, DialogTitle, EmptyState, FilePhotoViewer, FilesApp, Input, PageText, PdfViewer, RetryNotice } from "@repo/ui";
import { Effect, Stream } from "effect";
import { Folder } from "lucide-react";
import { type ComponentProps, useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { enabled, fileAt, highlightedFile } from "../gen/app__files.ts";
import { useMachine } from "../gen/app__setup.react.ts";
import { FileLibrary } from "./fileLibrary.vibe";
import { useRuntime } from "./useApp.ts";

const changes = Stream.unwrap(Effect.map(FileLibrary, (files) => files.changes));
const home = Stream.unwrap(Effect.map(FileLibrary, (files) => files.home));

export function useFilesHome() {
  const runtime = useRuntime();
  const account = useMachine(runtime).state?.graceAccount.tag;
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(home, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  return useSyncExternalStore(subscribe, () => account === "GraceDeviceSignedIn"
    ? runtime.runSync(Effect.flatMap(FileLibrary, (files) => files.getHome())) : undefined);
}

const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function Files({ onClose, ...cover }: Pick<ComponentProps<"div">, "inert" | "aria-hidden"> & { onClose: () => void }) {
  const runtime = useRuntime();
  const account = useMachine(runtime).state?.graceAccount.tag;
  const [query, setQuery] = useState("");
  const [confirmation, setConfirmation] = useState<{ id: string; lease: string; generation: number }>();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const subscribe = useCallback((changed: () => void) => {
    const fiber = runtime.runFork(Stream.runForEach(changes, () => Effect.sync(changed)));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  const snapshot = useSyncExternalStore(subscribe, () => runtime.runSync(Effect.flatMap(FileLibrary, (files) => files.get())));
  const run = (command: Parameters<FileLibrary.Shape["run"]>[0]) => startTransition(async () => {
    setFailed(false);
    const accepted = await runtime.runPromise(Effect.flatMap(FileLibrary, (files) => files.run(command)));
    if (!accepted) setFailed(true);
  });
  const window = { ...cover, onClose };
  if (snapshot.kind !== "ready" || account !== "GraceDeviceSignedIn") {
    return <AppWindow {...window} title="Files" icon={<Folder aria-hidden />}>
      {snapshot.kind === "unsupported" ? <EmptyState title="Open Files on your Grace tablet" /> :
        snapshot.kind === "unavailable" ? <RetryNotice onRetry={() => run({ kind: "retry" })}>Grace couldn’t read your files.</RetryNotice> :
        snapshot.kind === "signedOut" ? <EmptyState title="Sign in to see your files">
          <Button variant="prominent" size="pill" onClick={() => run({ kind: "account" })}>Go to Account</Button>
        </EmptyState> : <PageText role="status">Opening Files…</PageText>}
    </AppWindow>;
  }

  const { model } = snapshot;
  const selected = fileAt(model, model.selected);
  const photos = model.entries.filter((entry) => entry.kind === "Photo");
  const documents = model.entries.filter((entry) => entry.kind === "Pdf");
  const waiting = pending || snapshot.busy;
  const back = () => run({ kind: "back" });
  const retry = () => run({ kind: "retry" });
  const previewStatus = snapshot.image ? "ready" : snapshot.issue || model.feedback === "ContentFailed" ? "failed" : "loading";

  if (selected.id !== "") {
    if (selected.kind === "Photo") {
      if (!snapshot.image) return <AppWindow {...cover} onClose={back} closeLabel="Back to Files" title={selected.name}>
        {previewStatus === "failed" ? <RetryNotice onRetry={retry}>This photo couldn’t be shown.</RetryNotice> : <PageText role="status">Opening the photo…</PageText>}
      </AppWindow>;
      const target = { id: selected.id, lease: snapshot.lease, generation: model.generation };
      const confirm = () => setConfirmation(target);
      const removing = confirmation?.id === target.id && confirmation.lease === target.lease && confirmation.generation === target.generation;
      return <>
        <FilePhotoViewer {...cover} onClose={back} closeLabel="Back to Files" title={selected.name} src={snapshot.image} alt={selected.name}
          first={!enabled(model, { type: "movePhoto", direction: -1 }, "FileUser")}
          last={!enabled(model, { type: "movePhoto", direction: 1 }, "FileUser")}
          onPrevious={() => run({ kind: "photo", direction: -1 })} onNext={() => run({ kind: "photo", direction: 1 })}
          onDelete={!waiting && enabled(model, { type: "deletePhoto", id: target.id, generation: target.generation }, "FileUser") ? confirm : undefined}
          deleteError={model.feedback === "WriteFailed" ? "This photo wasn’t deleted." : undefined} onRetryDelete={confirm} />
        <Dialog open={removing} onOpenChange={(open) => { if (!open) setConfirmation(undefined); }}>
          <DialogContent>
            <DialogTitle>Delete {selected.name}?</DialogTitle>
            <Button variant="warn" size="pill" disabled={waiting} onClick={() => {
              setConfirmation(undefined);
              if (confirmation) run({ kind: "deletePhoto", ...confirmation });
            }}>Delete photo</Button>
            <Button variant="capsule" size="pill" onClick={() => setConfirmation(undefined)}>Cancel</Button>
          </DialogContent>
        </Dialog>
      </>;
    }
    return <PdfViewer {...cover} onClose={back} closeLabel="Back to Files" title={selected.name} pageLabel={`Page ${model.page} of ${selected.pages}`}
      status={previewStatus} errorLabel="This page couldn’t be shown." onRetry={retry}>
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex gap-3">
          <Button variant="capsule" size="pill" disabled={waiting || model.page <= 1} onClick={() => run({ kind: "page", direction: -1 })}>Previous page</Button>
          <Button variant="capsule" size="pill" disabled={waiting || model.page >= selected.pages} onClick={() => run({ kind: "page", direction: 1 })}>Next page</Button>
        </div>
        {snapshot.image && <img src={snapshot.image} alt={`Page ${model.page} of ${selected.name}`} className="h-auto max-w-full" />}
      </div>
    </PdfViewer>;
  }

  const open = (id: string) => run({ kind: "open", id });
  const browse = model.loaded && (
    <div className="flex flex-wrap items-end gap-3">
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); run({ kind: "search", query }); }}>
        <label>Find a file<Input value={query} maxLength={120} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
        <Button type="submit" variant="capsule" size="pill" disabled={waiting || !query.trim()}>Find</Button>
      </form>
      <Button variant="capsule" size="pill" disabled={waiting} onClick={() => run({ kind: "pick", file: model.tab === "Photos" ? "photo" : "pdf" })}>
        {model.tab === "Photos" ? "Import photo" : "Import PDF"}
      </Button>
      {model.tab === "Photos" && <Button variant="capsule" size="pill" disabled={waiting} onClick={() => run({ kind: "capture" })}>Take photo</Button>}
      {(failed || model.feedback === "WriteFailed") && <PageText role="status">The file wasn’t saved or opened.</PageText>}
    </div>
  );
  return <FilesApp {...window} actions={browse} status={model.loaded ? "ready" : model.feedback === "CatalogFailed" ? "failed" : "loading"}
    onRetry={retry} tab={model.tab === "Photos" ? "photos" : "documents"} highlightId={highlightedFile(model)}
    matches={model.matches.map((id) => ({ id, label: fileAt(model, id).name }))} onPickMatch={open}
    noMatch={model.feedback === "NothingFound" ? model.query : undefined}
    onTabChange={(tab) => run({ kind: "tab", tab: tab === "photos" ? "Photos" : "Documents" })}
    photoGroups={photos.length ? [{ title: "Saved photos", photos: photos.map((entry) => ({ id: entry.id, src: snapshot.thumbs[entry.id], label: entry.name })) }] : []}
    documents={documents.map((entry) => ({ id: entry.id, name: entry.name, detail: date.format(new Date(entry.savedAt)) }))}
    onOpenPhoto={open} onOpenDocument={open} />;
}
