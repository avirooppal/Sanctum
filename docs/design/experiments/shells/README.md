# B2 development experiments

These are original hello-world measurement candidates, not product screens.
They are an independent Cargo workspace, excluded from the product dependency
tree. No Jan code is copied. Versions were resolved from crates.io during explicit
development setup and pinned before fetch. No candidate is approved for shipping.

Use `cargo fetch --manifest-path docs/design/experiments/shells/Cargo.toml`
only during explicit developer setup. Then build `--locked --offline --release`.
Run `cargo tree` and the repository license gate against this workspace's metadata;
a rejection is evidence of unreviewed dependencies, not permission to bypass it.
Tauri/wry use the OS WebView. Browser candidate opens the default browser and
creates a tray; report browser process memory separately, never call launcher-only
RSS total desktop RSS. No installer is produced by these Cargo builds.

Ready markers occur after two animation frames; they do not prove actual painted
pixels or a usable product. Match viewport, content and release profile.
Record OS/runtime versions, process scope and unavailable cases explicitly.
