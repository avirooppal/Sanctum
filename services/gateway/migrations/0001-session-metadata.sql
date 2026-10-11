CREATE TABLE IF NOT EXISTS conversation_titles_v1 (
    id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_tombstones_v1 (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL
);
