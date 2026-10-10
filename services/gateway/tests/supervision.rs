#![cfg(all(target_os = "linux", target_arch = "x86_64"))]
use sanctum_gateway::supervision;
use std::{
    fs,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

#[test]
fn cancels_and_reaps_uncooperative_worker_and_grandchild() {
    let path = std::env::temp_dir().join(format!("sanctum-supervision-{}.txt", std::process::id()));
    let output = fs::File::create(&path).unwrap();
    let stop = Arc::new(AtomicBool::new(false));
    let child_stop = stop.clone();
    let thread = std::thread::spawn(move || {
        let mut command = Command::new("/bin/sh");
        command
            .args(["-c", "trap '' INT TERM; sleep 60 & echo $$ $!; wait"])
            .stdout(Stdio::from(output));
        supervision::run(&mut command, &child_stop).unwrap()
    });
    let until = Instant::now() + Duration::from_secs(3);
    let pids = loop {
        let text = fs::read_to_string(&path).unwrap();
        let pids: Vec<i32> = text
            .split_whitespace()
            .map(|v| v.parse().unwrap())
            .collect();
        if pids.len() == 2 {
            break pids;
        }
        assert!(Instant::now() < until, "worker did not start");
        std::thread::sleep(Duration::from_millis(5));
    };
    let started = Instant::now();
    stop.store(true, Ordering::Release);
    assert!(!thread.join().unwrap().success());
    assert!(started.elapsed() < Duration::from_secs(2));
    for pid in pids {
        assert!(
            !std::path::Path::new(&format!("/proc/{pid}")).exists(),
            "process {pid} survived or is a zombie"
        );
    }
    fs::remove_file(path).unwrap();
}
