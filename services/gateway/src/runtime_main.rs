#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use sanctum_policy::{close_extra_fds, local_stdio, runtime};
    use std::{io::Write, net::TcpListener, process::Command};
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--probe-child") {
        println!("{}", serde_json::to_string(&runtime::checks()?)?);
        return Ok(());
    }
    local_stdio()?;
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
    let server = tiny_http::Server::from_listener(listener, None)?;
    println!(
        "{}",
        serde_json::json!({"address":address.to_string(),"ready":true})
    );
    std::io::stdout().flush()?;
    for request in server.incoming_requests() {
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
