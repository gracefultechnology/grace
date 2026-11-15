import type { ReactNode } from "react";
import { Camera, Image, Lock, SwitchCamera, Zap, ZapOff } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { EmptyState } from "./EmptyState.tsx";

export type CameraState = "starting" | "live" | "refused" | "failed" | "unavailable";

export type CameraAppLabels = {
  title: string;
  preview: string;
  take: string;
  flip: string;
  photos: string;
  zoom: string;
  flashOn: string;
  flashOff: string;
  allowTitle: string;
  allow: string;
  failedTitle: string;
  tryAgain: string;
};

export const cameraAppLabels: CameraAppLabels = {
  title: "Camera",
  preview: "Live camera preview",
  take: "Take photo",
  flip: "Switch camera",
  photos: "Open Photos",
  zoom: "Zoom",
  flashOn: "Flash on",
  flashOff: "Flash off",
  allowTitle: "Allow Camera to take photos",
  allow: "Allow",
  failedTitle: "Couldn’t open the camera",
  tryAgain: "Try again",
};

export type CameraAppProps = Omit<AppWindowProps, "title" | "icon" | "children"> & {
  state: CameraState;
  /** The live preview, from the device's camera. */
  preview?: ReactNode;
  /** The last photo taken, as an image URL, for the Photos button. */
  thumbnail?: string;
  /** Why the camera is refused or failed, from the device. */
  problem?: string;
  /** The zoom steps the camera offers, such as [1, 2]; none hides zoom. */
  zooms?: number[];
  zoom?: number;
  onZoom?: (zoom: number) => void;
  /** Whether the flash is on; leave out when the camera has none. */
  flash?: boolean;
  onFlash?: () => void;
  onTake?: () => void;
  onFlip?: () => void;
  onOpenPhotos?: () => void;
  /** Allow after a refusal, or Try again after a failure. */
  onRetry?: () => void;
  labels?: Partial<CameraAppLabels>;
};

/**
 * Taking a photo (senior-care google/camera/CameraApp.tsx): the live preview filling an app window like the prototype's,
 * with zoom, the shutter between the last photo and Switch camera, and the refused and failed states.
 * @design packages/design-system/design.md#windows
 */
export function CameraApp({ state, preview, thumbnail, problem, zooms = [], zoom = 1, onZoom, flash, onFlash, onTake, onFlip, onOpenPhotos, onRetry, labels, ...props }: CameraAppProps) {
  const l = { ...cameraAppLabels, ...labels };
  const ready = state === "live";
  const actions = flash !== undefined && ready && (
    <Button variant="capsule" size="pill" aria-pressed={flash} onClick={onFlash}>
      {flash ? <Zap size={22} strokeWidth={2.2} aria-hidden /> : <ZapOff size={22} strokeWidth={2.2} aria-hidden />}
      {flash ? l.flashOn : l.flashOff}
    </Button>
  );
  return (
    <AppWindow title={l.title} icon={<Camera size={26} strokeWidth={2} aria-hidden />} actions={actions || undefined} {...props}>
      {state === "refused" || state === "failed" || state === "unavailable" ? (
        <EmptyState
          title={state === "refused" ? l.allowTitle : state === "failed" ? l.failedTitle : (problem ?? l.failedTitle)}
          icon={state === "refused" ? <Lock size={64} strokeWidth={2} aria-hidden /> : <Image size={64} strokeWidth={2} aria-hidden />}
          className="h-full"
        >
          {state !== "unavailable" && problem && <p role="alert">{problem}</p>}
          {state !== "unavailable" && (
            <Button variant="prominent" size="pill" onClick={onRetry}>
              {state === "refused" ? l.allow : l.tryAgain}
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="flex h-full flex-col items-center gap-6 pb-8 font-sans">
          <div role="img" aria-label={l.preview} className="relative w-full flex-1 overflow-hidden rounded-day bg-dim">
            {ready && preview}
          </div>
          {zooms.length > 0 && (
            <div role="group" aria-label={l.zoom} className="flex gap-2">
              {zooms.map((value) => (
                <Button key={value} variant={zoom === value ? "prominent" : "capsule"} size="compact" aria-pressed={zoom === value} onClick={() => onZoom?.(value)}>
                  {zoom === value ? `${value}×` : value}
                </Button>
              ))}
            </div>
          )}
          <div className="flex w-full items-center justify-between px-10">
            <button type="button" aria-label={l.photos} onClick={onOpenPhotos} className={cn(focusRing, "flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-tile bg-panel text-primary shadow-photo-tile")}>
              {thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" /> : <Image size={28} strokeWidth={2} aria-hidden />}
            </button>
            <button
              type="button"
              aria-label={l.take}
              aria-disabled={!ready || undefined}
              onClick={ready ? onTake : undefined}
              className={cn(focusRing, "size-20 cursor-pointer rounded-full bg-primary ring-6 ring-primary/20 transition-transform duration-press ease-spring active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 motion-reduce:active:scale-100")}
            />
            <Button variant="capsule" size="icon" aria-label={l.flip} aria-disabled={!ready || undefined} onClick={ready ? onFlip : undefined} className="size-16">
              <SwitchCamera size={28} strokeWidth={2} aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </AppWindow>
  );
}
