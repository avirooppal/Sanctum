# Run Sanctum Source Gate (PowerShell wrapper)
# Runs the canonical Linux source gate script inside WSL Ubuntu 22.04 with clean environment.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Split-Path -Parent $scriptDir

$logFile = if ($args.Count -ge 1) { $args[0] } else { "evals/results/source-gate-latest.log" }

wsl.exe -d Ubuntu-22.04 -e bash -lc "cd /mnt/c/Users/aviroop/Desktop/Sanctum && bash tools/run_source_gate.sh $logFile"
exit $LASTEXITCODE
