// spec/app/websiteRequests.md, "Story: Answer what a website asks of me"; spec/app/websiteRequests.md, "Story: Save a file a website offers"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/websiteRequests.md, "A website message is answered once with OK, Cancel or typed text"; spec/app/websiteRequests.md, "Allow asks Android, and a website gets a device only when Android allows it too"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"
import { Button, Card, CardFooter, CardTitle, Spinner, TextField } from "@repo/ui";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useState } from "react";
import { type Ask, type DownloadRecord, type Kinds, type Opening, type WebsiteRequest, presented } from "../gen/app__websiteRequests.ts";
import { OverPage } from "./PageLayer.tsx";
import { useWebsiteRequests } from "./useApp.ts";

export function site(address: string): string {
  try { return new URL(address).hostname; } catch { return address; }
}

function devices(kinds: Kinds): string {
  const named = [kinds.camera && "camera", kinds.microphone && "microphone", kinds.location && "location"].filter(Boolean);
  return named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)}` : String(named[0]);
}

function wording(ask: Ask, said: string): { title: string; words?: string; no: string; yes?: string } {
  switch (ask.tag) {
    case "WebsiteMessage":
      if (ask.dialog === "LeavePageMessage") return { title: "Leave this page?", words: said, no: "Stay", yes: "Leave" };
      return { title: "This website says", words: said, no: "Cancel", yes: "OK" };
    case "DownloadOffer": return { title: `Save ${ask.fileName}?`, no: "Don't save", yes: "Save" };
    case "FileChoice": return { title: "Choose a file to send?", no: "Cancel", yes: "Choose a file" };
    case "SitePermission": return { title: `Let ${site(ask.origin)} use your ${devices(ask.kinds)}?`, no: "Don't allow", yes: "Allow" };
    case "OtherApp":
      if (ask.handoff === "RefusedLink") return { title: "This link can't open here.", no: "Close" };
      return { title: ask.handoff === "DialApp" ? "Open the phone to call?" : ask.handoff === "SendToApp" ? "Open an app to send a message?" : "Open another app?",
        words: ask.fallback === "" ? said.replace(/^[a-z]+:/i, "") : `If no app opens it, ${site(ask.fallback)} opens here instead.`, no: "Cancel", yes: "Open" };
    case "BlockedSignIn": return { title: `${ask.provider} sign-in opens in your browser.`, no: "Cancel", yes: "Continue" };
  }
}

function failure(ask: Ask): string {
  switch (ask.tag) {
    case "BlockedSignIn": return "Your browser didn't open.";
    case "FileChoice": return "Your files didn't open.";
    case "SitePermission": return `Android didn't allow your ${devices(ask.kinds)}.`;
    default: return "That app didn't open.";
  }
}

const downloadMark = { Saving: <Spinner size="sm" label="Saving" />, Saved: <CircleCheck aria-label="Saved" className="text-primary" />, SaveFailed: <CircleAlert aria-label="Not saved" className="text-destructive" />, NotSaved: <CircleAlert aria-label="Not saved" className="text-muted-foreground" /> };

function Question({ request, said, answer }: { request: WebsiteRequest; said: string; answer: (accept: boolean, text: string) => void }) {
  const [text, setText] = useState("");
  const asked = wording(request.ask, said);
  const prompt = request.ask.tag === "WebsiteMessage" && request.ask.dialog === "PromptMessage";
  const alert = request.ask.tag === "WebsiteMessage" && request.ask.dialog === "AlertMessage";
  return (
    <Card role="alertdialog" aria-label={asked.title}>
      <CardTitle>{asked.title}</CardTitle>
      {asked.words && <p className="text-body break-words whitespace-pre-line text-muted-foreground">{asked.words}</p>}
      {prompt && <TextField label="Your answer" value={text} onChange={(e) => setText(e.target.value)} />}
      <CardFooter>
        {!alert && <Button variant="capsule" size="pill" onClick={() => answer(false, "")}>{asked.no}</Button>}
        {asked.yes && <Button variant="prominent" size="pill" onClick={() => answer(true, prompt ? text : "")}>{asked.yes}</Button>}
      </CardFooter>
    </Card>
  );
}

/** @model spec/app/websiteRequests.md */
export function WebsiteRequests() {
  const { requests, can, send, said } = useWebsiteRequests();
  if (!requests) return null;
  const request = presented(requests);
  const notices = [
    ...requests.downloads.map((d: DownloadRecord) => ({ key: `d${d.id}`, mark: downloadMark[d.status], title: d.fileName, close: d.status === "Saving" ? undefined : { type: "dismissDownload", id: d.id } as const })),
    ...requests.openings.filter((o: Opening) => o.failed).map((o: Opening) => ({ key: `o${o.id}`, mark: downloadMark.SaveFailed, title: failure(o.ask), close: { type: "dismissOpening", id: o.id } as const })),
  ];
  if (request.id === 0 && notices.length === 0) return null;
  const answer = (accept: boolean, text: string) => {
    const event = { type: "answer", id: request.id, choice: { accept, text } } as const;
    if (can(event)) void send(event);
  };

  return (
    <OverPage className="absolute top-6 left-1/2 z-[2] flex w-[560px] -translate-x-1/2 flex-col gap-3">
      {request.id > 0 && <Question key={request.id} request={request} said={said(request.id)} answer={answer} />}
      {notices.map(({ key, mark, title, close }) => (
        <Card key={key} className="flex-row items-center gap-4 py-4">
          {mark}
          <span className="min-w-0 flex-1 truncate text-body font-bold">{title}</span>
          {close && <Button variant="plain" size="compact-icon" aria-label="Close" onClick={() => { if (can(close)) void send(close); }}><X aria-hidden /></Button>}
        </Card>
      ))}
    </OverPage>
  );
}
