//! Trusted-worker process groups; the guardian stays alive to reap descendants.
use std::{
    io,
    os::unix::process::CommandExt,
    process::{Child, Command, ExitStatus},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

fn signal(group: i32, number: i32) {
    // SAFETY: positive PID of an owned process-group leader, never caller's group.
    unsafe {
        libc::kill(-group, number);
    }
}
fn alive(group: i32) -> bool {
    // SAFETY: signal zero only observes this owned process group.
    unsafe { libc::kill(-group, 0) == 0 }
}
fn reap(group: i32) {
    let mut status = 0;
    // SAFETY: valid status pointer; only adopted children in this owned group.
    while unsafe { libc::waitpid(-group, &mut status, libc::WNOHANG) } > 0 {}
}
pub fn run(command: &mut Command, stop: &AtomicBool) -> io::Result<ExitStatus> {
    // SAFETY: enables adoption of descendants solely within this guardian process.
    if unsafe { libc::prctl(libc::PR_SET_CHILD_SUBREAPER, 1) } != 0 {
        return Err(io::Error::last_os_error());
    }
    let guardian = std::process::id() as i32;
    command.process_group(0);
    // SAFETY: child hook calls only async-signal-safe syscalls and constructs errors.
    unsafe {
        command.pre_exec(move || {
            if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL) != 0 {
                return Err(io::Error::last_os_error());
            }
            if libc::getppid() != guardian {
                return Err(io::Error::from_raw_os_error(libc::ESRCH));
            }
            Ok(())
        });
    }
    let mut child = command.spawn()?;
    let group = child.id() as i32;
    let mut status = loop {
        let status = child.try_wait()?;
        if status.is_some() || stop.load(Ordering::Acquire) {
            break status;
        }
        thread::sleep(Duration::from_millis(10));
    };
    for (number, grace) in [
        (libc::SIGINT, 100),
        (libc::SIGTERM, 400),
        (libc::SIGKILL, 500),
    ] {
        signal(group, number);
        let until = Instant::now() + Duration::from_millis(grace);
        loop {
            if status.is_none() {
                status = child.try_wait()?;
            }
            if let Some(status) = status {
                reap(group);
                if !alive(group) {
                    return Ok(status);
                }
            }
            if Instant::now() >= until {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
    }
    Err(io::Error::new(
        io::ErrorKind::TimedOut,
        "worker group failed to reap after SIGKILL",
    ))
}

/// Signal the guardian, allowing it to clean its owned worker group before exit.
pub fn terminate(child: &mut Child) -> io::Result<()> {
    if child.try_wait()?.is_some() {
        return Ok(());
    }
    // SAFETY: PID of our live child guardian; not a caller-supplied process ID.
    unsafe {
        libc::kill(child.id() as i32, libc::SIGTERM);
    }
    let until = Instant::now() + Duration::from_millis(1250);
    while Instant::now() < until {
        if child.try_wait()?.is_some() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(10));
    }
    // An unhealthy guardian is a failure, not successful cleanup evidence.
    child.kill()?;
    child.wait()?;
    Err(io::Error::new(
        io::ErrorKind::TimedOut,
        "guardian failed its cleanup deadline",
    ))
}
