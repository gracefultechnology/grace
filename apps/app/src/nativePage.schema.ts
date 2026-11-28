// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Answer what a website asks of me"; spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"
import { Schema } from "effect"

export const PageId = Schema.String.pipe(Schema.brand("PageId"))
export type PageId = typeof PageId.Type

export const RequestKey = Schema.String.pipe(Schema.brand("RequestKey"))
export type RequestKey = typeof RequestKey.Type

export const Url = Schema.String.pipe(Schema.brand("Url"))
export type Url = typeof Url.Type

const pageUrl = (pattern: RegExp) => Url.check(Schema.isPattern(pattern, {
  arbitraryConstraint: { minLength: 32, patterns: [{ source: pattern.source.replace("^https", "^[hH][tT][tT][pP][sS]"), flags: "" }] }
}))

export const SecurePage = pageUrl(/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#]\S*)?$/i)

export const LoopbackPage = pageUrl(/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|[a-z0-9.-]+\.localhost)(?::\d+)?(?:[/?#]\S*)?$/i)

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
    structuredRegions: Schema.optional(Schema.Struct({
      complete: Schema.Boolean,
      pageHeading: Schema.optional(Schema.NullOr(Schema.String)),
      primaryHeading: Schema.optional(Schema.NullOr(Schema.String)),
      landmarks: Schema.optional(Schema.Array(Schema.Struct({
        regionId: Schema.optional(Schema.String),
        role: Schema.String,
        label: Schema.optional(Schema.NullOr(Schema.String)),
        heading: Schema.optional(Schema.NullOr(Schema.String)),
        textPreview: Schema.optional(Schema.NullOr(Schema.String)),
        actionRefs: Schema.optional(Schema.Array(Schema.String)),
      }))),
      headings: Schema.optional(Schema.Array(Schema.Struct({
        level: Schema.optional(Schema.Int),
        text: Schema.String,
      }))),
      tables: Schema.optional(Schema.Array(Schema.Struct({
        regionId: Schema.optional(Schema.String),
        caption: Schema.optional(Schema.NullOr(Schema.String)),
        heading: Schema.optional(Schema.NullOr(Schema.String)),
        columns: Schema.optional(Schema.Array(Schema.String)),
        rows: Schema.optional(Schema.Array(Schema.Struct({
          cells: Schema.Array(Schema.String),
          actionRefs: Schema.optional(Schema.Array(Schema.String)),
        }))),
        rowCount: Schema.optional(Schema.Int),
      }))),
      cards: Schema.optional(Schema.Array(Schema.Struct({
        regionId: Schema.optional(Schema.String),
        heading: Schema.optional(Schema.NullOr(Schema.String)),
        textLines: Schema.optional(Schema.Array(Schema.String)),
        badges: Schema.optional(Schema.Array(Schema.String)),
        actionRefs: Schema.optional(Schema.Array(Schema.String)),
        darkPatterns: Schema.optional(Schema.Array(Schema.String)),
      }))),
      forms: Schema.optional(Schema.Array(Schema.Struct({
        regionId: Schema.optional(Schema.String),
        name: Schema.optional(Schema.NullOr(Schema.String)),
        action: Schema.optional(Schema.NullOr(Schema.String)),
        hasPassword: Schema.optional(Schema.Boolean),
        hasPaymentCredential: Schema.optional(Schema.Boolean),
        hasOtp: Schema.optional(Schema.Boolean),
        hasFileInput: Schema.optional(Schema.Boolean),
      }))),
      fileInputs: Schema.optional(Schema.Array(Schema.Struct({
        label: Schema.optional(Schema.NullOr(Schema.String)),
        accept: Schema.optional(Schema.NullOr(Schema.String)),
        hasFiles: Schema.optional(Schema.Boolean),
      }))),
      darkPatterns: Schema.optional(Schema.Array(Schema.Struct({
        kind: Schema.String,
        label: Schema.optional(Schema.NullOr(Schema.String)),
        text: Schema.optional(Schema.NullOr(Schema.String)),
      }))),
      regions: Schema.optional(Schema.Array(Schema.Struct({
        key: Schema.NonEmptyString,
        kind: Schema.optional(Schema.String),
        heading: Schema.optional(Schema.NullOr(Schema.String)),
        label: Schema.optional(Schema.NullOr(Schema.String)),
        fragments: Schema.Array(Schema.String),
        darkPatternFlags: Schema.optional(Schema.Array(Schema.String)),
      }))),
    })),
    viewport: Schema.optional(Schema.Struct({
      width: Schema.Finite, height: Schema.Finite, scale: Schema.Number,
      offsetLeft: Schema.Finite, offsetTop: Schema.Finite
    })),
    blockers: Schema.Array(Schema.Struct({
      kind: Schema.String,
      covers: Schema.String,
      ref: Schema.optional(Schema.NullOr(Schema.String)),
      rejectRef: Schema.optional(Schema.NullOr(Schema.String)),
      text: Schema.optional(Schema.NullOr(Schema.String)),
      label: Schema.optional(Schema.NullOr(Schema.String)),
    })),
    elements: Schema.Array(Schema.Struct({
      id: Schema.NonEmptyString, tag: Schema.String, type: Schema.optional(Schema.NullOr(Schema.String)), fieldName: Schema.optional(Schema.NullOr(Schema.String)),
      form: Schema.optional(Schema.NullOr(Schema.Struct({ index: Schema.Int, name: Schema.optional(Schema.NullOr(Schema.String)) }))),
      submits: Schema.optional(Schema.Boolean),
      focused: Schema.optional(Schema.Boolean), edited: Schema.optional(Schema.Boolean), hasInput: Schema.optional(Schema.Boolean), label: Schema.NullOr(Schema.String),
      frame: Schema.optional(Schema.Struct({ index: Schema.Int })), inShadowRoot: Schema.optional(Schema.Boolean),
      title: Schema.optional(Schema.NullOr(Schema.String)),
      checked: Schema.optional(Schema.Boolean),
      selected: Schema.optional(Schema.Boolean),
      pressed: Schema.optional(Schema.Boolean),
      value: Schema.optional(Schema.NullOr(Schema.String)),
      group: Schema.optional(Schema.NullOr(Schema.String)),
      heading: Schema.optional(Schema.NullOr(Schema.String)),
      rowText: Schema.optional(Schema.NullOr(Schema.String)),
      nearbyText: Schema.optional(Schema.NullOr(Schema.String)),
      consequence: Schema.optional(Schema.Literals(["observe", "navigate", "stage", "commit", "person_only"])),
      actionTier: Schema.optional(Schema.Literals(["observe", "navigate", "stage", "commit"])),
      scrollOnly: Schema.optional(Schema.Boolean),
      scroll: Schema.optional(Schema.Struct({
        x: Schema.Finite,
        y: Schema.Finite,
        minX: Schema.optional(Schema.Finite),
        maxX: Schema.optional(Schema.Finite),
        maxY: Schema.optional(Schema.Finite),
        width: Schema.optional(Schema.Finite),
        height: Schema.optional(Schema.Finite),
        document: Schema.optional(Schema.Boolean),
      })),
      darkPatternFlags: Schema.optional(Schema.Array(Schema.String)),
      options: Schema.optional(Schema.Array(Schema.Struct({
        label: Schema.NullOr(Schema.String), value: Schema.optional(Schema.NullOr(Schema.String)), disabled: Schema.Boolean, selected: Schema.Boolean
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

const TaskPolicyTarget = Schema.Struct({
  selector: Schema.NonEmptyString,
  action: Schema.Literals(["click", "fill", "fill-code", "select", "scroll", "follow"]),
})

const CommitGrant = Schema.Struct({
  grantId: Schema.NonEmptyString,
  selector: Schema.optionalKey(Schema.NonEmptyString),
  formHash: Schema.optionalKey(Schema.NonEmptyString),
  valueHash: Schema.optionalKey(Schema.NonEmptyString),
  expiresAt: Schema.Finite,
})

const PageTaskPolicy = Schema.Struct({
  origin: Schema.NonEmptyString,
  allowedOrigins: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.NonEmptyString))),
  allowSameSiteSubdomains: Schema.optionalKey(Schema.Boolean),
  maxConsequence: Schema.optionalKey(Schema.Literals(["observe", "navigate", "stage"])),
  expiresAt: Schema.Finite,
  guidanceScope: Schema.optionalKey(Schema.NonEmptyString),
  actionId: Schema.optionalKey(Schema.NonEmptyString),
  expectedSelector: Schema.optionalKey(Schema.NonEmptyString),
  assistantName: Schema.optionalKey(Schema.NonEmptyString),
  commitGrant: Schema.optionalKey(CommitGrant),
  targets: Schema.mutable(Schema.Array(TaskPolicyTarget)),
})

export const PageActionCommand = Schema.Union([
  Schema.Struct({
    subaction: Schema.Literal("click"),
    snapshotId: Schema.NonEmptyString,
    nodeId: Schema.NonEmptyString,
    taskPolicy: Schema.optionalKey(PageTaskPolicy),
  }),
  Schema.Struct({
    subaction: Schema.Literal("fill"),
    snapshotId: Schema.NonEmptyString,
    nodeId: Schema.NonEmptyString,
    text: Schema.String,
    taskPolicy: Schema.optionalKey(PageTaskPolicy),
  }),
  Schema.Struct({
    subaction: Schema.Literal("select"),
    snapshotId: Schema.NonEmptyString,
    nodeId: Schema.NonEmptyString,
    text: Schema.NonEmptyString,
    taskPolicy: Schema.optionalKey(PageTaskPolicy),
  }),
  Schema.Struct({
    subaction: Schema.Literal("scroll"),
    snapshotId: Schema.NonEmptyString,
    nodeId: Schema.NonEmptyString,
    direction: Schema.Literals(["up", "down", "left", "right"]),
    taskPolicy: Schema.optionalKey(PageTaskPolicy),
  }),
  Schema.Struct({
    subaction: Schema.Literal("follow"),
    snapshotId: Schema.NonEmptyString,
    nodeId: Schema.NonEmptyString,
    taskPolicy: Schema.optionalKey(PageTaskPolicy),
  }),
])
export type PageActionCommand = typeof PageActionCommand.Type

const PageActionError = Schema.Union([
  Schema.String,
  Schema.Struct({
    kind: Schema.String,
    message: Schema.optional(Schema.String),
  }),
])

export const PageActionResult = Schema.Struct({
  documentId: Schema.NonEmptyString,
  frameScope: Schema.Literal("main"),
  result: Schema.Struct({
    ok: Schema.optional(Schema.Boolean),
    accepted: Schema.optional(Schema.Boolean),
    dispatched: Schema.optional(Schema.Boolean),
    completed: Schema.optional(Schema.Boolean),
    requiresReadback: Schema.optional(Schema.Boolean),
    error: Schema.optional(Schema.NullOr(PageActionError)),
    code: Schema.optional(Schema.NullOr(Schema.String)),
    url: Schema.optional(Schema.NullOr(Schema.String)),
    domRevision: Schema.optional(Schema.Int),
    value: Schema.optional(Schema.NullOr(Schema.String)),
    readbackValue: Schema.optional(Schema.NullOr(Schema.String)),
    navigated: Schema.optional(Schema.Boolean),
  }),
})
export type PageActionResult = typeof PageActionResult.Type
