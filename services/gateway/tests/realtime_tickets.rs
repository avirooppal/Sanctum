use sanctum_gateway::realtime_tickets::Tickets;
use std::time::{Duration, Instant};

#[test]
fn bound_single_use_and_expiry() {
    let now = Instant::now();
    let store = Tickets::default();
    assert!(store.issue(&[1; 32], "http://127.0.0.1:8769", now));
    assert!(!store.consume(&[1; 32], "http://127.0.0.1:9999", now));
    assert!(!store.consume(&[1; 32], "http://127.0.0.1:8769", now));
    assert!(store.issue(&[2; 32], "http://127.0.0.1:8769", now));
    assert!(store.consume(&[2; 32], "http://127.0.0.1:8769", now));
    assert!(!store.consume(&[2; 32], "http://127.0.0.1:8769", now));
    assert!(store.issue(&[3; 32], "http://127.0.0.1:8769", now));
    assert!(!store.consume(
        &[3; 32],
        "http://127.0.0.1:8769",
        now + Duration::from_secs(30)
    ));
}

#[test]
fn bounded_store_and_invalid_origins() {
    let now = Instant::now();
    let store = Tickets::default();
    for origin in [
        "null",
        "https://example.com",
        "http://127.0.0.1:8769/",
        "http://localhost:0",
        "http://localhost:08769",
    ] {
        assert!(!store.issue(&[99; 32], origin, now));
    }
    for n in 0..32 {
        assert!(store.issue(&[n; 32], "http://localhost:8769", now));
    }
    assert!(!store.issue(&[40; 32], "http://localhost:8769", now));
    assert!(store.issue(
        &[40; 32],
        "http://localhost:8769",
        now + Duration::from_secs(30)
    ));
}

#[test]
fn concurrent_consumers_get_one_success() {
    let store = std::sync::Arc::new(Tickets::default());
    let now = Instant::now();
    assert!(store.issue(&[4; 32], "http://localhost:8769", now));
    let workers: Vec<_> = (0..16)
        .map(|_| {
            let store = store.clone();
            std::thread::spawn(move || store.consume(&[4; 32], "http://localhost:8769", now))
        })
        .collect();
    assert_eq!(
        workers
            .into_iter()
            .filter_map(|w| w.join().ok())
            .filter(|ok| *ok)
            .count(),
        1
    );
}
