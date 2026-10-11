use sanctum_gateway::realtime_tickets::SessionAuth;

#[test]
fn authority_is_exact_and_bound_to_listener_port() {
    let auth = SessionAuth::new(8769);
    assert!(auth.allowed("127.0.0.1:8769", "http://127.0.0.1:8769"));
    assert!(auth.allowed("localhost:8769", "http://localhost:8769"));
    for (host, origin) in [
        ("127.0.0.1:9999", "http://127.0.0.1:9999"),
        ("evil.example:8769", "http://evil.example:8769"),
        ("127.0.0.1:8769", "http://localhost:8769"),
        ("127.0.0.1:8769", "null"),
        ("127.0.0.1:8769", "http://127.0.0.1:8769/"),
    ] {
        assert!(!auth.allowed(host, origin));
    }
}
