CREATE TABLE IF NOT EXISTS user_preferences_v1 (
    owner TEXT PRIMARY KEY,
    preferences TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
