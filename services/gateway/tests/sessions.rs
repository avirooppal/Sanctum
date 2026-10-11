use sanctum_gateway::storage::{SessionRequest, Store};
use serde_json::json;

fn command(value: serde_json::Value) -> SessionRequest {
    serde_json::from_value(value).unwrap()
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
