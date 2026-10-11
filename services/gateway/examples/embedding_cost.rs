//! Developer-only experiment launcher; creates its own egress-denied namespace.
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use sha2::{Digest, Sha256};
    use std::{fs, process::Command};
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 {
        return Err("usage: embedding_cost CONFIG PYTHON RUNTIME OUTPUT".into());
    }
    let config: serde_json::Value = serde_json::from_slice(&fs::read(&args[1])?)?;
    // Verify every engine file and the selected weights before execution.
    for artifact in config["engine_files"]
        .as_array()
        .ok_or("missing engine files")?
        .iter()
        .chain(std::iter::once(&config["embedding"]["artifact"]))
    {
        let bytes = fs::read(artifact["path"].as_str().ok_or("missing artifact path")?)?;
        if format!("{:x}", Sha256::digest(&bytes))
            != artifact["sha256"].as_str().ok_or("missing hash")?
        {
            return Err("artifact hash mismatch".into());
        }
    }
    sanctum_policy::runtime::enter()?;
    let checks = sanctum_policy::runtime::checks()?;
    eprintln!("verified {} containment checks", checks.len());
    let mut engine = Command::new(&args[3]);
    engine
        .args([
            "--resident-engine",
            config["engine"].as_str().ok_or("engine")?,
            "--offline",
            "--log-disable",
            "--no-webui",
            "--host",
            "127.0.0.1",
            "--port",
        ])
        .arg(config["embedding"]["port"].to_string())
        .arg("--model")
        .arg(
            config["embedding"]["artifact"]["path"]
                .as_str()
                .ok_or("model")?,
        )
        .arg("--alias")
        .arg(config["embedding"]["id"].as_str().ok_or("alias")?)
        .arg("--threads")
        .arg(config["threads"].to_string())
        .arg("--ctx-size")
        .arg(config["context"].to_string())
        .args([
            "--parallel",
            "1",
            "--cache-ram",
            "0",
            "--no-cache-prompt",
            "--embedding",
            "--pooling",
            "last",
        ])
        .env_clear();
    let mut child = engine.spawn()?;
    let result = Command::new(&args[3])
        .args([
            "--engine-child",
            &args[2],
            "evals/embedding_cost.py",
            "--config",
            &args[1],
            "--output",
            &args[4],
        ])
        .env_clear()
        .status();
    let cleanup = sanctum_gateway::supervision::terminate(&mut child);
    cleanup?;
    if !result?.success() {
        return Err("benchmark failed".into());
    }
    Ok(())
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
fn main() {
    eprintln!("UNVERIFIED: requires Linux x86_64 containment");
    std::process::exit(1);
}
