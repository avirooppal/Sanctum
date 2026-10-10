#[cfg(target_os = "linux")]
#[test]
fn voice_priority_blocks_background_and_preserves_interactive_execution() {
    use sanctum_gateway::engine_admission::{acquire, wait_background_execution, wait_execution};
    use sanctum_inference::cancellation::Cancellation;
    use std::time::{Duration, Instant};
    let root = std::env::temp_dir().join(format!("sanctum-voice-priority-{}", std::process::id()));
    let voice = acquire(&root, "voice-priority", 1, false).unwrap();
    let foreground_started = Instant::now();
    let foreground = wait_execution(
        &root,
        "port-9200",
        &Cancellation::new(Instant::now() + Duration::from_secs(4)),
    )
    .unwrap();
    drop(foreground);
    assert!(foreground_started.elapsed() < Duration::from_secs(3));
    let started = Instant::now();
    assert!(wait_background_execution(
        &root,
        "port-9200",
        &Cancellation::new(started + Duration::from_millis(50))
    )
    .is_err());
    assert!(started.elapsed() < Duration::from_millis(250));
    drop(voice);
    assert!(wait_background_execution(
        &root,
        "port-9200",
        &Cancellation::new(Instant::now() + Duration::from_secs(1))
    )
    .is_ok());
    std::fs::remove_dir_all(root).unwrap();
}
