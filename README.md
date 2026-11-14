# Kadhali

A real, working voice AI assistant you run yourself. It uses your **NVIDIA NIM** key,
speaks 40+ languages, writes code, and ships as a real Android APK that can also
control **your own computer** over your Wi-Fi.

Not a demo. Not a modified ChatGPT APK. Your key, your machine, your data.

## What it does

- **Live voice** — speak, it transcribes, answers and speaks back in a female voice
- **40+ languages** — Tamil, Hindi, English, Arabic, Chinese, Japanese, and more
- **Coding help** — complete runnable code with copy + Run buttons
- **Streaming answers** (SSE) with smart model routing
- **Phone → PC control** (optional, opt-in): screenshot, volume/media, lock,
  type/keys, windows, files, approved commands, notifications, power actions
- **Real APK** — `build-apk.sh` produces a signed `kadhali.apk` with the UI bundled
  inside; no Play Store, no Gradle
- **Local first** — the NVIDIA key stays on your computer; the phone only knows
  your LAN server and a pairing token

## Quick start

```bash
./run.sh                 # http://127.0.0.1:8765
```

Open the URL, click ⚙ and paste your NVIDIA API key (https://build.nvidia.com),
or drop it in `key.txt` / `NVIDIA_API_KEY`. The dot next to the title turns green.

Phone on the same Wi-Fi:

```bash
./run.sh --lan           # http://<your-ip>:8765
```

## Phone app

Download `kadhali.apk` from the latest release and install it. On first launch,
enter the server URL printed by `run.sh` (same Wi-Fi). The UI is bundled in the
APK, so it opens instantly; the server does the AI work.

Controls available inside the app: voice in/out, torch, vibrate, clipboard, share,
Android settings shortcuts, and the PC panel.

## PC control (opt-in)

```bash
./run.sh --lan --control
```

- First run creates a pairing token in `~/.kadhali/token`
- Open 🖥 in the app, paste the token once
- Every action is written to `~/.kadhali/audit.log`
- File access is limited to your home folder, commands come from a fixed allowlist,
  power actions require typing `YES`
- Only your own computer can be controlled; there is no remote-device takeover

Nothing happens unless you start the server with `--control`. Without it, all
`/api/pc/*` endpoints return `403 control_disabled`.

## Slash commands

```
/pc            PC info            /shot     screenshot
/vol up|down|mute                 /lock     lock PC
/windows       list windows      /files ~  browse home
/type hello    type on PC         /key enter
/run date      approved command   /notify hi
/help
```

## Build the APK

Needs JDK 17 and Android SDK build-tools 34 (`aapt2`, `d8`, `zipalign`, `apksigner`).

```bash
./build-apk.sh           # -> ./kadhali.apk (signed, UI bundled)
```

See `docs/APK.md` for details and the manual pipeline.

## Requirements

- Python 3.9+ (standard library only)
- Linux desktop for PC control features (`xdotool`, `wmctrl`, `pactl`, `gnome-screenshot`)
- An NVIDIA NIM API key

## Privacy

- The key is read on the server only, never sent to the phone or browser
- Chat history stays in the browser/phone local storage
- PC control is token-gated, same-LAN only, opt-in, and audited

## License

MIT — see `LICENSE`.
