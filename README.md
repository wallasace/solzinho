# Solzinho

A desktop mascot: a little sun (🌞) that walks around your screen, always
on top of every window, and every once in a while shows up with a short
tip to help you calm down — based on psychology techniques (breathing,
grounding, self-compassion, cognitive reframing) — or a physical break
reminder (water, stretch, stand up). It also has an on-demand guided
breathing exercise.

Made for people who worry too much and need a gentle nudge every now and
then, without giving up screen space for it.

![platform](https://img.shields.io/badge/platform-Windows-blue)
![license](https://img.shields.io/badge/license-PolyForm%20Internal%20Use%201.0.0-lightgrey)

## Seeing it in action

<table>
<tr>
<td width="50%">

**Walking around and giving a tip**
<br>Click it any time to ask for a tip on the spot.

![Solzinho walking and showing a tip when clicked](docs/demo-andar-e-dica.gif)

</td>
<td width="50%">

**Drag and release while moving (real physics)**
<br>It keeps moving, bounces off the wall and eases to a smooth stop.

![Solzinho being flung and bouncing off the wall](docs/demo-arremesso.gif)

</td>
</tr>
<tr>
<td width="50%">

**Breathing exercise**
<br>The moon takes over and guides the breathing cycle.

![Sun turning into the moon during the breathing exercise](docs/demo-respiracao.gif)

</td>
<td width="50%">

**Menu and language switch**
<br>Right-click opens the menu; the flags switch PT/EN instantly.

![Right-click menu and switching language between Portuguese and English](docs/demo-menu-idioma.gif)

</td>
</tr>
</table>

## What it does

- **Walks around the screen**: always stays on top of other windows,
  stops every now and then to "breathe" (idle rest animation), and can be
  dragged anywhere with the mouse.
- **Calming tips**: show up in a speech bubble, on a configurable rhythm
  (default: every ~30 min, with random variation).
- **Physical break reminders**: water, stretch, stand up — on its own
  rhythm, independent from the calming tips (default: every ~20 min).
- **Guided breathing exercise**: a 3s countdown, then a box-breathing
  cycle (inhale 4s / hold 4s / exhale 4s / hold 4s × 4), with the sun
  itself "breathing" in sync.
- **Click the sun**: asks for a tip right away (or ends the breathing
  exercise, if one is running).
- **Right-click**: menu with pause tips, adjust frequency (with a custom
  option), stop/resume walking, ask for a tip now, start the breathing
  exercise, put on sunglasses, and switch language (🇧🇷/🇺🇸).
- **Portuguese and English**: the whole interface and the tips have both
  versions.
- **Starts with Windows**: once installed (see below), it launches on its
  own at login.

## How to run it

### Development mode

```bash
npm install
npm start
```

Or double-click [`iniciar_solzinho.bat`](iniciar_solzinho.bat) to open it
without needing a terminal.

### Installer (recommended for everyday use)

```bash
npm run build
```

Generates an installer at `dist/Solzinho Setup <version>.exe`. Running
that installer, Solzinho is installed under your user account (no admin
needed), gets a shortcut in the start menu/desktop, and starts on its own
every time you turn on the computer. To turn that off, there's a
"🚀 Don't start with Windows" option right in solzinho's (right-click)
menu.

### Auto-update

The installed version checks for an update on its own when it opens
(silently — it only shows something if it finds a new version ready to
install) and has an "⬆️ Check for updates" item in the (right-click) menu
to check on the spot. When an update is downloaded, a prompt shows up with
"Update now" (restarts and installs right away) or "Later" (installs on
its own the next time solzinho closes normally).

This only works for whoever installed it through the generated `.exe` —
there's nothing to check in `npm start`. To publish a version that
installed users will receive:

```bash
# 1. bump the version in package.json (e.g. 1.0.0 -> 1.0.1)
# 2. generate a GitHub token with "repo" permission at
#    https://github.com/settings/tokens and export it:
export GH_TOKEN=your_token_here

npm run release
```

This builds the installer and publishes it as a Release on
[github.com/wallasace/solzinho/releases](https://github.com/wallasace/solzinho/releases)
— that's where the installed version looks (at the metadata
`electron-builder` generates alongside it, `latest.yml` etc.) to know if
there's something new.

## Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the project is organized
internally (Electron processes, IPC channels, the language system).

See [CHANGELOG.md](CHANGELOG.md) for the history of what's been built.

## License

Solzinho is source-available software, not open source in the OSI sense.
Personal, educational and internal use (yours or your company's) is free.
Selling, redistributing or embedding it in a product/service offered to
third parties requires a separate commercial license.

See [LICENSE](LICENSE) for the full terms and [COMMERCIAL.md](COMMERCIAL.md)
to know when a commercial license is needed and how to request one.

Third-party credits in [NOTICE](NOTICE).
