//! Request-owned cancellation shared by transport, dispatch and engine adapters.
use std::{
    sync::{
        atomic::{AtomicU8, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Reason {
    Disconnect = 1,
    Deadline = 2,
    Shutdown = 3,
    Explicit = 4,
}
impl std::fmt::Display for Reason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "request cancelled: {self:?}")
    }
}
impl std::error::Error for Reason {}

struct State {
    deadline: Instant,
    reason: AtomicU8,
}
#[derive(Clone)]
pub struct Cancellation(Arc<State>);
impl Cancellation {
    pub fn new(deadline: Instant) -> Self {
        Self(Arc::new(State {
            deadline,
            reason: AtomicU8::new(0),
        }))
    }
    pub fn cancel(&self, reason: Reason) {
        let _ =
            self.0
                .reason
                .compare_exchange(0, reason as u8, Ordering::AcqRel, Ordering::Acquire);
    }
    pub fn check(&self) -> Result<(), Reason> {
        if Instant::now() >= self.0.deadline {
            self.cancel(Reason::Deadline);
        }
        match self.0.reason.load(Ordering::Acquire) {
            0 => Ok(()),
            1 => Err(Reason::Disconnect),
            2 => Err(Reason::Deadline),
            3 => Err(Reason::Shutdown),
            _ => Err(Reason::Explicit),
        }
    }
    pub fn remaining(&self) -> Duration {
        if self.check().is_err() {
            Duration::ZERO
        } else {
            self.0.deadline.saturating_duration_since(Instant::now())
        }
    }
}
