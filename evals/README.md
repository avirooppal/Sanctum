# Verification outputs

Test and verification scripts write generated results to `evals/results/`.
These logs, traces, CSVs and machine-specific paths are ignored by Git. CI uploads
Windows verification evidence as the `Sanctum-Verification-Evidence` artifact.

Historical reports formerly checked in are retained in
[the pre-cleanup commit](https://github.com/avirooppal/Sanctum/tree/feecd7a/evals/results).
References to old result paths in historical documents refer to that snapshot,
not to guaranteed results for the current checkout.

Run `npm test` for source checks. On Windows, build with
`python tools/build_installer.py` before running desktop verification scripts
under `tools/exe-verify/`. Installer/lifecycle checks exercise local installation;
use a disposable test environment for the complete suite.
