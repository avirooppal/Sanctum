use sanctum_gateway::{read_frame, write_frame, RequestEnvelope, MAX_FRAME};
use sanctum_policy::{close_extra_fds, install, local_stdio, self_test, unix_stream_fd};
use serde_json::json;
use std::error::Error;
use std::io::{self, Read, Write};
use std::os::fd::OwnedFd;
use std::os::unix::net::UnixStream;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

struct Reap(Child);
impl Drop for Reap {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

pub fn run() -> Result<(), Box<dyn Error>> {
    match std::env::args().nth(1).as_deref() {
        Some("--worker") => worker(),
        Some("check") => supervisor(),
        _ => Err("usage: sanctum-foundation check < envelope.json".into()),
    }
}

fn worker() -> Result<(), Box<dyn Error>> {
    unix_stream_fd(0)?;
    unix_stream_fd(1)?;
    close_extra_fds(3)?;
    install()?;
    let checks = self_test()?;
    let bytes = read_frame(&mut io::stdin().lock())?;
    let envelope: RequestEnvelope = serde_json::from_slice(&bytes)?;
    envelope.validate()?;
    write_frame(
        &mut io::stdout().lock(),
        &serde_json::to_vec(&json!({
            "schema_version": "1.0", "accepted": true,
            "trace_id": envelope.trace_id, "worker_checks": checks,
        }))?,
    )?;
    Ok(())
}

fn supervisor() -> Result<(), Box<dyn Error>> {
    local_stdio()?;
    close_extra_fds(3)?;
    let (mut parent, child) = UnixStream::pair()?;
    for stream in [&parent, &child] {
        stream.set_read_timeout(Some(Duration::from_secs(5)))?;
        stream.set_write_timeout(Some(Duration::from_secs(5)))?;
    }
    let mut child_process = Reap(
        Command::new(std::env::current_exe()?)
            .arg("--worker")
            .env_clear()
            .stdin(Stdio::from(OwnedFd::from(child.try_clone()?)))
            .stdout(Stdio::from(OwnedFd::from(child.try_clone()?)))
            .stderr(Stdio::null())
            .spawn()?,
    );
    drop(child);
    // Pair allocated after close_range, so the parent endpoint is descriptor 3.
    close_extra_fds(4)?;
    install()?;
    let checks = self_test()?;
    let mut input = Vec::new();
    io::stdin()
        .take(MAX_FRAME as u64 + 1)
        .read_to_end(&mut input)?;
    if input.len() > MAX_FRAME {
        return Err("request exceeds frame limit".into());
    }
    let envelope: RequestEnvelope = serde_json::from_slice(&input)?;
    envelope.validate()?;
    write_frame(&mut parent, &input)?;
    let response = read_frame(&mut parent)?;
    let mut response: serde_json::Value = serde_json::from_slice(&response)?;
    if response["trace_id"] != envelope.trace_id || response["accepted"] != true {
        return Err("worker response mismatch".into());
    }
    response["supervisor_checks"] = serde_json::to_value(checks)?;
    if !child_process.0.wait()?.success() {
        return Err("worker failed".into());
    }
    serde_json::to_writer(io::stdout().lock(), &response)?;
    io::stdout().write_all(b"\n")?;
    Ok(())
}
