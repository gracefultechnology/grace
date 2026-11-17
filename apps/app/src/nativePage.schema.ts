// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Answer what a website asks of me"
import { Schema } from "effect"

export const PageId = Schema.String.pipe(Schema.brand("PageId"))
export type PageId = typeof PageId.Type

export const RequestKey = Schema.String.pipe(Schema.brand("RequestKey"))
export type RequestKey = typeof RequestKey.Type

export const Url = Schema.String.pipe(Schema.brand("Url"))
export type Url = typeof Url.Type

const surface = {
  id: PageId,
  owner: Schema.optional(Schema.NullOr(Schema.String)),
  session: Schema.optional(Schema.NullOr(Schema.String)),
  epoch: Schema.optional(Schema.NullOr(Schema.Finite))
}

export const NavigationChanged = Schema.Struct({
  ...surface,
  exists: Schema.optional(Schema.Boolean),
  currentUrl: Schema.optional(Schema.NullOr(Url)),
  progress: Schema.optional(Schema.Finite),
  pageError: Schema.optional(Schema.NullOr(Schema.String)),
  securityBlocked: Schema.optional(Schema.Boolean)
})

export const SurfaceCrashed = Schema.Struct(surface)

export const PageStarted = Schema.Struct({ ...surface, url: Url })

export const DialogRequested = Schema.Struct({
  ...surface,
  dialogId: RequestKey,
  kind: Schema.Literals(["alert", "confirm", "prompt", "beforeunload"]),
  message: Schema.String
})

export const DownloadRequested = Schema.Struct({ ...surface, requestId: RequestKey, fileName: Schema.String })

export const DownloadFinished = Schema.Struct({ ...surface, requestId: RequestKey, status: Schema.Literals(["saved", "failed"]) })

export const FileChooserRequested = Schema.Struct({ ...surface, requestId: RequestKey })

export const SitePermissionRequested = Schema.Struct({
  ...surface,
  requestId: Schema.NullOr(RequestKey),
  origin: Schema.NullOr(Url),
  kinds: Schema.NonEmptyArray(Schema.Literals(["camera", "microphone", "location"])),
  topFrame: Schema.Boolean
})

export const SitePermissionWithdrawn = Schema.Struct({ ...surface, requestId: RequestKey })

export const ExternalLinkRequested = Schema.Struct({ ...surface, url: Url, handoff: Schema.Literals(["send-to", "dial", "view", "refuse"]) })

export const IdentityProviderRequested = Schema.Struct({ ...surface, requestId: RequestKey, provider: Schema.Literals(["google", "facebook"]) })

export const SitePermissionAnswer = Schema.Struct({ outcome: Schema.Literals(["granted", "denied", "android-refused", "ended"]) })

export const PurgeResult = Schema.Struct({ clean: Schema.optional(Schema.Boolean) })
