# A1 harness failures and excluded partial attempts

Attempt1: Linux Git cannot interpret the Windows-managed worktree .git path.
Attempt2: Windows Git executable cannot run in this WSL environment (Exec format error).
Attempt3: native Git with explicit Git directory worked after a slow status scan.
Its scan finished just as attempt4 (using a fresh Windows Git clean receipt) began.
Both entered their first no-model sample concurrently; neither completed a full
60-second sample before explicit SIGINT stopped both. Their named JSON/logs remain.
These partial overlapping runs are invalid under the sequential measurement method,
not rejected because of their measured performance. No completed sample discarded.
A single-run advisory lock now prevents overlapping harness instances. Attempt5
uses a Windows Git clean-source receipt and checks its SHA against native rev-parse.
