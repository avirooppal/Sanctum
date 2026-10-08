# ADR 0004: Initial regression thresholds

Date: 2026-10-08
Status: accepted

## Context
Section 11 leaves regression X% unspecified and lacks numerical targets for most
future benchmarks. No application-quality dataset exists yet.

## Decision
Use 5% relative regression as the default performance/quality gate; security gates
have zero tolerance. Require every baseline metric, finite numbers, explicit
direction, and baseline provenance. Missing results fail closed. An accepted ADR
must justify any exception. Do not synthesize application benchmarks from unit tests.

## Consequences and verification
Foundation baselines measure deterministic profile scenarios only. They say nothing
about model throughput or RAG quality. Set dataset-specific Phase 2/3/4/6 targets
and reference hardware before claiming those phases complete.
