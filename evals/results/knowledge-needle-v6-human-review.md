# Phase 2 human faithfulness spot-check

Suite: `knowledge-needle-v6`  
Dataset SHA-256: `bd2c1f62b08284eb62fbc8781969ffc1c530f93b38d5e00942b9569d4039247e`  
Retrieval metrics are in `knowledge-needle-v6-retrieval-only.json`; this packet samples four answers, including two near-duplicate disambiguation cases. This is synthetic pipeline evidence, not a substitute for customer-corpus review.

Review performed by Codex at the user's direction on 2026-10-10. For each hybrid case,
the question, expected fact, answer, cited source, and exact quote were checked against
the frozen dataset source. All four hybrid answers are supported. In a comparison of
the vector-only answer artifact, cases 01, 25, and 30 cited decoy values for different
identifiers; case 18 happened to return the expected fact. The initial local judge
incorrectly marked those decoy answers supported, prompting ADR 0013 and calibrated
judge reruns. This records an assistant review and is not represented as a human review.

## needle-v6-01

Question: For batch token IDA17F0385D8B44A108DDB, what is the assigned sealant?
Expected fact: Assigned sealant: sodium silicate.
Answer: Assigned sealant: sodium silicate.
Citation source: asset-register.md
Section context: Batch token IDA17F0385D8B44A108DDB
Assigned sealant: sodium silicate.
Highlighted quote: Assigned sealant: sodium silicate.

Review: [x] supported  [ ] unsupported  [ ] wrong citation  [ ] should abstain

## needle-v6-18

Question: For batch token IDFBBA7C8183AC27D42B32, what is the assigned connector key?
Expected fact: Assigned connector key: keyway D.
Answer: Assigned connector key: keyway D.
Citation source: asset-register.md
Section context: Batch token IDFBBA7C8183AC27D42B32
Assigned connector key: keyway D.
Highlighted quote: Assigned connector key: keyway D.

Review: [x] supported  [ ] unsupported  [ ] wrong citation  [ ] should abstain

## needle-v6-25

Question: For batch token ID8C3CFE52E92832F305F2, what is the assigned pump rotation?
Expected fact: Assigned pump rotation: clockwise from drive end.
Answer: Assigned pump rotation: clockwise from drive end.
Citation source: asset-register.md
Section context: Batch token ID8C3CFE52E92832F305F2
Assigned pump rotation: clockwise from drive end.
Highlighted quote: Assigned pump rotation: clockwise from drive end.

Review: [x] supported  [ ] unsupported  [ ] wrong citation  [ ] should abstain

## needle-v6-30

Question: For batch token IDBF4EB0C4632D224F115F, what is the assigned replacement element?
Expected fact: Assigned replacement element: cartridge XR-14.
Answer: Assigned replacement element: cartridge XR-14.
Citation source: asset-register.md
Section context: Batch token IDBF4EB0C4632D224F115F
Assigned replacement element: cartridge XR-14.
Highlighted quote: Assigned replacement element: cartridge XR-14.

Review: [x] supported  [ ] unsupported  [ ] wrong citation  [ ] should abstain

