# ADR 0010: Permissive vector adapter for the first Knowledge slice

Date: 2026-10-08
Status: accepted

LanceDB 0.40.0 is Apache-2.0 but its Python dependency graph includes tqdm 4.70.1,
whose installed license expression is MPL-2.0 AND MIT. The user's permissive-only
rule applies to dependencies too. The experimental installation was removed;
do not conceal this by relabeling its license or skipping the scanner.

Use MIT/Apache-2.0 sqlite-vec 0.1.9 behind VectorStore for the initial local
reference. SQLite owns persistence and sqlite-vec computes vector distances; no
custom vector kernels or stores. Exact scans are suitable for the small reference
corpus, with authoritative ACL joins before ranking. This deviates from the
default LanceDB adapter. A future Rust LanceDB adapter can restore that default
after its entire graph is reviewed. Do not claim LanceDB is implemented now.

Evidence: https://pypi.org/pypi/lancedb/0.40.0/json and installed tqdm metadata;
https://github.com/asg017/sqlite-vec/blob/main/LICENSE-MIT.
