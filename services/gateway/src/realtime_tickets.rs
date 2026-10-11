//! Bounded memory-only handshake credentials; no HTTP authorization bypass.
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

struct Entry {
    origin: String,
    expires: Instant,
}
#[derive(Default)]
pub struct Tickets(Mutex<HashMap<[u8; 32], Entry>>);

pub struct SessionAuth {
    pub tickets: Tickets,
    port: u16,
}
impl SessionAuth {
    pub fn new(port: u16) -> Self {
        Self {
            tickets: Tickets::default(),
            port,
        }
    }
    pub fn allowed(&self, host: &str, origin: &str) -> bool {
        canonical_origin(origin)
            && origin == format!("http://{host}")
            && host
                .rsplit_once(':')
                .is_some_and(|(_, port)| port == self.port.to_string())
    }
}

fn canonical_origin(origin: &str) -> bool {
    let Some(value) = origin.strip_prefix("http://") else {
        return false;
    };
    let Some((host, port)) = value.rsplit_once(':') else {
        return false;
    };
    if !["localhost", "127.0.0.1", "[::1]"].contains(&host) {
        return false;
    }
    port.parse::<u16>()
        .is_ok_and(|number| number > 0 && number.to_string() == port)
}

impl Tickets {
    pub fn issue(&self, secret: &[u8; 32], origin: &str, now: Instant) -> bool {
        if !canonical_origin(origin) {
            return false;
        }
        let key: [u8; 32] = Sha256::digest(secret).into();
        let mut entries = self.0.lock().unwrap();
        entries.retain(|_, entry| entry.expires > now);
        if entries.len() >= 32 || entries.contains_key(&key) {
            return false;
        }
        entries.insert(
            key,
            Entry {
                origin: origin.to_owned(),
                expires: now + Duration::from_secs(30),
            },
        );
        true
    }
    pub fn consume(&self, secret: &[u8; 32], origin: &str, now: Instant) -> bool {
        let key: [u8; 32] = Sha256::digest(secret).into();
        self.0
            .lock()
            .unwrap()
            .remove(&key)
            .is_some_and(|entry| entry.expires > now && entry.origin == origin)
    }
}
