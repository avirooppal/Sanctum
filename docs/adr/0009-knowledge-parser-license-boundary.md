# ADR 0009: Permissive initial structural parser adapters

Date: 2026-10-08
Status: accepted

Current Docling 2.135.0/docling-slim directly requires certifi (MPL-2.0), violating
the user's permissive-only dependency constraint. Marker is not an automatic
alternative without its own full license review. Do not silently waive the rule.

Start with maintained permissive markdown-it-py and pypdf adapters behind Parser:
Markdown headings/paragraphs/tables and PDF page text, retaining parent sections and
page provenance. This deviates from the Docling default, not from the no-custom-
parser rule: parsing uses upstream libraries. Scanned PDFs without extractable text
fail explicitly until the OCR phase. Complex PDF tables/figures and bounding boxes
are unverified; never invent coordinates. Highlights initially reference exact
spans in extracted page text. Docling-quality layout remains an open Phase 2 item.

Primary dependency metadata checked at https://pypi.org/pypi/docling-slim/2.135.0/json.
Evaluation thresholds are fixed before retrieval tuning: >=5 percentage-point
recall@5 lift, no faithfulness regression, >=95% exact citation support, plus local
judge/human checks. A passing unit suite alone cannot complete Phase 2.
