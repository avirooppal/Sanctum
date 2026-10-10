use sanctum_inference::cancellation::{Cancellation, Reason};
use std::time::{Duration, Instant};

#[test]
fn clones_share_first_terminal_reason() {
    let context = Cancellation::new(Instant::now() + Duration::from_secs(1));
    let other = context.clone();
    assert!(context.check().is_ok());
    other.cancel(Reason::Disconnect);
    context.cancel(Reason::Shutdown);
    assert_eq!(context.check(), Err(Reason::Disconnect));
    assert_eq!(other.remaining(), Duration::ZERO);
}

#[test]
fn deadline_expires_without_a_background_timer() {
    let context = Cancellation::new(Instant::now());
    assert_eq!(context.check(), Err(Reason::Deadline));
    context.cancel(Reason::Explicit);
    assert_eq!(context.check(), Err(Reason::Deadline));
}

#[test]
fn concurrent_cancellation_is_irreversible() {
    let context = Cancellation::new(Instant::now() + Duration::from_secs(10));
    let threads: Vec<_> = (0..16)
        .map(|_| {
            let context = context.clone();
            std::thread::spawn(move || context.cancel(Reason::Explicit))
        })
        .collect();
    for thread in threads {
        thread.join().unwrap();
    }
    assert_eq!(context.check(), Err(Reason::Explicit));
}

#[test]
fn additive_engine_interface_preserves_legacy_calls_but_rejects_cancelled_work() {
    use sanctum_inference::{Engine, Reply};
    struct Legacy;
    impl Engine for Legacy {
        fn send(&self, _: &str, _: &serde_json::Value) -> Result<Reply, String> {
            Ok(Reply {
                status: 200,
                content_type: "application/json".into(),
                body: Box::new(std::io::Cursor::new(b"{}".to_vec())),
            })
        }
        fn healthy(&self) -> bool {
            true
        }
    }
    let context = Cancellation::new(Instant::now() + Duration::from_secs(1));
    assert_eq!(
        Legacy
            .send_with_context("/v1/embeddings", &serde_json::json!({}), &context)
            .unwrap()
            .status,
        200
    );
    context.cancel(Reason::Explicit);
    assert!(Legacy
        .send_with_context("/v1/embeddings", &serde_json::json!({}), &context)
        .is_err());
    assert!(Legacy
        .send("/v1/embeddings", &serde_json::json!({}))
        .is_ok());
}
