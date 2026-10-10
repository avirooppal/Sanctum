#![cfg(all(target_os = "linux", target_arch = "x86_64"))]
use sanctum_gateway::cancellable_io::ContextIo;
use sanctum_inference::cancellation::{Cancellation, Reason};
use std::{
    io::{Read, Write},
    os::unix::net::UnixStream,
    time::{Duration, Instant},
};

#[test]
fn stalled_read_honors_explicit_cancel_without_a_detached_worker() {
    let (stream, _held) = UnixStream::pair().unwrap();
    let context = Cancellation::new(Instant::now() + Duration::from_secs(2));
    let mut reader = ContextIo::new(stream, context.clone()).unwrap();
    let canceller = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(30));
        context.cancel(Reason::Explicit);
    });
    let start = Instant::now();
    assert_eq!(
        reader.read(&mut [0; 1]).unwrap_err().kind(),
        std::io::ErrorKind::ConnectionAborted
    );
    canceller.join().unwrap();
    assert!(start.elapsed() < Duration::from_millis(250));
}

#[test]
fn slow_reader_cannot_pin_a_blocked_write_past_deadline() {
    let (stream, _held) = UnixStream::pair().unwrap();
    let context = Cancellation::new(Instant::now() + Duration::from_millis(50));
    let mut writer = ContextIo::new(stream, context).unwrap();
    let start = Instant::now();
    assert!(writer.write_all(&vec![0; 8 * 1024 * 1024]).is_err());
    assert!(start.elapsed() < Duration::from_millis(250));
}

#[test]
fn buffered_partial_frame_survives_polling_without_data_loss() {
    use std::io::{BufRead, BufReader};
    let (stream, mut peer) = UnixStream::pair().unwrap();
    let context = Cancellation::new(Instant::now() + Duration::from_secs(2));
    let mut reader = BufReader::new(ContextIo::new(stream, context).unwrap());
    let sender = std::thread::spawn(move || {
        peer.write_all(b"par").unwrap();
        std::thread::sleep(Duration::from_millis(30));
        peer.write_all(b"tial\n").unwrap();
    });
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    sender.join().unwrap();
    assert_eq!(line, "partial\n");
}
