# ADR0055: substitutions based on local render comparisons

2026-10-11; supplements0053, does not grant rights to excluded upstream fonts.
Ran120 fixed-text comparisons in fresh Chromium with all network routes aborted;
zero requests attempted. Inspected section screenshots for serif, expanded,
compressed and pixel families. Input binaries are hashed in the raw report.
This is diagnostic selection, not a UI fidelity pass or threshold exception.

| Excluded family | Selected OFL candidate | Mean relative advance-width difference | Mean changed-pixel fraction |
|---|---|---:|---:|
| Collapse | Spectral Regular |0.05144936|0.07900065|
| Mondwest | Spectral Regular |0.08916246|0.06829427|
| Rules Expanded | Archivo with expanded stretch |0.13570134|0.10794922|
| Rules Compressed | League Gothic |0.24609173|0.05515951|
| Neuebit | VT323 |0.14667278|0.04485026|

These are closest among the tested candidates by visual family plus layout,
not all possible fonts. Spectral preserves the proportional serif shape seen
in the actual reference renders; VT323/Pixelify are unsuitable for Mondwest's
observed serif text despite being suggested pixel candidates. Spectral better
preserves Collapse's line width than Inter/Instrument Serif. League Gothic is
closer in compressed width than Archivo/Barlow/Inter, but remains substantially
wider; record this deviation, do not hide it with screenshot masks or transforms.
Archivo preserves expanded sans geometry better than Inter. VT323 is closer to
Neuebit than Pixelify on both measured metrics. JetBrains Mono's primary OFL
notice permits bundled technical type; exact file admission follows separately.

Sizes12/14/18/24, requested weights400/700, identical600x64 canvases and baseline;
regular source binaries plus browser synthetic bold where no matching face is
registered. Variable axes use browser defaults except Archivo stretch. This is
weak evidence for full bold/italic/language coverage, which must be tested in
the product. No font binary copied into product in this slice.

First execution failed on overflow of the long specimen string; retained named
failure, shortened identical sample text for all pairs without changing canvas
or any product gate. A preliminary Spectral download selected ExtraLight rather
than Regular: retained wrong-weight report, corrected exact Regular filename,
reran. Final120-row result is ui-font-comparison.json. No fabricated equivalence.
All selected font sources use Google/fonts pinbd8f81ddb5c74d5c8897b36ad88b440266245103.
