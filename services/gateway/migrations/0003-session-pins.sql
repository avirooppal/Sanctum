CREATE TABLE IF NOT EXISTS conversation_pins_v1 (
    id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    pinned INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
);
