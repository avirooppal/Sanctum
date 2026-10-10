//! Bounded admitted-request scheduling. Transport connection limits are separate.
use std::{
    collections::VecDeque,
    sync::{Arc, Condvar, Mutex},
    time::{Duration, Instant},
};

#[derive(Clone, Copy)]
pub enum Lane {
    Control,
    Voice,
    Chat,
    Background,
}
struct Entry<T> {
    value: T,
    admitted: Instant,
}
struct State<T> {
    queues: [VecDeque<Entry<T>>; 4],
    active: [usize; 4],
    closed: bool,
}
pub struct Dispatcher<T> {
    state: Mutex<State<T>>,
    wake: Condvar,
    capacity: usize,
    limits: [usize; 4],
}
pub struct Scheduled<T> {
    pub value: T,
    pub expired: bool,
    _permit: Permit<T>,
}
struct Permit<T> {
    queue: Arc<Dispatcher<T>>,
    lane: usize,
}
impl<T> Drop for Permit<T> {
    fn drop(&mut self) {
        self.queue.state.lock().unwrap().active[self.lane] -= 1;
        self.queue.wake.notify_all();
    }
}
impl<T> Dispatcher<T> {
    pub fn counts(&self) -> ([usize; 4], [usize; 4]) {
        let state = self.state.lock().unwrap();
        (
            std::array::from_fn(|index| state.queues[index].len()),
            state.active,
        )
    }
    pub fn new(capacity: usize, limits: [usize; 4]) -> Arc<Self> {
        assert!(capacity > 0 && limits.iter().all(|limit| *limit > 0));
        Arc::new(Self {
            state: Mutex::new(State {
                queues: std::array::from_fn(|_| VecDeque::new()),
                active: [0; 4],
                closed: false,
            }),
            wake: Condvar::new(),
            capacity,
            limits,
        })
    }
    pub fn submit(&self, lane: Lane, value: T, admitted: Instant) -> Result<(), T> {
        let mut state = self.state.lock().unwrap();
        if state.closed || state.queues.iter().map(VecDeque::len).sum::<usize>() >= self.capacity {
            return Err(value);
        }
        state.queues[lane as usize].push_back(Entry { value, admitted });
        self.wake.notify_all();
        Ok(())
    }
    fn pick(self: &Arc<Self>, state: &mut State<T>) -> Option<Scheduled<T>> {
        for lane in 0..4 {
            if state.active[lane] < self.limits[lane] {
                if let Some(entry) = state.queues[lane].pop_front() {
                    state.active[lane] += 1;
                    return Some(Scheduled {
                        value: entry.value,
                        expired: entry.admitted.elapsed() >= Duration::from_secs(10),
                        _permit: Permit {
                            queue: self.clone(),
                            lane,
                        },
                    });
                }
            }
        }
        None
    }
    pub fn try_take(self: &Arc<Self>) -> Option<Scheduled<T>> {
        self.pick(&mut self.state.lock().unwrap())
    }
    pub fn take(self: &Arc<Self>) -> Option<Scheduled<T>> {
        let mut state = self.state.lock().unwrap();
        loop {
            if let Some(item) = self.pick(&mut state) {
                return Some(item);
            }
            if state.closed {
                return None;
            }
            state = self.wake.wait(state).unwrap();
        }
    }
    pub fn drain(&self) {
        let mut state = self.state.lock().unwrap();
        while state.queues.iter().any(|queue| !queue.is_empty())
            || state.active.iter().any(|n| *n > 0)
        {
            state = self.wake.wait(state).unwrap();
        }
        state.closed = true;
        self.wake.notify_all();
    }
    pub fn close(&self) -> Vec<T> {
        let mut state = self.state.lock().unwrap();
        state.closed = true;
        let pending = state
            .queues
            .iter_mut()
            .flat_map(|queue| queue.drain(..).map(|entry| entry.value))
            .collect();
        self.wake.notify_all();
        pending
    }
}
