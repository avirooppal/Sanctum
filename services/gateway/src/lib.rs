//! Foundation envelope and bounded IPC. No public API/authentication yet.
use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub mod cancellable_io;
pub mod dispatch;
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub mod ingress;
pub mod storage;
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub mod supervision;

pub const MAX_FRAME: usize = 64 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataClass {
    Public,
    Internal,
    Confidential,
    Restricted,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PolicyContext {
    pub cloud_connectors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RequestEnvelope {
    pub user: String,
    pub workspace: String,
    pub data_class: DataClass,
    pub trace_id: String,
    pub policy_context: PolicyContext,
}

impl RequestEnvelope {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.user.is_empty() || self.workspace.is_empty() {
            return Err("identity and workspace required");
        }
        let trace = self.trace_id.as_bytes();
        if trace.len() != 32
            || trace.iter().all(|c| *c == b'0')
            || !trace
                .iter()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(c))
        {
            return Err("invalid trace_id");
        }
        if !self.policy_context.cloud_connectors.is_empty() {
            return Err("cloud connectors are disabled");
        }
        Ok(())
    }
}

pub fn read_frame(reader: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut header = [0; 4];
    reader.read_exact(&mut header)?;
    let length = u32::from_be_bytes(header) as usize;
    if length == 0 || length > MAX_FRAME {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "invalid frame size",
        ));
    }
    let mut payload = vec![0; length];
    reader.read_exact(&mut payload)?;
    Ok(payload)
}

pub fn write_frame(writer: &mut impl Write, payload: &[u8]) -> io::Result<()> {
    if payload.is_empty() || payload.len() > MAX_FRAME {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "invalid frame size",
        ));
    }
    writer.write_all(&(payload.len() as u32).to_be_bytes())?;
    writer.write_all(payload)?;
    writer.flush()
}

#[cfg(target_os = "linux")]
pub mod response_flow;
