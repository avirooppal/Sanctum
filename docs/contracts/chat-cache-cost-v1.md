# Chat cache cost experiment v1

Use pinned real model/artifact config in the same isolated supervised experiment
launcher as embedding cost. No production flags change. Variants: `cache-off`
(current RAM0/no-cache-prompt), `cache-on` (upstream RAM8192/cache-prompt),
`slot-only` (RAM0/cache-prompt). Single slot and identical model/context/threads.
The 8192MiB setting is a ceiling, not a promise that this T0 host can fill it;
run only a bounded six-turn conversation and do not run arbitrary load under it.

Three six-turn conversations per variant, one unrelated warmup before measurement.
Growing shared prefix, same user messages and template, temperature0/max16 tokens.
TTFT = client monotonic duration from before request to first nonempty content delta,
excluding role-only events. Consume the full stream; require DONE and content. Keep
every turn, no retries/discarded samples. Report raw vendor timings when present.
This isolates the engine's OpenAI chat HTTP path; gateway admission/helper overhead
is excluded equally for all variants. It is not a voice-turn or product-path SLO.

Separately repeat an identical native `/completion` prompt with no per-request cache
override. `timings.cache_n` must increase for actual default prefix reuse; missing
counters are UNVERIFIED, never inferred from faster timings. This distinguishes the
engine's ability to reuse slot KV from the production flags that enable/disable it.
Report warm baseline/final per-worker RSS/FD/thread/socket after10s. This small test
does not replace cancellation/storm/shutdown/overload gates for a proposed change.

Counter erratum, discovered during implementation by inspecting pinned
`server-context.cpp`: `tokens_cached` is final slot state length, not actual reuse.
The first off/on raw runs preserve the incorrect derived `slot_reuse_observed`
field; analysis must ignore it and use their preserved `timings.cache_n`. No timing
sample or raw run is rewritten. A regression test rejects retained-state-only input.
