# Changelog

A record of what's been built, in chronological order. This project
doesn't use semantic versioning yet (it's for personal use); entries mark
feature milestones, not releases.

## First version

- Desktop mascot in Electron: transparent sun, always on top, walking
  along the bottom of the screen, with random "breathing" pauses.
- Tip bubble with messages based on psychology techniques (breathing,
  5-4-3-2-1 grounding, self-compassion, cognitive reframing), on a
  configurable rhythm.
- Clicking the sun asks for a tip on the spot; right-click opens the menu
  (pause tips, frequency, stop/resume walking, close).

## Dragging the sun

- The first attempt with native `-webkit-app-region: drag` broke click
  and right-click (Windows intercepts it as a title bar). Replaced with
  manual dragging over IPC (`mousedown`/`mousemove` in the renderer,
  `setBounds` in the main process).
- Fixed later: dragging had no limit at all and the sun could be lost off
  screen — locked to the monitor's usable area.
- Fixed again: the limit was applied to the window (much bigger than the
  sun, because of the bubble's space), so the sun would stop far from the
  real edge. Now the limit is applied to the visible sun, on whichever
  monitor it's on, and the sun only moves away from the edge when it's
  time to show the bubble.

## Multiple monitors

- Fixed: dragging to a monitor with a different scale (e.g. 100% → 150%)
  left the sun stuck, unable to move anymore. There were three causes:
  mouse coordinates coming from the window are wrong across different
  scales (the cursor is now read straight from the system), "I released
  the button" could get lost (dragging now also ends if the button isn't
  pressed anymore), and Windows' rounding was swallowing the ~1px step of
  the walk (position is now tracked by the app itself).
- Fixed: after moving the sun to a monitor with a different scale, it
  would walk but could no longer be clicked or dragged. Detecting "mouse
  over the sun" depended on Windows' mouse forwarding, which reports the
  wrong position on those monitors; the app now checks the cursor itself.
- Fixed (again): even with the cursor being read correctly, after moving
  the sun to the 150% monitor it couldn't be grabbed. The cause was an
  Electron/Windows bug: a window moved to a monitor with a different
  scale loses the mouse's "button pressed" state. A 1px resize when
  switching monitors makes the window start receiving clicks again.
- Fixed: clicking the sun right up against an edge made it "jump" inward
  (to make room for the bubble). The bubble now has its own window and
  positions itself — below the sun if there's no room above, or shifted
  to the side at the edge. The sun always stays exactly where you left
  it.
- Fixed: after opening the menu once, opening it again could fail (the
  old menu, once it finished closing, would "turn off" the new one).
- Works with every monitor whoever's using it has: the sun can be dragged
  to any of them. Walking on its own, it stays on whichever monitor it's
  on — it only switches screens when dragged.
- Monitor disconnected, or a resolution/scale change, with the app open:
  the sun goes back to the nearest monitor.

## Visuals and feedback

- Redesigned the tip bubble (it was being clipped by the window) and the
  glow around the sun while talking (an SVG with spinning rays + a
  pulsing glow, resized a few times until it hugged the sun).
- A "talking" animation (squash-and-stretch) while the tip is on screen,
  in place of the walking animation that kept playing underneath.
- Synthesized sound (Web Audio API, no audio file) playing along with
  the tip.
- Bubble entrance animation with a bouncy/elastic effect.
- A bounce when clicking the sun (squashes, stretches up and settles).

## Custom menu

- Replaced the native right-click menu (Windows style) with its own HTML
  menu, sharing the bubble's visual identity — this also let us fix a
  real bug in the native menu (the "Custom" option would show as checked
  the moment it was clicked, before even confirming, because of the
  native Windows radio button's default behavior).
- Custom frequency: a dedicated window to type the interval in minutes.
- Fixed an anchoring bug: the menu and the frequency window were being
  positioned from the top of the sun's invisible window (much taller, to
  fit the bubble), not the visible sun — they ended up far from it.
- Both now follow the sun in real time if it's dragged while they're
  open.
- Fixed a pause bug: the "random stop" cycle and the tip bubble used the
  same pause variable as the menu/popup, so the idle cycle could "unlock"
  walking with a popup still open. Solved with multiple independent pause
  reasons (`pauseReasons`).
- An unwanted scrollbar in the menu: `overflow: hidden` was missing on
  that window's `html`/`body` (unlike the main window).

## Breathing exercise

- New menu item: a guided breathing exercise (box breathing, 4-4-4-4, 4
  cycles), with the sun "breathing" at a scale synced to the current
  phase's text.
- A 3s countdown ("Get ready…") before the cycle actually starts.
- Clicking the sun during the exercise now also ends it (before, that
  only worked by clicking the text panel).
- Tips that "want" to show up during the exercise wait for it to finish,
  reusing the same pending-tip mechanism.

- The sun turns into the moon in breathing mode: during the countdown it
  spins and shrinks while a moon 🌛 with a bluish glow appears; it's the
  moon that breathes; at the end it turns back into the sun.
- The transition became a real eclipse: the moon 🌚 emerges from behind
  the sun, does a full 360° loop orbiting in front of it (the sun always
  visible) and closes the loop by covering the sun exactly — a total
  eclipse, with the moon darkening a bit and the solar corona (just the
  ring, without the rays spinning, hugging the moon much more closely)
  visible around it. Turning back into the sun is the same orbit in
  reverse.
- Fling with physics: releasing the sun while it's moving keeps the
  motion going, gradually slowing down and bouncing off the screen's
  edges, until it stops on its own. Grabbing it again mid-fling cancels
  it.
- While being flung, the sun gets a dizzy face (😵) and the glow around
  it pulses very subtly (shrinks a bit and back), spinning very slowly.
  When it stops on its own, it goes back to normal right away, with no
  transition.
- Fixed: during the fling, the sun had no body animation at all (just
  idle's still breathing, barely noticeable while moving). Now it
  wobbles/spins while flying.
- A sound when clicking the moon (or the bubble) to end the breathing —
  a "puff" of transforming back into the sun.
- Asking for a tip from the menu during the breathing exercise no longer
  waits for it to end on its own: it ends right away, with the same
  animation of the moon turning back into the sun, and the tip shows up
  as soon as the transition finishes.
- A bounce when clicking the sun (squashes and returns to normal).
- Hitting the wall during the fling: the sun "squashes" right at the
  moment of impact (stretches toward the opposite side and back) and
  plays a short "boing" whose volume matches the force of the hit.
- A "Mute/Unmute sounds" option in the menu, turns off the tip's chime
  and the bounce's boing.
- Fixed: the glow around the sun (rays + glow) had a "mask" clipping its
  edge at the peak of the pulse — the `<svg>` clips its own drawing by
  default, and the pulse went slightly past its boundary.

## Two tip rhythms

- Split off a second tip cycle, independent from the "calming" one:
  physical break reminders (drink water, stretch, stand up), with their
  own frequency and set of messages.

## Language

- Support for Portuguese and English throughout the whole interface
  (menu, frequency window, breathing phases) and in both tip lists,
  switchable with two little flags (🇧🇷/🇺🇸) in the menu, with no need to
  restart the app.

## Packaging and distribution

- `electron-builder` set up to generate a Windows installer (NSIS,
  per-user, no admin needed).
- Auto-start at Windows login via `app.setLoginItemSettings`, active only
  in the installed version (not in development mode).
- Licensed under the same terms as the same author's
  [Meridian](https://github.com/wallasace/meridian) project: PolyForm
  Internal Use License 1.0.0 (source-available, free for personal/
  internal use, commercial use under a separate license).

## Auto-update

- A "Check for updates" button in the menu, and a silent check on its own
  when opening (installed version only). When it finds an update, it
  downloads on its own and shows a popup ("Update now" restarts right
  away, "Later" installs the next time the app closes normally).
- `npm run release` builds and publishes the installer straight to
  GitHub as a Release — that's the feed the installed version checks.
- A "Report a bug" button in the menu: opens a new GitHub issue already
  filled in with the version, OS and language (doesn't send anything on
  its own — just prepares it, the person still reviews and submits it).
- A sound when opening the menu (right-click): a very short, dry pop.
- The app's icon (installer, shortcuts, .exe): the 🌞 emoji itself,
  generated on a canvas from the emoji, instead of Electron's default
  icon.
- A menu option to choose whether solzinho starts with Windows or not
  (before, it was always on, with no way to turn it off from the app
  itself).
- Fixed: the fling used to stop abruptly with the sun still visibly
  moving. Now the final stretch brakes harder (~0.5s) down to almost
  zero, a smooth ending instead of an abrupt cut.
- Changed the wall-bounce sound: instead of the previous dry boing/click,
  a cozy marimba touch (a random note + a soft harmonic, with no
  harshness at all).
- Unified all 4 of the app's sounds (tip, bounce, transformation, menu)
  with the same cozy feel — the same low-pass filter + warm triangle wave
  recipe, instead of each one sounding different.

## Mouth, menu indicators, and fling/breathing adjustments

- The sun now "moves its mouth" (a small oval overlaid on the emoji's
  face, opening and closing quickly) while showing a tip.
- The menu's persistent-state options (pause tips, walking, sounds, start
  with Windows) got a visual on/off indicator, instead of just swapping
  the verb's text.
- Being dragged or flying free after a fling, the sun now has a
  "weeeee" face (before, it only had the dizzy face during the fling
  itself, and nothing special while being dragged). The dizzy face
  became a quick reaction just for the instant of hitting an edge,
  going back to "weeeee" right after on its own.
- Simplified the breathing exercise's sun/moon transformation: instead of
  the moon orbiting the sun, it's now just the moon appearing small and
  growing with a bounce at the end (and the sun shrinking/disappearing at
  the same time) — and the same motion in reverse on the way back.
- When the exercise ends (by click or time running out), the bubble
  invites you to repeat it ("tap to breathe again", highlighted); tapping
  it restarts the countdown. If no one taps it, it goes back to normal on
  its own after a few seconds.
- The physical-break bubble (water/stretch) got its own color
  (mint green), different from the calming tips' amber — a visual
  identity to tell the two kinds of reminder apart at a glance.
- Centered the language flags' text (BR/US) in the menu — it was
  slightly off-center inside the button's rectangle.
- Fixed: with the menu open, if the sun moved (dragging or a fling
  bounce) into the menu's area, it ended up hidden behind it — the menu,
  unlike the bubble, steals the top of the window stack when it opens.
  Now the sun goes back to the top whenever it repositions itself with a
  popup open.
- Fixed: in the sun/moon transformation, the sun's rays (a spiky
  silhouette) would show up peeking from behind the moon (round) midway
  through the animation, when both were shrinking/growing at the same
  time. Now it's sequential — whoever's disappearing shrinks first, only
  then does whoever's appearing grow — with no overlap between the two.
- Removed the glow (corona) that used to stay behind the sun when coming
  back from breathing (`moon-exit`) — it no longer made sense with the
  simplified transformation; it stays on as usual during moon/breathing
  mode and when giving a tip.
- Made the talking mouth bigger and higher-contrast — the previous
  version was too small/light and was almost impossible to notice at
  real size.
- New menu item (icon only, 🕶️): puts sunglasses on the sun, or takes
  them off, in the classic Wayfarer shape ("Ray-Ban style").
- Fixed a real bug: swapping the sun's face (`sunEl.textContent = ...`)
  wiped out `#sun`'s children — the mouth and the sunglasses would
  disappear for good every time the fling changed its face. The face now
  lives in its own `<span>`, without touching its siblings.
- The fling now has degrees of excitement depending on the current speed
  (instead of one fixed "weeeee" face the whole time): fast is the full
  face and wobble; slower is a much more discreet wobble, normal face;
  close to having already stopped, the idle/walking animation comes back
  on its own even before the fling actually finishes.
- The moon's breathing now has a bit of squash-and-stretch (inflates and
  rises slightly on the "inhale", deflates below normal and sinks on the
  "exhale") instead of just a uniform scale pulse.
- The sun/moon transition is much faster now (0.7s, was 1.8s) — it had
  gotten too slow after the simplification.
- When it stops moving (letting go of a drag, or a fling decaying down),
  a short animation "settles" the rotation before going back to idle/
  walking, instead of the abrupt cut it had before.
- Mouth adjustments: wider (fully covers the emoji's smile underneath,
  instead of leaving a piece of it showing on the side) and opens quite a
  bit less than before (it was exaggerated). It also stops talking while
  being dragged/flung — the two together interfered with each other.
- Sunglasses made 35% bigger.
- Fixed: clicking the sun with tips paused stayed silent (no bubble shows
  up to play the usual little sound). Now it plays the chime directly in
  that case.
- Sunglasses default back to off on a fresh install.
- While checking for an update, the solar corona spins fast — a visual
  "searching" cue, since the check almost never shows any popup. Also
  works in development mode (simulated, since there's no real
  autoUpdater without a real installation).
- Fixed: a real update check finishes so fast that the spin never had
  time to actually show up in an installed copy. It now stays visible for
  at least 1.4s no matter how quickly the real check finishes.
- Fixed a real auto-update bug: the installer was an assisted wizard
  (`oneClick: false`), which needs someone to click through it — running
  it unattended after the app quits (as `quitAndInstall()` does) left it
  stuck, never finishing, so updates would report as downloaded but never
  actually install. Switched to a fully silent installer
  (`oneClick: true`), the only setting that works with an unattended
  install.
- Default language switched to English — a fresh install now starts in
  English, switchable to Portuguese from the menu at any time.
