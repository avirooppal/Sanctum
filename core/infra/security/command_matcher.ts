export interface CommandRule {
  pattern: string;
  action: "allow" | "ask" | "deny";
  description?: string;
}

export interface CommandMatchResult {
  action: "allow" | "ask" | "deny";
  matchedRule?: CommandRule;
  reason: string;
}

export const DEFAULT_COMMAND_RULES: CommandRule[] = [
  // 1. HARD DENIED: Destructive system / disk commands
  {
    pattern: ".*(format\\s+[a-zA-Z]:|diskpart|bcdedit|vssadmin|mkfs).*",
    action: "deny",
    description: "Destructive disk formatting or volume alteration",
  },
  {
    pattern: ".*(rmdir\\s+/[sS]\\s+/[qQ]\\s+[c-zC-Z]:\\\\|del\\s+/[fF]\\s+/[sS]\\s+/[qQ]\\s+[c-zC-Z]:\\\\).*",
    action: "deny",
    description: "Recursive root disk deletion via cmd",
  },
  {
    pattern: ".*(rm\\s+-(rf|fr|r)\\s+(/|/\\*|[a-zA-Z]:\\\\)).*",
    action: "deny",
    description: "Root directory wipeout command",
  },
  {
    pattern: ".*Remove-Item\\s+.*([a-zA-Z]:\\\\).*",
    action: "deny",
    description: "PowerShell recursive drive wipe",
  },
  {
    pattern: ".*(:\\(\\)\\s*\\{.*:\\|:&|:\\|:&).*",
    action: "deny",
    description: "Fork bomb execution pattern",
  },

  // 2. AUTO-ALLOWED: Read-only safe inspection queries
  {
    pattern: "^git\\s+(status|diff|log|branch|show|rev-parse|tag|remote|describe)(\\s+.*)?$",
    action: "allow",
    description: "Read-only git queries",
  },
  {
    pattern: "^(dir|ls|pwd|echo|type|cat|head|tail|where|which)(\\s+.*)?$",
    action: "allow",
    description: "Safe directory and output inspection",
  },
  {
    pattern: "^(node\\s+-v|npm\\s+-v|python\\s+--version|git\\s+--version|tsc\\s+-v|dotnet\\s+--version|cargo\\s+--version|rustc\\s+--version|go\\s+version)(\\s+.*)?$",
    action: "allow",
    description: "Environment runtime version checks",
  },
];

/**
 * Matches a shell command against active permission rules.
 * Order of evaluation:
 * 1. Custom settings rules (if supplied)
 * 2. Default hard-denied rules
 * 3. Default auto-allowed rules
 * 4. Fallback: "ask" (prompt user confirmation)
 */
export function matchCommandRule(
  command: string,
  customRules?: CommandRule[]
): CommandMatchResult {
  const trimmed = (command || "").trim();
  if (!trimmed) {
    return {
      action: "deny",
      reason: "Empty command string.",
    };
  }

  const allRules: CommandRule[] = [
    ...(customRules || []),
    ...DEFAULT_COMMAND_RULES,
  ];

  for (const rule of allRules) {
    try {
      const regex = new RegExp(rule.pattern, "i");
      if (regex.test(trimmed)) {
        let reason = "";
        if (rule.action === "deny") {
          reason = rule.description || `Command matches deny pattern: ${rule.pattern}`;
        } else if (rule.action === "allow") {
          reason = rule.description || `Command matches pre-approved pattern: ${rule.pattern}`;
        } else {
          reason = rule.description || `Command requires user confirmation: ${rule.pattern}`;
        }
        return {
          action: rule.action,
          matchedRule: rule,
          reason,
        };
      }
    } catch {
      // Invalid regex skipped
    }
  }

  return {
    action: "ask",
    reason: "Standard command execution requires user confirmation.",
  };
}
