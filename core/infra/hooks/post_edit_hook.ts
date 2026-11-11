import { runCommand } from "../security/terminal_runner.ts";

export interface PostEditHookOptions {
  workspaceRoot: string;
  filePath: string;
  hookCommand?: string;
  enabled?: boolean;
}

export interface PostEditHookResult {
  executed: boolean;
  success: boolean;
  hookCommand?: string;
  output?: string;
  diagnostics?: string;
}

/**
 * Executes an optional linter/formatter hook after file modification
 * and formats any error output as structured agent feedback.
 */
export async function executePostEditHook(
  options: PostEditHookOptions
): Promise<PostEditHookResult> {
  const { workspaceRoot, filePath, hookCommand, enabled = false } = options;

  if (!enabled || !hookCommand || !hookCommand.trim()) {
    return { executed: false, success: true };
  }

  // Replace %FILE% with relative path if present, otherwise run hook command as-is
  const effectiveCommand = hookCommand.replace(/%FILE%/g, `"${filePath}"`).trim();

  try {
    const res = await runCommand({
      command: effectiveCommand,
      workspaceRoot,
      cwd: workspaceRoot,
      timeoutMs: 20000,
      maxOutputChars: 5000,
    });

    const success = res.exitCode === 0;
    let diagnostics: string | undefined;

    if (!success) {
      const errText = res.stderr || res.stdout;
      diagnostics = `Post-edit hook (${effectiveCommand}) reported issues (exit code ${res.exitCode}):\n${errText.trim()}`;
    }

    return {
      executed: true,
      success,
      hookCommand: effectiveCommand,
      output: res.stdout,
      diagnostics,
    };
  } catch (err: any) {
    return {
      executed: true,
      success: false,
      hookCommand: effectiveCommand,
      diagnostics: `Post-edit hook execution failed: ${err.message}`,
    };
  }
}
