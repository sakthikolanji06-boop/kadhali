#!/usr/bin/env python3
"""Kadhali — local NVIDIA-powered voice assistant + PC control (stdlib only).

Security model:
  * /api/chat, /api/models use your NVIDIA key (key.txt or X-NVIDIA-Key header).
  * /api/pc/* is DISABLED unless the server is started with --control.
  * Every /api/pc/* call needs the pairing token printed at startup
    (stored in ~/.kadhali/token, chmod 600).
  * Only this computer is controlled; every action is written to
    ~/.kadhali/audit.log.
"""
import argparse, base64, json, os, platform, re, secrets, shutil, socket, subprocess
import sys, time, urllib.request, urllib.error
from collections import deque
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
KEY_FILE = ROOT / "key.txt"
STATE_DIR = Path.home() / ".kadhali"
TOKEN_FILE = STATE_DIR / "token"
AUDIT_FILE = STATE_DIR / "audit.log"
DEFAULT_BASE = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
UA = "KadhaliVoice/1.0"
VERSION = "2.0.0"

WORKING_MODELS = [
    "nvidia/nemotron-3.5-bolt-e4b",
    "poolside/laguna-xs-2.1",
    "nvidia/riva-translate-4b-instruct-v2",
    "meta/llama-guard-4-12b",
    "nvidia/ising-calibration-1.5-31b",
]

OPEN_TARGETS = {
    "files": str(Path.home()),
    "home": str(Path.home()),
    "downloads": str(Path.home() / "Downloads"),
    "documents": str(Path.home() / "Documents"),
    "pictures": str(Path.home() / "Pictures"),
    "desktop": str(Path.home() / "Desktop"),
    "browser": "https://www.google.com",
    "github": "https://github.com",
    "youtube": "https://www.youtube.com",
}

KEYS = {
    "enter": "Return", "return": "Return", "tab": "Tab", "esc": "Escape", "escape": "Escape",
    "space": "space", "backspace": "BackSpace", "delete": "Delete", "home": "Home", "end": "End",
    "up": "Up", "down": "Down", "left": "Left", "right": "Right",
    "pageup": "Page_Up", "pagedown": "Page_Down",
    "copy": "ctrl+c", "paste": "ctrl+v", "cut": "ctrl+x", "undo": "ctrl+z", "redo": "ctrl+shift+z",
    "save": "ctrl+s", "selectall": "ctrl+a", "find": "ctrl+f", "newtab": "ctrl+t", "closetab": "ctrl+w",
    "alt-tab": "alt+tab", "super": "super", "play": "XF86AudioPlay", "next": "XF86AudioNext",
    "prev": "XF86AudioPrev", "mute": "XF86AudioMute", "volup": "XF86AudioRaiseVolume",
    "voldown": "XF86AudioLowerVolume", "f5": "F5", "f11": "F11",
}

RUN_COMMANDS = {
    "date": ["date"],
    "uptime": ["uptime"],
    "disk": ["df", "-h"],
    "memory": ["free", "-h"],
    "uname": ["uname", "-a"],
    "whoami": ["whoami"],
    "ip": ["hostname", "-I"],
    "os": ["lsb_release", "-a"],
    "python": ["python3", "--version"],
    "node": ["node", "-v"],
    "top": ["sh", "-c", "ps aux --sort=-%cpu | head -8"],
    "sessions": ["who"],
    "network": ["sh", "-c", "ip -brief addr"],
}
READ_EXT = {".txt", ".md", ".log", ".json", ".py", ".js", ".html", ".css", ".sh",
            ".conf", ".ini", ".yml", ".yaml", ".csv", ".toml", ".env"}


def read_key(header_key=None):
    if header_key and header_key.strip():
        return header_key.strip()
    if os.environ.get("NVIDIA_API_KEY"):
        return os.environ["NVIDIA_API_KEY"].strip()
    if KEY_FILE.exists():
        return KEY_FILE.read_text().strip()
    return ""


def token():
    try:
        return TOKEN_FILE.read_text().strip()
    except OSError:
        return ""


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def audit(action, detail, ok, remote):
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        line = json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "action": action,
                           "detail": detail, "ok": ok, "from": remote})
        with AUDIT_FILE.open("a") as f:
            f.write(line + "\n")
    except OSError:
        pass


class Handler(SimpleHTTPRequestHandler):
    server_version = "KadhaliVoice"
    control_enabled = False
    calls = deque()

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(WEB), **k)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-NVIDIA-Key, X-Control-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        p = self.path.split("?")[0]
        if p.endswith((".html", ".js", ".css", ".webmanifest", "/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return None

    def _is_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1")

    def do_GET(self):
        if self.path == "/api/health":
            return self._json(200, {"ok": True, "has_key": bool(read_key()),
                                    "control": self.control_enabled, "version": VERSION})
        if self.path == "/api/config":
            return self._json(200, {"base_url": DEFAULT_BASE, "has_key": bool(read_key()),
                                    "control": self.control_enabled, "version": VERSION,
                                    "models": WORKING_MODELS, "run_commands": RUN_COMMANDS,
                                    "token": token() if (self.control_enabled and self._is_local()) else ""})
        if self.path == "/api/models":
            return self._models()
        if self.path.startswith("/api/pc/"):
            return self._pc_get(self.path[len("/api/pc/"):])
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/savekey":
            return self._save_key()
        if self.path == "/api/chat":
            return self._chat()
        if self.path == "/api/pc/action":
            return self._pc_action()
        return self._json(404, {"error": "not_found"})

    # ---------- NVIDIA ----------
    def _models(self):
        key = read_key(self.headers.get("X-NVIDIA-Key"))
        if not key:
            return self._json(401, {"error": "missing_api_key", "models": WORKING_MODELS})
        req = urllib.request.Request(DEFAULT_BASE.rstrip("/") + "/models",
                                     headers={"Authorization": "Bearer " + key, "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            return self._json(e.code, {"error": e.read().decode()[:500]})
        except Exception as e:
            return self._json(502, {"error": str(e)})
        ids = sorted({m.get("id") for m in data.get("data", []) if m.get("id")})
        working = [m for m in WORKING_MODELS if m in ids] or WORKING_MODELS
        return self._json(200, {"models": ids, "working": working, "count": len(ids)})

    def _save_key(self):
        payload = self._body()
        if payload is None:
            return self._json(400, {"error": "bad_json"})
        if payload.get("delete"):
            if KEY_FILE.exists():
                KEY_FILE.unlink()
            return self._json(200, {"saved": False, "has_key": bool(read_key())})
        key = (payload.get("key") or "").strip()
        if not key:
            return self._json(400, {"error": "empty_key"})
        KEY_FILE.write_text(key)
        try:
            os.chmod(KEY_FILE, 0o600)
        except OSError:
            pass
        return self._json(200, {"saved": True, "has_key": True})

    def _chat(self):
        payload = self._body()
        if payload is None:
            return self._json(400, {"error": "bad_json"})

        key = read_key(self.headers.get("X-NVIDIA-Key"))
        if not key:
            return self._json(401, {"error": "missing_api_key"})

        model = payload.get("model") or "nvidia/nemotron-3.5-bolt-e4b"
        messages = payload.get("messages") or []
        if not isinstance(messages, list) or not messages:
            return self._json(400, {"error": "no_messages"})

        body = {
            "model": model,
            "messages": messages,
            "temperature": float(payload.get("temperature", 0.7)),
            "top_p": float(payload.get("top_p", 0.95)),
            "max_tokens": int(payload.get("max_tokens", 2048)),
            "stream": bool(payload.get("stream", True)),
        }
        req = urllib.request.Request(
            DEFAULT_BASE.rstrip("/") + "/chat/completions",
            data=json.dumps(body).encode(),
            headers={
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
                "Accept": "text/event-stream" if body["stream"] else "application/json",
                "User-Agent": UA,
            },
            method="POST",
        )
        try:
            resp = urllib.request.urlopen(req, timeout=300)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:800]
            return self._json(e.code, {"error": detail})
        except Exception as e:
            return self._json(502, {"error": str(e)})

        self.send_response(200)
        ctype = "text/event-stream" if body["stream"] else "application/json"
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            while True:
                chunk = resp.read(1024)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            try:
                resp.close()
            except Exception:
                pass

    # ---------- PC control ----------
    def _check_control(self):
        if not self.control_enabled:
            self._json(403, {"error": "control_disabled", "hint": "start server with --control"})
            return False
        got = (self.headers.get("X-Control-Token") or "").strip()
        want = token()
        if not want or not secrets.compare_digest(got, want):
            self._json(401, {"error": "bad_token"})
            return False
        now = time.time()
        while self.calls and now - self.calls[0] > 60:
            self.calls.popleft()
        if len(self.calls) > 60:
            self._json(429, {"error": "too_many_requests"})
            return False
        self.calls.append(now)
        return True

    def _pc_get(self, what):
        if not self._check_control():
            return
        if what == "info":
            return self._json(200, self._info())
        if what == "audit":
            return self._json(200, {"log": self._audit_tail()})
        self._json(404, {"error": "not_found"})

    def _info(self):
        info = {
            "host": socket.gethostname(), "os": platform.platform(),
            "user": os.environ.get("USER", ""), "python": platform.python_version(),
            "ip": lan_ip(), "home": str(Path.home()),
        }
        try:
            up = float(Path("/proc/uptime").read_text().split()[0])
            info["uptime_h"] = round(up / 3600, 1)
            load = os.getloadavg()
            info["load"] = [round(x, 2) for x in load]
        except Exception:
            pass
        try:
            mem = Path("/proc/meminfo").read_text()
            tot = int(re.search(r"MemTotal:\s+(\d+)", mem).group(1)) // 1024
            av = int(re.search(r"MemAvailable:\s+(\d+)", mem).group(1)) // 1024
            info["mem_total_mb"] = tot
            info["mem_used_mb"] = tot - av
        except Exception:
            pass
        try:
            d = shutil.disk_usage(str(Path.home()))
            info["disk_free_gb"] = round(d.free / 1e9, 1)
            info["disk_total_gb"] = round(d.total / 1e9, 1)
        except Exception:
            pass
        try:
            out = subprocess.run(["pactl", "get-sink-volume", "@DEFAULT_SINK@"],
                                 capture_output=True, text=True, timeout=3).stdout
            m = re.search(r"(\d+)%", out)
            info["volume"] = int(m.group(1)) if m else None
            m2 = subprocess.run(["pactl", "get-sink-mute", "@DEFAULT_SINK@"],
                                capture_output=True, text=True, timeout=3).stdout
            info["muted"] = "yes" in m2
        except Exception:
            pass
        try:
            info["window"] = subprocess.run(["xdotool", "getactivewindow", "getwindowname"],
                                            capture_output=True, text=True, timeout=3).stdout.strip()
        except Exception:
            pass
        return info

    def _audit_tail(self, n=40):
        try:
            lines = AUDIT_FILE.read_text().splitlines()[-n:]
            return [json.loads(x) for x in lines if x.strip()]
        except Exception:
            return []

    def _pc_action(self):
        if not self._check_control():
            return
        payload = self._body()
        if payload is None:
            return self._json(400, {"error": "bad_json"})
        act = str(payload.get("action") or "")
        args = payload.get("args") or {}
        started = time.time()
        try:
            result = self._do(act, args, payload)
        except Exception as e:
            audit(act, str(args)[:160], False, self.address_string())
            return self._json(500, {"error": str(e)})
        if result is None:
            audit(act, str(args)[:160], False, self.address_string())
            return self._json(400, {"error": "unknown_action", "action": act})
        ok = result.get("ok", True)
        audit(act, str(args)[:160], ok, self.address_string())
        result["ms"] = int((time.time() - started) * 1000)
        self._json(200 if ok else 500, result)

    def _do(self, act, args, payload):
        if act == "info":
            return {"ok": True, **self._info()}
        if act == "screenshot":
            return self._screenshot()
        if act == "volume":
            return self._volume(args)
        if act == "media":
            key = {"play": "XF86AudioPlay", "next": "XF86AudioNext",
                   "prev": "XF86AudioPrev", "stop": "XF86AudioStop"}.get(args.get("cmd"))
            return self._xkey(key) if key else {"ok": False, "error": "bad_media"}
        if act == "open":
            return self._open(args)
        if act == "type":
            text = str(args.get("text") or "")[:600]
            if not text:
                return {"ok": False, "error": "empty"}
            return self._run(["xdotool", "type", "--delay", "25", "--", text])
        if act == "key":
            return self._xkey(KEYS.get(str(args.get("key") or "").lower()))
        if act == "click":
            btn = 1 if args.get("button", "left") == "left" else 3
            return self._run(["xdotool", "click", str(btn)])
        if act == "move":
            dx = max(-2000, min(2000, int(args.get("dx", 0))))
            dy = max(-2000, min(2000, int(args.get("dy", 0))))
            return self._run(["xdotool", "mousemove_relative", "--", str(dx), str(dy)])
        if act == "scroll":
            way = args.get("dir", "down")
            n = max(1, min(20, int(args.get("n", 3))))
            key = "4" if way == "up" else "5"
            for _ in range(n):
                subprocess.run(["xdotool", "click", key], timeout=3)
            return {"ok": True}
        if act == "windows":
            return self._windows()
        if act == "focus":
            name = str(args.get("name") or "").strip()[:80]
            if not name:
                return {"ok": False, "error": "empty"}
            r = subprocess.run(["xdotool", "search", "--name", "--", name],
                               capture_output=True, text=True, timeout=5)
            wid = (r.stdout.split() or [""])[-1]
            if not wid:
                return {"ok": False, "error": "window_not_found"}
            return self._run(["xdotool", "windowactivate", wid])
        if act == "lock":
            return self._run(["loginctl", "lock-session"])
        if act == "notify":
            text = str(args.get("text") or "Hello from Kadhali")[:200]
            return self._run(["notify-send", "-a", "Kadhali", "Kadhali", text])
        if act == "run":
            cmd = RUN_COMMANDS.get(str(args.get("cmd") or ""))
            if not cmd:
                return {"ok": False, "error": "not_allowed", "allowed": sorted(RUN_COMMANDS)}
            return self._run(cmd)
        if act == "files":
            return self._files(args)
        if act == "read":
            return self._read(args)
        if act in ("suspend", "poweroff", "reboot"):
            if str(payload.get("confirm") or "") != "yes":
                return {"ok": False, "error": "confirm_required"}
            cmd = {"suspend": ["systemctl", "suspend"],
                   "poweroff": ["systemctl", "poweroff"],
                   "reboot": ["systemctl", "reboot"]}[act]
            return self._run(cmd, timeout=8)
        return None

    def _run(self, cmd, timeout=15):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return {"ok": r.returncode == 0, "out": (r.stdout or "")[:4000],
                    "err": (r.stderr or "")[:1500], "code": r.returncode}
        except FileNotFoundError:
            return {"ok": False, "error": "tool_missing", "tool": cmd[0]}
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "timeout"}

    def _xkey(self, key):
        if not key:
            return {"ok": False, "error": "bad_key"}
        return self._run(["xdotool", "key", "--clearmodifiers", key])

    def _volume(self, args):
        cmd = args.get("cmd", "up")
        if cmd == "up":
            return self._run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "+5%"])
        if cmd == "down":
            return self._run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "-5%"])
        if cmd == "mute":
            return self._run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle"])
        if cmd == "set":
            v = max(0, min(150, int(args.get("value", 50))))
            return self._run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{v}%"])
        return {"ok": False, "error": "bad_volume"}

    def _open(self, args):
        target = OPEN_TARGETS.get(str(args.get("target") or ""))
        if not target:
            return {"ok": False, "error": "not_allowed", "allowed": sorted(OPEN_TARGETS)}
        try:
            subprocess.Popen(["xdg-open", target], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
            return {"ok": True, "opened": target}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _windows(self):
        try:
            r = subprocess.run(["wmctrl", "-l"], capture_output=True, text=True, timeout=5)
            rows = []
            for line in (r.stdout or "").splitlines():
                parts = line.split(None, 3)
                if len(parts) == 4:
                    rows.append({"id": parts[0], "desktop": parts[1], "host": parts[2],
                                 "title": parts[3]})
            return {"ok": True, "windows": rows[:60]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _files(self, args):
        rel = str(args.get("path") or "~")
        base = Path.home()
        p = Path(rel).expanduser()
        try:
            p = p.resolve()
            p.relative_to(base)
        except Exception:
            return {"ok": False, "error": "outside_home"}
        if not p.is_dir():
            return {"ok": False, "error": "not_a_directory"}
        rows = []
        try:
            for e in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))[:200]:
                try:
                    st = e.stat()
                    rows.append({"name": e.name, "dir": e.is_dir(),
                                 "size": st.st_size, "mtime": int(st.st_mtime)})
                except OSError:
                    rows.append({"name": e.name, "dir": e.is_dir(), "size": 0, "mtime": 0})
        except PermissionError:
            return {"ok": False, "error": "permission_denied"}
        return {"ok": True, "path": str(p), "entries": rows}

    def _read(self, args):
        p = Path(str(args.get("path") or "")).expanduser()
        try:
            p = p.resolve()
            p.relative_to(Path.home())
        except Exception:
            return {"ok": False, "error": "outside_home"}
        if p.suffix.lower() not in READ_EXT:
            return {"ok": False, "error": "not_text", "allowed": sorted(READ_EXT)}
        if not p.is_file():
            return {"ok": False, "error": "not_a_file"}
        if p.stat().st_size > 200_000:
            return {"ok": False, "error": "too_large"}
        try:
            return {"ok": True, "path": str(p), "text": p.read_text(errors="replace")[:120000]}
        except OSError as e:
            return {"ok": False, "error": str(e)}

    def _screenshot(self):
        tmp = Path("/tmp") / f"kadhali-shot-{os.getpid()}.png"
        attempts = [["gnome-screenshot", "-f", str(tmp)], ["scrot", "-o", str(tmp)]]
        err = ""
        for cmd in attempts:
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if r.returncode == 0 and tmp.exists():
                    data = tmp.read_bytes()
                    tmp.unlink(missing_ok=True)
                    return {"ok": True, "image": "data:image/png;base64," +
                            base64.b64encode(data).decode(), "bytes": len(data)}
                err = (r.stderr or "").strip()
            except FileNotFoundError:
                continue
            except subprocess.TimeoutExpired:
                err = "timeout"
        return {"ok": False, "error": "screenshot_failed", "detail": err[:300]}


def main():
    ap = argparse.ArgumentParser(description="Kadhali server")
    ap.add_argument("--host", default=None, help="bind address (default 127.0.0.1, --lan = 0.0.0.0)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--lan", action="store_true", help="allow your phone on the same Wi-Fi")
    ap.add_argument("--control", action="store_true", help="enable /api/pc/* control of THIS computer")
    ap.add_argument("--new-token", action="store_true", help="rotate the control pairing token")
    args = ap.parse_args()

    Handler.control_enabled = bool(args.control)
    if args.control:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        if args.new_token or not token():
            TOKEN_FILE.write_text(secrets.token_hex(12))
            try:
                os.chmod(TOKEN_FILE, 0o600)
            except OSError:
                pass

    host = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    srv = ThreadingHTTPServer((host, args.port), Handler)
    shown = lan_ip() if host == "0.0.0.0" else host
    print(f"Kadhali {VERSION} running: http://{shown}:{args.port}")
    print(f"  key: {'set' if read_key() else 'NOT set'}   models: {len(WORKING_MODELS)} curated")
    if Handler.control_enabled:
        print(f"  PC control: ON   token: {token()}")
        print(f"  audit log: {AUDIT_FILE}")
    else:
        print("  PC control: off (add --control to enable)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
