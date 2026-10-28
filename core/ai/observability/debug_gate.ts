/**
 * Debug API gate (ADR 0105 §4): 404 unless the owner enabled request inspection,
 * 401 unless the presented token equals the per-process token. Constant-time compare.
 */
export function gateDebugRequest(args: { enabled: boolean; presented: string | null; expected: string }): 200 | 401 | 404 {
  if (!args.enabled) return 404;
  const p = args.presented ?? "";
  const e = args.expected ?? "";
  if (!e || p.length !== e.length) return 401;
  let diff = 0;
  for (let i = 0; i < e.length; i++) diff |= p.charCodeAt(i) ^ e.charCodeAt(i);
  return diff === 0 ? 200 : 401;
}
