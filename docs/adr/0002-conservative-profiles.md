# ADR 0002: Conservative hardware recommendations without unverified weights

Date: 2026-10-08
Status: accepted

## Context
Model names require verification; Windows adapter RAM can truncate above 4 GiB.
Multiple GPU memories cannot be assumed to form a single usable allocation.

## Decision
Use system RAM and nvidia-smi dedicated VRAM where available. Report unknown
features/accelerators explicitly. Select the highest matching JSON profile;
use one GPU's memory, not a sum. Apple Silicon uses shared RAM. No weights are
registered by default. A tier recommendation is not a measured fit/speed promise.
T3 requires team mode, >=32 GiB RAM and a >=48 GiB NVIDIA GPU; smaller team GPUs
retain the solo engine until multi-user profiles are benchmarked in Phase 6.
The 8 GiB/16 GiB boundaries use exact bytes and may conservatively place machines
with reserved system RAM below a threshold. Allow explicit profile-file overrides.

## Consequences and verification
CPU-only 64 GiB machines remain T1. AMD/Intel VRAM and NPU support are incomplete.
Tests cover boundaries, absent RAM, multiple GPUs, Apple, and profile replacement.
Profiles carry empty model lists until license/hash/source verification at Phase 1.
