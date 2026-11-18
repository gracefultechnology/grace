// spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "Story: See what needs me on Home"; spec/app/notices.md, "Home shows one banner: the connection first, then the first reminder to come due"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"
import { Banner, BellIcon, Button, Toast, WifiSlash } from "@repo/ui";
import { Effect } from "effect";
import { Wifi, X } from "lucide-react";
import { type Notice, bannerOf, isBackOnline } from "../gen/app__notices.ts";
import { useMachine } from "../gen/app__notices.react.ts";
import { NoticeHost, Reply } from "./notices.vibe";
import { OverPage } from "./PageLayer.tsx";
import { useRuntime, useWorkspace } from "./useApp.ts";

const words = (notice: Notice) => (isBackOnline(notice) ? "Back online" : notice.offer === "SeeDetails" ? `Reminder: ${notice.subject}` : notice.subject);
const toastButton = "h-11 px-3.5 text-body font-bold text-frame-lilac bg-glass/14 active:bg-glass/24";

function useNotices() {
  const runtime = useRuntime();
  const { state, can } = useMachine(runtime);
  const host = (use: (host: NoticeHost["Service"]) => Effect.Effect<void>) => () => void runtime.runPromise(Effect.flatMap(Effect.service(NoticeHost), use));
  return { state, can, host };
}

export function Notices({ above }: { above: number }) {
  const { state, can, host } = useNotices();
  const toast = state?.shown.at(0);
  if (toast === undefined) return null;
  const actable = can({ type: "act", id: toast.id }, "Person");
  const act = host((h) => h.act(toast.id));
  return (
    <OverPage className="absolute left-1/2 z-[45] -translate-x-1/2" style={{ bottom: above + 24 }}>
      <Toast key={toast.id} onUndo={toast.offer === "Undo" && actable ? act : undefined}>
        {words(toast)}
        {toast.offer === "SeeDetails" && actable && (
          <Button variant="plain" size="compact" className={toastButton} onClick={act}>
            See details
          </Button>
        )}
        {can({ type: "closeToast", id: toast.id }, "Person") && (
          <Button variant="plain" size="compact" aria-label="Close" className={toastButton} onClick={host((h) => h.close(toast.id))}>
            <X aria-hidden size={20} strokeWidth={2.4} />
          </Button>
        )}
      </Toast>
    </OverPage>
  );
}

export function NoticeBanner() {
  const { state, host } = useNotices();
  const { can, send } = useWorkspace();
  if (state === undefined) return null;
  const banner = bannerOf(state);
  const wifi = { type: "chooseSettingsPage", page: "NetworkSettings" } as const;
  switch (banner.kind) {
    case "NoBanner":
      return null;
    case "OfflineBanner":
      return (
        <Banner icon={<WifiSlash size={30} />} title="Not connected to the internet" line="Grace can help you reconnect."
          actions={<Button variant="prominent" size="compact" disabled={!can(wifi)} onClick={() => void send(wifi)}><Wifi aria-hidden size={22} strokeWidth={2.2} />Fix Wi-Fi</Button>} />
      );
    case "ReminderBanner":
      return (
        <Banner icon={<span className="flex text-alert"><BellIcon className="size-7.5" /></span>} title={banner.subject}
          actions={<>
            <Button variant="prominent" size="compact" onClick={host((h) => h.reply(Reply.SeeDetails({ reminder: banner.subject })))}>See details</Button>
            <Button variant="plain" size="compact-icon" aria-label="Dismiss" onClick={host((h) => h.reply(Reply.Dismiss({ reminder: banner.subject })))}><X aria-hidden size={24} strokeWidth={1.75} /></Button>
          </>} />
      );
  }
}
