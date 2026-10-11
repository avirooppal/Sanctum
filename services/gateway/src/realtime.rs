//! Direct admitted WebSocket transport. Speech execution is integrated separately.
use crate::{
    realtime_tickets::SessionAuth,
    response_flow::{write_response, Budget},
};
use base64::Engine;
use sanctum_inference::cancellation::{Cancellation, Reason};
use std::{
    io::{self, Read},
    net::TcpStream,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tungstenite::protocol::frame::{
    coding::{CloseCode, Control, Data, OpCode},
    CloseFrame, Frame, FrameSocket,
};

struct SessionEnd(Cancellation);
impl Drop for SessionEnd {
    fn drop(&mut self) {
        self.0.cancel(Reason::Disconnect);
        eprintln!("realtime session closed reason={:?}", self.0.check().err());
    }
}

#[derive(Default)]
pub struct Audio {
    active: bool,
    sequence: u32,
    pcm: Vec<u8>,
}
impl Audio {
    pub fn start(&mut self) {
        self.clear();
        self.active = true;
    }
    pub fn clear(&mut self) {
        self.active = false;
        self.sequence = 0;
        self.pcm = Vec::new();
    }
    pub fn push(&mut self, bytes: &[u8]) -> Result<(), &'static str> {
        if !self.active || bytes.len() < 10 {
            return Err("audio_not_started");
        }
        let sequence = u32::from_le_bytes(bytes[..4].try_into().unwrap());
        let samples = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
        if sequence != self.sequence
            || samples == 0
            || samples > 3200
            || bytes.len() != 8 + samples * 2
            || self.pcm.len() + bytes.len() - 8 > 960000
        {
            return Err("audio_limits_or_sequence");
        }
        self.pcm.extend_from_slice(&bytes[8..]);
        self.sequence += 1;
        Ok(())
    }
}

struct GuardedRead {
    stream: TcpStream,
    context: Cancellation,
    stop: Arc<AtomicBool>,
    pending: usize,
    started: Option<Instant>,
    progress: Instant,
    tick: Instant,
    upload: Budget,
}
impl Read for GuardedRead {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        if self.stop.load(Ordering::Acquire) {
            self.context.cancel(Reason::Shutdown);
        }
        if self.context.check().is_err() {
            return Err(io::ErrorKind::TimedOut.into());
        }
        if self.pending > 0
            && (self.progress.elapsed() >= Duration::from_millis(1800)
                || self
                    .started
                    .is_some_and(|s| s.elapsed() >= Duration::from_secs(15)))
        {
            self.context.cancel(Reason::Deadline);
            return Err(io::ErrorKind::TimedOut.into());
        }
        let result = self.stream.read(bytes);
        let count = result.as_ref().copied().unwrap_or(0);
        let now = Instant::now();
        if count > 0 {
            if self.pending == 0 {
                self.started = Some(now);
                self.tick = now;
            }
            self.pending += count;
            self.progress = now;
        }
        if self.pending > 0 {
            if let Err(error) = self.upload.advance(now - self.tick, count) {
                self.context.cancel(Reason::Deadline);
                return Err(error);
            }
        }
        self.tick = now;
        result
    }
}
fn send(
    socket: &mut FrameSocket<GuardedRead>,
    frame: Frame,
    budget: &mut Budget,
) -> io::Result<()> {
    let mut bytes = Vec::new();
    frame.format(&mut bytes).map_err(io::Error::other)?;
    let io = socket.get_mut();
    write_response(&mut io.stream, &bytes, &io.context, &io.stop, budget)
}
fn close(socket: &mut FrameSocket<GuardedRead>, code: CloseCode, budget: &mut Budget) {
    let mut bytes = Vec::new();
    let _ = Frame::close(Some(CloseFrame {
        code,
        reason: "session closed".into(),
    }))
    .format(&mut bytes);
    let context = Cancellation::new(Instant::now() + Duration::from_millis(1800));
    let io = socket.get_mut();
    let _ = write_response(
        &mut io.stream,
        &bytes,
        &context,
        &AtomicBool::new(false),
        budget,
    );
}
fn event(
    socket: &mut FrameSocket<GuardedRead>,
    sequence: &mut u64,
    kind: &str,
    value: serde_json::Value,
    budget: &mut Budget,
) -> io::Result<()> {
    let bytes = serde_json::to_vec(
        &serde_json::json!({"protocol":"sanctum.realtime.v1", "sequence":*sequence, "type":kind, "data":value}),
    )?;
    *sequence += 1;
    send(
        socket,
        Frame::message(bytes, OpCode::Data(Data::Text), true),
        budget,
    )
}
pub fn serve(
    mut client: TcpStream,
    bytes: &[u8],
    auth: &SessionAuth,
    stop: Arc<AtomicBool>,
) -> io::Result<()> {
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut parsed = httparse::Request::new(&mut headers);
    parsed.parse(bytes).map_err(io::Error::other)?;
    let one = |name: &str| -> Option<&str> {
        let values: Vec<_> = parsed
            .headers
            .iter()
            .filter(|h| h.name.eq_ignore_ascii_case(name))
            .collect();
        if values.len() == 1 {
            std::str::from_utf8(values[0].value).ok()
        } else {
            None
        }
    };
    let origin = one("Origin").unwrap_or("");
    let host = one("Host").unwrap_or("");
    let protocols: Vec<_> = one("Sec-WebSocket-Protocol")
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .collect();
    let ticket = protocols.iter().find_map(|p| p.strip_prefix("ticket."));
    let secret = ticket
        .filter(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
        .and_then(|s| {
            let mut result = [0; 32];
            for (i, b) in result.iter_mut().enumerate() {
                *b = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok()?;
            }
            Some(result)
        });
    let accepted = secret.is_some_and(|s| auth.tickets.consume(&s, origin, Instant::now()));
    let key = one("Sec-WebSocket-Key").unwrap_or("");
    let valid = accepted
        && parsed.method == Some("GET")
        && parsed.path == Some("/v1/realtime")
        && parsed.version == Some(1)
        && auth.allowed(host, origin)
        && protocols.len() == 2
        && protocols.contains(&"sanctum.realtime.v1")
        && one("Upgrade").is_some_and(|s| s.eq_ignore_ascii_case("websocket"))
        && one("Connection").is_some_and(|s| {
            s.split(',')
                .any(|v| v.trim().eq_ignore_ascii_case("upgrade"))
        })
        && one("Sec-WebSocket-Version") == Some("13")
        && base64::engine::general_purpose::STANDARD
            .decode(key)
            .is_ok_and(|v| v.len() == 16)
        && one("Authorization").is_none();
    let context = Cancellation::new(Instant::now() + Duration::from_secs(900));
    let mut budget = Budget::default();
    if !valid {
        return write_response(
            &mut client,
            b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            &context,
            &stop,
            &mut budget,
        );
    }
    let _end = SessionEnd(context.clone());
    let accept = tungstenite::handshake::derive_accept_key(key.as_bytes());
    let reply = format!("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\nSec-WebSocket-Protocol: sanctum.realtime.v1\r\n\r\n");
    write_response(&mut client, reply.as_bytes(), &context, &stop, &mut budget)?;
    eprintln!("realtime session opened protocol=v1");
    let now = Instant::now();
    let mut socket = FrameSocket::new(GuardedRead {
        stream: client,
        context: context.clone(),
        stop: stop.clone(),
        pending: 0,
        started: None,
        progress: now,
        tick: now,
        upload: Budget::default(),
    });
    let mut audio = Audio::default();
    let mut turn: Option<Cancellation> = None;
    let mut sequence = 0;
    event(
        &mut socket,
        &mut sequence,
        "ready",
        serde_json::json!({"capabilities":["transport"],"speech_pipeline":false}),
        &mut budget,
    )?;
    let mut last_ping = Instant::now();
    let mut outstanding: Option<(Vec<u8>, Instant)> = None;
    let result = loop {
        if stop.load(Ordering::Acquire) {
            context.cancel(Reason::Shutdown);
        }
        if context.check().is_err() {
            close(&mut socket, CloseCode::Away, &mut budget);
            break Ok(());
        }
        if outstanding
            .as_ref()
            .is_some_and(|(_, when)| when.elapsed() >= Duration::from_secs(30))
        {
            close(&mut socket, CloseCode::Policy, &mut budget);
            break Ok(());
        }
        if outstanding.is_none() && last_ping.elapsed() >= Duration::from_secs(15) {
            let mut nonce = vec![0; 16];
            std::fs::File::open("/dev/urandom")?.read_exact(&mut nonce)?;
            if let Err(e) = send(&mut socket, Frame::ping(nonce.clone()), &mut budget) {
                break Err(e);
            }
            outstanding = Some((nonce, Instant::now()));
            last_ping = Instant::now();
        }
        let frame = match socket.read(Some(65536)) {
            Ok(Some(frame)) => frame,
            Ok(None) => break Ok(()),
            Err(tungstenite::Error::Io(e))
                if matches!(
                    e.kind(),
                    io::ErrorKind::WouldBlock
                        | io::ErrorKind::TimedOut
                        | io::ErrorKind::Interrupted
                ) =>
            {
                continue
            }
            Err(e) => {
                close(
                    &mut socket,
                    if matches!(e, tungstenite::Error::Capacity(_)) {
                        CloseCode::Size
                    } else {
                        CloseCode::Protocol
                    },
                    &mut budget,
                );
                break Ok(());
            }
        };
        let head = frame.header();
        if !head.is_final || head.rsv1 || head.rsv2 || head.rsv3 || head.mask.is_none() {
            close(&mut socket, CloseCode::Protocol, &mut budget);
            break Ok(());
        }
        let opcode = head.opcode;
        let mask = head.mask.unwrap();
        let wire_len = frame.len();
        let mut payload = frame.into_payload().to_vec();
        for (i, b) in payload.iter_mut().enumerate() {
            *b ^= mask[i % 4];
        }
        let io = socket.get_mut();
        io.pending = io.pending.saturating_sub(wire_len);
        if io.pending == 0 {
            io.started = None;
            io.upload = Budget::default();
        }
        match opcode {
            OpCode::Control(Control::Ping) if payload.len() <= 125 => {
                if let Err(e) = send(&mut socket, Frame::pong(payload), &mut budget) {
                    break Err(e);
                }
            }
            OpCode::Control(Control::Pong) if payload.len() <= 125 => {
                if outstanding
                    .as_ref()
                    .is_some_and(|(nonce, _)| nonce == &payload)
                {
                    outstanding = None;
                }
            }
            OpCode::Control(Control::Close) => {
                let valid = payload.is_empty()
                    || (payload.len() >= 2
                        && payload.len() <= 125
                        && (matches!(u16::from_be_bytes([payload[0],payload[1]]), 1000..=1003 | 1007..=1014 | 3000..=4999))
                        && std::str::from_utf8(&payload[2..]).is_ok());
                close(
                    &mut socket,
                    if valid {
                        CloseCode::Normal
                    } else {
                        CloseCode::Protocol
                    },
                    &mut budget,
                );
                break Ok(());
            }
            OpCode::Data(Data::Binary) => {
                if audio.push(&payload).is_err() {
                    close(&mut socket, CloseCode::Policy, &mut budget);
                    break Ok(());
                }
            }
            OpCode::Data(Data::Text) if payload.len() > 4096 => {
                close(&mut socket, CloseCode::Size, &mut budget);
                break Ok(());
            }
            OpCode::Data(Data::Text) => {
                let value: serde_json::Value = match serde_json::from_slice(&payload) {
                    Ok(value) => value,
                    Err(_) => {
                        close(&mut socket, CloseCode::Invalid, &mut budget);
                        break Ok(());
                    }
                };
                let Some(object) = value.as_object() else {
                    close(&mut socket, CloseCode::Invalid, &mut budget);
                    break Ok(());
                };
                let kind = value["type"].as_str().unwrap_or("");
                let valid = match kind {
                    "start" | "stop" | "interrupt" | "metrics" => object.len() == 1,
                    "config" => object.len() == 2 && value["sample_rate"] == 16000,
                    "playback" => object.len() == 2 && value["sequence"].as_u64() == Some(0),
                    _ => false,
                };
                if !valid {
                    close(&mut socket, CloseCode::Policy, &mut budget);
                    break Ok(());
                }
                let data = match kind {
                    "start" => {
                        if let Some(previous) = turn.take() {
                            previous.cancel(Reason::Explicit);
                        }
                        turn = Some(context.child(Instant::now() + Duration::from_secs(330)));
                        audio.start();
                        serde_json::json!({"started":true})
                    }
                    "stop" | "interrupt" => {
                        if let Some(previous) = turn.take() {
                            previous.cancel(Reason::Explicit);
                        }
                        audio.clear();
                        serde_json::json!({"discarded":true,"speech_pipeline":false})
                    }
                    "metrics" => {
                        serde_json::json!({"buffered_pcm_bytes":audio.pcm.len(),"engine_slots":0})
                    }
                    _ => serde_json::json!({"accepted":true}),
                };
                if let Err(e) = event(
                    &mut socket,
                    &mut sequence,
                    if kind == "stop" {
                        "capability_unavailable"
                    } else {
                        kind
                    },
                    data,
                    &mut budget,
                ) {
                    break Err(e);
                }
            }
            _ => {
                close(&mut socket, CloseCode::Protocol, &mut budget);
                break Ok(());
            }
        }
    };
    context.cancel(Reason::Disconnect);
    if let Some(turn) = turn {
        turn.cancel(Reason::Disconnect);
    }
    result
}
