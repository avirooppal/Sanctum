//! Developer-only experiment launcher; creates its own egress-denied namespace.
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use sha2::{Digest, Sha256};
    use std::{fs, process::Command};
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 && args.len() != 6 {
        return Err(
            "usage: embedding_cost CONFIG PYTHON RUNTIME OUTPUT [cache-off|cache-on|slot-only]"
                .into(),
        );
    }
    let variant = args.get(5).map(String::as_str);
    if variant.is_some_and(|v| !["cache-off", "cache-on", "slot-only"].contains(&v)) {
        return Err("invalid cache experiment variant".into());
    }
    let role = if variant.is_some() {
        "chat"
    } else {
        "embedding"
    };
    let config: serde_json::Value = serde_json::from_slice(&fs::read(&args[1])?)?;
    // Verify every engine file and the selected weights before execution.
    for artifact in config["engine_files"]
        .as_array()
        .ok_or("missing engine files")?
        .iter()
        .chain(std::iter::once(&config[role]["artifact"]))
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
        .arg(config[role]["port"].to_string())
        .arg("--model")
        .arg(config[role]["artifact"]["path"].as_str().ok_or("model")?)
        .arg("--alias")
        .arg(config[role]["id"].as_str().ok_or("alias")?)
        .arg("--threads")
        .arg(config["threads"].to_string())
        .arg("--ctx-size")
        .arg(config["context"].to_string())
        .args(["--parallel", "1", "--cache-ram"])
        .arg(if variant == Some("cache-on") {
            "8192"
        } else {
            "0"
        })
        .arg(
            if variant == Some("cache-on") || variant == Some("slot-only") {
                "--cache-prompt"
            } else {
                "--no-cache-prompt"
            },
        )
        .env_clear();
    if role == "embedding" {
        engine.args(["--embedding", "--pooling", "last"]);
    } else {
        engine.arg("--jinja");
    }
    let mut child = engine.spawn()?;
    let mut benchmark = Command::new(&args[3]);
    benchmark
        .args([
            "--engine-child",
            &args[2],
            if role == "embedding" {
                "evals/embedding_cost.py"
            } else {
                "evals/chat_cache_cost.py"
            },
            "--config",
            &args[1],
            "--output",
            &args[4],
        ])
        .env_clear();
    if let Some(value) = variant {
        benchmark.args(["--variant", value]);
    }
    let result = benchmark.status();
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
