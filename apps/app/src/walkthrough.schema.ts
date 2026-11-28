// spec/app/execution.md, "Story: Get help on the website I chose"; spec/app/taskKinds.md, "Story: Ask every kind the same questions"; spec/app/commitment.md, "Story: Review and authorize the exact payment"
import { Schema } from "effect"
import type { Consequence, PageFact, PageTarget } from "../gen/app__execution.effect.vibe"
import type { LinkObservation } from "./nativePage.schema.ts"
import { sameSiteOrigin } from "./origin.ts"
import { withhold } from "./private.ts"

export { sameSiteOrigin }

export const WalkthroughTaskKind = Schema.Literals(["PayBill", "BookAppointment", "WebWalkthrough"])
export type WalkthroughTaskKind = typeof WalkthroughTaskKind.Type

export const DarkPatternKind = Schema.Literals([
  "pre-checked-opt-in",
  "recurring-default",
  "sponsored-listing",
  "upsell-modal",
  "confirmshaming",
  "paid-default-addon",
  "convenience-fee",
])
export type DarkPatternKind = typeof DarkPatternKind.Type

export const WalkthroughStepOperation = Schema.Literals([
  "click",
  "fill",
  "select",
  "scroll",
  "follow",
  "dismissBlocker",
])
export type WalkthroughStepOperation = typeof WalkthroughStepOperation.Type

export interface RedactedControl {
  readonly id: string
  readonly tag: string
  readonly role: string
  readonly label: string
  readonly group: string
  readonly heading: string
  readonly state: string
  readonly consequence: Consequence
  readonly inReach: boolean
  readonly darkPatterns: readonly DarkPatternKind[]
  readonly options: readonly string[]
}

export interface RedactedBlocker {
  readonly kind: string
  readonly covers: string
  readonly label: string
  readonly dismissRef: string | undefined
}

export interface RedactedRegion {
  readonly heading: string
  readonly text: string
  readonly darkPatterns: readonly DarkPatternKind[]
}

export interface RedactedPageSummary {
  readonly url: string
  readonly origin: string
  readonly title: string
  readonly primaryHeading: string
  readonly domRevision: number
  readonly documentId: string
  readonly snapshotId: string
  readonly blockers: readonly RedactedBlocker[]
  readonly regions: readonly RedactedRegion[]
  readonly controls: readonly RedactedControl[]
  readonly targets: readonly PageTarget[]
  readonly facts: readonly PageFact[]
  readonly darkPatternWarnings: readonly string[]
  readonly hasPrivateInputs: boolean
}

export const WalkthroughTrajectoryEntry = Schema.Struct({
  step: Schema.Int,
  timestamp: Schema.NonEmptyString,
  urlOriginPath: Schema.NonEmptyString,
  domRevision: Schema.Int,
  candidateCount: Schema.Int,
  blockerKinds: Schema.Array(Schema.String),
  darkPatternFlags: Schema.Array(Schema.String),
  action: Schema.String,
  targetRef: Schema.optional(Schema.String),
  consequence: Schema.Literals(["Routine", "AskFirst", "PersonOnly", "Commit"]),
  gateVerdict: Schema.Literals(["allowed", "handoff-person", "commit-approval-required", "blocked-origin", "refused"]),
  readbackVerified: Schema.Boolean,
  reason: Schema.optional(Schema.String),
  latencyMs: Schema.Int,
})
export type WalkthroughTrajectoryEntry = typeof WalkthroughTrajectoryEntry.Type

type PageElement = LinkObservation["result"]["elements"][number]

const commitLabelPattern = /\b(?:submit(?:\s+[\w&]+\s+|\s+)(?:payment|order|application|request|claim|message|form|tax\s+payment)|submit|pay\s+(?:now|\$[\d,.]+)|schedule\s+payment|confirm(?:\s+(?:&|and)\s+pay|\s+(?:payment|order|booking|appointment|cancellation|enrollment|transfer|purchase|request))?|place(?:\s+your)?\s+order|complete\s+(?:payment|purchase|order|booking|enrollment)|buy\s+now|book(?:\s+(?:now|appointment|visit))|send(?:\s+(?:message|now|request|transfer|payment))?|authorize(?:\s+(?:&|and)\s+submit|\s+payment|\s+debit|\s+transfer)?|cancel\s+(?:service|subscription|plan|membership|account|auto\s*-?\s*pay)|enroll\s+in\s+auto(?:matic\s+)?pay(?:ments)?|close\s+(?:account|card|policy|order)|delete\s+(?:account|forever)|sign\s+in|log\s+in)\b/iu
const safeDismissPattern = /^(?:close(?:\s+(?:dialog|modal|popup|pop-up|banner|window|overlay|drawer|panel|menu|alert|notice|message|ad|offer))?|dismiss|no\s+thanks.*|skip|not\s+now|maybe\s+later|reject\s+all|decline\s+all|necessary\s+only)$/iu
const routineProgressPattern = /^(?:pay\s+card|make\s+a\s+payment|pay\s+bill|continue|next|review|review\s+payment|review\s+order|add\s+to\s+cart|proceed\s+to\s+checkout|view\s+cart|back|edit|see\s+details|view\s+details|download.*|get\s+a\s+code|schedule\s+(?:a\s+visit|an?\s+appointment))$/iu
const recurringPattern = /\b(?:auto\s*-?\s*pay|automatic\s+payments?|subscribe\s*(?:&|and)\s*save|recurring|monthly\s+plan|paperless|prime\s+(?:free\s+)?trial|protection\s+plan|roadside\s+assistance|umbrella|green\s+energy)\b/iu
const sponsoredPattern = /\b(?:sponsored|promoted|advertisement|claim\s+your\s+\$|you\s+won|account\s+suspended)\b/iu
const confirmshamePattern = /\b(?:no\s+thanks.*full\s+price|keep\s+my\s+benefits|i\s+don.?t\s+want\s+to\s+save)\b/iu
const feePattern = /\b(?:convenience\s+fee|processing\s+fee|surcharge|express\s+shipping)\b/iu
const personOnlyLabelPattern = /\b(?:password|passcode|verification\s+code|one[- ]time\s+code|otp|security\s+code|cvv|cvc|ssn|social\s+security|routing\s+number|account\s+number|card\s+number|sign\s+in|log\s+in)\b/iu
const fileInputPattern = /^file$/iu

function cleanText(text: string | null | undefined, maxLength: number): string {
  if (!text) return ""
  const collapsed = text.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim()
  const redacted = withhold({ text: collapsed, passwords: [] })
  return redacted.length > maxLength ? redacted.slice(0, maxLength - 1) + "…" : redacted
}

function isEditableControl(element: PageElement): boolean {
  const type = (element.type ?? "").toLowerCase()
  if (element.tag === "textarea" || element.role === "textbox" || element.role === "searchbox" || element.role === "combobox") return true
  if (element.tag === "input" && !["hidden", "submit", "button", "reset", "checkbox", "radio", "image", "file"].includes(type)) return true
  return false
}

export function detectDarkPatterns(element: PageElement): readonly DarkPatternKind[] {
  const flags = new Set<DarkPatternKind>()
  for (const upstream of element.darkPatternFlags ?? []) {
    if (Schema.is(DarkPatternKind)(upstream)) flags.add(upstream)
  }
  const combined = [element.label, element.group, element.heading, element.nearbyText, element.rowText].filter(Boolean).join(" ")
  const type = (element.type ?? "").toLowerCase()
  if ((type === "checkbox" || element.role === "checkbox" || element.role === "switch") && element.checked === true && recurringPattern.test(combined)) {
    flags.add("pre-checked-opt-in")
  }
  if ((type === "radio" || element.role === "radio") && element.checked === true && recurringPattern.test(combined)) {
    flags.add("recurring-default")
  }
  if ((type === "radio" || element.role === "radio" || type === "checkbox") && element.checked === true && feePattern.test(combined)) {
    flags.add("paid-default-addon")
  }
  if (sponsoredPattern.test(combined)) flags.add("sponsored-listing")
  if (confirmshamePattern.test(combined)) flags.add("confirmshaming")
  if (feePattern.test(combined) && !flags.has("paid-default-addon")) flags.add("convenience-fee")
  return [...flags]
}

export function classifyControl(element: PageElement): {
  readonly consequence: Consequence
  readonly inReach: boolean
  readonly darkPatterns: readonly DarkPatternKind[]
} {
  const darkPatterns = detectDarkPatterns(element)
  const label = (element.label ?? "").trim()
  const type = (element.type ?? "").toLowerCase()
  const inReach = element.disabled !== true
  if (element.sensitive != null || type === "password" || fileInputPattern.test(type) ||
      (isEditableControl(element) && personOnlyLabelPattern.test(label))) {
    return { consequence: "PersonOnly", inReach, darkPatterns }
  }
  const upstreamTier = element.consequence ?? element.actionTier
  if (upstreamTier === "person_only") {
    return { consequence: "PersonOnly", inReach, darkPatterns }
  }
  if (upstreamTier === "commit") {
    return { consequence: "Commit", inReach, darkPatterns }
  }
  const isButtonLike = element.tag === "button" || element.role === "button" ||
    (element.tag === "input" && (type === "submit" || type === "button")) || element.submits === true
  const isDismiss = safeDismissPattern.test(label) && !commitLabelPattern.test(label)
  if (isButtonLike && !isDismiss && commitLabelPattern.test(label) && !routineProgressPattern.test(label)) {
    return { consequence: "Commit", inReach, darkPatterns }
  }
  if (isEditableControl(element) || element.tag === "select" || element.role === "combobox") {
    const isSearch = element.role === "searchbox" || type === "search" || /^search\b/iu.test(label)
    return { consequence: isSearch ? "Routine" : "AskFirst", inReach, darkPatterns }
  }
  return { consequence: "Routine", inReach, darkPatterns }
}

function controlState(element: PageElement): string {
  const parts: string[] = []
  if (element.checked === true) parts.push("checked")
  if (element.checked === false && (element.type === "checkbox" || element.type === "radio" || element.role === "checkbox" || element.role === "radio")) parts.push("unchecked")
  if (element.selected === true) parts.push("selected")
  if (element.pressed === true) parts.push("pressed")
  if (element.expanded === true) parts.push("expanded")
  if (element.expanded === false) parts.push("collapsed")
  if (element.disabled === true) parts.push("disabled")
  if (element.sensitive == null && element.value && element.value.trim() !== "") {
    parts.push(`value=${cleanText(element.value, 48)}`)
  }
  return parts.join(", ")
}

function collectStructuredRegions(result: LinkObservation["result"]): {
  readonly regions: RedactedRegion[]
  readonly upstreamWarnings: string[]
} {
  const sr = result.structuredRegions
  const regions: RedactedRegion[] = []
  const upstreamWarnings: string[] = []
  const toFlags = (raw: readonly string[] | undefined, text: string): DarkPatternKind[] => {
    const out: DarkPatternKind[] = []
    for (const flag of raw ?? []) {
      if (Schema.is(DarkPatternKind)(flag) && !out.includes(flag)) out.push(flag)
    }
    if (sponsoredPattern.test(text) && !out.includes("sponsored-listing")) out.push("sponsored-listing")
    return out
  }
  if (sr) {
    for (const dp of sr.darkPatterns ?? []) {
      const label = cleanText(dp.label ?? dp.text, 96)
      upstreamWarnings.push(label ? `${dp.kind}: ${label}` : dp.kind)
    }
    for (const card of (sr.cards ?? []).slice(0, 6)) {
      const text = cleanText((card.textLines ?? []).join(" · "), 260)
      const heading = cleanText(card.heading, 80)
      if (heading || text) regions.push({ heading, text, darkPatterns: toFlags(card.darkPatterns, text) })
    }
    for (const table of (sr.tables ?? []).slice(0, 4)) {
      const rows = (table.rows ?? []).slice(0, 4).map((row) => row.cells.join(" | ")).join("; ")
      const text = cleanText(rows || (table.columns ?? []).join(" | "), 260)
      const heading = cleanText(table.caption ?? table.heading, 80)
      if (heading || text) regions.push({ heading: heading || "Table", text, darkPatterns: toFlags(undefined, text) })
    }
    for (const landmark of (sr.landmarks ?? []).slice(0, 4)) {
      const text = cleanText(landmark.textPreview, 260)
      const heading = cleanText(landmark.heading ?? landmark.label ?? landmark.role, 80)
      if (text) regions.push({ heading, text, darkPatterns: toFlags(undefined, text) })
    }
  }
  const fallbackRegions = sr?.regions ?? result.statementRegions?.regions.map((region) => ({
    heading: region.heading ?? region.authorLabel ?? null,
    label: region.authorLabel ?? null,
    fragments: region.fragments,
    darkPatternFlags: [] as string[],
  })) ?? []
  for (const region of fallbackRegions.slice(0, 12)) {
    if (regions.length >= 12) break
    const text = cleanText(region.fragments.join(" · "), 260)
    const heading = cleanText(region.heading ?? region.label, 80)
    if (heading || text) regions.push({ heading, text, darkPatterns: toFlags(region.darkPatternFlags, text) })
  }
  return { regions: regions.slice(0, 12), upstreamWarnings }
}

/** @throws {never} */
export function summarizeRedactedPage(observation: LinkObservation, fallbackUrl: string): RedactedPageSummary {
  const { result, documentId } = observation
  const url = result.url || fallbackUrl
  const origin = URL.parse(url)?.origin ?? ""
  const title = cleanText(result.title, 120)
  const primaryHeading = cleanText(
    result.structuredRegions?.pageHeading ?? result.structuredRegions?.primaryHeading ?? result.statementRegions?.primaryHeading,
    120,
  )
  const blockers: RedactedBlocker[] = result.blockers.slice(0, 8).map((blocker) => ({
    kind: blocker.kind,
    covers: blocker.covers,
    label: cleanText(blocker.text ?? blocker.label, 80),
    dismissRef: blocker.rejectRef ?? blocker.ref ?? undefined,
  }))
  const { regions, upstreamWarnings } = collectStructuredRegions(result)
  if (regions.length === 0 && result.text) {
    const snippet = cleanText(result.text, 600)
    if (snippet !== "") regions.push({ heading: primaryHeading || title || "Page", text: snippet, darkPatterns: [] })
  }
  const seenIds = new Set<string>()
  const controls: RedactedControl[] = []
  const targets: PageTarget[] = []
  const warnings = new Set<string>(upstreamWarnings)
  let hasPrivateInputs = false
  for (const element of result.elements) {
    if (element.sensitive != null || element.type === "password") hasPrivateInputs = true
    if (seenIds.has(element.id)) continue
    seenIds.add(element.id)
    const { consequence, inReach, darkPatterns } = classifyControl(element)
    const label = cleanText(element.label ?? element.title ?? element.fieldName, 96)
    targets.push({ id: element.id, consequence, inReach })
    if (darkPatterns.includes("pre-checked-opt-in") || darkPatterns.includes("recurring-default")) {
      warnings.add(`Pre-selected recurring or opt-in control: ${label || element.id}`)
    }
    if (darkPatterns.includes("paid-default-addon")) {
      warnings.add(`Pre-selected paid option or fee: ${label || element.id}`)
    }
    if (darkPatterns.includes("sponsored-listing")) {
      warnings.add(`Sponsored or promotional content detected near: ${label || element.id}`)
    }
    if (controls.length < 40 && (label !== "" || element.role || isEditableControl(element))) {
      controls.push({
        id: element.id,
        tag: element.tag,
        role: element.role ?? element.type ?? element.tag,
        label: label || element.id,
        group: cleanText(element.group, 64),
        heading: cleanText(element.heading, 64),
        state: controlState(element),
        consequence,
        inReach,
        darkPatterns,
        options: (element.options ?? []).slice(0, 12).map((option) => cleanText(option.label ?? option.value, 48)).filter(Boolean),
      })
    }
  }
  for (const blocker of blockers) {
    if (blocker.dismissRef && !seenIds.has(blocker.dismissRef)) {
      seenIds.add(blocker.dismissRef)
      targets.push({ id: blocker.dismissRef, consequence: blocker.kind === "cookie-consent" ? "PersonOnly" : "Routine", inReach: true })
    }
    if (blocker.kind === "modal" || blocker.kind === "cookie-consent") {
      warnings.add(`Overlay (${blocker.kind})${blocker.label ? `: ${blocker.label}` : ""}${blocker.dismissRef ? ` [dismiss ref ${blocker.dismissRef}]` : ""}`)
    }
  }
  const facts: PageFact[] = []
  if (primaryHeading !== "") facts.push({ name: "heading", valueRef: primaryHeading, quoteRef: primaryHeading })
  if (title !== "") facts.push({ name: "title", valueRef: title, quoteRef: title })
  for (const [index, region] of regions.slice(0, 6).entries()) {
    if (region.text !== "") {
      facts.push({ name: region.heading || `region-${index + 1}`, valueRef: region.text.slice(0, 120), quoteRef: region.text.slice(0, 120) })
    }
  }
  return {
    url,
    origin,
    title,
    primaryHeading,
    domRevision: result.domRevision ?? 0,
    documentId,
    snapshotId: result.snapshotId,
    blockers,
    regions,
    controls,
    targets,
    facts,
    darkPatternWarnings: [...warnings],
    hasPrivateInputs,
  }
}

/** @throws {never} */
export function formatRedactedPageLines(summary: RedactedPageSummary): readonly string[] {
  const lines: string[] = []
  const heading = summary.primaryHeading || summary.title
  if (heading !== "") lines.push(`Page heading: “${heading}”.`)
  if (summary.blockers.length > 0) {
    lines.push(`Page overlays: ${summary.blockers.map((b) => `${b.kind} (${b.covers})${b.dismissRef ? ` [dismiss: ${b.dismissRef}]` : ""}`).join("; ")}.`)
  }
  if (summary.darkPatternWarnings.length > 0) {
    lines.push(`Caution flags: ${summary.darkPatternWarnings.slice(0, 6).join("; ")}.`)
  }
  if (summary.regions.length > 0) {
    const regionText = summary.regions.slice(0, 6).map((r) => `${r.heading ? `${r.heading}: ` : ""}${r.text}`).join(" | ")
    lines.push(`Visible page summary: ${regionText}.`)
  }
  if (summary.controls.length > 0) {
    const listed = summary.controls.slice(0, 24).map((c) => {
      const extras = [c.group, c.state, c.consequence === "Commit" ? "REQUIRES APPROVAL" : c.consequence === "PersonOnly" ? "PERSON ONLY" : "", ...c.darkPatterns].filter(Boolean)
      const opts = c.options.length > 0 ? ` options=[${c.options.slice(0, 6).join(", ")}]` : ""
      return `[${c.id}] ${c.role} “${c.label}”${extras.length ? ` (${extras.join(", ")})` : ""}${opts}`
    })
    lines.push(`Visible controls: ${listed.join("; ")}.`)
  }
  return lines
}

/** @throws {never} */
export function walkthroughStepPayload(action: {
  readonly operation: WalkthroughStepOperation
  readonly target: string
  readonly value?: string
  readonly option?: string
  readonly direction?: "up" | "down"
}) {
  return {
    operation: action.operation,
    target: action.target,
    ...(action.value !== undefined ? { value: action.value } : {}),
    ...(action.option !== undefined ? { option: action.option } : {}),
    ...(action.direction !== undefined ? { direction: action.direction } : {}),
  }
}
