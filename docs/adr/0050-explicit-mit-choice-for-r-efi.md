# ADR0050: Explicit permissive branch for r-efi

2026-10-11. Tungstenite0.30 transitively resolves getrandom0.4/r-efi6 for UEFI.
The downloaded r-efi6 AUTHORS and README explicitly offer MIT OR Apache-2.0 OR
LGPL-2.1-or-later. Select MIT and record that selection alongside the unchanged
upstream SPDX expression and archive hash. The registry schema permits additive
dependency metadata. Scanner must reject this expression without the explicit
MIT choice and reject an LGPL selection; tests first. No LGPL-only component is
allowed and no model/dependency permissive-only policy is relaxed. Keep existing
nonpermissive rejection tests. Other new crate licenses are verified from their
pinned downloaded sources before registration; product never downloads them.
