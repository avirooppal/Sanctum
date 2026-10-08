use sanctum_inference::LocalEngine;

#[test]
fn refuses_remote_or_ambiguous_urls() {
    for url in [
        "https://example.com",
        "http://localhost:8080",
        "http://127.0.0.1:80@evil.test",
        "http://127.0.0.1:1/path",
        "http://0.0.0.0:80",
    ] {
        assert!(LocalEngine::new(url).is_err(), "{url}");
    }
    assert!(LocalEngine::new("http://127.0.0.1:18081").is_ok());
}
