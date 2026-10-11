# Inference cache policy v1

Candidate ADR0044 policy, acceptance pending. All reference residents have one
execution slot, context limited by the profile, and host-RAM snapshot cache0.
Chat may reuse that fixed slot's common prefix; embedding/reranking remain stateless.
No request replay or changed resource/cancellation allowance. This changes engine
launch policy only; public HTTP/config/DB contracts remain backward compatible.

Verify through real OpenAI stream usage/timings with no per-request cache override,
then unchanged 500-cancellation storm, resource recovery, active shutdown and180s
mixed-overload gates. Keep prior failed experiments. If resource gates fail, fix or
restore the previous launch policy before merging/committing production changes.

Adoption follow-up2026-10-11: the combined ADR0044–0046 reference passed the real
gates in STATUS (500 cancellations, mixed182s, active and3 repeated shutdowns).
Reference inference threads2, ASR6; original numerical limits unchanged. The first
four-thread candidates failed mixed ASR and remain named evidence. This supplement
records acceptance without erasing the original pre-implementation contract.
