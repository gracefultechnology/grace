// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Answer what a website asks of me"; spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"
import { Schema } from "effect"

export const PageId = Schema.String.pipe(Schema.brand("PageId"))
export type PageId = typeof PageId.Type

export const RequestKey = Schema.String.pipe(Schema.brand("RequestKey"))
export type RequestKey = typeof RequestKey.Type

export const Url = Schema.String.pipe(Schema.brand("Url"))
export type Url = typeof Url.Type

export const SecurePage = Url.check(Schema.isPattern(/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#]\S*)?$/i))

export const LoopbackPage = Url.check(Schema.isPattern(/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|[a-z0-9.-]+\.localhost)(?::\d+)?(?:[/?#]\S*)?$/i))

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
  canGoBack: Schema.optional(Schema.Boolean),
  canGoForward: Schema.optional(Schema.Boolean),
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
  fallbackUrl: Schema.optional(Schema.NullOr(Schema.String))
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
    statementRegions: Schema.optional(Schema.Struct({
      complete: Schema.Boolean,
      primaryHeading: Schema.optional(Schema.NonEmptyString),
      regions: Schema.Array(Schema.Struct({
        key: Schema.NonEmptyString, fragments: Schema.Array(Schema.String),
        heading: Schema.optional(Schema.NonEmptyString), authorLabel: Schema.optional(Schema.NonEmptyString),
        ancestorLabels: Schema.optional(Schema.Array(Schema.NonEmptyString)), ambiguous: Schema.optional(Schema.Literal(true)),
        tableRow: Schema.optional(Schema.Struct({ parentKey: Schema.NonEmptyString, columns: Schema.Array(Schema.NonEmptyString) })),
      })),
    })),
    viewport: Schema.optional(Schema.Struct({
      width: Schema.Finite, height: Schema.Finite, scale: Schema.Number,
      offsetLeft: Schema.Finite, offsetTop: Schema.Finite
    })),
    blockers: Schema.Array(Schema.Struct({ kind: Schema.String, covers: Schema.String })),
    elements: Schema.Array(Schema.Struct({
      id: Schema.NonEmptyString, tag: Schema.String, type: Schema.optional(Schema.NullOr(Schema.String)), fieldName: Schema.optional(Schema.NullOr(Schema.String)),
      form: Schema.optional(Schema.NullOr(Schema.Struct({ index: Schema.Int, name: Schema.optional(Schema.NullOr(Schema.String)) }))),
      submits: Schema.optional(Schema.Boolean),
      focused: Schema.optional(Schema.Boolean), edited: Schema.optional(Schema.Boolean), hasInput: Schema.optional(Schema.Boolean), label: Schema.NullOr(Schema.String),
      frame: Schema.optional(Schema.Struct({ index: Schema.Int })), inShadowRoot: Schema.optional(Schema.Boolean),
      title: Schema.optional(Schema.NullOr(Schema.String)),
      options: Schema.optional(Schema.Array(Schema.Struct({
        label: Schema.NullOr(Schema.String), disabled: Schema.Boolean, selected: Schema.Boolean
      }))),
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
