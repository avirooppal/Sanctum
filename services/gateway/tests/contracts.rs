use sanctum_gateway::{read_frame, write_frame, RequestEnvelope, MAX_FRAME};
use serde_json::Value;

#[test]
fn shared_envelope_fixtures_match_contract() {
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../../docs/contracts/envelope-fixtures.json"
    ))
    .unwrap();
    for case in cases {
        let accepted = serde_json::from_value::<RequestEnvelope>(case["value"].clone())
            .map(|v| v.validate().is_ok())
            .unwrap_or(false);
        assert_eq!(
            accepted,
            case["valid"].as_bool().unwrap(),
            "{}",
            case["name"]
        );
    }
}

#[test]
fn frame_roundtrip_and_size_limits() {
    let mut bytes = Vec::new();
    write_frame(&mut bytes, b"hello").unwrap();
    assert_eq!(read_frame(&mut bytes.as_slice()).unwrap(), b"hello");
    assert!(write_frame(&mut Vec::new(), &[]).is_err());
    assert!(write_frame(&mut Vec::new(), &vec![0; MAX_FRAME + 1]).is_err());
}

#[test]
fn reject_truncated_or_unbounded_frames_before_allocation() {
    for data in [
        vec![0, 0],
        vec![0, 0, 0, 0],
        vec![255; 4],
        vec![0, 0, 0, 5, 1],
    ] {
        assert!(read_frame(&mut data.as_slice()).is_err());
    }
}
