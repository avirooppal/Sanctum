# ADR0054: brand, icons and other bundled assets

2026-10-11. Inventory v1 enumerates tracked assets with exact SHA256 and defaults
every asset to excluded. Do not treat a code license as an image/font license.

Excluded: Nous/Hermes caduceus, logos, wordmarks, banners, favicons, avatars,
marketing images, pet sprites, sounds, videos and plugin assets. Use an original
Sanctum icon and identity. No upstream binary/SVG asset has been copied.
Remote avatars, images and link-preview requests are prohibited in product UI.

The dashboard imports lucide-react; the desktop icons module re-exports Tabler,
and desktop styles import VS Code codicons and KaTeX fonts. These are dependency
candidates, not automatically admitted assets. Verify the exact selected package
license and every bundled font notice before adoption; do not import the entire
desktop dependency tree. Simple locally authored icons may replace needed icons,
with the visible deviation recorded and measured. No icon library added yet.

Root monorepo MIT notice applies to copied code. The desktop hermes-bots plugin
has a separate Copyright2026 MIT notice and is excluded with unsupported plugins.
Other optional-skills/website/ui-tui assets are outside the renderer target and
are not copied. Runtime asset audit, original Sanctum icon and in-app license
surface remain work to finish, not completed fidelity/brand gates.
