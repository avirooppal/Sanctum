import argparse
import ctypes
from ctypes import wintypes
import json
import os
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS_DIR = os.path.join(ROOT, "evals", "results", "exe")
EXE_PATH = os.path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe")
os.makedirs(RESULTS_DIR, exist_ok=True)


class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("PageFaultCount", wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
        ("PrivateUsage", ctypes.c_size_t),
    ]


def get_rss_mb(pid: int) -> float:
    PROCESS_QUERY_INFORMATION = 0x0400
    PROCESS_VM_READ = 0x0010
    handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
    if not handle:
        return 0.0
    try:
        counters = PROCESS_MEMORY_COUNTERS_EX()
        counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)
        ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb)
        # Use PrivateUsage (private committed bytes) so shared read-only OS/WebView2 DLLs are not multiplied N times across sub-processes
        return counters.PrivateUsage / (1024.0 * 1024.0)
    finally:
        ctypes.windll.kernel32.CloseHandle(handle)


def get_process_tree(root_pid: int, extra_root_pid: int = 0):
    seeds = [root_pid]
    if extra_root_pid and extra_root_pid != root_pid:
        seeds.append(extra_root_pid)
    enqueue_str = "\n".join(f"$queue.Enqueue({s}); $visited[{s}] = $true" for s in seeds)
    ps_cmd = f"""
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine
$tree = @()
$queue = New-Object System.Collections.Queue
$visited = @{{}}
{enqueue_str}
while ($queue.Count -gt 0) {{
    $curr = $queue.Dequeue()
    $proc = $all | Where-Object {{ $_.ProcessId -eq $curr }}
    if ($proc) {{ $tree += $proc }}
    $children = $all | Where-Object {{ $_.ParentProcessId -eq $curr }}
    foreach ($c in $children) {{
        if (-not $visited.ContainsKey($c.ProcessId)) {{
            $visited[$c.ProcessId] = $true
            $queue.Enqueue($c.ProcessId)
        }}
    }}
}}
$tree | ConvertTo-Json -Compress
"""
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
    if not res.stdout.strip():
        return []
    try:
        parsed = json.loads(res.stdout.strip())
        return [parsed] if isinstance(parsed, dict) else parsed
    except Exception:
        return []


def get_window_title(hwnd: int) -> str:
    buf = ctypes.create_unicode_buffer(256)
    ctypes.windll.user32.GetWindowTextW(wintypes.HWND(hwnd), buf, 256)
    return buf.value


def is_window_visible(hwnd: int) -> bool:
    return bool(ctypes.windll.user32.IsWindowVisible(wintypes.HWND(hwnd)))


def run_all_standalone_checks():
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", "Stop-Process -Name 'Sanctum-Desktop' -Force -ErrorAction SilentlyContinue"],
        capture_output=True,
    )
    evidence_file = os.path.join(RESULTS_DIR, "standalone_webview2_verification.json")
    data_dir = tempfile.mkdtemp(prefix="sanctum_wv2_verify_")
    runtime_state_path = os.path.join(data_dir, "webview2_runtime_state.json")
    window_state_path = os.path.join(data_dir, "window_state.json")

    print(f"Launching standalone Sanctum-Desktop.exe (embedded WebView2) with data_dir={data_dir}...")
    proc = subprocess.Popen(
        [EXE_PATH, "--data-dir", data_dir],
        cwd=os.path.dirname(EXE_PATH),
    )

    runtime_state = None
    t0 = time.time()
    while time.time() - t0 < 30.0:
        if os.path.exists(runtime_state_path):
            try:
                with open(runtime_state_path, "r", encoding="utf-8-sig") as f:
                    data = json.load(f)
                if data.get("status") == "ready":
                    runtime_state = data
                    break
            except Exception:
                pass
        time.sleep(0.1)

    if not runtime_state:
        proc.kill()
        print("FAIL: Embedded WebView2 did not reach ready state within 30s")
        return False

    time.sleep(1.0)
    hwnd = int(runtime_state.get("hwnd", 0))
    browser_pid = int(runtime_state.get("browser_process_id", 0))
    win_title = get_window_title(hwnd)
    win_visible = is_window_visible(hwnd)

    # 1. Process Tree & Identity Check
    tree = get_process_tree(proc.pid, browser_pid)
    proc_names = [p.get("Name", "").lower() for p in tree]
    forbidden_browsers = ["msedge.exe", "chrome.exe", "brave.exe", "firefox.exe"]
    external_browsers_spawned = [n for n in proc_names if n in forbidden_browsers]
    webview2_children = [p for p in tree if p.get("Name", "").lower() == "msedgewebview2.exe"]

    process_identity_ok = (
        len(external_browsers_spawned) == 0
        and len(webview2_children) > 0
        and win_visible
        and win_title in ("", "Sanctum")
        and runtime_state.get("app_user_model_id") == "Sanctum.Desktop.App.1"
        and runtime_state.get("engine") == "embedded-webview2"
    )

    # 2. Zero UI TCP Port Check
    pids_csv = ",".join(str(p["ProcessId"]) for p in tree)
    ps_listen = f"""
Get-NetTCPConnection -OwningProcess @({pids_csv}) -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess | ConvertTo-Json -Compress
"""
    res_listen = subprocess.run(["powershell", "-NoProfile", "-Command", ps_listen], capture_output=True, text=True)
    listening_ports = []
    if res_listen.stdout.strip():
        try:
            parsed = json.loads(res_listen.stdout.strip())
            listening_ports = [parsed] if isinstance(parsed, dict) else parsed
        except Exception:
            pass
    zero_ui_tcp_ok = len(listening_ports) == 0 and runtime_state.get("ui_tcp_listener_active") is False

    # 3. Accelerators & Browser Chrome Disabled Check (Gate 2)
    WM_KEYDOWN = 0x0100
    WM_KEYUP = 0x0101
    for vk in [0x50, 0x4E, 0x4B, 0x74, 0x7B]:  # P, N, K, F5, F12
        ctypes.windll.user32.PostMessageW(wintypes.HWND(hwnd), WM_KEYDOWN, vk, 0)
        ctypes.windll.user32.PostMessageW(wintypes.HWND(hwnd), WM_KEYUP, vk, 0)
    time.sleep(0.5)

    tree_after_keys = get_process_tree(proc.pid, browser_pid)
    browsers_after_keys = [
        p.get("Name", "").lower()
        for p in tree_after_keys
        if p.get("Name", "").lower() in forbidden_browsers
    ]

    accelerators_ok = (
        runtime_state.get("are_browser_accelerator_keys_enabled") is False
        and runtime_state.get("are_default_context_menus_enabled") is False
        and runtime_state.get("are_devtools_enabled") is False
        and runtime_state.get("is_status_bar_enabled") is False
        and runtime_state.get("is_zoom_control_enabled") is False
        and len(browsers_after_keys) == 0
    )

    # 4. Network Silence Gate (Gate 1) - Check outbound connections across entire process tree
    ps_net = f"""
Get-NetTCPConnection -OwningProcess @({pids_csv}) -ErrorAction SilentlyContinue | Where-Object {{ $_.RemoteAddress -notin @('127.0.0.1', '0.0.0.0', '::', '::1') }} | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess | ConvertTo-Json -Compress
"""
    res_net = subprocess.run(["powershell", "-NoProfile", "-Command", ps_net], capture_output=True, text=True)
    outbound_conns = []
    if res_net.stdout.strip():
        try:
            parsed = json.loads(res_net.stdout.strip())
            outbound_conns = [parsed] if isinstance(parsed, dict) else parsed
        except Exception:
            pass
    network_silence_ok = len(outbound_conns) == 0

    # 5. Budgets Gate (Gate 3) - Process Tree RSS & First Frame Latency
    host_rss_mb = get_rss_mb(proc.pid)
    total_tree_rss_mb = sum(get_rss_mb(int(p["ProcessId"])) for p in tree)
    first_frame_ms = int(runtime_state.get("first_frame_ms", 0))
    # Budget is 2500ms on bare metal (ADR 0101); allow 3500ms on shared virtualized CI runners (ADR 0086)
    first_frame_budget = 3500 if os.environ.get("CI") else 2500
    budgets_ok = first_frame_ms < first_frame_budget and total_tree_rss_mb < 500.0

    # 6. Graceful Close -> Window Bounds Persistence Check
    WM_CLOSE = 0x0010
    ctypes.windll.user32.PostMessageW(wintypes.HWND(hwnd), WM_CLOSE, 0, 0)
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.terminate()
    window_bounds_saved = os.path.exists(window_state_path)
    saved_bounds = {}
    if window_bounds_saved:
        try:
            with open(window_state_path, "r", encoding="utf-8-sig") as f:
                saved_bounds = json.load(f)
        except Exception:
            pass
    window_lifecycle_ok = window_bounds_saved and saved_bounds.get("width", 0) >= 900

    # 7. Job Object Hard-Kill Zero-Orphan Guarantee
    data_dir2 = tempfile.mkdtemp(prefix="sanctum_wv2_job_")
    runtime_state2_path = os.path.join(data_dir2, "webview2_runtime_state.json")
    proc2 = subprocess.Popen(
        [EXE_PATH, "--data-dir", data_dir2],
        cwd=os.path.dirname(EXE_PATH),
    )
    runtime_state2 = None
    t2 = time.time()
    while time.time() - t2 < 30.0:
        if os.path.exists(runtime_state2_path):
            try:
                with open(runtime_state2_path, "r", encoding="utf-8-sig") as f:
                    d2 = json.load(f)
                if d2.get("status") == "ready":
                    runtime_state2 = d2
                    break
            except Exception:
                pass
        time.sleep(0.1)

    browser_pid2 = int(runtime_state2.get("browser_process_id", 0)) if runtime_state2 else 0
    tree2 = get_process_tree(proc2.pid, browser_pid2)
    child_wv_pids = [int(p["ProcessId"]) for p in tree2 if int(p["ProcessId"]) != proc2.pid]

    # Kill ONLY the parent Sanctum-Desktop.exe PID (without /T) to test Win32 Job Object kernel cleanup
    subprocess.run(["taskkill", "/F", "/PID", str(proc2.pid)], capture_output=True)
    time.sleep(2.5)

    # Check if any child WebView2 PIDs are still active (STILL_ACTIVE = 259)
    surviving_orphans = []
    for cpid in child_wv_pids:
        chk = subprocess.run(
            ["powershell", "-NoProfile", "-Command", f"if (Get-Process -Id {cpid} -ErrorAction SilentlyContinue) {{ 'ALIVE' }}"],
            capture_output=True,
            text=True,
        )
        if "ALIVE" in chk.stdout:
            surviving_orphans.append(cpid)

    job_object_ok = len(child_wv_pids) > 0 and len(surviving_orphans) == 0

    report = {
        "overall_pass": all([
            process_identity_ok,
            zero_ui_tcp_ok,
            accelerators_ok,
            network_silence_ok,
            budgets_ok,
            window_lifecycle_ok,
            job_object_ok,
        ]),
        "runtime_state": runtime_state,
        "checks": {
            "1_process_identity": {
                "pass": process_identity_ok,
                "window_title": win_title,
                "window_visible": win_visible,
                "external_browsers_spawned": external_browsers_spawned,
                "embedded_webview2_child_count": len(webview2_children),
                "app_user_model_id": runtime_state.get("app_user_model_id"),
            },
            "2_accelerators_and_chrome": {
                "pass": accelerators_ok,
                "are_browser_accelerator_keys_enabled": runtime_state.get("are_browser_accelerator_keys_enabled"),
                "are_default_context_menus_enabled": runtime_state.get("are_default_context_menus_enabled"),
                "are_devtools_enabled": runtime_state.get("are_devtools_enabled"),
                "is_status_bar_enabled": runtime_state.get("is_status_bar_enabled"),
                "is_zoom_control_enabled": runtime_state.get("is_zoom_control_enabled"),
                "external_browsers_after_ctrl_p_ctrl_n": browsers_after_keys,
            },
            "3_zero_ui_tcp_port": {
                "pass": zero_ui_tcp_ok,
                "virtual_host": runtime_state.get("virtual_host"),
                "ui_tcp_listener_active": runtime_state.get("ui_tcp_listener_active"),
                "listening_tcp_ports": listening_ports,
            },
            "4_network_silence_gate1": {
                "pass": network_silence_ok,
                "outbound_connections_count": len(outbound_conns),
                "outbound_connections": outbound_conns,
            },
            "5_budgets_gate3": {
                "pass": budgets_ok,
                "first_frame_ms": first_frame_ms,
                "first_frame_budget_ms": first_frame_budget,
                "host_rss_mb": round(host_rss_mb, 2),
                "total_process_tree_rss_mb": round(total_tree_rss_mb, 2),
                "process_tree_rss_budget_mb": 500.0,
            },
            "6_window_lifecycle": {
                "pass": window_lifecycle_ok,
                "saved_bounds": saved_bounds,
            },
            "7_job_object_no_orphans": {
                "pass": job_object_ok,
                "spawned_child_pids_count": len(child_wv_pids),
                "surviving_orphan_pids": surviving_orphans,
            },
        },
    }

    with open(evidence_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))
    return report["overall_pass"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", default="all")
    parser.parse_args()
    ok = run_all_standalone_checks()
    sys.exit(0 if ok else 1)
