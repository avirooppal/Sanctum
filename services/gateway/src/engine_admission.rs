//! Cross-process engine leases, released by file close or process death.
use std::{
    fs::{self, File, OpenOptions},
    io,
    os::{
        fd::AsRawFd,
        unix::fs::{OpenOptionsExt, PermissionsExt},
    },
    path::Path,
};
pub fn acquire(root: &Path, key: &str, capacity: usize, background: bool) -> io::Result<File> {
    if key.is_empty()
        || !key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        || !(1..=2).contains(&capacity)
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid engine admission key/capacity",
        ));
    }
    fs::create_dir_all(root)?;
    if fs::symlink_metadata(root)?.file_type().is_symlink() {
        return Err(io::Error::other("admission root symlink prohibited"));
    }
    fs::set_permissions(root, fs::Permissions::from_mode(0o700))?;
    let slots: Vec<usize> = if background {
        vec![0]
    } else {
        (0..capacity).rev().collect()
    };
    for slot in slots {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .mode(0o600)
            .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(root.join(format!("{key}-{slot}.lock")))?;
        let metadata = file.metadata()?;
        if !metadata.is_file() || metadata.permissions().mode() & 0o077 != 0 {
            return Err(io::Error::other("unsafe admission file"));
        }
        // SAFETY: live file descriptor; nonblocking exclusive lock, released on close.
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0 {
            return Ok(file);
        }
        let error = io::Error::last_os_error();
        if error.kind() != io::ErrorKind::WouldBlock {
            return Err(error);
        }
    }
    Err(io::Error::new(
        io::ErrorKind::WouldBlock,
        "engine busy; retry later",
    ))
}
