#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod contained;

fn main() {
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    let result = contained::run();
    #[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
    let result: Result<(), Box<dyn std::error::Error>> = run_unconfined();
    if let Err(error) = result {
        eprintln!("sanctum-foundation: {error}");
        std::process::exit(78);
    }
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
fn run_unconfined() -> Result<(), Box<dyn std::error::Error>> {
    use sanctum_gateway::{read_frame, write_frame, RequestEnvelope};
    use serde_json::json;
    use std::io;

    match std::env::args().nth(1).as_deref() {
        Some("check") => {
            let bytes = read_frame(&mut io::stdin().lock())?;
            let envelope: RequestEnvelope = serde_json::from_slice(&bytes)?;
            envelope.validate()?;
            let checks = sanctum_policy::self_test()?;
            write_frame(
                &mut io::stdout().lock(),
                &serde_json::to_vec(&json!({
                    "schema_version": "1.0",
                    "accepted": true,
                    "trace_id": envelope.trace_id,
                    "worker_checks": checks,
                    "platform_assurance": sanctum_policy::platform_assurance_tier()
                }))?,
            )?;
            Ok(())
        }
        _ => Err("usage: sanctum-foundation check < envelope.json".into()),
    }
}
