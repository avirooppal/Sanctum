use std::collections::BTreeMap;
use std::io;
use std::mem;

/// Diagnostic supervisor stdio must be pipes/files/terminals, never sockets.
pub fn local_stdio() -> io::Result<()> {
    for fd in 0..=2 {
        // SAFETY: stat is initialized by fstat before any field is inspected.
        let mut stat: libc::stat = unsafe { mem::zeroed() };
        if unsafe { libc::fstat(fd, &mut stat) } != 0 {
            return Err(io::Error::last_os_error());
        }
        if stat.st_mode & libc::S_IFMT == libc::S_IFSOCK {
            return Err(io::Error::other("supervisor stdio sockets are forbidden"));
        }
    }
    Ok(())
}

/// Must run in a newly launched, single-threaded process before handling data.
pub fn close_extra_fds(first: u32) -> io::Result<()> {
    // SAFETY: close_range accepts scalar arguments and cannot touch Rust memory.
    if unsafe { libc::syscall(libc::SYS_close_range, first, u32::MAX, 0) } != 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

pub fn unix_stream_fd(fd: i32) -> io::Result<()> {
    for (option, expected) in [
        (libc::SO_DOMAIN, libc::AF_UNIX),
        (libc::SO_TYPE, libc::SOCK_STREAM),
    ] {
        let mut value: i32 = 0;
        let mut length = mem::size_of::<i32>() as libc::socklen_t;
        // SAFETY: value and length are writable and correctly sized for getsockopt.
        if unsafe {
            libc::getsockopt(
                fd,
                libc::SOL_SOCKET,
                option,
                (&mut value as *mut i32).cast(),
                &mut length,
            )
        } != 0
        {
            return Err(io::Error::last_os_error());
        }
        if value != expected {
            return Err(io::Error::other("expected inherited Unix stream"));
        }
    }
    Ok(())
}

fn instruction(code: u16, jt: u8, jf: u8, k: u32) -> libc::sock_filter {
    libc::sock_filter { code, jt, jf, k }
}

pub fn install() -> io::Result<()> {
    // Raw classic BPF: validate audit architecture first; unknown syscalls deny.
    // x32 syscall numbers carry bit 30 and therefore cannot match the allowlist.
    const LOAD: u16 = 0x20;
    const EQ: u16 = 0x15;
    const RET: u16 = 0x06;
    const ALLOW: u32 = 0x7fff0000;
    const DENY: u32 = 0x00050000 | libc::EPERM as u32;
    const KILL_PROCESS: u32 = 0x80000000;
    let allowed = [
        libc::SYS_read,
        libc::SYS_write,
        libc::SYS_close,
        libc::SYS_fstat,
        libc::SYS_lseek,
        libc::SYS_brk,
        libc::SYS_mmap,
        libc::SYS_mprotect,
        libc::SYS_munmap,
        libc::SYS_madvise,
        libc::SYS_futex,
        libc::SYS_clock_gettime,
        libc::SYS_rt_sigaction,
        libc::SYS_rt_sigprocmask,
        libc::SYS_rt_sigreturn,
        libc::SYS_sigaltstack,
        libc::SYS_getrandom,
        libc::SYS_getpid,
        libc::SYS_gettid,
        libc::SYS_sched_yield,
        libc::SYS_exit,
        libc::SYS_exit_group,
        libc::SYS_wait4,
        libc::SYS_kill,
        libc::SYS_recvfrom,
    ];
    let mut filter = vec![
        instruction(LOAD, 0, 0, 4),        // seccomp_data.arch
        instruction(EQ, 1, 0, 0xc000003e), // AUDIT_ARCH_X86_64
        instruction(RET, 0, 0, KILL_PROCESS),
        instruction(LOAD, 0, 0, 0), // seccomp_data.nr
    ];
    for syscall in allowed {
        filter.push(instruction(EQ, 0, 1, syscall as u32));
        filter.push(instruction(RET, 0, 0, ALLOW));
    }
    // Rust UnixStream::write uses sendto(fd, ..., NULL, 0). No explicit destination.
    filter.extend([
        instruction(EQ, 0, 5, libc::SYS_sendto as u32),
        instruction(LOAD, 0, 0, 48), // args[4] low word (destination pointer)
        instruction(EQ, 0, 3, 0),
        instruction(LOAD, 0, 0, 52), // high word
        instruction(EQ, 0, 1, 0),
        instruction(RET, 0, 0, ALLOW),
        instruction(RET, 0, 0, DENY),
    ]);
    let program = libc::sock_fprog {
        len: filter.len() as u16,
        filter: filter.as_mut_ptr(),
    };
    #[repr(C)]
    struct CapHeader {
        version: u32,
        pid: i32,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CapData {
        effective: u32,
        permitted: u32,
        inheritable: u32,
    }
    let header = CapHeader {
        version: 0x20080522,
        pid: 0,
    };
    let caps = [CapData {
        effective: 0,
        permitted: 0,
        inheritable: 0,
    }; 2];
    // SAFETY: syscall pointers refer to correctly laid-out live kernel ABI structs.
    // prctl arguments are scalar values; the filter is copied by the kernel.
    unsafe {
        if libc::syscall(libc::SYS_capset, &header, caps.as_ptr()) != 0
            || libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0
            || libc::prctl(libc::PR_SET_SECCOMP, 2, &program) != 0
        {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(())
}

pub fn self_test() -> io::Result<BTreeMap<String, String>> {
    let mut results = BTreeMap::new();
    let mut denied = |name: &str, result: libc::c_long| -> io::Result<()> {
        if result != -1 || io::Error::last_os_error().raw_os_error() != Some(libc::EPERM) {
            return Err(io::Error::other(format!(
                "kernel denial not proven: {name}"
            )));
        }
        results.insert(name.into(), "denied".into());
        Ok(())
    };
    // SAFETY: socket arguments are scalars. Denied pointer-taking probes use null
    // or a valid static string: without the filter they fail harmlessly, not execute.
    unsafe {
        for (name, domain, kind) in [
            ("ipv4_tcp", libc::AF_INET, libc::SOCK_STREAM),
            ("ipv4_udp", libc::AF_INET, libc::SOCK_DGRAM),
            ("ipv6_tcp", libc::AF_INET6, libc::SOCK_STREAM),
            ("ipv6_udp", libc::AF_INET6, libc::SOCK_DGRAM),
            ("unix_socket", libc::AF_UNIX, libc::SOCK_STREAM),
        ] {
            denied(name, libc::syscall(libc::SYS_socket, domain, kind, 0))?;
        }
        denied(
            "file_open",
            libc::syscall(
                libc::SYS_openat,
                libc::AT_FDCWD,
                c"/dev/null".as_ptr(),
                libc::O_RDONLY,
                0,
            ),
        )?;
        denied(
            "exec",
            libc::syscall(
                libc::SYS_execve,
                std::ptr::null::<u8>(),
                std::ptr::null::<u8>(),
                std::ptr::null::<u8>(),
            ),
        )?;
        denied("namespace", libc::syscall(libc::SYS_unshare, 0))?;
        denied(
            "connect",
            libc::syscall(libc::SYS_connect, -1, std::ptr::null::<u8>(), 0),
        )?;
        denied(
            "descriptor_passing",
            libc::syscall(libc::SYS_sendmsg, -1, std::ptr::null::<u8>(), 0),
        )?;
        denied(
            "io_uring",
            libc::syscall(libc::SYS_io_uring_setup, 0, std::ptr::null::<u8>()),
        )?;
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::unix_stream_fd;
    use std::os::fd::AsRawFd;
    use std::os::unix::net::UnixStream;

    #[test]
    fn ipc_descriptor_requires_unix_stream() {
        let (socket, _peer) = UnixStream::pair().unwrap();
        unix_stream_fd(socket.as_raw_fd()).unwrap();
        let file = std::fs::File::open("/dev/null").unwrap();
        assert!(unix_stream_fd(file.as_raw_fd()).is_err());
    }
}
