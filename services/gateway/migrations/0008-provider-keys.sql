CREATE TABLE IF NOT EXISTS provider_keys_v1 (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_keys_owner ON provider_keys_v1(owner);
