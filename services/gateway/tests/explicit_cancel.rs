#[cfg(target_os = "linux")]
#[test]
fn explicit_control_cancels_engine_work_and_preserves_health() {
    use sanctum_gateway::ingress::Ingress;
    use sanctum_inference::cancellation::Reason;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream},
    };
    let backend = TcpListener::bind("127.0.0.1:0").unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let ingress = Ingress::start(listener, backend.local_addr().unwrap()).unwrap();
    let mut health = TcpStream::connect(address).unwrap();
    health
        .write_all(b"GET /healthz HTTP/1.1\r\nHost: local\r\n\r\n")
        .unwrap();
    let (mut health_upstream, health_peer) = backend.accept().unwrap();
    health_upstream.read_exact(&mut [0u8; 1]).unwrap();
    let mut engine = TcpStream::connect(address).unwrap();
    engine
        .write_all(b"POST /v1/chat/completions HTTP/1.1\r\nContent-Length: 2\r\n\r\n{}")
        .unwrap();
    let (mut engine_upstream, engine_peer) = backend.accept().unwrap();
    engine_upstream.read_exact(&mut [0u8; 1]).unwrap();
    let engine_context = ingress.context(engine_peer).unwrap();
    let health_context = ingress.context(health_peer).unwrap();
    assert_eq!(ingress.cancellation_control().cancel_engines(), 1);
    assert_eq!(engine_context.check(), Err(Reason::Explicit));
    assert!(health_context.check().is_ok());
}
