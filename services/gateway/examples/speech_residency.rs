//! Confined developer evaluation; production workers are unchanged.
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 4 {
        return Err("usage: speech_residency RUNTIME PYTHON PROBE_ARGS...".into());
    }
    sanctum_policy::runtime::enter()?;
    eprintln!(
        "verified {} containment checks",
        sanctum_policy::runtime::checks()?.len()
    );
    let status = std::process::Command::new(&args[1])
        .args(["--engine-child", &args[2], "evals/speech_residency.py"])
        .args(&args[3..])
        .env_clear()
        .status()?;
    if !status.success() {
        return Err("speech residency experiment failed".into());
    }
    Ok(())
}
#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
fn main() {
    eprintln!("UNVERIFIED: Linux x86_64 required");
    std::process::exit(1);
}
