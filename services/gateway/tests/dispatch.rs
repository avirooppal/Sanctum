use sanctum_gateway::dispatch::{Dispatcher, Lane};
use std::time::{Duration, Instant};

#[test]
fn priority_capacity_and_per_lane_limits() {
    let queue = Dispatcher::new(4, [1, 1, 1, 1]);
    let now = Instant::now();
    queue.submit(Lane::Background, 1, now).unwrap();
    queue.submit(Lane::Chat, 2, now).unwrap();
    queue.submit(Lane::Voice, 3, now).unwrap();
    queue.submit(Lane::Control, 4, now).unwrap();
    assert_eq!(queue.submit(Lane::Chat, 5, now), Err(5));
    let control = queue.try_take().unwrap();
    let voice = queue.try_take().unwrap();
    let chat = queue.try_take().unwrap();
    assert_eq!((control.value, voice.value, chat.value), (4, 3, 2));
    queue.submit(Lane::Chat, 6, now).unwrap();
    let background = queue.try_take().unwrap();
    assert_eq!(background.value, 1);
    assert!(queue.try_take().is_none());
    drop(chat);
    assert_eq!(queue.try_take().unwrap().value, 6);
}

#[test]
fn expiry_and_shutdown_return_queued_work() {
    let queue = Dispatcher::new(2, [1, 1, 1, 1]);
    queue
        .submit(Lane::Chat, 1, Instant::now() - Duration::from_secs(11))
        .unwrap();
    assert!(queue.try_take().unwrap().expired);
    queue.submit(Lane::Voice, 2, Instant::now()).unwrap();
    assert_eq!(queue.close(), vec![2]);
    assert_eq!(queue.submit(Lane::Chat, 3, Instant::now()), Err(3));
    assert!(queue.take().is_none());
}

#[test]
fn completed_permit_wakes_waiter() {
    let queue = Dispatcher::new(2, [1, 1, 1, 1]);
    queue.submit(Lane::Chat, 1, Instant::now()).unwrap();
    let first = queue.take().unwrap();
    queue.submit(Lane::Chat, 2, Instant::now()).unwrap();
    let cloned = queue.clone();
    let thread = std::thread::spawn(move || cloned.take().unwrap().value);
    drop(first);
    assert_eq!(thread.join().unwrap(), 2);
    queue.close();
}
