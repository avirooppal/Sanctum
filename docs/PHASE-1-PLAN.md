# Phase 1 — Chat core

Tasks in order: provision immutable hash-verified permissive CPU engine and small
chat/embedding reference models; define router/API/storage contracts; write SDK and
service tests; implement a Rust gateway/router with loopback engine adapters inside
the Phase 0 namespace; add bearer authentication and SQLite conversation storage;
build local React/Tailwind chat; measure a real answer and clean-install timing.

Interfaces: OpenAI chat completions (SSE/tools/JSON schema), embeddings/models;
local session/conversation API; model manifest/provisioning and engine adapter trait.
Tests: official OpenAI Python SDK on real llama.cpp, hash mismatch rejection,
unauthenticated requests, invalid model IDs, conversation isolation, engine egress
inheritance, actual streaming, tool/schema handling, quickstart timing.

Risks: network download availability, small CPU model limitations, cold download
time, SDK drift and build tool availability. No canned responses or embeddings may
count as integration success. Apple/MLX remains unverified outside available Linux
hardware. Phase 2 may begin only after all applicable Phase 1 exit checks pass.
