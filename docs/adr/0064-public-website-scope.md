# ADR 0064: Sanctum website and shared application distribution

The owner's clarification, "everything, but replace the information with our
info", explicitly adds the public website and documentation surface to Step U.
This supersedes ADR0051's exclusion of marketing, but does not expand backend
capabilities or waive release gates. The chat and dashboard reference remains
NousResearch/hermes-agent at b30f95ac4a80d2f6dbe3aa01001b0524314f6d74.

The pinned website/ is a Docusaurus documentation site. The live homepage at
https://hermes-agent.nousresearch.com/ is a separate visual reference observed
2026-10-11: blue split hero, installation panel, platform cards, features, FAQs
and footer. Its artwork/font redistribution rights have not been established.
Reimplement the layout with original Sanctum artwork and already admitted OFL
fonts; do not copy its binaries, tracker, logos or commercial Portal content.
Document deviations and do not claim pixel equivalence without measurements.

Add /website.html as a separate Vite entry in the existing offline asset bundle;
the existing / remains the authenticated application. All links and assets on
the website are same-origin. Setup/status sections describe current support,
not aspirational product availability. Do not publish download buttons before
verified artifacts exist. Native Windows/macOS gateway support and installers
are still missing software, not completed work or a hardware-only exception.

Browser and eventual desktop shells must consume the same built web assets.
An EXE or Linux package must additionally verify the gateway, confinement,
model provisioning and clean install; wrapping a web page is not that gate.
No new dependencies, deadlines, fidelity thresholds or security exceptions.
