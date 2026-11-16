import type { ReactNode } from "react";
import { Camera, MapPin, Mic } from "lucide-react";
import { Button } from "./Button.tsx";
import { BrowserDialog } from "./BrowserNoticeDialog.tsx";
import { PageText } from "./PageHeading.tsx";

export type SiteDevice = "camera" | "microphone" | "location";

export type SitePermissionLabels = {
  title: (site: string, devices: SiteDevice[]) => string;
  scope: string;
  waiting: string;
  allow: string;
  deny: string;
};

export type SitePermissionDialogProps = {
  /** The website asking, the top frame's, as the address shows it. */
  site: string;
  /** The devices it asks for, answered together. */
  devices: SiteDevice[];
  /** Android is being asked after the person's Allow: the answer waits. */
  waiting?: boolean;
  /** Called by Allow. */
  onAllow: () => void;
  /** Called by Don't allow and Escape. */
  onDeny: () => void;
  /** The question is showing. */
  open?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<SitePermissionLabels>;
  className?: string;
};

const nouns: Record<SiteDevice, string> = { camera: "camera", microphone: "microphone", location: "location" };
const icons: Record<SiteDevice, ReactNode> = {
  camera: <Camera size={28} strokeWidth={2} />,
  microphone: <Mic size={28} strokeWidth={2} />,
  location: <MapPin size={28} strokeWidth={2} />,
};

const defaultLabels: SitePermissionLabels = {
  title: (site, devices) => {
    const names = devices.map((d) => nouns[d]);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return `${site} wants to use your ${list}`;
  },
  scope: "Only this website. Until you close the browser.",
  waiting: "Asking the tablet…",
  allow: "Allow",
  deny: "Don’t allow",
};

/**
 * A website asks for the camera, microphone or location: the devices, how long the answer holds, and Allow or
 * Don't allow. After Allow both wait while Android asks too.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function SitePermissionDialog({ site, devices, waiting = false, onAllow, onDeny, open = true, labels: words, className }: SitePermissionDialogProps) {
  const labels = { ...defaultLabels, ...words };
  return (
    <BrowserDialog
      open={open}
      title={labels.title(site, devices)}
      icon={devices.length === 1 ? icons[devices[0]] : undefined}
      onEscape={waiting ? undefined : onDeny}
      className={className}
      actions={
        <>
          <Button variant="prominent" size="pill" loading={waiting} onClick={onAllow}>
            {labels.allow}
          </Button>
          <Button variant="capsule" size="pill" disabled={waiting} onClick={onDeny}>{labels.deny}</Button>
        </>
      }
    >
      {devices.length > 1 && (
        <div aria-hidden className="mt-3.5 flex gap-3">
          {devices.map((d) => (
            <span key={d} className="flex size-14 items-center justify-center rounded-xl bg-panel text-primary">{icons[d]}</span>
          ))}
        </div>
      )}
      <PageText className="mt-3.5">{labels.scope}</PageText>
      {waiting && (
        <p role="status" className="m-0 mt-3.5 text-body leading-[26px] font-semibold text-primary">{labels.waiting}</p>
      )}
    </BrowserDialog>
  );
}
