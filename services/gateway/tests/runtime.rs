#![cfg(all(target_os = "linux", target_arch = "x86_64"))]
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::process::{Command, Stdio};

#[test]
fn host_can_read_health_from_isolated_gateway() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_sanctum-runtime"))
        .args(["--port", "0", "--once"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut line = String::new();
    BufReader::new(child.stdout.take().unwrap())
        .read_line(&mut line)
        .unwrap();
    if line.is_empty() {
        panic!("startup: {:?}", child.wait_with_output().unwrap());
    }
    let started: serde_json::Value = serde_json::from_str(&line).unwrap();
    let mut socket = TcpStream::connect(started["address"].as_str().unwrap()).unwrap();
    socket
        .set_read_timeout(Some(std::time::Duration::from_secs(10)))
        .unwrap();
    socket
        .write_all(b"GET /healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        .unwrap();
    let mut output = String::new();
    socket.read_to_string(&mut output).unwrap();
    assert!(output.starts_with("HTTP/1.1 200"), "{output}");
    let payload: serde_json::Value =
        serde_json::from_str(output.split("\r\n\r\n").nth(1).unwrap()).unwrap();
    assert_eq!(payload["isolation"], "linux-user-netns-seccomp");
    assert!(payload["checks"]
        .as_object()
        .unwrap()
        .values()
        .all(|v| v == "denied"));
    assert!(child.wait().unwrap().success());
}

#[test]
fn exec_child_rechecks_enforcement() {
    let output = Command::new(env!("CARGO_BIN_EXE_sanctum-runtime"))
        .args(["--test-child", "--port", "0"])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let checks: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert!(checks.as_object().unwrap().len() >= 8);
}

#[test]
fn child_probe_refuses_host_network() {
    let output = Command::new(env!("CARGO_BIN_EXE_sanctum-runtime"))
        .arg("--probe-child")
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
}
