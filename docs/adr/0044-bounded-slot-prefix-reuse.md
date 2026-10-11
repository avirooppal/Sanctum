# ADR 0044: Separate fixed slot KV reuse from optional host-RAM prompt caching

Proposed 2026-10-11; production change and unchanged storm gates pending.

H3 real six-turn engine chat comparison (18 turns per configuration) found current
RAM0/no-cache-prompt TTFT p50/p95 2.511719/3.103626s and zero actually reused prompt
tokens. RAM8192/cache-prompt gave 0.357319/1.889318s; repeated native prompt actual
reuse 0 ->220 tokens. Raw runs retained in `chat-cache-{off,on}.json`. The initial
derived reuse boolean used the wrong counter; use `timings.cache_n`, verified from
pinned upstream source. The raw records are not rewritten.

The RAM-cache configuration grew 60704KiB from short warmup; current configuration
grew19072KiB. Neither preliminary comparison meets the unchanged +16384KiB bound;
neither is a full warmed storm baseline. Do not call either leak-safe. Preserving
the prior S0 gate requires its complete representative warmup and storms, not an
increased tolerance or repeatedly warming until pass.

Propose `--cache-ram 0 --cache-prompt` for the single chat slot only. Its model
context/KV allocation remains fixed by the profile; no extra host snapshot cache.
Embedding/reranking stay stateless and RAM0/no-cache-prompt. This is a bounded
alternative to adding a few-hundred-MiB RAM cache, which could exceed this host's
retained-RSS allowance. It trades snapshot reuse across unrelated prompts for
same-slot prefix reuse. No model change, replay, larger queue or new egress.

Before adoption: measure the slot-only variant's actual chat and native reuse,
then rerun existing real-engine cancellation/storm/active-shutdown/mixed-load
gates with the proposed production configuration. Existing p95<=2s/max<3s cancel,
shutdown5s, health250ms/chat5s and exact FD/socket/role, thread+2, RSS+16MiB/10s
remain unchanged. Failed results stay named. If these fail, fix or retain current
production settings; no threshold adjustment is authorized by this ADR.

Sources checked at pinned b11429:
[argument definitions](https://github.com/ggml-org/llama.cpp/blob/b11429/common/arg.cpp),
[actual reuse and final slot state](https://github.com/ggml-org/llama.cpp/blob/b11429/tools/server/server-context.cpp).
This does not satisfy Phase3 voice latency and does not implement resident speech.

## Adoption evidence, 2026-10-11

Adopt chat fixed-slot reuse with RAM snapshots0 together with ADR0045 accounting
and the measured ADR0046 two-thread inference reference. Four-thread candidate
mixed failures remain preserved; do not claim cache flags alone met the load gate.
Final500 real cancellations and all floods PASS, worst retained RSS+7376KiB;
mixed182.050947s PASS all lanes/resource bounds, retained RSS worst+14116KiB;
active shutdown0.701486s and repeated1.007190/0.770481/0.850773s, zero survivors.
Raw `slot-policy-final-*`/`slot-policy-mixed-overload-inference-threads2.json`.
No timing/resource bound changed. Source/Rust/profile checks and push follow.
