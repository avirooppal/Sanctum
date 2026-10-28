/**
 * Test helper for detecting real engine availability in runner environment.
 * If live engine daemon is offline (e.g. CI runner without Ollama/llama-server),
 * tests report skipped rather than failing due to missing external process.
 */

export async function isEndpointAvailable(url: string, timeoutMs: number = 500): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status < 500;
  } catch {
    return false;
  }
}
