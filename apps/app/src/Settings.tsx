// spec/app/shell.md, "Settings and rail popovers preserve the surface underneath"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"
// Settings: its pages beside the list, and on About this tablet, Clear browsing data behind one confirmation.
import { Alert, Button, Dialog, DialogContent, DialogTitle, EmptyState, ListRow, PageHeading, SettingsApp, type SettingsPage as PageName } from "@repo/ui";
import { CircleAlert, Trash, X } from "lucide-react";
import type { ComponentProps } from "react";
import type { SettingsPage } from "../gen/app__shell.ts";
import { useWebsiteRequests, useWorkspace } from "./useApp.ts";

const names: Record<SettingsPage, PageName> = {
  TextSizeSettings: "text-size", BrightnessSettings: "brightness", VoiceSettings: "voice", NetworkSettings: "wifi", AboutSettings: "about",
};

/** @model spec/app/websiteRequests.md */
export function Settings(props: Pick<ComponentProps<"div">, "inert" | "aria-hidden">) {
  const { workspace, can, send } = useWorkspace();
  const website = useWebsiteRequests();
  const page = workspace!.device.settingsPage;
  const choose = (name: PageName) => {
    const event = { type: "chooseSettingsPage", page: (Object.keys(names) as SettingsPage[]).find((p) => names[p] === name)! } as const;
    if (can(event)) void send(event);
  };
  const clear = (confirmed: boolean) => {
    const event = { type: "answerClearBrowsingData", confirmed } as const;
    if (website.can(event)) void website.send(event);
  };

  return (
    <SettingsApp page={names[page]} onPageChange={choose} placement="inline" {...props}
      onClose={() => { if (can({ type: "returnToApplication" })) void send({ type: "returnToApplication" }); }}>
      {page === "AboutSettings" ? (
        <>
          <PageHeading>About this tablet</PageHeading>
          {/* spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation" */}
          <ListRow className="mt-6" title="Clear browsing data" leading={<Trash size={26} strokeWidth={2} aria-hidden />}
            onClick={() => { if (website.can({ type: "requestClearBrowsingData" })) void website.send({ type: "requestClearBrowsingData" }); }} />
          {/* A purge that left a cookie, or failed, cleared nothing. */}
          {website.requests?.clearing === "ClearFailed" && (
            <Alert variant="destructive" icon={<CircleAlert />} className="mt-4 flex items-center gap-4 text-body font-bold">
              <span className="flex-1">Your browsing data wasn't cleared.</span>
              <Button variant="plain" size="compact-icon" aria-label="Close" onClick={() => { if (website.can({ type: "dismissClearFailed" })) void website.send({ type: "dismissClearFailed" }); }}><X aria-hidden /></Button>
            </Alert>
          )}
          <Dialog open={website.requests?.clearing === "ConfirmingClear"} onOpenChange={(open) => { if (!open) clear(false); }}>
            <DialogContent className="gap-0">
              <DialogTitle>Clear browsing data?</DialogTitle>
              <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">You will be signed out of every website.</p>
              <div className="mt-6 flex flex-col gap-3">
                <Button variant="warn" size="pill" className="w-full" onClick={() => clear(true)}>Clear</Button>
                <Button variant="capsule" size="pill" className="w-full" onClick={() => clear(false)}>Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : <EmptyState title="Nothing here yet." />}
    </SettingsApp>
  );
}
