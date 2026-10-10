#[test]
fn stalled_health_probe_has_a_short_deadline() {
    use sanctum_inference::{Engine, LocalEngine};
    use std::{
        net::TcpListener,
        time::{Duration, Instant},
    };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let server = std::thread::spawn(move || {
        let (_stream, _) = listener.accept().unwrap();
        std::thread::sleep(Duration::from_millis(600));
    });
    let engine = LocalEngine::new(&format!("http://{address}")).unwrap();
    let started = Instant::now();
    assert!(!engine.healthy());
    assert!(started.elapsed() < Duration::from_millis(500));
    server.join().unwrap();
}
