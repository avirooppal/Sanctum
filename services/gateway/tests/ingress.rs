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

#[cfg(target_os = "linux")]
#[test]
fn advertises_close_before_a_pooled_client_can_reuse_the_connection() {
    use sanctum_gateway::ingress::Ingress;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        time::Duration,
    };
    let backend = TcpListener::bind("127.0.0.1:0").unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let _ingress = Ingress::start(listener, backend.local_addr().unwrap()).unwrap();
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = backend.accept().unwrap();
        let mut head = Vec::new();
        while !head.ends_with(b"\r\n\r\n") {
            let mut byte = [0];
            stream.read_exact(&mut byte).unwrap();
            head.push(byte[0]);
        }
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}")
            .unwrap();
    });
    let mut client = TcpStream::connect(address).unwrap();
    client
        .set_read_timeout(Some(Duration::from_secs(2)))
        .unwrap();
    client
        .write_all(b"GET /healthz HTTP/1.1\r\nHost: local\r\n\r\n")
        .unwrap();
    let mut response = String::new();
    client.read_to_string(&mut response).unwrap();
    worker.join().unwrap();
    assert!(
        response.contains("Connection: close\r\n"),
        "response must prohibit reuse before FIN arrives: {response}"
    );
    assert!(response.ends_with("\r\n\r\n{}"));
}

#[cfg(target_os = "linux")]
#[test]
fn nonreading_clients_cancel_fixed_and_streaming_upstreams() {
    use sanctum_gateway::ingress::Ingress;
    use std::{
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        time::{Duration, Instant},
    };
    for framing in ["Content-Length: 16777216", "Transfer-Encoding: chunked"] {
        let backend = TcpListener::bind("127.0.0.1:0").unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let ingress = Ingress::start(listener, backend.local_addr().unwrap()).unwrap();
        let mut client = TcpStream::connect(address).unwrap();
        client
            .write_all(b"GET /healthz HTTP/1.1\r\nHost: local\r\n\r\n")
            .unwrap();
        let (mut upstream, peer) = backend.accept().unwrap();
        upstream.read_exact(&mut [0u8; 1]).unwrap();
        let context = ingress.context(peer).unwrap();
        let started = Instant::now();
        let sender = std::thread::spawn(move || {
            upstream
                .set_write_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            write!(upstream, "HTTP/1.1 200 OK\r\n{framing}\r\n\r\n").unwrap();
            for _ in 0..1024 {
                if framing.starts_with("Transfer") && upstream.write_all(b"4000\r\n").is_err() {
                    break;
                }
                if upstream.write_all(&[42; 16384]).is_err() {
                    break;
                }
                if framing.starts_with("Transfer") && upstream.write_all(b"\r\n").is_err() {
                    break;
                }
            }
        });
        while context.check().is_ok() && started.elapsed() < Duration::from_secs(3) {
            std::thread::sleep(Duration::from_millis(5));
        }
        assert!(context.check().is_err(), "{framing} pinned its worker");
        assert!(started.elapsed() < Duration::from_secs(3));
        sender.join().unwrap();
    }
}
