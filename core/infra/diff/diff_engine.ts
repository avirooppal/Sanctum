export interface DiffLine {
  type: "context" | "addition" | "deletion";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
  status: "pending" | "accepted" | "rejected";
}

export interface StructuredDiff {
  filePath: string;
  isNewFile: boolean;
  isDeletedFile: boolean;
  hunks: DiffHunk[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Computes longest common subsequence line table.
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Computes structured line diff with clustered hunks.
 */
export function computeStructuredDiff(
  filePath: string,
  oldText: string,
  newText: string,
  contextSize: number = 3
): StructuredDiff {
  const isNewFile = oldText === "" && newText !== "";
  const isDeletedFile = oldText !== "" && newText === "";

  const oldLines = oldText ? oldText.split(/\r?\n/) : [];
  const newLines = newText ? newText.split(/\r?\n/) : [];

  const dp = computeLCS(oldLines, newLines);
  const diffLines: DiffLine[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diffLines.unshift({
        type: "context",
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.unshift({
        type: "addition",
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffLines.unshift({
        type: "deletion",
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  // Count changes
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const line of diffLines) {
    if (line.type === "addition") totalAdditions++;
    if (line.type === "deletion") totalDeletions++;
  }

  // If identical, return empty hunks
  if (totalAdditions === 0 && totalDeletions === 0) {
    return {
      filePath,
      isNewFile,
      isDeletedFile,
      hunks: [],
      totalAdditions: 0,
      totalDeletions: 0,
    };
  }

  // Cluster changed lines into hunks with context
  const hunks: DiffHunk[] = [];
  let currentHunkLines: DiffLine[] = [];
  let hunkIndex = 0;
  let inHunk = false;
  let trailingContext = 0;

  for (let idx = 0; idx < diffLines.length; idx++) {
    const line = diffLines[idx];
    const isChange = line.type === "addition" || line.type === "deletion";

    if (isChange) {
      if (!inHunk) {
        // Collect leading context
        inHunk = true;
        const leadingStart = Math.max(0, idx - contextSize);
        currentHunkLines = diffLines.slice(leadingStart, idx);
      }
      currentHunkLines.push(line);
      trailingContext = 0;
    } else if (inHunk) {
      currentHunkLines.push(line);
      trailingContext++;
      // Check if next lines have changes within 2 * contextSize
      let upcomingChange = false;
      for (let k = idx + 1; k < Math.min(diffLines.length, idx + 1 + contextSize * 2); k++) {
        if (diffLines[k].type !== "context") {
          upcomingChange = true;
          break;
        }
      }

      if (trailingContext >= contextSize && !upcomingChange) {
        // Finalize hunk
        hunkIndex++;
        const firstOld = currentHunkLines.find((l) => l.oldLineNumber !== undefined)?.oldLineNumber || 1;
        const firstNew = currentHunkLines.find((l) => l.newLineNumber !== undefined)?.newLineNumber || 1;
        const oldCnt = currentHunkLines.filter((l) => l.type !== "addition").length;
        const newCnt = currentHunkLines.filter((l) => l.type !== "deletion").length;

        hunks.push({
          id: `hunk-${hunkIndex}`,
          oldStart: firstOld,
          oldLines: oldCnt,
          newStart: firstNew,
          newLines: newCnt,
          header: `@@ -${firstOld},${oldCnt} +${firstNew},${newCnt} @@`,
          lines: [...currentHunkLines],
          status: "pending",
        });

        currentHunkLines = [];
        inHunk = false;
        trailingContext = 0;
      }
    }
  }

  // Flush remaining open hunk
  if (inHunk && currentHunkLines.length > 0) {
    hunkIndex++;
    const firstOld = currentHunkLines.find((l) => l.oldLineNumber !== undefined)?.oldLineNumber || 1;
    const firstNew = currentHunkLines.find((l) => l.newLineNumber !== undefined)?.newLineNumber || 1;
    const oldCnt = currentHunkLines.filter((l) => l.type !== "addition").length;
    const newCnt = currentHunkLines.filter((l) => l.type !== "deletion").length;

    hunks.push({
      id: `hunk-${hunkIndex}`,
      oldStart: firstOld,
      oldLines: oldCnt,
      newStart: firstNew,
      newLines: newCnt,
      header: `@@ -${firstOld},${oldCnt} +${firstNew},${newCnt} @@`,
      lines: [...currentHunkLines],
      status: "pending",
    });
  }

  return {
    filePath,
    isNewFile,
    isDeletedFile,
    hunks,
    totalAdditions,
    totalDeletions,
  };
}

/**
 * Applies only accepted hunks to the original text.
 * Rejected hunks leave original lines untouched.
 */
export function applyAcceptedHunks(originalText: string, hunks: DiffHunk[]): string {
  if (hunks.length === 0) return originalText;

  const origLines = originalText ? originalText.split(/\r?\n/) : [];
  const resultLines: string[] = [];
  let currentOrigIndex = 0; // 0-based

  for (const hunk of hunks) {
    const hunkStart = Math.max(0, hunk.oldStart - 1);

    // Copy unchanged lines prior to this hunk
    while (currentOrigIndex < hunkStart && currentOrigIndex < origLines.length) {
      resultLines.push(origLines[currentOrigIndex]);
      currentOrigIndex++;
    }

    if (hunk.status === "rejected") {
      // Keep original lines across this hunk's old range
      const hunkEnd = hunkStart + hunk.oldLines;
      while (currentOrigIndex < hunkEnd && currentOrigIndex < origLines.length) {
        resultLines.push(origLines[currentOrigIndex]);
        currentOrigIndex++;
      }
    } else {
      // status is "accepted" or "pending" (default to apply if accepted/pending)
      for (const line of hunk.lines) {
        if (line.type === "context" || line.type === "addition") {
          resultLines.push(line.content);
        }
      }
      currentOrigIndex = hunkStart + hunk.oldLines;
    }
  }

  // Copy remaining lines after last hunk
  while (currentOrigIndex < origLines.length) {
    resultLines.push(origLines[currentOrigIndex]);
    currentOrigIndex++;
  }

  return resultLines.join("\n");
}

/**
 * Generates unified diff text.
 */
export function generateUnifiedDiff(diff: StructuredDiff): string {
  const header = `--- a/${diff.filePath}\n+++ b/${diff.filePath}\n`;
  const hunkTexts = diff.hunks.map((hunk) => {
    const lines = hunk.lines.map((l) => {
      const prefix = l.type === "addition" ? "+" : l.type === "deletion" ? "-" : " ";
      return `${prefix}${l.content}`;
    });
    return `${hunk.header}\n${lines.join("\n")}`;
  });

  return header + hunkTexts.join("\n");
}
