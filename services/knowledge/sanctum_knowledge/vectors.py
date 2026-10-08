"""Replaceable embedded vector adapter, using upstream sqlite-vec distance kernels."""

import math
import sqlite3
import struct
from pathlib import Path
import sqlite_vec
from .store import identifier


def packed(vector):
    if not vector or not all(math.isfinite(v) for v in vector) or not any(vector):
        raise ValueError("finite nonzero vector required")
    return struct.pack(f"<{len(vector)}f", *vector)


class SqliteVectors:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(path)
        self.db.enable_load_extension(True)
        try:
            sqlite_vec.load(self.db)
        finally:
            self.db.enable_load_extension(False)
        self.db.executescript(
            "CREATE TABLE IF NOT EXISTS vectors(id TEXT PRIMARY KEY,vector BLOB); CREATE TEMP TABLE eligible(id TEXT PRIMARY KEY);"
        )

    def close(self):
        self.db.close()

    def upsert(self, rows):
        with self.db:
            self.db.executemany(
                "INSERT OR REPLACE INTO vectors VALUES(?,?)",
                [(identifier(key), packed(vector)) for key, vector in rows],
            )

    def search(self, vector, eligible, k):
        query = packed(vector)
        with self.db:
            self.db.execute("DELETE FROM eligible")
            self.db.executemany(
                "INSERT OR IGNORE INTO eligible VALUES(?)", [(identifier(key),) for key in eligible]
            )
            return [
                row[0]
                for row in self.db.execute(
                    "SELECT v.id FROM vectors v JOIN eligible e ON e.id=v.id ORDER BY vec_distance_cosine(v.vector,?),v.id LIMIT ?",
                    (query, max(1, min(k, 100))),
                )
            ]
