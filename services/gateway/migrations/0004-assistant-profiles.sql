CREATE TABLE IF NOT EXISTS assistant_profiles_v1 (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assistant_profiles_owner ON assistant_profiles_v1(owner);
