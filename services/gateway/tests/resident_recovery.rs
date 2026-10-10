#[cfg(target_os = "linux")]
#[test]
fn resident_restart_budget_is_bounded_and_shutdown_interrupts_backoff() {
    use sanctum_gateway::supervision::run_resident;
    use std::{
        process::Command,
        sync::atomic::{AtomicBool, Ordering},
        time::{Duration, Instant},
    };
    let stop = AtomicBool::new(false);
    let mut launches = 0;
    let started = Instant::now();
    let result = run_resident(
        || {
            launches += 1;
            let mut c = Command::new("/bin/sh");
            c.args(["-c", "exit 1"]);
            c
        },
        &stop,
    );
    assert!(result.is_err());
    assert_eq!(launches, 4);
    assert!(started.elapsed() < Duration::from_secs(4));
    let mut launches = 0;
    let result = run_resident(
        || {
            launches += 1;
            stop.store(true, Ordering::Release);
            let mut c = Command::new("/bin/sh");
            c.args(["-c", "sleep 30"]);
            c
        },
        &stop,
    );
    assert!(result.is_ok());
    assert_eq!(launches, 1);
}
