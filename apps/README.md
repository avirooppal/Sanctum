# Sanctum Apps Layer (`apps/`)

The **Apps** module houses presentation clients and frontends for the Sanctum ecosystem (Web UI, Desktop shells).

## UI Strict Separation Mandate
1. **Zero AI Logic in UI**:
   - No prompt assembly or system prompt strings.
   - No hardware detection heuristics or VRAM offloading calculations.
   - No regex or parsing for model thought blocks (`<think>...</think>`). All parsing is handled by `core/ai/inference/format.ts`.
2. **Deterministic Data Flow**:
   - UI consumes typed API responses via `apps/ui/api-client/` or `contracts/api/client.ts`.
   - UI displays human-readable copy from the centralized presentation string table (`apps/ui/i18n/strings.ts`), mapping typed `ErrorCode` values returned by the backend.
3. **Responsive & Accessible Presentation**:
   - Standard Radix / Lucide primitives with Tailwind styling.
   - High performance: zero unnecessary re-renders, 0 layout shifts.

## Testing & Validation
- `tests/ui_strings.test.ts`: Confirms every typed error code maps to a valid localized UI string.
- `tools/check_architecture.py`: Verifies zero AI logic, raw prompt strings, or VRAM calculations exist inside UI components.
