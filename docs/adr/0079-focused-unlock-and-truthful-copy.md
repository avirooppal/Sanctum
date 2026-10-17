# ADR0079: Focused unlock and a measured redesign

Owner-directed redesign,2026-10-17. Work on codex/focused-unlock-redesign.
This supersedes ADR0078's proposed user-visible Hermes theme attribution: no
Hermes/Nous names in owner surfaces;retain the original id/palette as Sanctum
reference and preserve upstream attribution in the dedicated notices resource.
No palette or authenticated-shell geometry change in the first UI slice.

The owner authorizes a redesigned unlock default. Keep the reference selectable
after authentication;do not claim the new unlock is pixel-equivalent. An early
return gates the shell and shortcuts until owner bootstrap succeeds. No history,
preferences,dashboard or navigation is mounted while locked. Credentials remain
memory-only,never URL/browser storage. Key entry is still mandatory:there is no
owner-creation backend. Do not invent one-click setup or a password migration.

One primary Unlock action;runtime review is secondary. Explain the actual token
file path in a disclosure and show errors beside the field. Keep the field's
accessible name Local access key for compatibility;visible label Access key is
plain language. Setup review remains available,without promising downloads,
automatic hardware detection or folder watching that are absent.

Move third-party notice text out of the initial app chunk into its own lazy
same-origin resource. The build copy guard excludes only that named attribution
resource,not arbitrary source files. Copyright/notices remain intact. Deny
Hermes/Nous branding and absolute privacy marketing outside notices;legitimate
CSS percentages and font scaling are not privacy claims.

Use existing bundled Archivo and existing tokens;no assets,icons,fonts or npm
packages added. Use a first-party abstract inline SVG,not a borrowed mark.
New unlock controls have44px minimum targets,14-16px body,12px minimum metadata,
AA text4.5:1 and essential focus/input boundaries3:1. Accent foreground must be
recomputed when a custom accent is applied;testing only accent against canvas
does not prove button text contrast. Existing fidelity/timeout gates unchanged.
Reuse ADR0078 incremental12KiB JS/8KiB CSS gzip budget and200ms motion ceiling.
No new timeout,skip or throughput threshold is introduced.

Before audit covers real screens only. Auth error uses an actual rejected key;
no intercepted fake health/generation. Real busy/streaming/long-answer/citation
captures still require explicit execution;missing cells stay pending. Website
and docs have fixed blue styling,so repeating theme parameters does not prove
their theme support. Screenshot contact sheets establish a layout critique,
not automated WCAG certification or two-hour comfort. Three committed critique
iterations for S1 and later S3/S4 are still required;no iteration invented.
