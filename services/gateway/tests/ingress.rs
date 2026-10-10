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
