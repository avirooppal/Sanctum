#[cfg(target_os = "linux")]
use sanctum_gateway::ingress::inspect;

#[cfg(target_os = "linux")]
#[test]
fn rejects_ambiguous_framing_and_oversized_bodies() {
    for header in [
        "POST /v1/chat/completions HTTP/1.1\r\nContent-Length: 1\r\nContent-Length: 2\r\n\r\n",
        "POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n",
        "POST /v1/audio/transcriptions HTTP/1.1\r\nContent-Length: 99999999\r\n\r\n",
        "GET http://example.com/ HTTP/1.1\r\n\r\n",
    ] {
        assert!(inspect(header.as_bytes()).is_err());
    }
}

#[cfg(target_os = "linux")]
#[test]
fn assigns_lanes_and_preserves_owner_auth() {
    let request = inspect(b"POST /v1/chat/completions HTTP/1.1\r\nAuthorization: Bearer fixture\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\n").unwrap();
    assert_eq!(request.lane, 2);
    assert_eq!(request.length, 2);
    let forwarded = String::from_utf8(request.forwarded).unwrap();
    assert!(forwarded.contains("Authorization: Bearer fixture"));
    assert!(forwarded.contains("Connection: close"));
    assert!(!forwarded.contains("keep-alive"));
    assert_eq!(inspect(b"GET /healthz HTTP/1.1\r\n\r\n").unwrap().lane, 0);
}

#[cfg(target_os = "linux")]
#[test]
fn private_peer_context_observes_client_disconnect_and_is_removed() {
    use sanctum_gateway::ingress::Ingress;
    use sanctum_inference::cancellation::Reason;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        time::{Duration, Instant},
    };
    let backend = TcpListener::bind("127.0.0.1:0").unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let ingress = Ingress::start(listener, backend.local_addr().unwrap()).unwrap();
    let mut client = TcpStream::connect(address).unwrap();
    client
        .write_all(b"GET /healthz HTTP/1.1\r\nHost: local\r\n\r\n")
        .unwrap();
    let (mut upstream, peer) = backend.accept().unwrap();
    upstream
        .set_read_timeout(Some(Duration::from_secs(1)))
        .unwrap();
    upstream.read_exact(&mut [0u8; 1]).unwrap();
    let context = ingress.context(peer).unwrap();
    assert!(context.check().is_ok());
    drop(client);
    let until = Instant::now() + Duration::from_secs(1);
    while context.check().is_ok() && Instant::now() < until {
        std::thread::sleep(Duration::from_millis(5));
    }
    assert_eq!(context.check(), Err(Reason::Disconnect));
    assert!(ingress.context(peer).is_none());
}
