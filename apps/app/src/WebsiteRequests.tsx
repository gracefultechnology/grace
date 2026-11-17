// spec/app/websiteRequests.md, "Story: Answer what a website asks of me"; spec/app/websiteRequests.md, "Story: Save a file a website offers"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"
import {
  BrowserNoticeDialog, Button, Card, type ExternalAppKind, ExternalAppDialog, RefusedSignInDialog, type SiteDevice, SitePermissionDialog,
  Spinner, WebsiteDownloadDialog, WebsiteFileRequestDialog, type WebsiteMessageKind, WebsiteMessageDialog,
} from "@repo/ui";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import type { ReactNode } from "react";
import { type Ask, type DownloadStatus, type Kinds, type MessageKind, type WebsiteRequest, presented } from "../gen/app__websiteRequests.ts";
import { tabUrl } from "../gen/app__browser.ts";
import { OverPage } from "./PageLayer.tsx";
import { useWebsiteRequests, useWorkspace } from "./useApp.ts";

export function site(address: string): string {
  return URL.parse(address)?.hostname || address;
}

const messageKinds: Record<MessageKind, WebsiteMessageKind> = { AlertMessage: "alert", ConfirmMessage: "confirm", PromptMessage: "prompt", LeavePageMessage: "beforeunload" };

const devices = (kinds: Kinds): SiteDevice[] => (["camera", "microphone", "location"] as const).filter((kind) => kinds[kind]);

const schemes: Record<string, ExternalAppKind> = { tel: "call", mailto: "email", sms: "message", smsto: "message", geo: "map", market: "store" };
const appKind = (link: string): ExternalAppKind => schemes[link.slice(0, link.indexOf(":")).toLowerCase()] ?? "other";

function failure(ask: Ask): string {
  switch (ask.tag) {
    case "BlockedSignIn": return "Your browser didn't open.";
    case "FileChoice": return "Your files didn't open.";
    case "SitePermission": return `Android didn't allow your ${devices(ask.kinds).join(" and ")}.`;
    default: return "That app didn't open.";
  }
}

const downloadMark: Record<DownloadStatus, ReactNode> = {
  Saving: <Spinner size="sm" label="Saving" />,
  Saved: <CircleCheck aria-label="Saved" className="text-primary" />,
  SaveFailed: <CircleAlert aria-label="Not saved" className="text-destructive" />,
  NotSaved: <CircleAlert aria-label="Not saved" className="text-muted-foreground" />,
};

type QuestionProps = { request: WebsiteRequest; website: string; said: string; waiting: boolean; open: boolean; answer: (accept: boolean, text?: string) => void };

function Question({ request: { ask }, website, said, waiting, open, answer }: QuestionProps) {
  const yes = () => answer(true), no = () => answer(false);
  switch (ask.tag) {
    case "WebsiteMessage": return <WebsiteMessageDialog open={open} kind={messageKinds[ask.dialog]} site={website} message={said} onAnswer={answer} />;
    case "DownloadOffer": return <WebsiteDownloadDialog open={open} offer={{ site: website, name: ask.fileName }} onSave={yes} onDecline={no} />;
    case "FileChoice": return <WebsiteFileRequestDialog open={open} site={website} onChoose={yes} onCancel={no} />;
    case "SitePermission": return <SitePermissionDialog open={open} site={site(ask.origin)} devices={devices(ask.kinds)} waiting={waiting} onAllow={yes} onDeny={no} />;
    case "OtherApp": return <ExternalAppDialog open={open} kind={appKind(said)} target={said.replace(/^[a-z]+:/i, "")} canOpen={ask.handoff !== "RefusedLink"} onContinue={yes} onCancel={no} />;
    case "BlockedSignIn": return <RefusedSignInDialog open={open} provider={ask.provider} site={website} onContinue={yes} onCancel={no} />;
  }
}

/** @model spec/app/websiteRequests.md */
export function WebsiteRequests() {
  const { requests, can, send, said } = useWebsiteRequests();
  const { workspace } = useWorkspace();
  if (!requests || !workspace) return null;
  const request = presented(requests);
  const failed = requests.openings.find((o) => o.failed);
  const tab = workspace.browser.tabs.find((t) => t.id === request.tab);
  const answer = (accept: boolean, text = "") => {
    const event = { type: "answer", id: request.id, choice: { accept, text } } as const;
    if (can(event)) void send(event);
  };
  const close = (event: Parameters<typeof send>[0]) => () => { if (can(event)) void send(event); };
  return (
    <>
      {request.id > 0 && (
        <OverPage key={request.id} className="fixed inset-0">
          {(drawn) => <Question open={drawn} request={request} website={site(tab ? tabUrl(tab) : "")} said={said(request.id)} waiting={requests.asking.some((a) => a.id === request.id)} answer={answer} />}
        </OverPage>
      )}
      {request.id === 0 && failed && (
        <OverPage key={`o${failed.id}`} className="fixed inset-0">
          {(drawn) => <BrowserNoticeDialog open={drawn} title={failure(failed.ask)} onClose={close({ type: "dismissOpening", id: failed.id })} />}
        </OverPage>
      )}
      {requests.downloads.length > 0 && (
        <OverPage className="absolute top-6 left-1/2 z-[2] flex w-[560px] -translate-x-1/2 flex-col gap-3">
          {requests.downloads.map((d) => (
            <Card key={d.id} className="flex-row items-center gap-4 py-4">
              {downloadMark[d.status]}
              <span className="min-w-0 flex-1 truncate text-body font-bold">{d.fileName}</span>
              {d.status !== "Saving" && <Button variant="plain" size="compact-icon" aria-label="Close" onClick={close({ type: "dismissDownload", id: d.id })}><X aria-hidden /></Button>}
            </Card>
          ))}
        </OverPage>
      )}
    </>
  );
}
