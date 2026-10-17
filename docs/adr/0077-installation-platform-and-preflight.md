# ADR0077: Linux packages and a dedicated-WSL Windows launcher

Owner-directed installation work supersedes packaging sequencing only. ADR0006
remains:Linux x86_64 containment only;never native Windows containment. Choose A:
a standard-library Rust GUI launcher and NSIS installer around a DEDICATED WSL2
import. No Electron,WebView2,Tauri or existing owner distro modification. WSL or
virtualization enabling needs explicit consent/UAC and reboot guidance. Rootfs
import is owner-authorized,hash/signature-verified,version2;never set global WSL
settings or silently download. GUI Start/Stop/Open/Quit follows later slices.
B was rejected because a terminal-only WSL procedure misses the owner's goal.

NSIS core:zlib/libpng;use only audited builtins and public-domain LZMA. Its
license appendix has compression exceptions;do not assume all plugins are
permissive. Pin tool version/hash and archive exact notices BEFORE a build.
No NSIS dependency or binary is admitted in this slice. WiX/Inno not selected;
no license claim about their unexamined components. Rust uses existing MIT/
Apache2 toolchain/application dependencies. Sources checked2026-10-17:
https://nsis.sourceforge.io/Docs/AppendixI.html
https://learn.microsoft.com/en-us/windows/wsl/use-custom-distro
https://documentation.ubuntu.com/release-notes/24.04/

Windows/WSL/Ubuntu are OS prerequisites,not permissively licensed Sanctum
application components. Do not label their GPL/LGPL OS packages permissive.
Prefer explicit official rootfs download;offline OS redistribution needs its
own notices/source-compliance inventory before shipping. Application payload
remains permissive-only. No rootfs or installer is shipped by this decision.

Linux target ABI:glibc>=2.35,x86_64. New preflight default staging disk reserve:
2GiB (model-free installation only);later builders must use measured payload,
staging/rollback size if larger. No existing RAM/profile threshold changes;
RAM/CPU are reported,model eligibility remains UNVERIFIED until provisioning.
Probe real unprivileged namespaces/seccomp via existing foundation check;accept
all22 denial results ONLY. Reuse15s probe deadline;on expiry kill process group,
reap with5s bound. No unsupported platform/root/missing-probe fallback. Port
bind is a momentary availability check,not reservation. No network downloads,
DNS or mutations. Every actual start must repeat checks and runtime health;
this preflight alone does not implement a start command or verify an install.

Ubuntu24 AppArmor restriction detection never disables global policy or uses
no-sandbox. A narrowly attached userns permission for root-owned,non-writable
installed executable paths is the remediation;user-writable exceptions are
not generated. The AppArmor unconfined flag is ONLY an AppArmor namespace
permission profile;Sanctum namespace/seccomp denial remains mandatory.
Actual24.04 verification and a concrete installed-path policy remain pending
until the root-owned package exists. Fail closed in the meantime.

Minisign intended for offline signatures;license/version admission before use.
Trust key must be embedded/out-of-band,never trusted from the same unverified
bundle. Authenticode unavailable until an actual certificate is supplied;
unsigned developer artifacts must say unsigned. No release/build/phase tag or
GitHub release is created by this slice. Package signing is NOT verified here.
