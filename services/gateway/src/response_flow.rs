//! Bounded delivery time; upstream generation pauses do not consume throughput.
use sanctum_inference::cancellation::{Cancellation, Reason};
use std::{
    io,
    net::TcpStream,
    os::fd::AsRawFd,
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};
#[derive(Default)]
pub struct Budget {
    elapsed: Duration,
    bytes: usize,
}
impl Budget {
    pub fn advance(&mut self, elapsed: Duration, bytes: usize) -> io::Result<()> {
        self.elapsed += elapsed;
        self.bytes = self.bytes.saturating_add(bytes);
        if self.elapsed >= Duration::from_secs(2) {
            if (self.bytes as f64) < self.elapsed.as_secs_f64() * 1024.0 {
                return Err(timeout());
            }
            self.elapsed = Duration::ZERO;
            self.bytes = 0;
        }
        Ok(())
    }
}
fn timeout() -> io::Error {
    io::Error::new(
        io::ErrorKind::TimedOut,
        "response delivery deadline or throughput",
    )
}
pub fn write_response(
    stream: &mut TcpStream,
    mut bytes: &[u8],
    context: &Cancellation,
    stop: &AtomicBool,
    budget: &mut Budget,
) -> io::Result<()> {
    let size: libc::c_int = 16384;
    // SAFETY: borrowed live socket, pointer to correctly sized integer option.
    if unsafe {
        libc::setsockopt(
            stream.as_raw_fd(),
            libc::SOL_SOCKET,
            libc::SO_SNDBUF,
            (&size as *const libc::c_int).cast(),
            std::mem::size_of_val(&size) as libc::socklen_t,
        )
    } != 0
    {
        return Err(io::Error::last_os_error());
    }
    let mut progress = Instant::now();
    let delivery_started = progress;
    let mut tick = progress;
    while !bytes.is_empty() {
        if stop.load(Ordering::Relaxed) {
            context.cancel(Reason::Shutdown);
        }
        if context.check().is_err() {
            return Err(timeout());
        }
        if progress.elapsed() >= Duration::from_millis(1800)
            || delivery_started.elapsed() >= Duration::from_millis(1800)
        {
            context.cancel(Reason::Deadline);
            return Err(timeout());
        }
        // SAFETY: valid byte slice and live descriptor; never blocks or raises SIGPIPE.
        let sent = unsafe {
            libc::send(
                stream.as_raw_fd(),
                bytes.as_ptr().cast(),
                bytes.len(),
                libc::MSG_DONTWAIT | libc::MSG_NOSIGNAL,
            )
        };
        let count = if sent > 0 { sent as usize } else { 0 };
        let now = Instant::now();
        if let Err(error) = budget.advance(now - tick, count) {
            context.cancel(Reason::Deadline);
            return Err(error);
        }
        tick = now;
        if count > 0 {
            bytes = &bytes[count..];
            progress = now;
        } else if sent < 0 {
            let error = io::Error::last_os_error();
            if !matches!(
                error.kind(),
                io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
            ) {
                context.cancel(Reason::Disconnect);
                return Err(error);
            }
            thread::sleep(Duration::from_millis(5));
        } else {
            context.cancel(Reason::Disconnect);
            return Err(io::Error::new(io::ErrorKind::WriteZero, "client closed"));
        }
    }
    Ok(())
}
