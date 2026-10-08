//! Egress boundary for trusted local services. Not an untrusted-agent sandbox.
use std::{
    collections::BTreeMap,
    fs, io, mem,
    net::{SocketAddr, TcpStream, UdpSocket},
    time::Duration,
};

fn last(result: i32) -> io::Result<()> {
    if result == -1 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

pub fn enter() -> io::Result<()> {
    // SAFETY: scalar namespace operations on this single-threaded launcher.
    let (uid, gid) = unsafe { (libc::getuid(), libc::getgid()) };
    unsafe {
        last(libc::unshare(libc::CLONE_NEWUSER | libc::CLONE_NEWNET))?;
    }
    fs::write("/proc/self/setgroups", "deny")?;
    fs::write("/proc/self/uid_map", format!("0 {uid} 1\n"))?;
    fs::write("/proc/self/gid_map", format!("0 {gid} 1\n"))?;
    // SAFETY: valid ifreq, fixed loopback name, closed control descriptor.
    unsafe {
        let socket = libc::socket(libc::AF_INET, libc::SOCK_DGRAM | libc::SOCK_CLOEXEC, 0);
        if socket == -1 {
            return Err(io::Error::last_os_error());
        }
        let mut request: libc::ifreq = mem::zeroed();
        request.ifr_name[0] = b'l' as i8;
        request.ifr_name[1] = b'o' as i8;
        request.ifr_ifru.ifru_flags = (libc::IFF_UP | libc::IFF_RUNNING) as i16;
        let result = last(libc::ioctl(socket, libc::SIOCSIFFLAGS, &request));
        libc::close(socket);
        result?;
    }
    lock()
}

fn ins(code: u16, jt: u8, jf: u8, k: u32) -> libc::sock_filter {
    libc::sock_filter { code, jt, jf, k }
}

fn lock() -> io::Result<()> {
    const DENY: u32 = 0x00050000 | libc::EPERM as u32;
    const ALLOW: u32 = 0x7fff0000;
    let mut filter = vec![
        ins(0x20, 0, 0, 4),
        ins(0x15, 1, 0, 0xc000003e),
        ins(0x06, 0, 0, 0x80000000),
        ins(0x20, 0, 0, 0),
    ];
    // Reject x32 ABI, which otherwise provides alternate syscall numbers.
    filter.extend([ins(0x45, 0, 1, 0x40000000), ins(0x06, 0, 0, DENY)]);
    for call in [
        libc::SYS_setns,
        libc::SYS_unshare,
        libc::SYS_mount,
        libc::SYS_umount2,
        libc::SYS_pivot_root,
        libc::SYS_ptrace,
        libc::SYS_process_vm_writev,
        libc::SYS_process_vm_readv,
        libc::SYS_pidfd_getfd,
        libc::SYS_io_uring_setup,
        libc::SYS_bpf,
        libc::SYS_open_by_handle_at,
    ] {
        filter.extend([ins(0x15, 0, 1, call as u32), ins(0x06, 0, 0, DENY)]);
    }
    filter.extend([
        ins(0x15, 0, 1, libc::SYS_clone3 as u32),
        ins(0x06, 0, 0, 0x00050000 | libc::ENOSYS as u32),
    ]);
    let namespaces = (libc::CLONE_NEWUSER
        | libc::CLONE_NEWNET
        | libc::CLONE_NEWNS
        | libc::CLONE_NEWPID
        | libc::CLONE_NEWIPC
        | libc::CLONE_NEWUTS
        | libc::CLONE_NEWCGROUP) as u32;
    filter.extend([
        ins(0x15, 0, 4, libc::SYS_clone as u32),
        ins(0x20, 0, 0, 16),
        ins(0x45, 0, 1, namespaces),
        ins(0x06, 0, 0, DENY),
        ins(0x06, 0, 0, ALLOW),
        ins(0x15, 0, 5, libc::SYS_socket as u32),
        ins(0x20, 0, 0, 16),
        ins(0x15, 2, 0, libc::AF_INET as u32),
        ins(0x15, 1, 0, libc::AF_INET6 as u32),
        ins(0x06, 0, 0, DENY),
        ins(0x06, 0, 0, ALLOW),
        ins(0x06, 0, 0, ALLOW),
    ]);
    #[repr(C)]
    struct Header {
        version: u32,
        pid: i32,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Data {
        effective: u32,
        permitted: u32,
        inheritable: u32,
    }
    let header = Header {
        version: 0x20080522,
        pid: 0,
    };
    let data = [Data {
        effective: 0,
        permitted: 0,
        inheritable: 0,
    }; 2];
    let program = libc::sock_fprog {
        len: filter.len() as u16,
        filter: filter.as_mut_ptr(),
    };
    // SAFETY: live C-layout structs, kernel copies the filter before returning.
    unsafe {
        if libc::syscall(libc::SYS_capset, &header, data.as_ptr()) != 0 {
            return Err(io::Error::last_os_error());
        }
        last(libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0))?;
        last(libc::prctl(libc::PR_SET_SECCOMP, 2, &program))?;
    }
    Ok(())
}

pub fn checks() -> io::Result<BTreeMap<String, String>> {
    // Check topology BEFORE attempting any destination; never probe host network.
    let dev = fs::read_to_string("/proc/net/dev")?;
    let names: Vec<&str> = dev
        .lines()
        .filter_map(|line| line.split_once(':').map(|(name, _)| name.trim()))
        .collect();
    if names != ["lo"] {
        return Err(io::Error::other("runtime requires private loopback only"));
    }
    let mut results = BTreeMap::new();
    for (label, address, bind) in [
        ("ipv4", "192.0.2.1:443", "0.0.0.0:0"),
        ("ipv6", "[2001:db8::1]:443", "[::]:0"),
    ] {
        let address: SocketAddr = address.parse().unwrap();
        let tcp = TcpStream::connect_timeout(&address, Duration::from_millis(200)).map(|_| ());
        let udp = UdpSocket::bind(bind)
            .and_then(|socket| socket.send_to(b"sanctum-self-test", address).map(|_| ()));
        for (kind, result) in [("tcp", tcp), ("udp", udp)] {
            let error = result
                .err()
                .ok_or_else(|| io::Error::other("egress unexpectedly succeeded"))?;
            if !matches!(
                error.raw_os_error(),
                Some(
                    libc::ENETUNREACH
                        | libc::EHOSTUNREACH
                        | libc::EADDRNOTAVAIL
                        | libc::EAFNOSUPPORT
                )
            ) {
                return Err(io::Error::other(format!(
                    "inconclusive {label} {kind}: {error}"
                )));
            }
            results.insert(format!("{label}_{kind}"), "denied".into());
        }
    }
    let mut denied = |name: &str, result: libc::c_long| -> io::Result<()> {
        if result != -1 || io::Error::last_os_error().raw_os_error() != Some(libc::EPERM) {
            return Err(io::Error::other(format!("missing syscall denial: {name}")));
        }
        results.insert(name.into(), "denied".into());
        Ok(())
    };
    // SAFETY: these inert probes cannot execute code or connect to a destination.
    unsafe {
        denied(
            "host_unix_socket",
            libc::syscall(libc::SYS_socket, libc::AF_UNIX, libc::SOCK_STREAM, 0),
        )?;
        denied("namespace_change", libc::syscall(libc::SYS_unshare, 0))?;
        denied(
            "io_uring",
            libc::syscall(libc::SYS_io_uring_setup, 0, std::ptr::null::<u8>()),
        )?;
        denied(
            "host_fd_import",
            libc::syscall(libc::SYS_pidfd_getfd, -1, -1, 0),
        )?;
    }
    Ok(results)
}
