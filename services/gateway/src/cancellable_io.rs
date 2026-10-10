//! Bounded polling for owned nonblocking streams; no detached helper threads.
use sanctum_inference::cancellation::Cancellation;
use std::{
    io::{self, Read, Write},
    os::fd::AsRawFd,
    thread,
    time::Duration,
};

pub struct ContextIo<T> {
    inner: T,
    context: Cancellation,
}
impl<T: AsRawFd> ContextIo<T> {
    pub fn new(inner: T, context: Cancellation) -> io::Result<Self> {
        // SAFETY: borrowed live descriptor; retain all existing flags.
        let flags = unsafe { libc::fcntl(inner.as_raw_fd(), libc::F_GETFL) };
        if flags < 0
            || unsafe { libc::fcntl(inner.as_raw_fd(), libc::F_SETFL, flags | libc::O_NONBLOCK) }
                < 0
        {
            return Err(io::Error::last_os_error());
        }
        Ok(Self { inner, context })
    }
}
impl<T> ContextIo<T> {
    pub fn set_context(&mut self, context: Cancellation) {
        self.context = context;
    }
    fn check(&self) -> io::Result<()> {
        self.context
            .check()
            .map_err(|reason| io::Error::new(io::ErrorKind::ConnectionAborted, reason))
    }
}
impl<T: Read> Read for ContextIo<T> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        loop {
            self.check()?;
            match self.inner.read(buffer) {
                Err(error)
                    if matches!(
                        error.kind(),
                        io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                    ) =>
                {
                    thread::sleep(Duration::from_millis(10))
                }
                result => return result,
            }
        }
    }
}
impl<T: Write> Write for ContextIo<T> {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        loop {
            self.check()?;
            match self.inner.write(buffer) {
                Err(error)
                    if matches!(
                        error.kind(),
                        io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                    ) =>
                {
                    thread::sleep(Duration::from_millis(10))
                }
                result => return result,
            }
        }
    }
    fn flush(&mut self) -> io::Result<()> {
        self.check()?;
        self.inner.flush()
    }
}
