import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_knowledge.store import Catalog


class AclTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Catalog(Path(self.tmp.name) / "catalog.sqlite3")
        self.a = self.store.workspace("alice", "A")
        self.b = self.store.workspace("bob", "B")

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_cross_workspace_and_membership_are_denied(self):
        with self.assertRaises(PermissionError):
            self.store.allowed_chunks("bob", self.a)
        with self.assertRaises(PermissionError):
            self.store.add_member("bob", self.a, "bob")
        self.assertEqual([w["id"] for w in self.store.workspaces("bob")], [self.b])

    def test_document_acl_and_revocation_apply_before_candidates(self):
        self.store.add_member("alice", self.a, "bob")
        doc = self.store.put(
            "alice",
            self.a,
            "secret.md",
            "a" * 64,
            [],
            "restricted",
            [{"text": "secret password", "parent_text": "secret password", "page": 1}],
        )
        self.assertEqual(self.store.allowed_chunks("bob", self.a), [])
        self.assertEqual(self.store.lexical("bob", self.a, "password", 5), [])
        self.store.set_readers("alice", self.a, doc["id"], ["bob"])
        self.assertEqual(len(self.store.allowed_chunks("bob", self.a)), 1)
        self.assertEqual(len(self.store.lexical("bob", self.a, "password", 5)), 1)
        self.store.set_readers("alice", self.a, doc["id"], [])
        self.assertEqual(self.store.allowed_chunks("bob", self.a), [])

    def test_nonmember_readers_and_sql_injection(self):
        with self.assertRaises(PermissionError):
            self.store.put("alice", self.a, "x.md", "a" * 64, ["outsider"], "internal", [])
        with self.assertRaises((ValueError, PermissionError)):
            self.store.allowed_chunks("alice", "' OR 1=1 --")
        self.assertEqual(self.store.lexical("alice", self.a, '" OR * --', 5), [])

    def test_dedup_version_and_parent_expansion_acl(self):
        chunk = {"text": "first", "parent_text": "section first", "page": 2}
        a = self.store.put("alice", self.a, "x.md", "a" * 64, [], "internal", [chunk])
        b = self.store.put("alice", self.a, "x.md", "a" * 64, [], "internal", [chunk])
        self.assertEqual(a, b)
        old = self.store.allowed_chunks("alice", self.a)
        c = self.store.put(
            "alice", self.a, "x.md", "b" * 64, [], "internal", [dict(chunk, text="second")]
        )
        self.assertEqual(c["version"], 2)
        self.assertEqual(c["id"], a["id"])
        self.assertEqual(self.store.expand("alice", self.a, old), [])


if __name__ == "__main__":
    unittest.main()
