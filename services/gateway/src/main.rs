#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod contained;

fn main() {
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    let result = contained::run();
    #[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
    let result: Result<(), Box<dyn std::error::Error>> =
        Err("containment unsupported on this platform".into());
    if let Err(error) = result {
        eprintln!("sanctum-foundation: {error}");
        std::process::exit(78);
    }
}
