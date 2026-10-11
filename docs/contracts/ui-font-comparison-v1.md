# Font comparison v1

Developer diagnostic, not a product or UI-fidelity gate. Load explicit local font
buffers in an isolated fresh browser context; no URLs, upstream scripts, owner
keys or product data. Abort and record every network attempt. Compare fixed text
on equal 600x64 canvases at12/14/18/24px and weights400/700; report advance width,
relative width difference and changed-pixel fraction at identical positions.
No brand masks, reflow normalization or resizing to hide differences. Hash every
input binary and preserve screenshots. No threshold or exact-match claim.

The raster metric counts a pixel changed if any RGBA channel differs. Dimensions
must match; empty or invalid RGBA buffers fail. Actual specimen and metrics guide
the licensed substitution ADR; readability must be inspected separately.
