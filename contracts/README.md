# Sanctum Contracts Layer (`contracts/`)

The **Contracts** module is the single source of truth for all types, constants, schemas, error codes, and client definitions shared across the entire Sanctum ecosystem.

## Architectural Mandates
1. **Zero Dependencies on Inner Layers**: `contracts/` NEVER imports from `core/` or `apps/`.
2. **Deterministic Schemas**: All data exchanged between the UI, API routes, and local AI engines must conform to typed interfaces defined here.
3. **Backwards Compatibility**: Any re-export shims (such as `src/types/index.ts` and `src/lib/constants.ts`) point directly to this layer.

## Structure
- `types/index.ts`: Core data structures (`Message`, `Thread`, `ModelInfo`, `CuratedModel`, `DocumentItem`, etc.).
- `constants/index.ts`: Default ports, local endpoints, curated Jan-style model download catalogs, and benchmark configurations.
- `errors/codes.ts`: Machine-readable error codes (`ErrorCodes`) used across domain and infrastructure.
- `api/client.ts`: Canonical typed HTTP client (`SanctumApiClient`) interfacing with `/api/*` endpoints.

## Testing & Validation
All contracts are continuously tested via:
- `tests/contracts_validation.test.ts`
- `tests/constants_catalogs.test.ts`
- `tests/api_contracts.test.ts`
