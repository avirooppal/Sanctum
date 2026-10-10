#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
static STOP: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
extern "C" fn stop(_: i32) {
    STOP.store(true, std::sync::atomic::Ordering::Relaxed);
}
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use sanctum_policy::{close_extra_fds, local_stdio, runtime};
    use std::{io::Write, net::TcpListener, process::Command};
    let args: Vec<String> = std::env::args().collect();
    if let Some(index) = args.iter().position(|a| a == "--engine-child") {
        use std::os::unix::process::ExitStatusExt;
        // SAFETY: handlers only update the lock-free STOP atomic.
        unsafe {
            let mut action: libc::sigaction = std::mem::zeroed();
            action.sa_sigaction = stop as *const () as usize;
            libc::sigemptyset(&mut action.sa_mask);
            if libc::sigaction(libc::SIGTERM, &action, std::ptr::null_mut()) != 0
                || libc::sigaction(libc::SIGINT, &action, std::ptr::null_mut()) != 0
            {
                return Err(std::io::Error::last_os_error().into());
            }
        }
        // The engine must not outlive its supervisor, including abrupt crashes.
        let parent = unsafe { libc::getppid() };
        if parent == 1 || unsafe { libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) } != 0 {
            return Err("cannot bind engine lifetime to supervisor".into());
        }
        if unsafe { libc::getppid() } != parent {
            return Err("supervisor exited during engine startup".into());
        }
        runtime::checks()?;
        let executable = args.get(index + 1).ok_or("missing engine executable")?;
        let mut command = Command::new(executable);
        command.args(&args[index + 2..]).env_clear();
        let status = sanctum_gateway::supervision::run(&mut command, &STOP)?;
        std::process::exit(status.code().unwrap_or(128 + status.signal().unwrap_or(1)));
    }
    if args.iter().any(|a| a == "--probe-child") {
        println!("{}", serde_json::to_string(&runtime::checks()?)?);
        return Ok(());
    }
    local_stdio()?;
    // SAFETY: handler only sets a lock-free atomic and has no captures.
    unsafe {
        let mut action: libc::sigaction = std::mem::zeroed();
        action.sa_sigaction = stop as *const () as usize;
        libc::sigemptyset(&mut action.sa_mask);
        if libc::sigaction(libc::SIGTERM, &action, std::ptr::null_mut()) != 0
            || libc::sigaction(libc::SIGINT, &action, std::ptr::null_mut()) != 0
        {
            return Err(std::io::Error::last_os_error().into());
        }
    }
    close_extra_fds(3)?;
    let port = args
        .iter()
        .position(|a| a == "--port")
        .map(|i| args.get(i + 1).ok_or("missing port"))
        .transpose()?
        .map(|s| s.parse::<u16>())
        .transpose()?
        .unwrap_or(8765);
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let address = listener.local_addr()?;
    runtime::enter()?;
    let checks = runtime::checks()?;
    if args.iter().any(|a| a == "--supervision-probe") {
        let mut command = Command::new(std::env::current_exe()?);
        command.args([
            "--engine-child",
            "/usr/bin/python3",
            "tools/supervision_fixture.py",
        ]);
        if args.iter().any(|a| a == "--natural") {
            command.arg("--natural");
        }
        let mut child = command.env_clear().spawn()?;
        loop {
            if child.try_wait()?.is_some() {
                break;
            }
            if STOP.load(std::sync::atomic::Ordering::Acquire) {
                sanctum_gateway::supervision::terminate(&mut child)?;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        return Ok(());
    }
    if args.iter().any(|a| a == "--test-child") {
        let child = Command::new(std::env::current_exe()?)
            .arg("--probe-child")
            .env_clear()
            .output()?;
        if !child.status.success() {
            return Err(String::from_utf8_lossy(&child.stderr).into_owned().into());
        }
        std::io::stdout().write_all(&child.stdout)?;
        return Ok(());
    }
    let chat = if let Some(index) = args.iter().position(|a| a == "--config") {
        Some(chat::Chat::load(std::path::Path::new(
            args.get(index + 1).ok_or("missing config")?,
        ))?)
    } else {
        None
    };
    let private_listener = TcpListener::bind(("127.0.0.1", 0))?;
    let ingress =
        sanctum_gateway::ingress::Ingress::start(listener, private_listener.local_addr()?)?;
    let server = tiny_http::Server::from_listener(private_listener, None)?;
    println!(
        "{}",
        serde_json::json!({"address":address.to_string(),"ready":true,"token_file":chat.as_ref().map(|chat|chat.token_path())})
    );
    std::io::stdout().flush()?;
    use sanctum_gateway::dispatch::{Dispatcher, Lane};
    let queue = Dispatcher::<(
        tiny_http::Request,
        sanctum_inference::cancellation::Cancellation,
    )>::new(8, [2, 1, 2, 1]);
    let chat = std::sync::Arc::new(chat);
    let health = serde_json::json!({"status":"ok","cloud_connectors":"disabled","isolation":"linux-user-netns-seccomp","checks":checks});
    let mut workers = Vec::new();
    for _ in 0..6 {
        let (queue, chat, health) = (queue.clone(), chat.clone(), health.clone());
        workers.push(std::thread::spawn(move || {
            while let Some(job) = queue.take() {
                let (request, context) = job.value;
                if job.expired || context.check().is_err() {
                    overload(request);
                    continue;
                }
                if request.url() != "/healthz" {
                    if let Some(chat) = chat.as_ref() {
                        if let Err(error) = chat.handle(request, &context) {
                            eprintln!("request failed: {error}");
                        }
                        continue;
                    }
                }
                let (code, value) =
                    if request.method() == &tiny_http::Method::Get && request.url() == "/healthz" {
                        (200, health.clone())
                    } else {
                        (404, serde_json::json!({"error":"not_found"}))
                    };
                let _ = request.respond(
                    tiny_http::Response::from_string(value.to_string())
                        .with_status_code(code)
                        .with_header(
                            tiny_http::Header::from_bytes("Content-Type", "application/json")
                                .unwrap(),
                        ),
                );
            }
        }));
    }
    while !STOP.load(std::sync::atomic::Ordering::Relaxed) {
        let Some(request) = server.recv_timeout(std::time::Duration::from_millis(200))? else {
            continue;
        };
        let lane = match request.url().split('?').next().unwrap_or("/") {
            "/v1/realtime" | "/v1/audio/transcriptions" | "/v1/audio/speech" => Lane::Voice,
            "/v1/chat/completions" | "/v1/embeddings" => Lane::Chat,
            path if path.starts_with("/v1/workspaces") => Lane::Background,
            _ => Lane::Control,
        };
        let Some(context) = request
            .remote_addr()
            .and_then(|peer| ingress.context(*peer))
        else {
            overload(request);
            continue;
        };
        if let Err((request, _)) = queue.submit(lane, (request, context), std::time::Instant::now())
        {
            overload(request);
        }
        if args.iter().any(|a| a == "--once") {
            break;
        }
    }
    // Test --once drains its single accepted request; ordinary shutdown rejects queued work.
    if args.iter().any(|a| a == "--once") {
        queue.drain();
        ingress.drain(std::time::Duration::from_secs(2));
    }
    drop(ingress);
    for (request, context) in queue.close() {
        context.cancel(sanctum_inference::cancellation::Reason::Shutdown);
        overload(request);
    }
    for worker in workers {
        let _ = worker.join();
    }
    Ok(())
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn overload(request: tiny_http::Request) {
    let _ = request.respond(
        tiny_http::Response::from_string("{\"error\":{\"message\":\"Gateway busy; retry later\"}}")
            .with_status_code(503)
            .with_header(tiny_http::Header::from_bytes("Content-Type", "application/json").unwrap())
            .with_header(tiny_http::Header::from_bytes("Retry-After", "1").unwrap()),
    );
}

fn main() {
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    let result = run();
    #[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
    let result: Result<(), Box<dyn std::error::Error + Send + Sync>> =
        Err("runtime containment unsupported on this platform".into());
    if let Err(error) = result {
        eprintln!("sanctum-runtime: {error}");
        std::process::exit(78);
    }
}
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod chat;
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod knowledge;
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod speech;
