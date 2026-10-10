#[cfg(target_os = "linux")]
#[test]
fn bounded_execution_wait_observes_deadline_without_losing_admission() {
    use sanctum_gateway::engine_admission::{acquire, wait_execution};
    use sanctum_inference::cancellation::Cancellation;
    use std::time::{Duration, Instant};
    let root = std::env::temp_dir().join(format!("sanctum-execution-{}", std::process::id()));
    let held = acquire(&root, "execute-port-9100", 1, false).unwrap();
    let started = Instant::now();
    let context = Cancellation::new(started + Duration::from_millis(50));
    assert!(wait_execution(&root, "port-9100", &context).is_err());
    assert!(started.elapsed() < Duration::from_millis(250));
    drop(held);
    let context = Cancellation::new(Instant::now() + Duration::from_secs(1));
    assert!(wait_execution(&root, "port-9100", &context).is_ok());
    std::fs::remove_dir_all(root).unwrap();
}
