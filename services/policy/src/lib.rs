//! Kernel containment for the foundation diagnostic, not a declarative policy engine.
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod linux;
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub use linux::{close_extra_fds, install, local_stdio, self_test, unix_stream_fd};

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub mod runtime;
