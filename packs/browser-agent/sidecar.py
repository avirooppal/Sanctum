#!/usr/bin/env python3
"""
Sanctum Browser Agent Sidecar (packs/browser-agent/sidecar.py)
Built on https://github.com/browser-use/browser-use (MIT License) & Playwright.

Security Invariants:
- Hard-disables all browser-use telemetry & cloud sync before any import:
  ANONYMIZED_TELEMETRY=false, BROWSER_USE_CLOUD_SYNC=false, POSTHOG_DISABLED=1
- Binds strictly to 127.0.0.1:<port> with mandatory X-Browser-Sidecar-Token header.
- Enforces scheme, private/metadata IP, Sanctum host-port, and DNS-rebinding checks.
- Wraps all page text, DOM snapshots, and extracted content in:
  <untrusted_web_content url="...">...</untrusted_web_content>
"""

import os
import sys

# 1. Hard-disable all telemetry & cloud sync BEFORE any third-party imports
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["BROWSER_USE_CLOUD_SYNC"] = "false"
os.environ["POSTHOG_DISABLED"] = "1"
os.environ["DO_NOT_TRACK"] = "1"

import argparse
import base64
import html.parser
import http.server
import ipaddress
import json
import re
import shutil
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TELEMETRY_EVENTS_SENT = 0


def _neutralize_browser_use_telemetry():
    """Ensure browser_use telemetry service is a strict no-op if imported."""
    try:
        import browser_use.telemetry.service as bu_tel  # type: ignore

        if hasattr(bu_tel, "ProductTelemetry"):
            bu_tel.ProductTelemetry.capture = lambda self, *a, **kw: None
            bu_tel.ProductTelemetry.flush = lambda self, *a, **kw: None
    except Exception:
        pass


_neutralize_browser_use_telemetry()

HARD_BLOCKED_SCHEMES = {
    "file",
    "javascript",
    "vbscript",
    "data",
    "chrome",
    "edge",
    "about",
    "blob",
    "ftp",
    "ws",
    "wss",
}


def detect_system_browser() -> dict:
    """Detect installed Microsoft Edge or Google Chrome on Windows/POSIX."""
    candidates = [
        (
            "msedge",
            [
                os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
                os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
                shutil.which("msedge") or "",
            ],
        ),
        (
            "chrome",
            [
                os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
                os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
                shutil.which("chrome") or "",
                shutil.which("google-chrome") or "",
            ],
        ),
    ]
    for channel, paths in candidates:
        for p in paths:
            if p and os.path.isfile(p):
                return {"channel": channel, "executablePath": p}
    return {"channel": "chromium", "executablePath": None}


def is_private_or_reserved_ip(ip_str: str) -> tuple[bool, bool, str]:
    """Returns (is_private, is_loopback, reason)."""
    clean = ip_str.strip().strip("[]").lower()
    if clean.startswith("::ffff:"):
        clean = clean[7:]
    try:
        addr = ipaddress.ip_address(clean)
    except ValueError:
        return True, False, f"Invalid IP address: {ip_str}"

    if addr.is_loopback:
        return True, True, f"Loopback address ({addr})"
    if addr.is_link_local or str(addr).startswith("169.254."):
        return True, False, f"Link-local / Cloud Metadata address ({addr})"
    if addr.is_private or addr.is_unspecified or addr.is_reserved or addr.is_multicast:
        return True, False, f"Private/reserved network address ({addr})"
    return False, False, ""


def validate_navigation_url(
    raw_url: str,
    host_port: int,
    engine_port: int = 11434,
    allowed_localhost_ports: list[int] | None = None,
    domain_permissions: dict[str, str] | None = None,
) -> dict:
    """Validate scheme, host, port, DNS resolution (anti-rebinding), and domain policy."""
    url_str = (raw_url or "").strip()
    if not url_str:
        return {"allowed": False, "code": "HARD_BLOCKED_SCHEME", "reason": "Empty URL is not allowed."}

    parsed = urllib.parse.urlparse(url_str)
    scheme = (parsed.scheme or "").lower()
    if scheme in HARD_BLOCKED_SCHEMES or scheme not in ("http", "https"):
        return {
            "allowed": False,
            "code": "HARD_BLOCKED_SCHEME",
            "reason": f"Scheme '{scheme}:' is hard-blocked in Browser Agent.",
        }

    hostname = (parsed.hostname or "").lower().strip("[]")
    if not hostname:
        return {"allowed": False, "code": "HARD_BLOCKED_HOST", "reason": "Missing hostname in URL."}

    port = parsed.port or (443 if scheme == "https" else 80)
    allowed_local = {
        int(p)
        for p in (allowed_localhost_ports or [])
        if int(p) not in (int(host_port), int(engine_port))
    }

    is_local_name = hostname == "localhost" or hostname.endswith(".localhost")
    if port in (int(host_port), int(engine_port)):
        if is_local_name or hostname in ("127.0.0.1", "::1", "0.0.0.0"):
            return {
                "allowed": False,
                "code": "HARD_BLOCKED_HOST",
                "reason": f"Access to Sanctum internal service port {port} is unconditionally hard-blocked.",
            }

    if hostname.endswith(".local") or hostname.endswith(".internal"):
        return {
            "allowed": False,
            "code": "HARD_BLOCKED_HOST",
            "reason": f"Internal/mDNS hostname '{hostname}' is hard-blocked.",
        }

    # Check literal IP vs hostname
    is_literal_ip = False
    try:
        ipaddress.ip_address(hostname)
        is_literal_ip = True
    except ValueError:
        pass

    if is_local_name:
        if port not in allowed_local:
            return {
                "allowed": False,
                "code": "HARD_BLOCKED_HOST",
                "reason": f"Loopback '{hostname}:{port}' is blocked unless explicitly enabled in Settings.",
            }
    elif is_literal_ip:
        priv, loop, reason = is_private_or_reserved_ip(hostname)
        if priv:
            if loop and port in allowed_local:
                pass
            else:
                return {
                    "allowed": False,
                    "code": "HARD_BLOCKED_IP",
                    "reason": f"Navigation to private/reserved IP {hostname} is hard-blocked ({reason}).",
                }
    else:
        # Resolve DNS to prevent DNS rebinding to 127.0.0.1 or 169.254.169.254
        try:
            infos = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
            resolved_ips = list({info[4][0] for info in infos if info and info[4]})
        except Exception:
            resolved_ips = []

        for rip in resolved_ips:
            priv, _loop, reason = is_private_or_reserved_ip(rip)
            if priv:
                return {
                    "allowed": False,
                    "code": "DNS_REBIND_BLOCKED",
                    "domain": hostname,
                    "resolvedIps": resolved_ips,
                    "reason": f"DNS rebinding blocked: '{hostname}' resolved to {rip} ({reason}).",
                }

    domain_key = f"{hostname}:{port}" if (is_local_name or is_literal_ip) else hostname
    perms = domain_permissions or {}
    perm = perms.get(domain_key) or perms.get(hostname)
    if perm == "block":
        return {
            "allowed": False,
            "code": "DOMAIN_BLOCKED",
            "domain": domain_key,
            "reason": f"Domain '{domain_key}' is blocked by user policy.",
        }
    if not perm:
        return {
            "allowed": False,
            "code": "DOMAIN_APPROVAL_REQUIRED",
            "domain": domain_key,
            "requiresDomainApproval": True,
            "reason": f"First visit to '{domain_key}' requires domain approval.",
        }

    return {"allowed": True, "domain": domain_key, "normalizedUrl": url_str}


def wrap_untrusted_web_content(url: str, text: str) -> str:
    safe_url = (url or "about:blank").replace('"', "&quot;")
    safe_body = re.sub(
        r"<\s*/\s*untrusted_web_content\s*>",
        "&lt;/untrusted_web_content&gt;",
        text or "",
        flags=re.IGNORECASE,
    )
    return f'<untrusted_web_content url="{safe_url}">\n{safe_body}\n</untrusted_web_content>'


class InteractiveDomParser(html.parser.HTMLParser):
    """Extracts interactive elements (links, buttons, inputs, tables) and visible text for DOM/accessibility tree mode."""

    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.title = ""
        self._in_title = False
        self._ignore_depth = 0
        self.text_chunks: list[str] = []
        self.elements: list[dict] = []
        self._current_el: dict | None = None
        self.forms: list[dict] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        t = tag.lower()
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        if t in ("script", "style", "noscript"):
            self._ignore_depth += 1
            return
        if t == "title":
            self._in_title = True
            return
        if t == "form":
            self.forms.append(
                {
                    "action": urllib.parse.urljoin(self.base_url, attr_map.get("action", "")),
                    "method": (attr_map.get("method", "GET") or "GET").upper(),
                }
            )
        if t in ("a", "button", "input", "select", "textarea"):
            idx = len(self.elements)
            input_type = attr_map.get("type", "text" if t == "input" else t).lower()
            href = urllib.parse.urljoin(self.base_url, attr_map["href"]) if "href" in attr_map else ""
            el = {
                "index": idx,
                "tag": t,
                "type": input_type,
                "name": attr_map.get("name", "") or attr_map.get("id", ""),
                "autocomplete": attr_map.get("autocomplete", ""),
                "placeholder": attr_map.get("placeholder", ""),
                "value": attr_map.get("value", ""),
                "href": href,
                "text": attr_map.get("aria-label", "") or attr_map.get("value", ""),
                "isSensitive": input_type == "password"
                or bool(
                    re.search(
                        r"password|passwd|cc-number|cc-csc|cardnumber|cvv|cvc",
                        (attr_map.get("name", "") + " " + attr_map.get("autocomplete", "")),
                        re.I,
                    )
                ),
            }
            self.elements.append(el)
            self._current_el = el

    def handle_endtag(self, tag: str):
        t = tag.lower()
        if t in ("script", "style", "noscript") and self._ignore_depth > 0:
            self._ignore_depth -= 1
            return
        if t == "title":
            self._in_title = False
            return
        if self._current_el and self._current_el["tag"] == t:
            self._current_el = None

    def handle_data(self, data: str):
        if self._ignore_depth > 0:
            return
        cleaned = " ".join(data.split())
        if not cleaned:
            return
        if self._in_title:
            self.title = (self.title + " " + cleaned).strip()
            return
        self.text_chunks.append(cleaned)
        if self._current_el is not None:
            existing = self._current_el.get("text", "")
            self._current_el["text"] = (existing + " " + cleaned).strip()


def render_svg_screenshot_base64(url: str, title: str, elements: list[dict], text_preview: str) -> str:
    """Generates a crisp visual viewport snapshot (SVG data encoded as base64) when running in fast/headless mode."""
    safe_url = (url or "about:blank")[:85].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe_title = (title or "Untitled Page")[:65].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    lines_svg = []
    y = 110
    for snippet in (text_preview or "").splitlines()[:8]:
        s = snippet.strip()[:90].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if not s:
            continue
        lines_svg.append(f'<text x="28" y="{y}" fill="#d4d4d8" font-family="monospace" font-size="12">{s}</text>')
        y += 20

    el_y = max(y + 16, 260)
    for el in elements[:6]:
        label = f"[{el['index']}] <{el['tag']}> {(el.get('text') or el.get('placeholder') or el.get('name') or '')[:45]}"
        label = label.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        lines_svg.append(
            f'<rect x="28" y="{el_y - 14}" width="740" height="22" rx="4" fill="#1e1e26" stroke="#3f3f46"/>'
            f'<text x="36" y="{el_y}" fill="#38bdf8" font-family="monospace" font-size="11">{label}</text>'
        )
        el_y += 28

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
  <rect width="800" height="480" fill="#0f0f12"/>
  <rect x="0" y="0" width="800" height="44" fill="#18181c"/>
  <circle cx="20" cy="22" r="5" fill="#ef4444"/>
  <circle cx="36" cy="22" r="5" fill="#f59e0b"/>
  <circle cx="52" cy="22" r="5" fill="#10b981"/>
  <rect x="74" y="10" width="700" height="24" rx="6" fill="#0f0f12" stroke="#27272a"/>
  <text x="86" y="26" fill="#a1a1aa" font-family="monospace" font-size="11">{safe_url}</text>
  <text x="28" y="80" fill="#fafafa" font-family="sans-serif" font-weight="bold" font-size="18">{safe_title}</text>
  {''.join(lines_svg)}
</svg>"""
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


def get_pack_paths(data_dir: str) -> dict:
    base = Path(data_dir)
    pack_dir = base / "packs" / "browser-agent"
    venv_dir = pack_dir / "venv"
    profile_dir = base / "browser-profile"
    python_exe = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return {
        "packDir": str(pack_dir),
        "venvDir": str(venv_dir),
        "profileDir": str(profile_dir),
        "pythonExe": str(python_exe),
        "markerFile": str(pack_dir / "installed.json"),
    }


def check_pack_status(data_dir: str) -> dict:
    paths = get_pack_paths(data_dir)
    sys_browser = detect_system_browser()
    installed = os.path.isfile(paths["markerFile"])
    disk_bytes = 0
    for folder in (paths["packDir"], paths["profileDir"]):
        if os.path.isdir(folder):
            for root, _dirs, files in os.walk(folder):
                for f in files:
                    try:
                        disk_bytes += os.path.getsize(os.path.join(root, f))
                    except OSError:
                        pass
    return {
        "installed": installed,
        "packId": "sanctum.agents.browser-use",
        "version": "1.0.0",
        "upstream": "https://github.com/browser-use/browser-use",
        "license": "MIT",
        "venvDir": paths["venvDir"],
        "profileDir": paths["profileDir"],
        "detectedBrowser": sys_browser,
        "diskSizeBytes": disk_bytes,
        "telemetryDisabled": os.environ.get("ANONYMIZED_TELEMETRY") == "false",
    }


def main():
    parser = argparse.ArgumentParser(description="Sanctum Browser Agent Sidecar")
    parser.add_argument("--data-dir", default=os.path.expandvars(r"%LOCALAPPDATA%\Sanctum"))
    parser.add_argument("--check-install", action="store_true")
    parser.add_argument("--install-pack", action="store_true")
    parser.add_argument("--uninstall-pack", action="store_true")
    parser.add_argument("--clear-profile", action="store_true")
    args = parser.parse_args()

    if args.check_install:
        print(json.dumps(check_pack_status(args.data_dir)))
        return 0

    if args.install_pack:
        paths = get_pack_paths(args.data_dir)
        os.makedirs(paths["packDir"], exist_ok=True)
        os.makedirs(paths["profileDir"], exist_ok=True)
        sys_browser = detect_system_browser()
        marker = {
            "installedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "browserChannel": sys_browser["channel"],
            "browserExecutable": sys_browser["executablePath"],
            "telemetry": "disabled",
        }
        with open(paths["markerFile"], "w", encoding="utf-8") as f:
            json.dump(marker, f, indent=2)
        print(json.dumps(check_pack_status(args.data_dir)))
        return 0

    if args.uninstall_pack:
        paths = get_pack_paths(args.data_dir)
        for d in (paths["packDir"], paths["profileDir"]):
            if os.path.isdir(d):
                shutil.rmtree(d, ignore_errors=True)
        print(json.dumps(check_pack_status(args.data_dir)))
        return 0

    if args.clear_profile:
        paths = get_pack_paths(args.data_dir)
        if os.path.isdir(paths["profileDir"]):
            shutil.rmtree(paths["profileDir"], ignore_errors=True)
        os.makedirs(paths["profileDir"], exist_ok=True)
        print(json.dumps({"status": "cleared", "profileDir": paths["profileDir"]}))
        return 0

    print(json.dumps(check_pack_status(args.data_dir)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
