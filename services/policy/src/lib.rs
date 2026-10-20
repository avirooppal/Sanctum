//! Kernel containment for the foundation diagnostic, not a declarative policy engine.
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod linux;
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub use linux::{close_extra_fds, install, local_stdio, self_test, unix_stream_fd};

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub mod runtime;

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub fn platform_assurance_tier() -> &'static str {
    "verified kernel containment"
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
pub fn platform_assurance_tier() -> &'static str {
    "not verified"
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
pub fn local_stdio() -> std::io::Result<()> {
    Ok(())
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
pub fn close_extra_fds(_first: u32) -> std::io::Result<()> {
    Ok(())
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
pub fn install() -> std::io::Result<()> {
    Ok(())
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
pub fn self_test() -> std::io::Result<std::collections::BTreeMap<String, String>> {
    let mut map = std::collections::BTreeMap::new();
    map.insert("platform_assurance".into(), "not verified".into());
    Ok(map)
}

#[cfg(not(all(target_os = "linux", target_arch = "x86_64")))]
pub mod runtime {
    use std::{collections::BTreeMap, io};
    pub fn enter() -> io::Result<()> {
        Ok(())
    }
    pub fn checks() -> io::Result<BTreeMap<String, String>> {
        let mut map = BTreeMap::new();
        map.insert("platform_assurance".into(), "not verified".into());
        Ok(map)
    }
}
