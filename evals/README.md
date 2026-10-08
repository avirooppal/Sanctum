# Evaluations

Run `uv run --offline python evals/run.py`. Eight deterministic hardware scenarios
form the measured foundation baseline; they are not model benchmarks. Missing
metrics, nonfinite values and excessive regressions fail the gate. Security has
zero tolerance; other metrics default to 5% relative regression (ADR 0004).

RAG, ASR, voice, vision, agent and concurrency datasets/benchmarks remain pending
their phases. Never populate those metrics with guesses.
