"""SQLite authority for membership, live document versions and lexical candidates."""

import re
import sqlite3
import uuid
from pathlib import Path


def identifier(value: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{32}", value):
        raise ValueError("invalid identifier")
    return value


class Catalog:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            PRAGMA foreign_keys=ON;
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT,owner TEXT);
            CREATE TABLE IF NOT EXISTS members(workspace TEXT REFERENCES workspaces(id),user TEXT,
                PRIMARY KEY(workspace,user));
            CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,workspace TEXT REFERENCES
                workspaces(id),name TEXT,sha256 TEXT,version INTEGER,data_class TEXT,
                UNIQUE(workspace,name));
            CREATE TABLE IF NOT EXISTS readers(document TEXT REFERENCES documents(id),user TEXT,
                PRIMARY KEY(document,user));
            CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY,document TEXT REFERENCES
                documents(id),text TEXT,parent_text TEXT,page INTEGER);
            CREATE VIRTUAL TABLE IF NOT EXISTS lexical USING fts5(id UNINDEXED,text);
        """)

    def close(self):
        self.db.close()

    def workspace(self, user: str, name: str) -> str:
        if not user or not name.strip() or len(name) > 120:
            raise ValueError("user and short workspace name required")
        key = uuid.uuid4().hex
        with self.db:
            self.db.execute("INSERT INTO workspaces VALUES(?,?,?)", (key, name, user))
            self.db.execute("INSERT INTO members VALUES(?,?)", (key, user))
        return key

    def workspaces(self, user):
        return [
            dict(r)
            for r in self.db.execute(
                "SELECT w.id,w.name FROM workspaces w JOIN members m ON w.id=m.workspace WHERE m.user=? ORDER BY w.rowid",
                (user,),
            )
        ]

    def require(self, user, workspace, owner=False):
        identifier(workspace)
        row = self.db.execute(
            "SELECT w.owner FROM workspaces w JOIN members m ON w.id=m.workspace WHERE w.id=? AND m.user=?",
            (workspace, user),
        ).fetchone()
        if not row or (owner and row["owner"] != user):
            raise PermissionError("workspace access denied")
        return row["owner"]

    def add_member(self, user, workspace, member):
        self.require(user, workspace, owner=True)
        if not member:
            raise ValueError("member required")
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO members VALUES(?,?)", (workspace, member))

    def _readers(self, workspace, readers):
        for reader in readers:
            self.require(reader, workspace)

    def set_readers(self, user, workspace, document, readers):
        self.require(user, workspace, owner=True)
        self._readers(workspace, readers)
        if not self.db.execute(
            "SELECT 1 FROM documents WHERE id=? AND workspace=?", (identifier(document), workspace)
        ).fetchone():
            raise PermissionError("document access denied")
        with self.db:
            self.db.execute("DELETE FROM readers WHERE document=?", (document,))
            self.db.executemany(
                "INSERT OR IGNORE INTO readers VALUES(?,?)", [(document, r) for r in readers]
            )

    def put(self, user, workspace, name, digest, readers, data_class, chunks):
        self.require(user, workspace, owner=True)
        self._readers(workspace, readers)
        if data_class not in {"public", "internal", "confidential", "restricted"}:
            raise ValueError("invalid data class")
        if not re.fullmatch(r"[0-9a-f]{64}", digest) or not name or len(name) > 255:
            raise ValueError("invalid document metadata")
        old = self.db.execute(
            "SELECT id,sha256,version FROM documents WHERE workspace=? AND name=?",
            (workspace, name),
        ).fetchone()
        key = old["id"] if old else uuid.uuid4().hex
        if old and old["sha256"] == digest:
            self.set_readers(user, workspace, key, readers)
            with self.db:
                self.db.execute("UPDATE documents SET data_class=? WHERE id=?", (data_class, key))
            return {"id": key, "version": old["version"], "sha256": digest}
        version = old["version"] + 1 if old else 1
        with self.db:
            if old:
                self.db.execute(
                    "DELETE FROM lexical WHERE id IN (SELECT id FROM chunks WHERE document=?)",
                    (key,),
                )
                self.db.execute("DELETE FROM chunks WHERE document=?", (key,))
                self.db.execute(
                    "UPDATE documents SET sha256=?,version=?,data_class=? WHERE id=?",
                    (digest, version, data_class, key),
                )
            else:
                self.db.execute(
                    "INSERT INTO documents VALUES(?,?,?,?,?,?)",
                    (key, workspace, name, digest, version, data_class),
                )
            self.db.execute("DELETE FROM readers WHERE document=?", (key,))
            self.db.executemany(
                "INSERT OR IGNORE INTO readers VALUES(?,?)", [(key, r) for r in readers]
            )
            for chunk in chunks:
                cid = uuid.uuid4().hex
                self.db.execute(
                    "INSERT INTO chunks VALUES(?,?,?,?,?)",
                    (cid, key, chunk["text"], chunk["parent_text"], chunk.get("page")),
                )
                self.db.execute("INSERT INTO lexical VALUES(?,?)", (cid, chunk["parent_text"]))
        return {"id": key, "version": version, "sha256": digest}

    def allowed_chunks(self, user, workspace):
        self.require(user, workspace)
        return [
            r[0]
            for r in self.db.execute(
                """SELECT c.id FROM chunks c
            JOIN documents d ON d.id=c.document JOIN workspaces w ON w.id=d.workspace
            WHERE d.workspace=? AND (w.owner=? OR EXISTS
              (SELECT 1 FROM readers r WHERE r.document=d.id AND r.user=?)) ORDER BY c.rowid""",
                (workspace, user, user),
            )
        ]

    def expand(self, user, workspace, ids):
        # Recheck after retrieval: revocation between candidate selection and expansion
        # must not release parent text. Never trust IDs returned by vector engines.
        allowed = set(self.allowed_chunks(user, workspace))
        output = []
        for cid in ids:
            if cid not in allowed:
                continue
            row = self.db.execute(
                "SELECT c.id AS chunk_id,c.document AS document_id,c.text,c.parent_text,c.page,d.name AS source,d.data_class FROM chunks c JOIN documents d ON d.id=c.document WHERE c.id=?",
                (cid,),
            ).fetchone()
            if row:
                output.append(dict(row))
        return output

    def lexical(self, user, workspace, query, k):
        self.require(user, workspace)
        words = re.findall(r"\w+", query, re.UNICODE)[:64]
        if not words:
            return []
        expression = " OR ".join('"' + word + '"' for word in words)
        # ACL predicate is in the SQL before ORDER BY/LIMIT, not applied to top-k.
        rows = self.db.execute(
            """SELECT lexical.id FROM lexical
            JOIN chunks c ON c.id=lexical.id JOIN documents d ON d.id=c.document
            JOIN workspaces w ON w.id=d.workspace
            WHERE lexical MATCH ? AND d.workspace=? AND (w.owner=? OR EXISTS
              (SELECT 1 FROM readers r WHERE r.document=d.id AND r.user=?))
            ORDER BY bm25(lexical),lexical.id LIMIT ?""",
            (expression, workspace, user, user, max(1, min(k, 100))),
        )
        return [r[0] for r in rows]
