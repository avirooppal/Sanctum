#[cfg(target_os = "linux")]
#[test]
fn delivery_windows_reject_trickles_without_charging_generation_pauses() {
    use sanctum_gateway::response_flow::Budget;
    use std::time::Duration;
    let mut budget = Budget::default();
    assert!(budget.advance(Duration::from_secs(2), 4096).is_ok());
    assert!(budget.advance(Duration::from_secs(2), 8).is_err());
    let mut budget = Budget::default();
    for _ in 0..100 {
        assert!(budget.advance(Duration::from_millis(1), 1).is_ok());
    }
}

#[cfg(target_os = "linux")]
#[test]
fn pending_socket_write_honors_idle_and_context_deadlines() {
    use sanctum_gateway::response_flow::{write_response, Budget};
    use sanctum_inference::cancellation::Cancellation;
    use std::{
        net::{TcpListener, TcpStream},
        sync::atomic::AtomicBool,
        time::{Duration, Instant},
    };
    for deadline in [Duration::from_millis(100), Duration::from_secs(5)] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let _client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (mut server, _) = listener.accept().unwrap();
        let started = Instant::now();
        let context = Cancellation::new(started + deadline);
        let result = write_response(
            &mut server,
            &vec![42; 16 * 1024 * 1024],
            &context,
            &AtomicBool::new(false),
            &mut Budget::default(),
        );
        assert!(result.is_err());
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(context.check().is_err());
    }
}
