# Architecture

Plain Electron (no UI framework), with multiple transparent, frameless
`BrowserWindow`s — each one is a separate visual piece, not a "tab" of a
single window.

## Windows

| Window | File | When it exists |
|---|---|---|
| Sun (main) | `renderer/index.html` | Always; contains the sun (and the moon from breathing mode) |
| Bubble | `renderer/speech.html` | While a tip or the breathing exercise is on screen |
| Menu (right-click) | `renderer/context-menu.html` | While the menu is open |
| Custom frequency | `renderer/frequency-prompt.html` | While that window is open |

Secondary windows (bubble, menu, frequency) are **created on open and
destroyed on close**, always born already on the sun's monitor — being
born directly on the right monitor avoids the Electron bug of losing
clicks when switching monitors (see below). Each one only touches global
state (`menuWin`, `speechWin`...) if it's still the current window:
before, an old menu's async `closed` would wipe out the new menu's
reference, leaving it orphaned and the menu would stop opening.

Bug fixed: unlike the bubble (`focusable: false`, never contests the top
of the stack), the menu needs to be focusable to receive clicks — and as
soon as it opens, it becomes the topmost window among those at
`'screen-saver'` level. If the sun then moved (dragging or a fling bounce
while the menu was open) and passed over the menu's area, it would end up
visually underneath it, hidden. `repositionFollowerWindows()` now also
calls `win.moveTop()` in that case — it only reorders the stack, it
doesn't take focus away from the menu — bringing the sun back to the top
whenever it (or one of the popups) moves.

### Bubble (`speech.html`)

The sun's renderer decides the text (a random tip, breathing phase) and
sends it over IPC (`speech-show` / `speech-update` / `speech-hide`); the
main process creates the window, the bubble measures its own size
(`speech-size`) and the main process positions it around the sun
(`computeSpeechPlacement`): above it; below, if there's no room above;
shifted to the side when the sun is at the edge, with the "tail" always
pointing at the sun. The sun never moves to make room.

While the tip bubble is on screen (`shining`), a `#mouth` — a small oval,
child of `#sun`, positioned over the 🌞 emoji's mouth — opens and closes
quickly (`mouth-talk`) simulating speech; it stays at `opacity:0` the rest
of the time, leaving the emoji's normal smile showing underneath.

The bubble has its own color per tip type — visual identity, not just
text: `kind: 'tip'` (calming tip) stays the default amber,
`kind: 'physical'` (physical break: water/stretch) is mint green
(`.speech-card.physical`, same layout as `.tip`, only the palette
changes). The `kind` comes from the sun's renderer (`showBubble()`, from
the `kind` parameter already used to pick the message pool).

In the menu (`context-menu.js`), the persistent-state options (tips,
walking, sounds, start with Windows) use a square indicator
(`.toggle-dot`, filled with a "check" when active) instead of just
swapping the verb's text — you can see the current state at a glance,
without having to read.

Sunglasses (`#sunglasses`, an SVG with two lenses/a bridge, child of
`#sun` — it follows along on its own with whatever bob/talk/wobble the
sun already has, without reapplying the animation on a sibling element):
`settings.sunglasses` (persisted), toggled by the icon-only button (🕶️,
reusing the `.lang-btn` style) in the menu, action `toggle-sunglasses`.
Turned off during moon/eclipse mode (doesn't make sense in that state).
Wayfarer shape (trapezoidal lenses, wider on top, with a bridge and
thick temples) — the classic "Ray-Ban style", explicitly requested.

The mouth (`#mouth`) needed a few adjustments after seeing it run: wide
enough (27px) to fully cover the emoji's smile underneath (otherwise a
piece of the original smile was left showing next to the talking mouth,
the two together looking odd) and a more contained opening (peak
`scaleY` of 1.5, was 2.2 — it was exaggerated). It also only talks with
`:not(.weee):not(.weee-mild):not(.dizzy)` — talking AND wobbling from a
drag/fling at the same time interfered with each other visually.

`settings.sunglasses` genuinely defaults to `false` — starts off on a
fresh install.

### Visual feedback while checking for an update

`#sun-wrap.checking-update` turns on the same `#glow` used by other
states, with the rays spinning fast (1.2s, much faster than any other
state) — a visible "searching" cue, since the check almost never shows
any popup (only when it actually finds an update, or when it's a manual
request and it fails). `setCheckingUpdate()` (`main.js`) turns this on
from the real `autoUpdater`'s `checking-for-update` event (only exists
with the packaged app) and turns it off on the other events
(`update-downloaded`, `update-not-available`, `error`). In development
mode there's no real `autoUpdater` to listen to (`initAutoUpdater()`
doesn't even run), so `checkForUpdatesNow()` simulates it: turns
`checking-update` on right away, waits 1.6s and turns it off before
showing the "development mode" popup — lets you validate the animation
without needing a real installed version.

Bug fixed: a real check just hits the GitHub API for `latest.yml` and
usually finishes in well under a second — too fast for the spin to ever
become noticeable in an actual installed copy, even though it worked
fine in the dev-mode simulation (which already had a fixed delay on
purpose). `stopCheckingUpdate()` now enforces a minimum visible duration
(`MIN_CHECKING_UPDATE_MS`, 1.4s) before turning the class off and running
whatever needs to happen next (opening a popup, etc.), regardless of how
fast the real check actually finished.

### Breathing mode: sun/moon transformation

Classes on `#sun-wrap`: `moon-mode` (the moon 🌚 appears small in the
center and grows to normal size with a bounce at the end — `@keyframes
grow-in-bounce` — while the sun shrinks and disappears in the same spot
— `@keyframes shrink-out`), `breathing` (the moon, already settled,
inflates/deflates in 16s cycles) and `moon-exit` (the same motion with
the roles swapped: the sun appears small and grows with the bounce —
`grow-in-bounce` — while the moon shrinks and disappears — `shrink-out`).
No orbit or rotation: it's just a crossfade with scale, so both
`@keyframes` work for either side of the transition, just swapping which
element gets which. At that moment the moon darkens a bit
(`filter: brightness(0.8)` on `#sun-wrap.breathing #moon`), simulating
the eclipse's shadow.

The two `@keyframes` are **sequential, not simultaneous**: whoever is
disappearing holds full size until 45% and only then quickly shrinks
away by 50%; whoever is appearing stays hidden until that same 50% mark
and only then grows in with the bounce. Bug fixed: with both running at
the same time for the whole 1.8s (a "real" crossfade), midway through the
transition you could see the sun's rays (a spiky silhouette, bigger than
the disc) peeking out from behind the moon (round, smaller at that
instant) — shrinking and growing in sequence, with no overlap, gets rid
of that for good.

Total duration: 0.7s (was 1.8s — flattened quite a bit so the transition
feels almost instant, not a slow animation). `BREATHING_EXIT_ANIM_MS`
(`main.js`) and the local `setTimeout` that removes the `moon-exit` class
(`renderer.js`) are kept in sync with this value.

The `#glow` (the same glow used for "giving a tip") also turns on while
the moon is around (`moon-mode`/`breathing`), but becomes a corona that
hugs the moon's silhouette much more closely: smaller (76px instead of
100px) and **with the rays not spinning** (`#rays { opacity: 0 }` in
those states) — just the glow ring (`#glow-circle`) pulsing. When
returning to the sun (`moon-exit`) the glow is turned off — the sun
reappears on its own, with no corona behind it. Clicks are listened for
on `#sun-wrap`, not `#sun`, so they also work over the moon.

Bug fixed: the `#glow` `<svg>` clips its own drawing at its `viewBox`'s
edge by default (browser behavior); the glow circle's pulse
(`glow-pulse`) goes slightly past it at the peak of the scale, cutting
off a slice of the glow — fixed with `overflow: visible` on `#glow`.

When it ends (by click or time running out), instead of resuming the
walk right away, the main process sends `breathing-done-prompt` and the
renderer shows an invitation in the bubble ("How are you feeling? / tap
to breathe again", with the invitation's text highlighted —
`.speech-card.cta #hint`, different from the discreet "tap to stop" text
of the exercise itself). Tapping it (`breathing-again-request`) restarts
the exercise from scratch (a new countdown); if no one taps it within
`BREATHING_PROMPT_MS` (7s), the renderer itself sends
`breathing-prompt-dismissed` and only then does the main process resume
walking and show the pending tip, if there is one. `requestTipNow()`
(asking for a tip now, including during the exercise) skips this
invitation on purpose — the intent there is to see the tip, not to
repeat the breathing.

All of them use `transparent: true`, `frame: false`,
`alwaysOnTop: true` (`screen-saver` level, Electron's highest) and
`skipTaskbar: true`. The sun's window is `focusable: false` on purpose —
it should never steal focus from another window; that's why dragging is
done manually (see below), not with native
`-webkit-app-region: drag` (which breaks clicking/the context menu — see
CHANGELOG).

## Main process (`main.js`)

Owner of all the state: the sun's position, settings (`settings.json` in
`app.getPath('userData')`), and every timer. Renderers don't hold state
that survives a reload — only main.js does.

`settings.json` lives outside the installed program's own folder (in
`%APPDATA%`), so the NSIS installer never touches it — an update carries
every setting over as-is (sunglasses, language, mute, etc.). Defaults in
the `Object.assign(...)` at the top of the file only apply the very first
time the app ever runs, when the file doesn't exist yet; they don't reset
anything on an update.

### Anchoring the secondary windows

The menu and the frequency window aren't positioned relative to the whole
screen; they're computed from the sun's current position
(`computeMenuPosition`, `computeFreqPromptPosition`, in `main.js`), and
if the sun is dragged while one of them is open,
`repositionFollowerWindows()` realigns them in real time.

A point worth noting: the sun's window (`WIN_H = 320`) is much taller
than the visible sun (`96px` tall, anchored at the window's bottom) — a
holdover from when the bubble used to live inside it. That's why
`SUN_VISUAL_TOP_MARGIN` / `getSunAnchorTop()` / `sunVisualRect()` exist:
without them, anything anchoring to the sun would end up anchoring to
the top of the invisible window, well above where the sun actually is.

### Reasons to pause walking (`pauseReasons`)

The sun's walk can be paused for several reasons at the same time:
showing a tip, the random "stop to breathe" cycle, the breathing
exercise, the menu open, the frequency window open. This is modeled as a
`Set` of reasons (`pauseWalk(reason)` / `resumeWalk(reason)`), not a
single boolean — a single boolean already caused a real bug (the idle
cycle would "unlock" walking even with a popup still open, because both
touched the same variable). Walking is only allowed when the `Set` is
empty.

### Pending tip (`pendingTip`)

If it's time to show a tip while the app is "busy" (a menu or popup
open, or the breathing exercise running — see `isBusy()`), the tip
doesn't show up behind the popup; it's stored in `pendingTip` (holds
only **one**, never piles up) and is shown as soon as whatever was
occupying the screen finishes (`showPendingTipIfAny()`, called in the
close handlers of each popup and at the end of the breathing exercise).

Asking for a tip through the menu ("Give me a tip now") while in
breathing mode doesn't wait for the exercise to end on its own:
`requestTipNow()` calls `endBreathingExercise(false)` — the `false`
skips the repeat invitation (see above) — and the tip only shows up
after the transition finishes (`endBreathingExercise` holds the next
step behind a `setTimeout` of `BREATHING_EXIT_ANIM_MS`, matching the
duration of `grow-in-bounce`/`shrink-out` in `renderer/style.css`, so it
doesn't cut the animation short by showing the bubble on top of it).

### Two independent tip cycles

`scheduleNextTip()` (calming tips, frequency configurable from the menu)
and `scheduleNextPhysicalTip()` (water/stretch/stand up, fixed frequency
in `PHYSICAL_TIP_MINUTES`) run in parallel, each with its own timer and
jitter. Both go through the same `triggerBubble(kind)` / `isBusy()` /
`pendingTip`, so they never show up on top of each other.

With tips paused (`settings.tipsPaused`), `triggerBubble()` returns right
away — clicking the sun in that state asked for a tip that never
appeared, with no bubble at all to play the usual little sound
(`playChime()` lives inside `showBubble()`, only fires when the bubble
actually shows up). The click stayed silent. Fixed by playing the chime
directly on click (`renderer.js`) when `tipsPaused` is on — the renderer
now keeps track of that value via `init-settings` and a new
`tips-paused-changed` event (sent by the main process only when the menu
toggles the option). Outside of that case, `showBubble()` still plays the
sound as always, so it doesn't play twice.

## Manual dragging (doesn't use `-webkit-app-region: drag`)

The sun started out using Chromium's native drag region, but that makes
Windows treat that area as a title bar — regular click and right-click
stop working (the OS intercepts the mousedown before the DOM sees it).
The final solution: the renderer only announces the start (`mousedown`)
and end (`mouseup`) of the drag; while it lasts, the main process reads
the cursor with `screen.getCursorScreenPoint()` every 16ms and moves the
window.

Why the cursor is read in the main process and not the renderer: with
monitors at different scales (e.g. 100% and 150%), the renderer's
`screenX`/`screenY` ends up in a different coordinate system when
crossing screens, and dragging would get stuck. For the same reason, the
renderer ends the drag if it gets a `mousemove` with no button pressed —
`mouseup` can get lost when switching screens.

## Where the sun's window accepts clicks

The sun's window lets the mouse pass through (`setIgnoreMouseEvents(true)`),
except over the sun. `hoverTick()` in the main process decides this,
every 50ms, comparing `screen.getCursorScreenPoint()` against
`sunVisualRect()`.

The previous version used `mouseenter`/`mouseleave` in the renderer,
which depend on Windows' mouse forwarding (`forward: true`). On a
monitor with a scale != 100%, that forwarding reports the wrong
position, the sun would never "notice" the mouse over it, and it became
impossible to click/drag after switching screens.

### Electron bug when switching to a monitor with a different scale

A window created on a 100% monitor and moved (with `setBounds`) to a
150% one starts **losing `mousedown`**: `mouseup` arrives, `mousedown`
doesn't, so dragging never starts. A window created directly on the 150%
monitor doesn't have the problem, and neither do small windows
(120×120) — with the sun's size (260×320) it happens every time. It's
not a position calculation issue: it was measured with `GetWindowRect`
and a screenshot, and the window, the drawing and the clickable area
were all in the right place.

What fixes it: a real resize (1px bigger and back), or hiding and
showing the window. We use the resize, since it doesn't flicker:
`setSunBounds()` detects when the window changes monitor and, as soon as
it's no longer being dragged, calls `refreshInputAfterDisplayChange()`.

## Sun position and multiple monitors

The sun window's position is stored in `sunPos` (with decimal places)
and applied via `setSunBounds()`, instead of being re-read with
`getBounds()` on every step: on a monitor with a scale != 100%, Windows
rounds the position and a ~1px step disappears — the sun would "walk"
without moving. `setSunBounds()` also fixes the window's size, which
Windows can change when crossing into a monitor with a different scale.

Nothing is hardcoded for a specific setup: every boundary comes from
`screen.getAllDisplays()` / `getDisplayNearestPoint()`, so it works with
however many monitors someone has, at any scale and arrangement.

- **Walking**: stays on the monitor the sun is on (edge to edge of it);
  never switches screens on its own.
- **Dragging**: the only way to change monitor; can go to any of them,
  locked to whichever monitor the sun ends up on.
- **Fling**: releasing the sun while moving fast keeps the motion going
  (`startFlingIfFast` / `flingTick`, in `main.js`) — friction on every
  tick, bouncing off the current monitor's edges (loses part of the
  speed), until it stops on its own and normal walking resumes. Speed is
  estimated in `dragTick()` by comparing position every 16ms, smoothed
  between ticks so it doesn't get jittery. Dragging again mid-fling
  cancels it. The final stretch has a stronger brake
  (`FLING_EASE_SPEED` / `FLING_EASE_FRICTION`) than the normal "cruise"
  friction: without it, the usual weak friction took too long to get
  close to zero, and the cutoff at `FLING_STOP_SPEED` happened while the
  sun was still visibly moving — a smooth "easy out" over ~0.5s instead
  of an abrupt stop. Being dragged (after it's already moved) is always
  maximum excitement; flying free after a fling, the excitement has
  degrees depending on the current speed (`main.js` sends `fling-speed`
  on every tick of `flingTick()`, not just at the start): above
  `FLING_WILD_SPEED` (260 px/s) it's `#sun-wrap.weee` — a "weeeee" face
  (😆) and a fast wobble (`weee-wobble`); below that (but still moving)
  it's `#sun-wrap.weee-mild` — same normal face, just a much more
  discreet, slower wobble (`weee-wobble-mild`); below
  `FLING_CALM_SPEED` (40 px/s, "almost stopped") neither class is on
  anymore — the idle/walking animation underneath (never turned off)
  shows through again on its own, so the transition to the normal state
  already happens before the fling actually finishes, not only at the
  exact instant it stops. In either degree of excitement, the `#glow`
  (the same glow used by other states) turns on with a very subtle pulse
  (shrinks a bit and back) and the rays spin much slower than in any
  other state (26s for "weee", 40s for "weee-mild"). At the exact instant
  of hitting an edge, `#sun-wrap.dizzy` briefly overlays a dizzy face
  (😵) and a rougher wobble (`fling-wobble`, reused from the earlier
  design) on top of whatever was playing — it lasts as long as the
  impact's squash (`animationend` on `wall-squash-x/y` turns `dizzy` off)
  and then goes back on its own to whichever degree of excitement
  matches the current speed, since the flight continues.
  `updateMotionVisual()` (in `renderer.js`) centralizes this face/class
  switching from `isDragging`, `flingActive`, `flingSpeed` and
  `impactActive`, always mutually exclusive with each other.

  Bug fixed: the face swap used `sunEl.textContent = ...`, which
  **wipes out all of `#sun`'s children** — harmless while it only had
  text, but it destroyed the `#mouth`/`#sunglasses` (added later) every
  time the face changed (every fling tick!). Fixed by moving the face
  emoji into its own `<span id="face">`, a child of `#sun` alongside the
  others — only that span's `.textContent` is swapped now.

  When it stops moving (letting go of a drag without it turning into a
  fling, or a fling decaying down to "calm"), a `.settling` class
  (`@keyframes settle-wobble`, 0.4s, `animation-fill-mode: forwards`)
  eases the rotation back to zero before handing control back to the
  idle/walking animation underneath (never turned off) — without this,
  the cut was abrupt: the wobble's `rotate()` doesn't interpolate with
  `bob`/`breathe`'s `translateY`/`scale()`, so the only visual outcome
  was an abrupt "vanishing". `wasMoving` (in `renderer.js`) tracks the
  falling edge (was moving → stopped) to trigger this only at that exact
  instant; if a new movement starts before it finishes, `.settling` is
  cancelled right away (otherwise it would win over `weee`/`weee-mild`
  by coming later in the file).
- **A monitor being connected/disconnected, or a resolution/scale
  change**, with the app open: `keepSunOnScreen()` brings the sun back to
  the nearest monitor.

The screen boundary (`clampSunWindowPosition`) is applied to the
**visible sun**, not the window: the window has ~80px invisible on each
side and ~210px on top (room for the bubble), so locking the window would
leave a gap up to the real edge. The invisible part can go off-screen;
the sun never does. The taskbar is always respected (`workArea` is used,
not `bounds`). The bubble, having its own window, adjusts to the edge on
its own — the sun doesn't move to make room for it.

## Language (i18n)

`renderer/i18n.js` is a simple `{ pt: {...}, en: {...} }` dictionary
loaded by any window that needs interface text (main index, menu,
frequency window). The tip messages themselves live in
`renderer/messages.js`, also by language (`MESSAGES.pt` / `MESSAGES.en`,
`PHYSICAL_MESSAGES.pt` / `.en`). Switching the language from the menu
saves it to `settings.language` and sends `language-changed` to the main
window to update it on the spot — no app restart needed.

`settings.language` defaults to `'en'` — a fresh install starts in
English, switchable to Portuguese from the menu at any time.

## Sound

Every sound in the app is synthesized on the spot with the Web Audio API
(simple oscillators), no audio files — avoids having to bundle/license a
sound asset. The four (`playChime` for the tip, `playBounceThud` for the
wall bounce, `playMoonToSunChime` for the moon turning into the sun,
`playMenuPop` for the right-click) share the same cozy feel on purpose,
through two shared pieces in `renderer.js`:

- `warmDestination(ctx, cutoff)` — a low-pass `BiquadFilter` every sound
  passes through before the speaker. A triangle wave on its own has
  sharp harmonics that sound "synthetic"; the filter takes that edge off.
- `playWarmNote(ctx, dest, freq, opts)` — one note = triangle (body) +
  a sine an octave up, very quiet (soft shimmer), both going through
  `warmDestination`. Used by the tip's chime, the bounce's "marimba"
  touch (a note picked at random among G4/A4/B4/C5, like a wind chime)
  and the transformation puff — each one just changes
  frequency/duration/volume.

`playMenuPop` is left out of `playWarmNote` on purpose: it's meant to be
short and discreet (an explicit request — "very subtle and dry"), so it's
just a plain osc/gain, but it still goes through the same
`warmDestination` so it doesn't clash with the other three.

The bounce sound's volume (not its pitch) scales with the impact's force
(`speed`, sent by `flingTick`). `settings.muted` (menu → 🔇/🔊) turns off
all four; the change is broadcast on the spot via `mute-changed`, same
as the language.

## Auto-update (`electron-updater`)

`initAutoUpdater()` only runs with `app.isPackaged` (the installed
version) — in `npm start` there's no update feed to check at all, and
trying to check without one would just produce an error. On opening, it
waits 15s (so it doesn't get in the way of startup) and checks once; the
rest of the lifecycle is "install on its own": `autoDownload` and
`autoInstallOnAppQuit` stay on, so if the user doesn't click anything,
the update downloads in the background and installs the next time the
app closes normally.

The popup (`renderer/update-prompt.html`, the same window pattern as the
other secondary windows — born when it shows up, dies when it closes,
anchored above the sun) only shows up in two situations: when the
download finishes (`update-downloaded`, always, with "Update now" /
"Later" buttons) or when the check was manual (menu → "Check for
updates") and found nothing new, found the same error as always, or ran
outside the installed app — the `manualUpdateCheck` flag is what tells
apart "a silent check that found nothing" (doesn't say anything) from
"the person asked to check" (always shows something, even if it's
"you're already up to date").

Bug fixed: `quitAndInstall()` just launches the NSIS installer and quits
the app — it has no way to know or report whether that installer actually
succeeds. With `build.nsis.oneClick: false`, the generated installer is
an assisted wizard (choose the folder, etc.) that needs someone to click
through it; running it unattended after the app has already quit left it
stuck, never finishing, so the old version stayed installed even though
the app had reported "update downloaded". `oneClick: true` makes the
installer fully silent — the only setting that actually works with an
unattended `quitAndInstall()`.

The update feed is the GitHub repository's own Releases
(`build.publish` in `package.json`, provider `github`) — no server or
extra infrastructure of its own. See [README.md](README.md) for how to
publish a new version (`npm run release`, needs `GH_TOKEN`).

The menu shows the installed version at the bottom (`Solzinho v{x.y.z}`,
from `app.getVersion()`) — a quick, always-visible way to confirm an
update actually landed, instead of having to guess from a subtle visual
change.

## Reporting a bug

"🐛 Report a bug" in the menu (`reportBug()` in `main.js`) doesn't send
anything on its own — it builds the link for a new GitHub issue already
filled in (the app's version via `app.getVersion()`, OS, language) and
opens it in the default browser with `shell.openExternal()`; whoever's
reporting still reviews it and clicks "Submit" there.

## Starting with Windows

`registerAutoLaunch()` only takes effect on the installed version
(`app.isPackaged` — in dev mode, `process.execPath` points to the
`electron.exe` inside `node_modules`, not the real app, and registering
that for Windows startup wouldn't make any sense). The value itself
(`settings.autoLaunch`, `true` by default) is read and saved normally in
dev too — only the actual `app.setLoginItemSettings()` call is skipped.
The menu calls `registerAutoLaunch()` again on every toggle, to apply it
right away.

## Icon

`build/icon.png` (1024×1024, transparent background) is the 🌞 emoji
itself drawn on a `<canvas>` and exported via `toDataURL()` — not a
third-party asset, it's generated from the same emoji the app uses. It
serves two purposes: `electron-builder` automatically converts it to the
installer/shortcuts' `.ico` (`build.win.icon` in `package.json`; that's
how the icon shows up on the `.exe`, the start menu and the desktop), and
the sun's window uses the same file directly (`icon:` on the
`BrowserWindow`) so it's consistent in development mode too (Alt+Tab,
task manager) — even though it doesn't normally show up in the taskbar
thanks to `skipTaskbar: true`.

One detail about exporting via `<canvas>` instead of `capturePage()`: the
latter doesn't preserve transparency (it returns a solid white background
even with the window set to `transparent: true`), the canvas does.

## npm scripts

- `npm start` — runs in development mode (`electron .`)
- `npm run pack` — builds without an installer, just the unpacked folder
  (`dist/win-unpacked/`), useful for testing quickly
- `npm run build` — generates the Windows installer
  (`dist/Solzinho Setup *.exe`), without publishing
- `npm run release` — generates the installer and publishes it as a
  GitHub Release (needs `GH_TOKEN`); that's what installed users receive
  as an update
