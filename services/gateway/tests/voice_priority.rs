#[cfg(target_os = "linux")]
#[test]
fn queued_engine_time_does_not_consume_later_voice_deferral() {
    use sanctum_gateway::engine_admission::{acquire, wait_execution};
    use sanctum_inference::cancellation::Cancellation;
    use std::{
        sync::mpsc,
        time::{Duration, Instant},
    };
    let root = std::env::temp_dir().join(format!("sanctum-voice-queued-{}", std::process::id()));
    let execution = acquire(&root, "execute-port-9201", 1, false).unwrap();
    let (started, ready) = mpsc::channel();
    let other = root.clone();
    let waiter = std::thread::spawn(move || {
        started.send(()).unwrap();
        let lease = wait_execution(
            &other,
            "port-9201",
            &Cancellation::new(Instant::now() + Duration::from_secs(5)),
        )
        .unwrap();
        drop(lease);
        Instant::now()
    });
    ready.recv().unwrap();
    std::thread::sleep(Duration::from_millis(700));
    let voice = acquire(&root, "voice-priority", 1, false).unwrap();
    let voice_started = Instant::now();
    drop(execution);
    let finished = waiter.join().unwrap();
    let protected = finished.duration_since(voice_started);
    assert!(protected >= Duration::from_millis(2400), "{protected:?}");
    assert!(protected < Duration::from_secs(3), "{protected:?}");
    drop(voice);
    std::fs::remove_dir_all(root).unwrap();
}

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
