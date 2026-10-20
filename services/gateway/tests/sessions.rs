use sanctum_gateway::storage::{SessionRequest, Store};
use serde_json::json;

fn command(value: serde_json::Value) -> SessionRequest {
    serde_json::from_value(value).unwrap()
}

#[test]
fn populated_history_search_fits_existing_metadata_deadline() {
    let path = std::env::temp_dir().join(format!(
        "sanctum-search-{}-{}.sqlite",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    {
        let db = rusqlite::Connection::open(&path).unwrap();
        db.execute_batch(
            "CREATE TABLE conversations(id TEXT PRIMARY KEY, owner TEXT NOT NULL);
             CREATE TABLE turns(id INTEGER PRIMARY KEY, conversation TEXT NOT NULL
             REFERENCES conversations(id), request TEXT NOT NULL, response TEXT NOT NULL,
             streaming INTEGER NOT NULL);
             BEGIN;
             WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<4000)
             INSERT INTO conversations SELECT 'history-'||x,'owner' FROM n;
             INSERT INTO turns(conversation,request,response,streaming)
             SELECT id,'{\"prompt\":\"'||printf('%04000d',0)||'\"}','preserved answer',0
             FROM conversations;
             COMMIT;",
        )
        .unwrap();
    }
    for _ in 0..2 {
        let mut store = Store::open(&path).unwrap();
        let started = std::time::Instant::now();
        let result = store
            .sessions(
                "owner",
                command(json!({"operation":"list","query":"absent-needle","offset":0})),
            )
            .unwrap();
        assert_eq!(result["data"], json!([]));
        assert!(
            started.elapsed() < std::time::Duration::from_secs(10),
            "history search exceeded existing 10-second metadata deadline: {:?}",
            started.elapsed()
        );
        assert_eq!(
            store.turns("owner", "history-1").unwrap()[0]["response"],
            "preserved answer"
        );
    }
    std::fs::remove_file(path).unwrap();
}

#[test]
fn session_search_rename_and_owner_boundaries() {
    let mut store = Store::memory().unwrap();
    store.save("a", "id1", &json!({}), "answer", false).unwrap();
    assert_eq!(
        store
            .sessions(
                "b",
                command(json!({"operation":"rename","id":"id1","title":"Hidden"}))
            )
            .unwrap()["changed"],
        false
    );
    assert_eq!(
        store
            .sessions(
                "a",
                command(json!({"operation":"rename","id":"id1","title":"  Research  "}))
            )
            .unwrap()["changed"],
        true
    );
    let found = store
        .sessions(
            "a",
            command(json!({"operation":"list","query":"research","offset":0})),
        )
        .unwrap();
    assert_eq!(found["data"][0]["title"], "Research");
    assert_eq!(
        store
            .sessions(
                "b",
                command(json!({"operation":"list","query":"","offset":0}))
            )
            .unwrap()["data"],
        json!([])
    );
    assert!(store
        .sessions(
            "a",
            command(json!({"operation":"rename","id":"id1","title":"\n"}))
        )
        .is_err());
    assert!(serde_json::from_value::<SessionRequest>(
        json!({"operation":"delete","id":"id1","owner":"a"})
    )
    .is_err());
}

#[test]
fn delete_is_atomic_and_late_save_cannot_resurrect() {
    let mut store = Store::memory().unwrap();
    store.save("a", "id1", &json!({}), "answer", false).unwrap();
    assert_eq!(
        store
            .sessions("b", command(json!({"operation":"delete","id":"id1"})))
            .unwrap()["changed"],
        false
    );
    assert_eq!(store.turns("a", "id1").unwrap().len(), 1);
    assert_eq!(
        store
            .sessions("a", command(json!({"operation":"delete","id":"id1"})))
            .unwrap()["changed"],
        true
    );
    assert!(store.turns("a", "id1").unwrap().is_empty());
    assert!(store.conversations("a").unwrap().is_empty());
    assert!(store
        .save("a", "id1", &json!({}), "late answer", false)
        .is_err());
}

#[test]
fn migration_preserves_populated_data_and_is_idempotent() {
    let path = std::env::temp_dir().join(format!(
        "sanctum-migration-{}-{}.sqlite",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    {
        let db = rusqlite::Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE conversations(id TEXT PRIMARY KEY,owner TEXT NOT NULL);CREATE TABLE turns(id INTEGER PRIMARY KEY,conversation TEXT NOT NULL REFERENCES conversations(id),request TEXT NOT NULL,response TEXT NOT NULL,streaming INTEGER NOT NULL);INSERT INTO conversations VALUES('old','a');INSERT INTO turns VALUES(1,'old','{}','kept',0);").unwrap();
    }
    for _ in 0..2 {
        let mut store = Store::open(&path).unwrap();
        assert_eq!(store.turns("a", "old").unwrap()[0]["response"], "kept");
        store
            .sessions(
                "a",
                command(json!({"operation":"rename","id":"old","title":"Preserved"})),
            )
            .unwrap();
    }
    let mut store = Store::open(&path).unwrap();
    assert_eq!(
        store
            .sessions(
                "a",
                command(json!({"operation":"list","query":"Preserved","offset":0}))
            )
            .unwrap()["data"][0]["id"],
        "old"
    );
    drop(store);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn listing_is_bounded_and_paginated() {
    let mut store = Store::memory().unwrap();
    for i in 0..102 {
        store
            .save("a", &format!("id{i}"), &json!({}), "x", false)
            .unwrap();
    }
    let first = store
        .sessions(
            "a",
            command(json!({"operation":"list","query":"","offset":0})),
        )
        .unwrap();
    assert_eq!(first["data"].as_array().unwrap().len(), 100);
    assert_eq!(first["has_more"], true);
    let next = store
        .sessions(
            "a",
            command(json!({"operation":"list","query":"","offset":100})),
        )
        .unwrap();
    assert_eq!(next["data"].as_array().unwrap().len(), 2);
    assert_eq!(next["has_more"], false);
}

#[test]
fn rejects_invalid_bounds_without_modifying_history() {
    let mut store = Store::memory().unwrap();
    store.save("a", "safe", &json!({}), "kept", false).unwrap();
    for value in [
        json!({"operation":"list","query":"x".repeat(121),"offset":0}),
        json!({"operation":"list","query":"","offset":1000001}),
        json!({"operation":"rename","id":"safe","title":"x".repeat(121)}),
        json!({"operation":"rename","id":"safe","title":"bad\u{0000}title"}),
        json!({"operation":"delete","id":"../safe"}),
    ] {
        assert!(store.sessions("a", command(value)).is_err());
    }
    assert_eq!(store.turns("a", "safe").unwrap()[0]["response"], "kept");
}

#[test]
fn session_pin_unpin_and_message_content_search() {
    let mut store = Store::memory().unwrap();
    store
        .save(
            "owner1",
            "s1",
            &json!({"text":"first query"}),
            "first answer about quantum computing",
            false,
        )
        .unwrap();
    store
        .save(
            "owner1",
            "s2",
            &json!({"text":"second query"}),
            "second answer about cellular biology",
            false,
        )
        .unwrap();

    // Verify initial list (ordered by rowid DESC: s2 then s1)
    let initial = store
        .sessions(
            "owner1",
            command(json!({"operation":"list","query":"","offset":0})),
        )
        .unwrap();
    assert_eq!(initial["data"][0]["id"], "s2");
    assert_eq!(initial["data"][0]["pinned"], false);
    assert_eq!(initial["data"][1]["id"], "s1");
    assert_eq!(initial["data"][1]["pinned"], false);

    // Pin s1
    let pin_res = store
        .sessions(
            "owner1",
            command(json!({"operation":"pin","id":"s1","pinned":true})),
        )
        .unwrap();
    assert_eq!(pin_res["changed"], true);

    // Verify pinned session comes first
    let after_pin = store
        .sessions(
            "owner1",
            command(json!({"operation":"list","query":"","offset":0})),
        )
        .unwrap();
    assert_eq!(after_pin["data"][0]["id"], "s1");
    assert_eq!(after_pin["data"][0]["pinned"], true);
    assert_eq!(after_pin["data"][1]["id"], "s2");
    assert_eq!(after_pin["data"][1]["pinned"], false);

    // Server-side full-text search across turn content ("quantum" in s1)
    let search_res = store
        .sessions(
            "owner1",
            command(json!({"operation":"list","query":"quantum","offset":0})),
        )
        .unwrap();
    assert_eq!(search_res["data"].as_array().unwrap().len(), 1);
    assert_eq!(search_res["data"][0]["id"], "s1");

    // Unpin s1
    let unpin_res = store
        .sessions(
            "owner1",
            command(json!({"operation":"pin","id":"s1","pinned":false})),
        )
        .unwrap();
    assert_eq!(unpin_res["changed"], true);
    let after_unpin = store
        .sessions(
            "owner1",
            command(json!({"operation":"list","query":"","offset":0})),
        )
        .unwrap();
    assert_eq!(after_unpin["data"][0]["pinned"], false);
}

#[test]
fn conversation_token_usage_accounting() {
    let store = Store::memory().unwrap();
    // Nonexistent conversation returns has_data: false
    let missing = store
        .conversation_usage("owner", "nonexistent", 2048)
        .unwrap();
    assert_eq!(missing["has_data"], false);
    assert_eq!(missing["total_tokens"], 0);
    assert_eq!(missing["context_length"], 2048);

    // Save turn with real usage payload
    let turn_payload = json!({
        "choices": [{"message": {"role": "assistant", "content": "hello"}}],
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 8,
            "total_tokens": 20
        }
    });
    store
        .save(
            "owner",
            "c1",
            &json!({"role": "user"}),
            &turn_payload.to_string(),
            false,
        )
        .unwrap();

    let usage = store.conversation_usage("owner", "c1", 4096).unwrap();
    assert_eq!(usage["has_data"], true);
    assert_eq!(usage["prompt_tokens"], 12);
    assert_eq!(usage["completion_tokens"], 8);
    assert_eq!(usage["total_tokens"], 20);
    assert_eq!(usage["context_length"], 4096);
}

#[test]
fn assistant_profiles_crud() {
    let store = Store::memory().unwrap();
    let initial = store.profiles("owner").unwrap();
    assert_eq!(initial.len(), 0);

    // Save profile
    store
        .save_profile(
            "owner",
            "p1",
            "Research Assistant",
            "You are a rigorous researcher.",
            "global",
        )
        .unwrap();

    let profiles = store.profiles("owner").unwrap();
    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0]["id"], "p1");
    assert_eq!(profiles[0]["name"], "Research Assistant");
    assert_eq!(
        profiles[0]["system_prompt"],
        "You are a rigorous researcher."
    );
    assert_eq!(profiles[0]["scope"], "global");

    // Update profile
    store
        .save_profile(
            "owner",
            "p1",
            "Updated Researcher",
            "You are an updated assistant.",
            "session",
        )
        .unwrap();
    let updated = store.profiles("owner").unwrap();
    assert_eq!(updated.len(), 1);
    assert_eq!(updated[0]["name"], "Updated Researcher");
    assert_eq!(updated[0]["scope"], "session");

    // Delete profile
    let deleted = store.delete_profile("owner", "p1").unwrap();
    assert!(deleted);
    let after_delete = store.profiles("owner").unwrap();
    assert_eq!(after_delete.len(), 0);
}

#[test]
fn full_purge_wipes_all_data_and_preferences() {
    let mut store = Store::memory().unwrap();

    // Populate conversations, turns, preferences, pins, and profiles
    store
        .save(
            "owner",
            "c1",
            &json!({"prompt": "test"}),
            "{\"response\": \"ok\"}",
            false,
        )
        .unwrap();
    store
        .save_preferences("owner", "{\"theme\": \"dark\"}")
        .unwrap();
    store
        .sessions(
            "owner",
            command(json!({"operation": "pin", "id": "c1", "pinned": true})),
        )
        .unwrap();
    store
        .save_profile("owner", "p1", "Profile 1", "System prompt", "global")
        .unwrap();

    assert_eq!(store.conversations("owner").unwrap().len(), 1);
    assert!(store.preferences("owner").unwrap().is_some());
    assert_eq!(store.profiles("owner").unwrap().len(), 1);

    // Run Full Purge
    store.purge_all("owner").unwrap();

    // Verify EVERYTHING is gone
    assert_eq!(store.conversations("owner").unwrap().len(), 0);
    assert_eq!(store.turns("owner", "c1").unwrap().len(), 0);
    assert!(store.preferences("owner").unwrap().is_none());
    assert_eq!(store.profiles("owner").unwrap().len(), 0);
    let sessions = store
        .sessions(
            "owner",
            command(json!({"operation": "list", "query": "", "offset": 0})),
        )
        .unwrap();
    assert_eq!(sessions["data"].as_array().unwrap().len(), 0);
}
