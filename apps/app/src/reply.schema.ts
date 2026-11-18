// spec/app/conversation.md, "Responses have a written equivalent and only current callbacks change the turn"; spec/app/conversation.md, "A tapped answer preserves whether the microphone was active"
import { Option, Schema, SchemaGetter } from "effect"
import type { SettingsPage, Surface } from "../gen/app__shell.effect.vibe"
import type { Pace, TextSize } from "../gen/app__preferences.effect.vibe"
import type { BrowserInput } from "../gen/app__browserControls.effect.vibe"
import type { Recurrence } from "../gen/app__calendar.effect.vibe"
import type { DeleteScope } from "../gen/app__calendarView.effect.vibe"
import type { Folder } from "../gen/app__emailItem.effect.vibe"
import type { GuidedRead } from "../gen/app__workspace.effect.vibe"
import type { FileTab } from "../gen/app__files.effect.vibe"

const Words = Schema.Trimmed.check(Schema.isMinLength(1))
const Day = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
  Schema.makeFilter((day: string) => String(new Date(`${day}T00:00:00Z`).toJSON()).startsWith(day)),
)
const Clock = Schema.String.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/))
const of = <T extends string>() => <const L extends readonly [T, ...T[]]>(literals: L) => Schema.Literals(literals)
const Repeat = of<Recurrence>()(["Once", "Weekly", "Monthly"])
export const Remind = Schema.Literals(["NoReminder", "HourBefore", "DayBefore"])
const appointment = {
  title: Words, day: Day, time: Clock, until: Schema.optionalKey(Clock), place: Schema.optionalKey(Words), who: Schema.optionalKey(Words), remind: Schema.optionalKey(Remind),
}
const action = <const Kind extends string, const Fields extends Schema.Struct.Fields>(kind: Kind, fields: Fields) =>
  Schema.Struct({ kind: Schema.Literal(kind), ...fields })

export const Action = Schema.Union([
  action("open", { surface: of<Surface>()(["Home", "Calendar", "Email", "Browser", "Files", "DeviceSettings"]) }),
  action("showSetting", { page: of<SettingsPage>()(["TextSizeSettings", "BrightnessSettings", "VoiceSettings", "NetworkSettings", "AccountSettings", "EmailCalendarSettings", "AboutSettings"]) }),
  action("setTextSize", { size: of<TextSize>()(["Smaller", "StandardText", "Larger", "Largest"]) }),
  action("setPace", { pace: of<Pace>()(["Slower", "Normal", "Faster"]) }),
  action("setVolume", { volume: Schema.Int }),
  action("setMuted", { muted: Schema.Boolean }),
  action("setBrightness", { brightness: Schema.Int }),
  action("setVoiceOutput", { on: Schema.Boolean }),
  action("undoSetting", {}),
  action("navigate", { url: Words }),
  action("browse", { control: of<BrowserInput["tag"]>()(["Back", "Forward", "Reload", "NewTab"]) }),
  action("guide", { target: Words, emphasis: Schema.Literals(["point", "instruction", "confirm"]), title: Words, detail: Schema.optionalKey(Words) }),
  action("searchMail", { query: Words }),
  action("openMessage", { message: Words }),
  action("showInbox", { account: Schema.optionalKey(Words) }),
  action("chooseFolder", { folder: of<Folder>()(["InboxFolder", "SentFolder", "DraftsFolder", "TrashFolder"]) }),
  action("newEmail", { to: Words, subject: Schema.optionalKey(Words), body: Words }),
  action("addressEmail", { to: Words }),
  action("draftReply", { body: Words }),
  action("fillDraft", { body: Words }),
  action("forwardMessage", {}),
  action("saveDraft", {}),
  action("trashMessage", {}),
  action("restoreMessage", {}),
  action("undoTrash", {}),
  action("markUnread", {}),
  action("proposeAppointment", { ...appointment, repeat: Repeat }),
  action("proposeFromMessage", appointment),
  action("proposeChange", {
    entry: Words, title: Schema.optionalKey(Words), day: Schema.optionalKey(Day), time: Schema.optionalKey(Clock), until: Schema.optionalKey(Clock),
    place: Schema.optionalKey(Words), repeat: Schema.optionalKey(Repeat), remind: Schema.optionalKey(Remind),
  }),
  action("proposeDeletion", { entry: Words, scope: of<DeleteScope>()(["ThisOccurrence", "EntireSeries"]) }),
  action("confirmProposal", {}),
  action("cancelProposal", {}),
  action("findFile", { tab: of<FileTab>()(["Photos", "Documents"]), query: Words }),
  action("beginTask", { task: Schema.Literals(["PayBill", "BookAppointment"]) }),
  action("proposeReadPlan", { steps: Schema.NonEmptyArray(Schema.Union([
    of<GuidedRead>()(["ReadMail", "ReadBrowser", "ReadChangedBrowser", "ReadStatement", "ReadCalendar", "SaveMailAppointment"]),
    action("ReachNamedPage", { target: Words.check(Schema.isMaxLength(128)) }),
  ])) }),
  action("fill", {}),
])

const [fewest, most] = [2, 3]
const distinct = (answers: readonly string[]) => answers.filter((answer, at) => answers.findIndex((other) => other.toLowerCase() === answer.toLowerCase()) === at)
const Said = { text: Words, working: Schema.optionalKey(Words), actions: Schema.Array(Action) }
const Statement = Schema.Struct({ ...Said, isQuestion: Schema.Literal(false), answers: Schema.Tuple([]) })
const Question = Schema.Struct({
  ...Said,
  isQuestion: Schema.Literal(true),
  answers: Schema.Union([Schema.Tuple([]), Schema.Array(Words).check(Schema.isBetweenLength(fewest, most), Schema.makeFilter((answers: readonly string[]) => distinct(answers).length === answers.length))]),
})

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))
const decodeAction = Schema.decodeUnknownOption(Action)
const trimmed = (value: unknown) => typeof value === "string" ? value.trim() : value
const given = (value: unknown) => value !== null && value !== ""
const list = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []
const whole = (value: unknown) => typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value
const padded = (value: unknown) => typeof value === "string" ? value.replace(/^(\d):/, "0$1:") : value
const normal: ReadonlyMap<string, (value: unknown) => unknown> = new Map([
  ["volume", whole],
  ["brightness", whole],
  ["time", padded],
  ["until", padded],
])
const isFields = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value)
const present = (value: unknown) => isFields(value)
  ? Object.fromEntries(Object.entries(value).map(([key, field]): [string, unknown] => [key, (normal.get(key) ?? trimmed)(trimmed(field))]).filter(([, field]) => given(field)))
  : value

const fields = (raw: string): Readonly<Record<string, unknown>> => {
  const said = raw.trim()
  const unfenced = /^```\w*\s*([\s\S]*?)\s*(?:```)?$/.exec(said)?.[1] ?? said
  const object = unfenced.slice(unfenced.indexOf("{"), unfenced.lastIndexOf("}") + 1)
  const parsed = Option.filter(decodeJson(object), isFields)
  if (Option.isSome(parsed) && typeof parsed.value.text === "string") return parsed.value
  return /^(```|\{|\[)/.test(said) || Option.isSome(parsed) || Option.isSome(decodeJson(said)) ? { text: "" } : { text: said }
}

const read = (raw: string) => {
  const said = fields(raw)
  const text = String(said.text).trim()
  const answers = distinct(list(said.answers).map(trimmed).filter((answer): answer is string => typeof answer === "string" && answer !== "")).slice(0, most)
  const working = trimmed(said.working)
  const asked = said.isQuestion == null ? text.endsWith("?") : said.isQuestion === true || said.isQuestion === "true"
  const reply = {
    text,
    ...(typeof working === "string" && working !== "" ? { working } : {}),
    actions: list(said.actions).flatMap((each) => Option.toArray(decodeAction(present(each)))),
  }
  return asked
    ? { ...reply, isQuestion: true as const, answers: answers.length >= fewest ? answers : [] }
    : { ...reply, isQuestion: false as const, answers: [] as const }
}

export const Reply = Schema.String.pipe(Schema.decodeTo(Schema.Union([Statement, Question]), {
  decode: SchemaGetter.transform(read),
  encode: SchemaGetter.transform((reply) => JSON.stringify(reply)),
}))
