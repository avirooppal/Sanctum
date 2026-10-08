#![cfg(all(target_os = "linux", target_arch = "x86_64"))]
use std::io::Write;
use std::process::{Command, Stdio};

fn check(input: &[u8]) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_sanctum-foundation"))
        .arg("check")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(input).unwrap();
    child.wait_with_output().unwrap()
}

#[test]
fn two_processes_deny_egress_and_exchange_envelope() {
    let cases: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/contracts/envelope-fixtures.json"
    ))
    .unwrap();
    let output = check(&serde_json::to_vec(&cases[0]["value"]).unwrap());
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["trace_id"], cases[0]["value"]["trace_id"]);
    for role in ["worker_checks", "supervisor_checks"] {
        let checks = response[role].as_object().unwrap();
        assert_eq!(checks.len(), 11);
        assert!(checks.values().all(|value| value == "denied"));
    }
}

#[test]
fn invalid_envelopes_never_receive_acceptance() {
    let cases: serde_json::Value = serde_json::from_str(include_str!(
        "../../../docs/contracts/envelope-fixtures.json"
    ))
    .unwrap();
    for case in cases.as_array().unwrap().iter().skip(1) {
        let output = check(&serde_json::to_vec(&case["value"]).unwrap());
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
    }
    assert!(!check(b"not json").status.success());
}

#[test]
fn direct_worker_with_pipe_is_refused() {
    let result = Command::new(env!("CARGO_BIN_EXE_sanctum-foundation"))
        .arg("--worker")
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(!result.status.success());
    assert!(result.stdout.is_empty());
}

#[test]
fn supervisor_refuses_inherited_stdio_socket() {
    use std::os::fd::OwnedFd;
    use std::os::unix::net::UnixStream;
    let (_peer, socket) = UnixStream::pair().unwrap();
    let result = Command::new(env!("CARGO_BIN_EXE_sanctum-foundation"))
        .arg("check")
        .stdin(Stdio::from(OwnedFd::from(socket)))
        .output()
        .unwrap();
    assert!(!result.status.success());
    assert!(result.stdout.is_empty());
}

#[test]
fn oversized_stdin_is_rejected() {
    let result = check(&vec![b'x'; sanctum_gateway::MAX_FRAME + 1]);
    assert!(!result.status.success());
    assert!(result.stdout.is_empty());
}

#[test]
fn worker_rejects_oversized_ipc_frame() {
    use std::io::Read;
    use std::os::fd::OwnedFd;
    use std::os::unix::net::UnixStream;
    use std::time::Duration;
    let (mut peer, socket) = UnixStream::pair().unwrap();
    peer.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_sanctum-foundation"))
        .arg("--worker")
        .stdin(Stdio::from(OwnedFd::from(socket.try_clone().unwrap())))
        .stdout(Stdio::from(OwnedFd::from(socket)))
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    peer.write_all(&u32::MAX.to_be_bytes()).unwrap();
    let mut output = Vec::new();
    peer.read_to_end(&mut output).unwrap();
    assert!(output.is_empty());
    assert!(!child.wait().unwrap().success());
}
