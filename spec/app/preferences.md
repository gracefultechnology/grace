# Readable text, sound and display preferences

The new prototype's Voice menu and Settings control audible output separately
from the microphone, with Slower, Normal and Faster choices. Settings also
provides four text sizes, display brightness and optional night dimming. The
Volume rail controls device sound and mute. These follow the new prototype
(lines 1832–1858, 2040–2050 and 2210–2215) and VOICE 03 accessibility rules.
These preferences are kept on the tablet; set-up may offer them too. Grace's
voice is her cloud speech service in English with one voice, so there is no
language switch or voice catalog, and pace is the only voice choice.
The user-approved “Hey Grace” preference controls whether the separate wake
lifecycle may detect the wake phrase, including while the screen sleeps; the
MVP has no detector, so its Settings row shows that it is not available.
Conversation still owns active request capture; the wake model owns detection,
permission and transient wake state. The UI uses design tokens
and measures legibility on hardware; this model does not prescribe new pixels.

## Story: Adjust Grace without losing my choices

> As an older adult, I want to hear Grace at a comfortable pace or read her
> replies, preview larger text and keep my chosen settings on this device.

### Output voice, pace and text size have one local source of truth

Output Voice off never means that an unheard response is unavailable: the
same written conversation remains visible. Changing pace affects speech,
not browser execution speed. The prototype's three rates are 80%, 100% and
115%. Microphone state is absent here deliberately.

```quint
type PreferenceActor = PreferenceUser | PreferenceStore
type Pace = Slower | Normal | Faster
type TextSize = Smaller | StandardText | Larger | Largest
type DisplayPreferences = { voiceOutput: bool, pace: Pace, textSize: TextSize, volume: int, muted: bool, brightness: int, nightDimming: bool, wakeEnabled: bool }
type SavePhase = NoSave | Saving | SaveFailed
type Preferences = {
  session: DisplayPreferences, durable: DisplayPreferences,
  snapshot: DisplayPreferences, previous: DisplayPreferences, canUndo: bool, revision: int, requestedRevision: int, saving: SavePhase
}
type PreferenceEffect = PlaySample({ pace: Pace, volume: int, muted: bool })
type PreferenceResult = { state: Preferences, out: List[PreferenceEffect] }
pure val defaults: DisplayPreferences = { voiceOutput: true, pace: Normal, textSize: StandardText, volume: 60, muted: false, brightness: 100, nightDimming: true, wakeEnabled: true }
pure val initial: Preferences = {
  session: defaults, durable: defaults, snapshot: defaults, previous: defaults, canUndo: false,
  revision: 0, requestedRevision: 0, saving: NoSave
}
pure def speechRatePercent(settings: DisplayPreferences): int =
  if (settings.pace == Slower) 80 else if (settings.pace == Faster) 115 else 100
pure def needsSaving(p: Preferences): bool = p.session != p.durable
pure def validSettings(settings: DisplayPreferences): bool =
  settings.volume >= 0 and settings.volume <= 100 and settings.brightness >= 20 and settings.brightness <= 100 and
  (settings.volume == 0 implies settings.muted)
pure def textScalePercent(settings: DisplayPreferences): int =
  if (settings.textSize == Smaller) 90 else if (settings.textSize == StandardText) 100 else if (settings.textSize == Larger) 115 else 130
pure def audible(settings: DisplayPreferences): bool = settings.voiceOutput and not(settings.muted) and settings.volume > 0
```

### Preview changes the session immediately without claiming it was saved

The complete chosen options are kept while a write is pending or failed.
Previewing another option does not allow an old save acknowledgement to
replace what the person currently sees.

```quint
pure def canPreview(p: Preferences, settings: DisplayPreferences, by: PreferenceActor): bool =
  by == PreferenceUser and validSettings(settings) and settings != p.session
pure def preview(p: Preferences, settings: DisplayPreferences, by: PreferenceActor): Preferences =
  { ...p, previous: p.session, canUndo: true, session: settings, revision: p.revision + 1 }
pure def stepOnlyPreviewChangesSession(before: Preferences, via: str, after: Preferences): bool =
  (via != "preview" and via != "undo" and via != "restart") implies after.session == before.session
```

### Saving or retrying requests the current choice as one versioned snapshot

Save and Retry use the same internal action. Every confirmed setting change
queues it automatically; no extra Save button or confirmation screen is added. If the person changes options and saves
again, that newer snapshot supersedes the old request. Repeating Save for an
identical write already in progress does not create a second request. Returning
to the previous durable options also supersedes a different in-flight write;
otherwise that older write could persist a choice the person has undone. The
store serializes writes or compares these revisions at commit, not only when
delivering acknowledgement, so a late write cannot replace a newer snapshot.

```quint
pure def canSave(p: Preferences, by: PreferenceActor): bool =
  by == PreferenceUser and (needsSaving(p) or p.saving == SaveFailed or
    (p.saving == Saving and p.snapshot != p.session)) and
  not(p.saving == Saving and p.snapshot == p.session)
pure def save(p: Preferences, by: PreferenceActor): Preferences =
  { ...p, snapshot: p.session, saving: Saving,
    revision: p.revision + 1, requestedRevision: p.revision + 1 }
```

### Only the current storage acknowledgement confirms persistence

Acknowledging a pending snapshot changes the durable options, never the
possibly newer session preview. A failed save keeps the session's choice,
exposes Retry and preserves the previous durable options; Grace also tries a
failed save again each minute, wherever the choice was made. Callbacks from
superseded writes or a previous session are refused.

```quint
pure def canSaved(p: Preferences, saveToken: int, by: PreferenceActor): bool =
  by == PreferenceStore and p.saving == Saving and saveToken == p.requestedRevision
pure def saved(p: Preferences, saveToken: int, by: PreferenceActor): Preferences =
  { ...p, durable: p.snapshot, saving: NoSave }
pure def canSaveFailed(p: Preferences, saveToken: int, by: PreferenceActor): bool =
  by == PreferenceStore and p.saving == Saving and saveToken == p.requestedRevision
pure def saveFailed(p: Preferences, saveToken: int, by: PreferenceActor): Preferences =
  { ...p, saving: SaveFailed }
pure def stepOnlyAcknowledgementChangesDurable(before: Preferences, via: str, after: Preferences): bool =
  via != "saved" implies after.durable == before.durable
```

### Restart restores confirmed preferences and invalidates pending acknowledgements

The store loads the last confirmed options. No unacknowledged preview is
advertised as persistent, and neither Voice on nor restoration starts a
microphone exchange.

```quint
pure def canRestart(p: Preferences, by: PreferenceActor): bool = by == PreferenceStore
pure def restart(p: Preferences, by: PreferenceActor): Preferences =
  { ...p, session: p.durable, snapshot: p.durable, previous: p.durable, canUndo: false, saving: NoSave,
    revision: p.revision + 1, requestedRevision: p.revision + 1 }
pure def alwaysVersionsAreOrdered(p: Preferences): bool =
  p.revision >= 0 and p.requestedRevision >= 0 and p.requestedRevision <= p.revision
pure def alwaysPendingSaveHasAVersion(p: Preferences): bool =
  p.saving != NoSave implies p.requestedRevision > 0
pure def alwaysSettingsAreValid(p: Preferences): bool =
  validSettings(p.session) and validSettings(p.durable) and validSettings(p.snapshot) and validSettings(p.previous)
pure def lawSpeechRatesAreBounded(settings: DisplayPreferences): bool =
  speechRatePercent(settings) >= 80 and speechRatePercent(settings) <= 115
```

### Undo restores the last setting choice without changing the microphone

A spoken or tapped setting change retains one Undo snapshot. Undo restores that
complete previous choice, then queues the same versioned save. Showing where a
setting lives changes navigation only; it does not alter the preference. System
volume, mute and output Voice off are different controls; none starts capture.
Zero volume is muted. Unmute at zero chooses the prototype's 50 percent value.
Each brightness or volume button press steps from the current session choice,
including any earlier press still waiting to appear on screen. Volume steps
from zero while muted. Once the tablet holds Grace's current volume choice, a
volume or mute the person sets with the tablet's own keys or Android's sound
panel is their choice too: it is previewed like a tap, so Settings shows it,
Undo restores the one before and the next start keeps it.

```quint
pure def canUndo(p: Preferences, by: PreferenceActor): bool = by == PreferenceUser and p.canUndo
pure def undo(p: Preferences, by: PreferenceActor): Preferences =
  { ...p, session: p.previous, canUndo: false, revision: p.revision + 1 }
pure def volumeChoice(settings: DisplayPreferences, amount: int): DisplayPreferences =
  val level = if (amount < 0) 0 else if (amount > 100) 100 else amount
  { ...settings, volume: level, muted: level == 0 }
pure def muteChoice(settings: DisplayPreferences, muted: bool): DisplayPreferences =
  { ...settings, muted: muted, volume: if (not(muted) and settings.volume == 0) 50 else settings.volume }
pure def brightnessChoice(settings: DisplayPreferences, amount: int): DisplayPreferences =
  { ...settings, brightness: if (amount < 20) 20 else if (amount > 100) 100 else amount }
type LevelStep = BrightnessBy({ amount: int }) | VolumeBy({ amount: int })
pure def adjustedLevel(settings: DisplayPreferences, levelStep: LevelStep): DisplayPreferences =
  match levelStep {
    | BrightnessBy(delta) => brightnessChoice(settings, settings.brightness + delta.amount)
    | VolumeBy(delta) => volumeChoice(settings, (if (settings.muted) 0 else settings.volume) + delta.amount)
  }
pure val levelStepValues = Set(BrightnessBy({ amount: -10 }), BrightnessBy({ amount: 10 }),
  VolumeBy({ amount: -10 }), VolumeBy({ amount: 10 }))
pure def lawControlsKeepValidSettings(settings: DisplayPreferences, amount: int, muted: bool): bool =
  validSettings(settings) implies validSettings(volumeChoice(settings, amount)) and
    validSettings(muteChoice(settings, muted)) and validSettings(brightnessChoice(settings, amount))
pure def sometimesUndoAvailable(p: Preferences): bool = p.canUndo
```

### Night dimming and sound samples use the current preference without rewriting it

The night interval is 9 pm through before 7 am in the device's local time. At
night the display shows half the chosen brightness, never below the readable
minimum, so it dims every setting above that minimum and never brightens one. At
daytime the chosen brightness returns. A native settings failure is reported and
leaves the last confirmed device value; Grace tries the unconfirmed setting again
each minute without reporting it twice. A CSS overlay is not evidence of actual
device control.
Play a sample and Test sound emit an explicit request at the chosen pace and
system volume, respect mute, and neither activate the mic nor change Voice on/off.
A sample is spoken by Grace's cloud voice, so it needs the internet and the
signed-in account; when it cannot play, the conversation's written speech
failure says why.

```quint
pure def nightDimmingApplies(settings: DisplayPreferences, hour: int): bool =
  settings.nightDimming and hour >= 0 and hour < 24 and (hour >= 21 or hour < 7)
pure def nightBrightness(settings: DisplayPreferences): int =
  if (settings.brightness / 2 < 20) 20 else settings.brightness / 2
pure def effectiveBrightness(settings: DisplayPreferences, hour: int): int =
  if (nightDimmingApplies(settings, hour)) nightBrightness(settings) else settings.brightness
pure def lawNightDimmingIsBounded(settings: DisplayPreferences, hour: int): bool =
  validSettings(settings) implies effectiveBrightness(settings, hour) >= 20 and
    effectiveBrightness(settings, hour) <= settings.brightness
pure def lawNightDimmingDims(settings: DisplayPreferences, hour: int): bool =
  validSettings(settings) and nightDimmingApplies(settings, hour) and settings.brightness > 20 implies
    effectiveBrightness(settings, hour) < settings.brightness
pure def canSample(p: Preferences, by: PreferenceActor): bool = by == PreferenceUser
pure def sample(p: Preferences, by: PreferenceActor): PreferenceResult =
  { state: p, out: List(PlaySample({ pace: p.session.pace, volume: p.session.volume, muted: p.session.muted })) }
```

### Preview, persistence and a recoverable save failure are reachable

The samples describe test choices only; generated preferences accept every
combination of the declared output, pace and text-size options.

```quint
pure val amountValues = Set(-1, 0, 20, 50, 60, 100, 101)
pure val hourValues = Set(0, 6, 7, 20, 21, 23, 24)
pure val settingsValues = Set(
  defaults,
  { ...defaults, voiceOutput: false, wakeEnabled: false },
  { ...defaults, pace: Slower, textSize: Larger, brightness: 40 },
  { ...defaults, brightness: 21 },
  { ...defaults, pace: Faster, textSize: Largest, volume: 0, muted: true },
  { ...defaults, textSize: Smaller, volume: 100, brightness: 20, nightDimming: false },
  { ...defaults, brightness: 0 },
  { ...defaults, volume: 0 }
)
pure def sometimesEnlargedPreview(p: Preferences): bool = (p.session.textSize == Larger or p.session.textSize == Largest) and needsSaving(p)
pure def sometimesVoiceOffSaved(p: Preferences): bool = not(p.durable.voiceOutput)
pure def sometimesRecoverableFailure(p: Preferences): bool = p.saving == SaveFailed
pure def sometimesChangedWhileSaving(p: Preferences): bool = p.saving == Saving and p.session != p.snapshot
pure def sometimesRevertedWhileSaving(p: Preferences): bool =
  p.saving == Saving and p.session == p.durable and p.session != p.snapshot
```
