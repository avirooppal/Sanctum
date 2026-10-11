#[cfg(target_os = "linux")]
#[test]
fn audio_sequence_size_and_session_cap_are_enforced() {
    use sanctum_gateway::realtime::Audio;
    let mut audio = Audio::default();
    let frame = [0u8, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    assert!(audio.push(&frame).is_err());
    audio.start();
    assert!(audio.push(&frame).is_ok());
    assert!(audio.push(&frame).is_err());
    audio.clear();
    assert!(audio.push(&frame).is_err());
    audio.start();
    let mut packet = vec![0; 6408];
    packet[4..8].copy_from_slice(&3200u32.to_le_bytes());
    for sequence in 0u32..150 {
        packet[..4].copy_from_slice(&sequence.to_le_bytes());
        assert!(audio.push(&packet).is_ok());
    }
    packet[..4].copy_from_slice(&150u32.to_le_bytes());
    assert!(audio.push(&packet).is_err());
}

#[test]
fn turn_cancel_does_not_close_session_and_parent_cancel_propagates() {
    use sanctum_inference::cancellation::{Cancellation, Reason};
    use std::time::{Duration, Instant};
    let parent = Cancellation::new(Instant::now() + Duration::from_secs(900));
    let turn = parent.child(Instant::now() + Duration::from_secs(330));
    turn.cancel(Reason::Explicit);
    assert!(parent.check().is_ok());
    let next = parent.child(Instant::now() + Duration::from_secs(330));
    parent.cancel(Reason::Disconnect);
    assert_eq!(next.check(), Err(Reason::Disconnect));
}
