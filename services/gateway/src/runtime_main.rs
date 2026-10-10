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
        use std::os::unix::process::CommandExt;
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
        let error = Command::new(executable)
            .args(&args[index + 2..])
            .env_clear()
            .exec();
        return Err(error.into());
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
    let server = tiny_http::Server::from_listener(listener, None)?;
    println!(
        "{}",
        serde_json::json!({"address":address.to_string(),"ready":true,"token_file":chat.as_ref().map(|chat|chat.token_path())})
    );
    std::io::stdout().flush()?;
    while !STOP.load(std::sync::atomic::Ordering::Relaxed) {
        let Some(request) = server.recv_timeout(std::time::Duration::from_millis(200))? else {
            continue;
        };
        if request.url() != "/healthz" {
            if let Some(chat) = &chat {
                if let Err(error) = chat.handle(request) {
                    eprintln!("request failed: {error}");
                }
                continue;
            }
        }
        let (code, value) = if request.method() == &tiny_http::Method::Get
            && request.url() == "/healthz"
        {
            (
                200,
                serde_json::json!({"status":"ok","cloud_connectors":"disabled","isolation":"linux-user-netns-seccomp","checks":checks}),
            )
        } else {
            (404, serde_json::json!({"error":"not_found"}))
        };
        request.respond(
            tiny_http::Response::from_string(value.to_string())
                .with_status_code(code)
                .with_header(
                    tiny_http::Header::from_bytes("Content-Type", "application/json").unwrap(),
                ),
        )?;
        if args.iter().any(|a| a == "--once") {
            break;
        }
    }
    Ok(())
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
