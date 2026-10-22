# Found Bugs Log (docs/refactor/FOUND_BUGS.md)

As mandated: *If you find a bug while moving code, record it here and do not fix it in a move commit.*

| ID | Location | Observation | Impact |
| :--- | :--- | :--- | :--- |
| BUG-001 | `src/components/screens/AgentsScreen.tsx:162` | `setTimeout` timer for agent execution is uncancelled on unmount. | Harmless dev warning if unmounted quickly while running. |
| BUG-002 | `src/components/screens/ResearchScreen.tsx` | Wikipedia snippets contain raw HTML spans from MediaWiki API. | Formatting quirk in citation viewer snippets. |
| BUG-003 | `src/lib/vectorStore.ts:93` | Paragraph regex `\n\s*\n` ignores single-newline Markdown linebreaks. | Minor difference in chunk boundaries for single-spaced documents. |
