# Install preflight v1

`sanctum doctor --install-check --probe-binary ABSOLUTE_FOUNDATION_PATH
--install-root PATH --port 8769 --required-bytes 2147483648 --json`

Exit0:ready_for_installation only. Exit78:blocked. Exit2:invalid arguments.
Output schema_version1.0,ready_for_installation,model_readiness(unverified),
facts(OS/arch/glibc/UID/RAM/CPU flags/free bytes/port/existing install/AppArmor),
checks(platform,owner,disk,port,containment),messages. All mandatory checks
must pass;missing/partial/malformed/timed-out probe is blocked. Existing
hardware doctor behavior and model eligibility thresholds are unchanged.

The probe uses an explicit absolute binary,empty environment,closed inherited
FDs and a new process group. Validate version,acceptance,trace and every expected
denial in both roles;never expose raw stdout/stderr. On timeout kill whole group
and reap. No files under install/data paths are created or removed. OS/path
metadata may be reported;no conversation/document/config/token content read.

Exact failure messages:
platform:Linux x86_64 with glibc 2.35 or later is required. On Windows use the dedicated WSL2 launcher.
owner:Run this check as the owner,not root.
disk:Not enough space for installation staging. Free space or choose another installation directory.
port:This loopback port is busy. Stop the existing application or choose another port.
containment:Kernel containment could not be verified. Startup is blocked;never run unconfined.

For AppArmor-restricted hosts append:Ubuntu AppArmor restricts user namespaces. Use a root-owned installation and its executable-specific AppArmor policy;do not disable the system-wide restriction.

No package,GUI launcher,start supervisor or installed-model claim follows from
this command. Windows native check always blocks. Concrete Ubuntu24 profile
installation/verification remains an installation-slice gate.
