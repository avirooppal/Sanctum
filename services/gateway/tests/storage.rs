use sanctum_gateway::storage::Store;
use serde_json::json;

#[test]
fn owner_isolation_and_roundtrip() {
    let store = Store::memory().unwrap();
    store
        .save(
            "owner-a",
            "thread1",
            &json!({"messages":[]}),
            "reply",
            false,
        )
        .unwrap();
    assert_eq!(store.turns("owner-a", "thread1").unwrap().len(), 1);
    assert!(store.turns("owner-b", "thread1").unwrap().is_empty());
    assert!(store.conversations("owner-b").unwrap().is_empty());
    assert!(store
        .save("owner-b", "thread1", &json!({}), "leak", false)
        .is_err());
}

#[test]
fn queries_do_not_interpolate_ids() {
    let store = Store::memory().unwrap();
    store
        .save("owner", "' OR 1=1 --", &json!({}), "safe", false)
        .unwrap();
    assert!(store.turns("stranger", "' OR 1=1 --").unwrap().is_empty());
}
