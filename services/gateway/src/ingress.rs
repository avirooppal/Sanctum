//! Bounded TCP ingress; the application listener stays in the private namespace.
use sanctum_inference::cancellation::{Cancellation, Reason};
use std::{
    collections::HashMap,
    io::{self, Read, Write},
    net::{Shutdown, SocketAddr, TcpListener, TcpStream},
    os::fd::AsRawFd,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
type Contexts = Arc<Mutex<HashMap<SocketAddr, Cancellation>>>;
struct Registration {
    contexts: Contexts,
    peer: SocketAddr,
    context: Cancellation,
}
impl Drop for Registration {
    fn drop(&mut self) {
        self.contexts.lock().unwrap().remove(&self.peer);
        self.context.cancel(Reason::Disconnect);
    }
}

pub struct Head {
    pub lane: usize,
    pub length: usize,
    pub forwarded: Vec<u8>,
    expect: bool,
}
pub fn inspect(bytes: &[u8]) -> Result<Head, u16> {
    if bytes.len() > 16384 {
        return Err(431);
    }
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut parsed = httparse::Request::new(&mut headers);
    if !parsed.parse(bytes).map_err(|_| 400u16)?.is_complete() {
        return Err(400);
    }
    if parsed.version != Some(1) {
        return Err(505);
    }
    let path = parsed.path.ok_or(400u16)?;
    if !path.starts_with('/') || path.starts_with("//") {
        return Err(400);
    }
    let route = path.split('?').next().unwrap_or(path);
    let lane = match route {
        "/v1/realtime" | "/v1/audio/transcriptions" | "/v1/audio/speech" => 1,
        "/v1/chat/completions" | "/v1/embeddings" => 2,
        value if value.starts_with("/v1/workspaces") => 3,
        _ => 0,
    };
    let mut length = None;
    let mut expect = false;
    let mut forwarded =
        format!("{} {path} HTTP/1.1\r\n", parsed.method.ok_or(400u16)?).into_bytes();
    for header in parsed.headers.iter() {
        if header.name.eq_ignore_ascii_case("Transfer-Encoding") {
            return Err(411);
        }
        if header.name.eq_ignore_ascii_case("Upgrade") {
            return Err(501);
        }
        if header.name.eq_ignore_ascii_case("Content-Length") {
            if length.is_some() {
                return Err(400);
            }
            let raw = std::str::from_utf8(header.value).map_err(|_| 400u16)?;
            if raw.is_empty() || !raw.bytes().all(|byte| byte.is_ascii_digit()) {
                return Err(400);
            }
            length = Some(raw.parse::<usize>().map_err(|_| 413u16)?);
        }
        if header.name.eq_ignore_ascii_case("Expect") {
            if !header.value.eq_ignore_ascii_case(b"100-continue") {
                return Err(417);
            }
            expect = true;
            continue;
        }
        if ["Connection", "Proxy-Connection", "Keep-Alive"]
            .iter()
            .any(|name| header.name.eq_ignore_ascii_case(name))
        {
            continue;
        }
        forwarded.extend_from_slice(header.name.as_bytes());
        forwarded.extend_from_slice(b": ");
        forwarded.extend_from_slice(header.value);
        forwarded.extend_from_slice(b"\r\n");
    }
    forwarded.extend_from_slice(b"Connection: close\r\n\r\n");
    let length = length.unwrap_or(0);
    let limit = match lane {
        1 if route == "/v1/audio/transcriptions" => 8 * 1024 * 1024,
        1 | 2 => 1024 * 1024,
        3 => 15 * 1024 * 1024,
        _ => 0,
    };
    if length > limit {
        return Err(413);
    }
    Ok(Head {
        lane,
        length,
        forwarded,
        expect,
    })
}

struct Lease(Arc<AtomicUsize>);
impl Lease {
    fn acquire(count: &Arc<AtomicUsize>, limit: usize) -> Option<Self> {
        count
            .try_update(Ordering::AcqRel, Ordering::Relaxed, |n| {
                (n < limit).then_some(n + 1)
            })
            .ok()?;
        Some(Self(count.clone()))
    }
}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::AcqRel);
    }
}
fn reject(stream: &mut TcpStream, code: u16) {
    log_rejection(code);
    let _ = stream.set_write_timeout(Some(Duration::from_millis(100)));
    let _ = write!(stream, "HTTP/1.1 {code} Rejected\r\nContent-Length: 0\r\nConnection: close\r\nRetry-After: 1\r\n\r\n");
    let _ = stream.shutdown(Shutdown::Both);
}
fn log_rejection(code: u16) {
    static REJECTED: AtomicUsize = AtomicUsize::new(0);
    let count = REJECTED.fetch_add(1, Ordering::Relaxed) + 1;
    if count == 1 || count.is_multiple_of(100) {
        eprintln!("ingress rejection code={code} count={count}");
    }
}
fn timed_out() -> io::Error {
    io::Error::new(io::ErrorKind::TimedOut, "ingress deadline")
}
fn read_some(
    stream: &mut TcpStream,
    buffer: &mut [u8],
    until: Instant,
    stop: &AtomicBool,
) -> io::Result<usize> {
    loop {
        if stop.load(Ordering::Relaxed) || Instant::now() >= until {
            return Err(timed_out());
        }
        match stream.read(buffer) {
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
                ) =>
            {
                continue
            }
            result => return result,
        }
    }
}
fn connected(stream: &TcpStream) -> bool {
    let mut byte = 0u8;
    // SAFETY: one-byte valid destination, borrowed live socket; peek is nonblocking.
    let result = unsafe {
        libc::recv(
            stream.as_raw_fd(),
            (&mut byte as *mut u8).cast(),
            1,
            libc::MSG_PEEK | libc::MSG_DONTWAIT,
        )
    };
    result != 0 && (result > 0 || io::Error::last_os_error().kind() == io::ErrorKind::WouldBlock)
}
fn relay(
    mut client: TcpStream,
    backend: SocketAddr,
    stop: Arc<AtomicBool>,
    lanes: [Arc<AtomicUsize>; 4],
    pending: Lease,
    contexts: Contexts,
) -> io::Result<()> {
    client.set_read_timeout(Some(Duration::from_millis(100)))?;
    client.set_write_timeout(Some(Duration::from_secs(2)))?;
    let started = Instant::now();
    let context = Cancellation::new(started + Duration::from_secs(330));
    let mut head = Vec::with_capacity(1024);
    while !head.ends_with(b"\r\n\r\n") {
        if head.len() >= 16384 {
            reject(&mut client, 431);
            return Ok(());
        }
        let mut byte = [0];
        if read_some(
            &mut client,
            &mut byte,
            started + Duration::from_millis(1800),
            &stop,
        )? == 0
        {
            return Ok(());
        }
        head.push(byte[0]);
    }
    let head = match inspect(&head) {
        Ok(head) => head,
        Err(code) => {
            reject(&mut client, code);
            return Ok(());
        }
    };
    let Some(_lane) = Lease::acquire(&lanes[head.lane], [4, 2, 4, 2][head.lane]) else {
        reject(&mut client, 503);
        return Ok(());
    };
    drop(pending);
    if head.expect {
        client.write_all(b"HTTP/1.1 100 Continue\r\n\r\n")?;
    }
    let mut body = vec![0; head.length];
    let uploaded = Instant::now();
    let mut offset = 0;
    while offset < body.len() {
        if uploaded.elapsed().as_secs_f64() > 2.0
            && (offset as f64 / uploaded.elapsed().as_secs_f64()) < 1024.0
        {
            return Err(timed_out());
        }
        let size = read_some(
            &mut client,
            &mut body[offset..],
            std::cmp::min(
                uploaded + Duration::from_secs(15),
                Instant::now() + Duration::from_millis(1800),
            ),
            &stop,
        )?;
        if size == 0 {
            return Ok(());
        }
        offset += size;
    }
    let mut engine = TcpStream::connect_timeout(&backend, Duration::from_secs(1))?;
    let peer = engine.local_addr()?;
    contexts.lock().unwrap().insert(peer, context.clone());
    let _registration = Registration {
        contexts,
        peer,
        context: context.clone(),
    };
    engine.set_write_timeout(Some(Duration::from_secs(2)))?;
    engine.set_read_timeout(Some(Duration::from_millis(100)))?;
    engine.write_all(&head.forwarded)?;
    engine.write_all(&body)?;
    drop(body);
    let mut bytes = [0u8; 16384];
    let result = loop {
        if stop.load(Ordering::Relaxed) {
            context.cancel(Reason::Shutdown);
        }
        if !connected(&client) {
            context.cancel(Reason::Disconnect);
        }
        if context.check().is_err() {
            break Err(timed_out());
        }
        match engine.read(&mut bytes) {
            Ok(0) => break Ok(()),
            Ok(count) => {
                if let Err(error) = client.write_all(&bytes[..count]) {
                    break Err(error);
                }
            }
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
                ) => {}
            Err(error) => break Err(error),
        }
    };
    let _ = engine.shutdown(Shutdown::Both);
    let _ = client.shutdown(Shutdown::Both);
    result
}

pub struct Ingress {
    contexts: Contexts,
    stop: Arc<AtomicBool>,
    active: Arc<AtomicUsize>,
    thread: Option<JoinHandle<()>>,
}
impl Ingress {
    pub fn start(listener: TcpListener, backend: SocketAddr) -> io::Result<Self> {
        listener.set_nonblocking(true)?;
        // SAFETY: live bound TCP listener; adjust only the pending accept backlog.
        if unsafe { libc::listen(listener.as_raw_fd(), 32) } != 0 {
            return Err(io::Error::last_os_error());
        }
        let stop = Arc::new(AtomicBool::new(false));
        let running = stop.clone();
        let active = Arc::new(AtomicUsize::new(0));
        let all = active.clone();
        let contexts: Contexts = Arc::new(Mutex::new(HashMap::new()));
        let associations = contexts.clone();
        let thread = thread::spawn(move || {
            let pending = Arc::new(AtomicUsize::new(0));
            let lanes = std::array::from_fn(|_| Arc::new(AtomicUsize::new(0)));
            let mut tasks: Vec<JoinHandle<()>> = Vec::new();
            let mut rejected = 0usize;
            while !running.load(Ordering::Relaxed) {
                let mut index = 0;
                while index < tasks.len() {
                    if tasks[index].is_finished() {
                        let _ = tasks.swap_remove(index).join();
                    } else {
                        index += 1;
                    }
                }
                match listener.accept() {
                    Ok((stream, _)) => {
                        let leases = Lease::acquire(&all, 24).zip(Lease::acquire(&pending, 8));
                        if let Some((overall, header)) = leases {
                            let (running, lanes, contexts) =
                                (running.clone(), lanes.clone(), associations.clone());
                            tasks.push(thread::spawn(move || {
                                let _overall = overall;
                                if relay(stream, backend, running, lanes, header, contexts).is_err()
                                {
                                    log_rejection(408);
                                }
                            }));
                        } else {
                            rejected += 1;
                            if rejected == 1 || rejected.is_multiple_of(100) {
                                eprintln!("ingress rejected connections: {rejected}");
                            }
                            let _ = stream.shutdown(Shutdown::Both);
                        }
                    }
                    Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5))
                    }
                    Err(_) => break,
                }
            }
            drop(listener);
            for task in tasks {
                let _ = task.join();
            }
        });
        Ok(Self {
            contexts,
            stop,
            active,
            thread: Some(thread),
        })
    }
    pub fn context(&self, peer: SocketAddr) -> Option<Cancellation> {
        self.contexts.lock().unwrap().get(&peer).cloned()
    }
    pub fn drain(&self, timeout: Duration) {
        let until = Instant::now() + timeout;
        while self.active.load(Ordering::Relaxed) != 0 && Instant::now() < until {
            thread::sleep(Duration::from_millis(5));
        }
    }
}
impl Drop for Ingress {
    fn drop(&mut self) {
        for context in self.contexts.lock().unwrap().values() {
            context.cancel(Reason::Shutdown);
        }
        self.stop.store(true, Ordering::Relaxed);
        if let Some(task) = self.thread.take() {
            let _ = task.join();
        }
    }
}
