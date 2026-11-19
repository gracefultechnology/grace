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

export const ExternalLinkRequested = Schema.Struct({
  ...surface,
  url: Url,
  handoff: Schema.Literals(["send-to", "dial", "view", "refuse"]),
  fallbackUrl: Schema.optional(Schema.NullOr(Url))
})

export const IdentityProviderRequested = Schema.Struct({ ...surface, requestId: RequestKey, provider: Schema.Literals(["google", "facebook"]) })

export const SitePermissionAnswer = Schema.Struct({ outcome: Schema.Literals(["granted", "denied", "android-refused", "ended"]) })

export const PermissionClosed = Schema.Struct({ code: Schema.Literal("SITE_PERMISSION_CLOSED") })

export const AppUnavailable = Schema.Struct({ code: Schema.Literal("EXTERNAL_APP_UNAVAILABLE") })

export const PurgeResult = Schema.Struct({ clean: Schema.optional(Schema.Boolean) })

export const LinkObservation = Schema.Struct({
  documentId: Schema.NonEmptyString,
  frameScope: Schema.Literal("main"),
  result: Schema.Struct({
    snapshotId: Schema.NonEmptyString,
    url: Schema.String,
    complete: Schema.Literal(true),
    readyState: Schema.String,
    title: Schema.optional(Schema.NullOr(Schema.String)),
    text: Schema.optional(Schema.NullOr(Schema.String)),
    domRevision: Schema.optional(Schema.Int),
    viewport: Schema.optional(Schema.Struct({
      width: Schema.Finite, height: Schema.Finite, scale: Schema.Number,
      offsetLeft: Schema.Finite, offsetTop: Schema.Finite
    })),
    blockers: Schema.Array(Schema.Struct({ kind: Schema.String, covers: Schema.String })),
    elements: Schema.Array(Schema.Struct({
      id: Schema.NonEmptyString, tag: Schema.String, label: Schema.NullOr(Schema.String),
      role: Schema.optional(Schema.NullOr(Schema.String)), expanded: Schema.optional(Schema.Boolean),
      targetSelector: Schema.optional(Schema.NullOr(Schema.String)),
      href: Schema.NullOr(Schema.String), disabled: Schema.optional(Schema.Boolean),
      bounds: Schema.optional(Schema.Struct({ x: Schema.Finite, y: Schema.Finite, width: Schema.Finite, height: Schema.Finite })),
      sensitive: Schema.optional(Schema.NullOr(Schema.String)), inViewport: Schema.Boolean
    }))
  })
})
export type LinkObservation = typeof LinkObservation.Type
export const VisibleTextRead = Schema.Struct({ url: Url, text: Schema.NonEmptyString, truncated: Schema.Literal(false) })
export const PointResult = Schema.Struct({ result: Schema.Struct({ accepted: Schema.optional(Schema.Boolean) }) })
