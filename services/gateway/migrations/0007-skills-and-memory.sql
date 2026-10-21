CREATE TABLE IF NOT EXISTS skills_v1 (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills_v1(owner);

CREATE TABLE IF NOT EXISTS memories_v1 (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    assistant_id TEXT,
    fact TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories_v1(owner);
