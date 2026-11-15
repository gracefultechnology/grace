# Design system

Grace's tablet: one indigo on lilac light and clear glass. A fixed 1280×800 product surface, from
`prototype/Grace Prototype.html`. Color carries meaning; position and weight carry hierarchy.

- **Surfaces.** The `screen` sits under `bg-gradient-frame`. Floating surfaces (rail, windows, Grace) are
  glass over it; app windows are white (`background`). `panel` is a row or panel on white; `card` a white
  panel on glass; `sidebar` a side list inside a window.
- **Text.** `foreground` in apps and on Home, `grace-ink` in Grace's window and on glass buttons, `chrome`
  for the rail and window buttons, `muted-foreground` for what matters less. Each pair meets WCAG AA, except three of the prototype's own pale
  inks, kept exactly by choice: `pale` for Grace's unspoken words, `outside-day` for days outside the month and
  `alert` on the week strip's Today. Each is marked `data-prototype-ink`, the one place axe skips contrast.
- **Meaning.** `primary` (indigo) is the one next step, the selected label and the focus ring. `guide` is
  Grace pointing; `ok` done; `alert` today and what is due; `destructive` a warning about safety.
- **Shape.** `radius` is 12px (`rounded-sm` 8 … `rounded-xl` 16); named radii by role: `rounded-row` 22,
  `rounded-window` 26, `rounded-card` 30, `rounded-menu` 38, `rounded-full` for every button.
- **Type.** Figtree. Sizes are tokens in rem so the Text size setting scales every word: `text-body` 20,
  `text-body-lg` 22, `text-lead` 24 (Grace's words), `text-title` 28, `text-display` 40.
- **Motion.** `press` with `ease-spring` for a tap (scale 1.05), `window` for a window changing size.
- **Dark.** The tablet keeps its light look; `.dark` changes only the semantic colors, for tools around it.

Name a value by its token (`bg-primary`, `var(--primary)`), never by its value. Where a literal color
is unavoidable, such as a chart series or third-party markup, say why on the line above:
`// eslint-disable-next-line design-system/no-literal-colors -- chart series`.

## Glass

Clear glass: `bg-glass/10` with `backdrop-blur-glass` and `shadow-glass`, a bright rim and no lift. Grace's
window is frosted: `bg-frost/86` with `backdrop-blur-2xl`. Every floating surface casts `shadow-float`.

## Buttons

Three kinds only, all 64px tall and fully round: glass (`shadow-glass`), prominent (flat `primary`, the
one next step) and plain (no fill, for ✕). Pressed: scale 1.05 and a brighter glass. Icon-only buttons are
round. Disabled text is `grace-ink` at 38%.

## Selected

A raised white platter (`bg-card shadow-raised`) with an indigo label, the same for list items, the
rail's buttons, segmented choices and menu options. No outlines.

## Windows

App windows float 6px from the rail and the screen edges, `rounded-window`, white with `shadow-float`. The
header is two glass capsules over the scrolling content; the title sits on the ✕'s row. Split apps keep
their side list (`sidebar`) still while the page beside it scrolls. One margin: 24px.

## Grace

Grace's window: header (her name, Pause, Voice), the conversation, and the answer row (field, Send, Attach,
Mic). Her bubbles are `bubble` with a tail; Margaret's are `user-ink`. Answer chips are Margaret's words
not yet said: white, outlined in her ink, with her tail. While she speaks, `lavender` bars move.

## Guidance

Grace points with a `guide` ring in the margin around the target and a label beside it: indigo while she
works, `guide` for "your turn", `ok` when done. A target off screen becomes a glass pill at the edge.

## Changing it

`tokens.json` is the source; the CSS in `generated/` and the table below are built from it. Nothing reads
this prose into tokens. To change the design, describe it, and have the change written as a list in a file:

```json
[{ "path": "color.light.primary", "value": "oklch(0.45 0.2 277)", "reason": "deeper accent" }]
```

- `node ../../vibestack/design/cli.ts apply changes.json` refuses an unknown path, an invalid value or a
  pair below AA, and prints each token before and after.
- The same with `--write` updates `tokens.json`, the CSS and the table.
- `pnpm build` regenerates; `pnpm check` fails on invalid tokens, low contrast or a stale table.

<!-- tokens:start -->
| Color | Light | Dark |
| --- | --- | --- |
| `background` | oklch(1 0 0) | oklch(0.197 0.016 296.4) |
| `foreground` | oklch(0.247 0.031 273.1) | oklch(0.939 0.014 299.8) |
| `card` | oklch(1 0 0) | oklch(0.235 0.021 297.2) |
| `card-foreground` | oklch(0.247 0.031 273.1) | oklch(0.939 0.014 299.8) |
| `popover` | oklch(1 0 0) | oklch(0.235 0.021 297.2) |
| `popover-foreground` | oklch(0.191 0 0) | oklch(0.939 0.014 299.8) |
| `primary` | oklch(0.346 0.088 291.7) | oklch(0.784 0.093 291.7) |
| `primary-foreground` | oklch(1 0 0) | oklch(0.197 0.016 296.4) |
| `secondary` | oklch(0.971 0.009 299.2) | oklch(0.288 0.029 296) |
| `secondary-foreground` | oklch(0.247 0.031 273.1) | oklch(0.939 0.014 299.8) |
| `muted` | oklch(0.971 0.009 299.2) | oklch(0.288 0.029 296) |
| `muted-foreground` | oklch(0.437 0.031 270.6) | oklch(0.73 0.032 296) |
| `accent` | oklch(0.948 0.022 297.4) | oklch(0.288 0.029 296) |
| `accent-foreground` | oklch(0.346 0.088 291.7) | oklch(0.939 0.014 299.8) |
| `destructive` | oklch(0.501 0.178 28.7) | oklch(0.729 0.139 25.3) |
| `destructive-foreground` | oklch(1 0 0) | oklch(0.197 0.016 296.4) |
| `border` | oklch(0.908 0.019 299) | oklch(0.288 0.029 296) |
| `input` | oklch(0.908 0.019 299) | oklch(0.288 0.029 296) |
| `ring` | oklch(0.346 0.088 291.7) | oklch(0.784 0.093 291.7) |
| `ok` | oklch(0.514 0.117 153.6) | oklch(0.791 0.126 156.9) |
| `warn` | oklch(0.521 0.138 41.8) | oklch(0.809 0.114 69.6) |
| `device` | oklch(0.201 0.014 298.2) | — |
| `screen` | oklch(0.91 0.043 295.9) | — |
| `glass` | oklch(1 0 0) | — |
| `frost` | oklch(0.926 0.03 296.2) | — |
| `fade` | oklch(0.951 0.022 297.4) | — |
| `sidebar` | oklch(0.99 0.005 297.7) | — |
| `panel` | oklch(0.971 0.009 299.2) | — |
| `caution` | oklch(0.975 0.012 29.9) | — |
| `bubble` | oklch(0.917 0.045 296.6) | — |
| `shade` | oklch(0.404 0.069 272.3) | — |
| `scrim` | oklch(0.224 0.039 292.2) | — |
| `chrome` | oklch(0.248 0.006 271.2) | — |
| `chrome-muted` | oklch(0.369 0.007 240) | — |
| `grace-ink` | oklch(0.191 0 0) | — |
| `grace-title` | oklch(0.245 0.027 53.8) | — |
| `user-ink` | oklch(0.294 0.022 300.3) | — |
| `label-ink` | oklch(0.483 0.034 293.8) | — |
| `lead-ink` | oklch(0.529 0.037 290.8) | — |
| `subtle` | oklch(0.425 0.035 293.6) | — |
| `greeting-sub` | oklch(0.549 0.029 268.6) | — |
| `chevron` | oklch(0.521 0.042 293.4) | — |
| `pale` | oklch(0.763 0.034 297) | — |
| `site` | oklch(0.972 0.003 247.9) | — |
| `favicon` | oklch(0.64 0.022 291.9) | — |
| `site-brand` | oklch(0.347 0.073 256.7) | — |
| `site-ink` | oklch(0.267 0.028 248.9) | — |
| `site-muted` | oklch(0.458 0.027 248.4) | — |
| `site-line` | oklch(0.926 0.007 247.9) | — |
| `site-border` | oklch(0.852 0.012 252.1) | — |
| `site-placeholder` | oklch(0.659 0.017 248.1) | — |
| `site-error` | oklch(0.501 0.178 28.7) | — |
| `site-ok` | oklch(0.514 0.117 153.6) | — |
| `field-placeholder` | oklch(0.562 0 0) | — |
| `dim` | oklch(0 0 0) | — |
| `thumb-ring` | oklch(0.203 0.039 282.3) | — |
| `calendar-shadow` | oklch(0.538 0.139 29.1) | — |
| `guide-close` | oklch(0.409 0.043 291.4) | — |
| `placeholder` | oklch(0.431 0.12 285) | — |
| `address-placeholder` | oklch(0.498 0.009 253.9) | — |
| `outside-day` | oklch(0.766 0.027 295.4) | — |
| `link` | oklch(0.487 0.181 261.1) | — |
| `primary-pressed` | oklch(0.411 0.131 288.3) | — |
| `guide` | oklch(0.595 0.201 286.2) | — |
| `lavender` | oklch(0.695 0.146 290.3) | — |
| `unread` | oklch(0.567 0.181 292) | — |
| `pager` | oklch(0.774 0.104 293.2) | — |
| `rose` | oklch(0.652 0.178 8.4) | — |
| `alert` | oklch(0.597 0.182 24.5) | — |
| `offline` | oklch(0.551 0.19 27.2) | — |
| `pdf` | oklch(0.915 0.015 298.5) | — |
| `switch-off` | oklch(0.832 0.024 296.7) | — |
| `track-off` | oklch(0.682 0.027 295.9) | — |
| `keyboard` | oklch(0.865 0.014 295.3) | — |
| `key-fn` | oklch(0.744 0.02 292.5) | — |
| `key-pressed` | oklch(0.932 0.012 296.3) | — |
| `key-mark` | oklch(0.944 0.027 297.3) | — |
| `frame-lilac` | oklch(0.827 0.087 294) | — |
| `frame-sky` | oklch(0.862 0.05 249.3) | — |
| `frame-lime` | oklch(0.938 0.111 114.9) | — |
| `frame-mauve` | oklch(0.857 0.067 303.4) | — |
| `frame-from` | oklch(0.904 0.044 295.5) | — |
| `frame-via` | oklch(0.92 0.023 252.2) | — |
| `frame-to` | oklch(0.96 0.047 113.7) | — |
| `ring-from` | oklch(0.759 0.059 295) | — |
| `ring-via` | oklch(0.817 0.041 248.3) | — |
| `ring-to` | oklch(0.935 0.145 113.5) | — |
| `halo` | oklch(0.773 0.105 294.3) | — |
| `orb-light` | oklch(0.788 0.124 298.3) | — |
| `orb-mid` | oklch(0.688 0.172 293.2) | — |
| `orb-deep` | oklch(0.625 0.19 290.3) | — |
| `orb-mist` | oklch(0.927 0.04 296.7) | — |
| `orb-blue` | oklch(0.692 0.149 257.9) | — |
| `orb-pink` | oklch(0.713 0.172 351.8) | — |
| `orb-haze` | oklch(0.872 0.071 296.6) | — |
| `orb-veil` | oklch(0.908 0.051 297.7) | — |
| `orb-violet` | oklch(0.653 0.166 288.5) | — |
| `orb-glow` | oklch(0.764 0.125 294.2) | — |
| `calendar-from` | oklch(0.746 0.136 37.7) | — |
| `calendar-page` | oklch(0.955 0.014 304.1) | — |
| `calendar-ink` | oklch(0.291 0.079 288.7) | — |
| `calendar-ring` | oklch(0.521 0.088 311.7) | — |
| `sleep-glow` | oklch(0.28 0.056 292.8) | — |
| `sleep` | oklch(0.18 0.019 294.7) | — |
| `sleep-ink` | oklch(0.943 0.016 297.5) | — |
| `sleep-date` | oklch(0.83 0.037 296.2) | — |
| `sleep-hint` | oklch(0.729 0.039 295.6) | — |
| `avatar-1` | oklch(0.575 0.117 243.7) | — |
| `avatar-2` | oklch(0.542 0.122 257.8) | — |
| `avatar-3` | oklch(0.597 0.072 151.9) | — |
| `avatar-4` | oklch(0.653 0.03 274.4) | — |
| `avatar-5` | oklch(0.589 0.116 44.4) | — |
| `avatar-6` | oklch(0.565 0.129 307.2) | — |

| Token | Value |
| --- | --- |
| `radius` | 0.75rem |
| `font.sans` | "Figtree", Arial, sans-serif |
| `font.mono` | ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace |
| `font.site` | Arial, Helvetica, sans-serif |
| `shadow.sm` | 0 1px 2px oklch(0 0 0 / 0.08) |
| `shadow.md` | 0 4px 12px oklch(0 0 0 / 0.12) |
| `shadow.lg` | 0 12px 32px oklch(0 0 0 / 0.18) |
| `shadow.float` | 0 1px 2px rgb(59 47 99 / 0.05), 0 4px 14px rgb(59 47 99 / 0.06) |
| `shadow.glass` | inset 0 0 0 1px rgb(255 255 255 / 0.75), inset 0 1.5px 1px rgb(255 255 255 / 0.95), inset 0 -1px 1px rgb(255 255 255 / 0.35) |
| `shadow.glass-pressed` | inset 0 0 0 1px rgb(255 255 255 / 0.75), inset 0 1.5px 1px rgb(255 255 255 / 0.95), inset 0 -1px 1px rgb(255 255 255 / 0.35), inset 0 0 0 1.5px rgb(255 255 255 / 0.7), 0 6px 18px rgb(59 47 99 / 0.14) |
| `shadow.capsule` | inset 0 0 0 1px rgb(255 255 255 / 0.9), inset 0 1.5px 1px #fff, 0 0 0 1px rgb(59 47 99 / 0.1), 0 4px 14px rgb(59 47 99 / 0.12) |
| `shadow.raised` | 0 1px 2px rgb(59 47 99 / 0.08), 0 4px 14px rgb(59 47 99 / 0.12) |
| `shadow.prominent` | 0 1px 2px rgb(59 47 99 / 0.1), 0 4px 14px rgb(59 47 99 / 0.18) |
| `shadow.panel` | 0 2px 10px rgb(60 70 110 / 0.08) |
| `shadow.badge` | 0 1px 4px rgb(60 70 110 / 0.14) |
| `shadow.photo` | 0 8px 30px rgb(60 70 110 / 0.18) |
| `shadow.menu` | inset 0 0 0 1px rgb(255 255 255 / 0.85), 0 12px 32px rgb(59 47 99 / 0.18) |
| `shadow.dialog` | 0 24px 60px rgb(28 24 44 / 0.3) |
| `shadow.field` | inset 0 0 0 1.5px rgb(59 47 99 / 0.16) |
| `shadow.field-focus` | inset 0 0 0 1px rgb(255 255 255 / 0.9), 0 0 0 2.5px var(--primary), 0 4px 14px rgb(59 47 99 / 0.12) |
| `shadow.selected` | inset 0 0 0 2.5px var(--primary) |
| `shadow.key` | 0 1px 0 rgb(0 0 0 / 0.25) |
| `shadow.halo` | 0 0 0 8px rgb(201 188 250 / 0.8), 0 0 22px 14px rgb(185 168 242 / 0.6) |
| `shadow.guide` | 0 0 0 4px var(--guide), 0 0 0 10px rgb(122 99 238 / 0.22), 0 8px 24px rgb(59 47 99 / 0.14) |
| `shadow.guide-ok` | 0 0 0 4px var(--ok), 0 0 0 10px rgb(30 122 70 / 0.15), 0 8px 24px rgb(59 47 99 / 0.14) |
| `shadow.device` | 0 30px 60px rgb(20 16 32 / 0.25) |
| `shadow.banner` | inset 0 1.5px 0 rgb(255 255 255 / 0.95), inset 0 0 0 1px rgb(255 255 255 / 0.7), 0 1px 2px rgb(59 47 99 / 0.05), 0 4px 14px rgb(59 47 99 / 0.06) |
| `shadow.frost` | inset 0 0 0 1px rgb(255 255 255 / 0.75), inset 0 1.5px 1px rgb(255 255 255 / 0.95), 0 2px 10px rgb(59 47 99 / 0.08) |
| `shadow.window` | 0 0 0 1px rgb(59 47 99 / 0.06), 0 1px 2px rgb(59 47 99 / 0.05), 0 4px 14px rgb(59 47 99 / 0.06) |
| `shadow.popover` | inset 0 0 0 1px rgb(255 255 255 / 0.85), 0 12px 32px rgb(59 47 99 / 0.22) |
| `shadow.tile` | 0 1px 4px rgb(60 70 110 / 0.12) |
| `shadow.picture` | 0 2px 10px rgb(60 70 110 / 0.12) |
| `shadow.paper` | 0 2px 14px rgb(60 70 110 / 0.16) |
| `shadow.preview` | 0 8px 14px rgb(60 70 110 / 0.16) |
| `shadow.thumb` | inset 0 0 0 1px rgb(59 47 99 / 0.08), 0 2px 8px rgb(59 47 99 / 0.25) |
| `shadow.tag` | 0 1px 2px rgb(59 47 99 / 0.06), 0 8px 24px rgb(59 47 99 / 0.16) |
| `shadow.cursor` | 0 0 0 6px rgb(122 99 238 / 0.35), 0 0 22px 8px rgb(122 99 238 / 0.35) |
| `shadow.tile-pressed` | inset 0 0 0 1px rgb(255 255 255 / 0.95), 0 4px 12px rgb(59 47 99 / 0.12) |
| `shadow.bubble` | 0 1px 2px rgb(59 47 99 / 0.06), 0 4px 14px rgb(59 47 99 / 0.08) |
| `shadow.strip` | inset 0 0 0 1px rgb(255 255 255 / 0.75), 0 6px 20px rgb(59 47 99 / 0.14) |
| `shadow.cursor-tag` | 0 8px 24px rgb(59 47 99 / 0.22) |
| `shadow.cursor-tag-paused` | inset 0 0 0 2px var(--primary), 0 8px 24px rgb(59 47 99 / 0.18) |
| `shadow.guide-tight` | 0 0 0 4px var(--guide) |
| `shadow.guide-tight-ok` | 0 0 0 4px var(--ok) |
| `shadow.guide-nudge` | 0 0 0 4px var(--guide), 0 0 0 10px rgb(122 99 238 / 0.24) |
| `shadow.attachment` | 0 2px 8px rgb(60 70 110 / 0.12) |
| `shadow.photo-tile` | 0 2px 10px rgb(60 70 110 / 0.1) |
| `shadow.pane` | inset 0 0 0 1px rgb(255 255 255 / 0.65), inset 0 1px 0 rgb(255 255 255 / 0.95), 0 0 0 1px rgb(255 255 255 / 0.55), 0 1px 2px rgb(59 47 99 / 0.05), 0 4px 14px rgb(59 47 99 / 0.06) |
| `shadow.sidebar` | inset 0 0 0 1px #fff, inset 0 1.5px 2px #fff, 0 0 0 1px rgb(59 47 99 / 0.07), 0 2px 6px rgb(59 47 99 / 0.06), 0 12px 36px rgb(59 47 99 / 0.16) |
| `shadow.print` | 0 0 0 6px #fff, 0 10px 20px rgb(60 70 110 / 0.18) |
| `shadow.print-top` | 0 0 0 6px #fff, 0 14px 24px rgb(60 70 110 / 0.2) |
| `shadow.launcher` | inset 0 1px 0 rgb(255 255 255 / 0.95), 0 1px 2px rgb(59 47 99 / 0.06), 0 8px 22px rgb(59 47 99 / 0.1) |
| `shadow.hairline` | 0 1px 0 rgb(59 47 99 / 0.1) |
| `shadow.arrow` | -1px 1px 0 rgb(255 255 255 / 0.85) |
| `shadow.field-error` | 0 0 0 2.5px var(--destructive), 0 4px 14px rgb(59 47 99 / 0.12) |
| `shadow.strip-pill` | inset 0 0 0 1px rgb(59 47 99 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.8) |
| `shadow.site-card` | 0 1px 3px rgb(0 0 0 / 0.12) |
| `shadow.site-focus` | 0 0 0 2px rgb(31 58 95 / 0.25) |
| `dropShadow.label` | 0 1px 2px rgb(59 47 99 / 0.06), 0 8px 18px rgb(59 47 99 / 0.14) |
| `dropShadow.calendar` | 0 14px 18px color-mix(in srgb, var(--calendar-shadow) 28%, transparent), 0 3px 4px rgb(59 47 99 / 0.12) |
| `breakpoint.sm` | 40rem |
| `breakpoint.md` | 48rem |
| `breakpoint.lg` | 64rem |
| `breakpoint.xl` | 80rem |
| `rounded.line` | 4px |
| `rounded.tag` | 6px |
| `rounded.tile` | 14px |
| `rounded.tab` | 18px |
| `rounded.photo` | 20px |
| `rounded.row` | 22px |
| `rounded.label` | 23px |
| `rounded.day` | 24px |
| `rounded.window` | 26px |
| `rounded.card` | 30px |
| `rounded.screen` | 32px |
| `rounded.menu` | 38px |
| `rounded.segment` | 40px |
| `rounded.device` | 48px |
| `gradient.frame` | radial-gradient(38% 55% at 12% 18%, var(--frame-lilac) 0%, transparent 70%), radial-gradient(40% 55% at 70% 8%, var(--frame-sky) 0%, transparent 70%), radial-gradient(45% 50% at 88% 92%, var(--frame-lime) 0%, transparent 70%), radial-gradient(40% 50% at 30% 95%, var(--frame-mauve) 0%, transparent 70%), linear-gradient(135deg, var(--frame-from) 0%, var(--frame-via) 60%, var(--frame-to) 100%) |
| `gradient.frame-soft` | radial-gradient(38% 55% at 12% 18%, color-mix(in srgb, var(--frame-lilac) 50%, #fff) 0%, transparent 70%), radial-gradient(40% 55% at 70% 8%, color-mix(in srgb, var(--frame-sky) 50%, #fff) 0%, transparent 70%), radial-gradient(45% 50% at 88% 92%, color-mix(in srgb, var(--frame-lime) 50%, #fff) 0%, transparent 70%), linear-gradient(135deg, color-mix(in srgb, var(--frame-from) 50%, #fff) 0%, color-mix(in srgb, var(--frame-via) 50%, #fff) 60%, color-mix(in srgb, var(--frame-to) 50%, #fff) 100%) |
| `gradient.ring` | linear-gradient(135deg, var(--ring-from) 0%, var(--ring-via) 55%, var(--ring-to) 100%) |
| `gradient.calendar` | linear-gradient(135deg, var(--calendar-from) 0%, var(--rose) 100%) |
| `gradient.sleep` | radial-gradient(60% 70% at 20% 10%, var(--sleep-glow) 0%, transparent 70%), linear-gradient(var(--sleep), var(--sleep)) |
| `gradient.sheen` | linear-gradient(108deg, rgb(255 255 255 / 0) 47%, rgb(255 255 255 / 0.35) 50%, rgb(255 255 255 / 0) 53%) |
| `gradient.orb` | radial-gradient(circle at 40% 38%, var(--orb-light), var(--orb-deep)) |
| `text.caption` | 0.9375rem |
| `text.label` | 1.0625rem |
| `text.body` | 1.25rem |
| `text.body-lg` | 1.375rem |
| `text.lead` | 1.5rem |
| `text.title-sm` | 1.625rem |
| `text.title` | 1.75rem |
| `text.title-lg` | 1.875rem |
| `text.display-sm` | 2.125rem |
| `text.display` | 2.5rem |
| `blur.glass` | 1.5px |
| `blur.soft` | 3px |
| `blur.mist` | 14px |
| `blur.capsule` | 16px |
| `blur.nav` | 18px |
| `blur.frost` | 20px |
| `blur.fade` | 24px |
| `blur.haze` | 30px |
| `keyframes.rise` | from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none} |
| `keyframes.eq` | 0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)} |
| `keyframes.breathe` | 0%,100%{transform:scaleY(.55);opacity:.7}50%{transform:scaleY(1);opacity:1} |
| `keyframes.bob` | 0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-5px);opacity:1} |
| `keyframes.blink` | 50%{opacity:0} |
| `keyframes.guide-pulse` | 50%{box-shadow:0 0 0 6px var(--guide),0 0 0 16px rgb(122 99 238 / .18),0 8px 24px rgb(59 47 99 / .14)} |
| `keyframes.guide-pulse-ok` | 50%{box-shadow:0 0 0 6px var(--ok),0 0 0 16px rgb(30 122 70 / .12),0 8px 24px rgb(59 47 99 / .14)} |
| `keyframes.guide-pulse-tight` | 50%{box-shadow:0 0 0 4px rgb(157 139 240 / .2)} |
| `keyframes.guide-pulse-tight-ok` | 50%{box-shadow:0 0 0 4px rgb(30 122 70 / .2)} |
| `keyframes.label-in` | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} |
| `keyframes.orb-in` | from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none} |
| `keyframes.ripple` | from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0} |
| `keyframes.drift` | 0%{transform:translate(0,0)}50%{transform:translate(-60px,30px)}100%{transform:translate(40px,-20px)} |
| `keyframes.glow` | 0%,100%{transform:scale(1.05);opacity:.75}50%{transform:scale(1.45);opacity:1} |
| `keyframes.glow-ring` | 0%{transform:scale(1);opacity:.9}100%{transform:scale(1.75);opacity:0} |
| `keyframes.sheen` | 0%,55%{left:-40%}100%{left:140%} |
| `keyframes.sheen-pan` | 0%,55%{background-position:100% 0}100%{background-position:0% 0} |
| `animate.rise` | rise .3s ease-out |
| `animate.eq` | eq .9s ease-in-out infinite |
| `animate.breathe` | breathe 1.8s ease-in-out infinite |
| `animate.bob` | bob 1.2s ease-in-out infinite |
| `animate.blink` | blink 1s step-end infinite |
| `animate.guide-pulse` | guide-pulse 1.4s ease-in-out infinite |
| `animate.guide-pulse-ok` | guide-pulse-ok 1.4s ease-in-out infinite |
| `animate.guide-pulse-tight` | guide-pulse-tight 1.4s ease-in-out infinite |
| `animate.guide-pulse-tight-ok` | guide-pulse-tight-ok 1.4s ease-in-out infinite |
| `animate.label-in` | label-in .3s ease-out both |
| `animate.orb-in` | orb-in .35s ease-out both |
| `animate.ripple` | ripple .7s ease-out infinite |
| `animate.drift` | drift 16s ease-in-out infinite alternate |
| `animate.glow` | glow 2.4s ease-in-out infinite |
| `animate.glow-ring` | glow-ring 2.4s ease-out infinite |
| `animate.sheen` | sheen 9s ease-in-out infinite |
| `animate.sheen-pan` | sheen-pan 9s ease-in-out infinite |
| `animate.spin-slow` | spin 14s linear infinite |
| `duration.fast` | 100ms |
| `duration.base` | 150ms |
| `duration.press` | 140ms |
| `duration.quick` | 200ms |
| `duration.slow` | 300ms |
| `duration.window` | 280ms |
| `duration.glow` | 400ms |
| `duration.progress` | 600ms |
| `ease.standard` | cubic-bezier(0.4, 0, 0.2, 1) |
| `ease.spring` | cubic-bezier(0.3, 0.7, 0.4, 1.4) |
| `ease.settle` | cubic-bezier(0.3, 0.7, 0.3, 1) |
| `ease.css-default` | cubic-bezier(0.25, 0.1, 0.25, 1) |
| `ease.out-cubic` | cubic-bezier(0.33, 1, 0.68, 1) |
<!-- tokens:end -->
