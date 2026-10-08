use sanctum_gateway::storage::Store;
use sanctum_inference::{Engine, LocalEngine};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::{
    error::Error,
    fs,
    io::{self, Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

type Result<T> = std::result::Result<T, Box<dyn Error + Send + Sync>>;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Artifact {
    path: PathBuf,
    sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Model {
    id: String,
    artifact: Artifact,
    port: u16,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    engine: PathBuf,
    engine_files: Vec<Artifact>,
    chat: Model,
    embedding: Model,
    threads: usize,
    context: usize,
    state_dir: PathBuf,
    ui_dir: PathBuf,
}

fn verify(artifact: &Artifact) -> Result<()> {
    let mut file = fs::File::open(&artifact.path)?;
    let mut hash = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != artifact.sha256 {
        return Err(format!("artifact verification failed: {}", artifact.path.display()).into());
    }
    Ok(())
}

pub fn random_id() -> io::Result<String> {
    let mut bytes = [0u8; 32];
    fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

struct Engines(Vec<Child>);
impl Drop for Engines {
    fn drop(&mut self) {
        for child in &mut self.0 {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub struct Chat {
    config: Config,
    token: String,
    store: Store,
    chat: LocalEngine,
    embedding: LocalEngine,
    _engines: Engines,
}

impl Chat {
    pub fn load(path: &Path) -> Result<Self> {
        let mut config: Config = serde_json::from_slice(&fs::read(path)?)?;
        if let Some(relative) = config.state_dir.to_str().and_then(|s| s.strip_prefix("~/")) {
            config.state_dir = PathBuf::from(std::env::var("HOME")?).join(relative);
        }
        if config.engine_files.is_empty()
            || !config.engine_files.iter().any(|a| a.path == config.engine)
        {
            return Err("engine executable must be covered by manifest".into());
        }
        for artifact in config
            .engine_files
            .iter()
            .chain([&config.chat.artifact, &config.embedding.artifact])
        {
            verify(artifact)?;
        }
        fs::create_dir_all(&config.state_dir)?;
        fs::set_permissions(&config.state_dir, fs::Permissions::from_mode(0o700))?;
        let token_path = config.state_dir.join("local.token");
        let token = if token_path.exists() {
            if fs::metadata(&token_path)?.permissions().mode() & 0o077 != 0 {
                return Err("local token has unsafe permissions".into());
            }
            fs::read_to_string(&token_path)?
        } else {
            let token = random_id()?;
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&token_path)?;
            file.write_all(token.as_bytes())?;
            token
        };
        if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("invalid local token".into());
        }
        let store_path = config.state_dir.join("sanctum.sqlite3");
        let store = Store::open(&store_path)?;
        fs::set_permissions(&store_path, fs::Permissions::from_mode(0o600))?;
        let mut engines = Engines(Vec::new());
        for (model, embedding) in [(&config.chat, false), (&config.embedding, true)] {
            let mut command = Command::new(std::env::current_exe()?);
            command
                .arg("--engine-child")
                .arg(&config.engine)
                .args([
                    "--offline",
                    "--log-disable",
                    "--no-webui",
                    "--host",
                    "127.0.0.1",
                    "--port",
                ])
                .arg(model.port.to_string())
                .arg("--model")
                .arg(&model.artifact.path)
                .arg("--alias")
                .arg(&model.id)
                .arg("--threads")
                .arg(config.threads.to_string())
                .arg("--ctx-size")
                .arg(config.context.to_string())
                .args(["--parallel", "1"])
                .env_clear()
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            if embedding {
                command.args(["--embedding", "--pooling", "last"]);
            } else {
                command.arg("--jinja");
            }
            engines.0.push(command.spawn()?);
        }
        let chat = LocalEngine::new(&format!("http://127.0.0.1:{}", config.chat.port))?;
        let embedding = LocalEngine::new(&format!("http://127.0.0.1:{}", config.embedding.port))?;
        let deadline = Instant::now() + Duration::from_secs(120);
        while !chat.healthy() || !embedding.healthy() {
            for child in &mut engines.0 {
                if child.try_wait()?.is_some() {
                    return Err("local engine exited during startup".into());
                }
            }
            if Instant::now() > deadline {
                return Err("local engine startup timeout".into());
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        Ok(Self {
            config,
            token,
            store,
            chat,
            embedding,
            _engines: engines,
        })
    }
    pub fn token_path(&self) -> PathBuf {
        self.config.state_dir.join("local.token")
    }
    pub fn handle(&self, mut request: tiny_http::Request) -> Result<()> {
        let path = request.url().to_string();
        if !path.starts_with("/v1/") {
            return self.static_file(request);
        }
        let given = request
            .headers()
            .iter()
            .find(|h| h.field.equiv("Authorization"))
            .map(|h| h.value.as_str())
            .unwrap_or("");
        let expected = format!("Bearer {}", self.token);
        let authorized = given.len() == expected.len()
            && given
                .bytes()
                .zip(expected.bytes())
                .fold(0u8, |diff, (a, b)| diff | (a ^ b))
                == 0;
        if !authorized {
            return respond(
                request,
                401,
                json!({"error":{"message":"Invalid local API token","type":"authentication_error"}}),
            );
        }
        if request.method() == &tiny_http::Method::Get {
            return match path.as_str() {
                "/v1/models" => respond(
                    request,
                    200,
                    json!({"object":"list","data":[{"id":self.config.chat.id,"object":"model","created":0,"owned_by":"local","capabilities":["text","tools"]},{"id":self.config.embedding.id,"object":"model","created":0,"owned_by":"local","capabilities":["embedding"]}]}),
                ),
                "/v1/conversations" => respond(
                    request,
                    200,
                    json!({"data":self.store.conversations("local-owner")?}),
                ),
                p if p.starts_with("/v1/conversations/") => respond(
                    request,
                    200,
                    json!({"data":self.store.turns("local-owner",p.trim_start_matches("/v1/conversations/"))?}),
                ),
                _ => respond(request, 404, json!({"error":{"message":"Not found"}})),
            };
        }
        if request.method() != &tiny_http::Method::Post
            || !matches!(path.as_str(), "/v1/chat/completions" | "/v1/embeddings")
        {
            return respond(request, 404, json!({"error":{"message":"Not found"}}));
        }
        let mut body = Vec::new();
        request
            .as_reader()
            .take(1024 * 1024 + 1)
            .read_to_end(&mut body)?;
        if body.len() > 1024 * 1024 {
            return respond(
                request,
                413,
                json!({"error":{"message":"Request too large"}}),
            );
        }
        let mut payload: Value = match serde_json::from_slice(&body) {
            Ok(value) => value,
            Err(_) => return respond(request, 400, json!({"error":{"message":"Invalid JSON"}})),
        };
        let is_chat = path == "/v1/chat/completions";
        let expected_model = if is_chat {
            &self.config.chat.id
        } else {
            &self.config.embedding.id
        };
        if payload.get("model").and_then(Value::as_str) != Some(expected_model) {
            return respond(
                request,
                400,
                json!({"error":{"message":"Unknown model for this endpoint"}}),
            );
        }
        if is_chat
            && !payload
                .get("messages")
                .is_some_and(|v| v.is_array() && !v.as_array().unwrap().is_empty())
        {
            return respond(
                request,
                400,
                json!({"error":{"message":"messages required"}}),
            );
        }
        if is_chat
            && payload
                .get("max_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(256)
                > 4096
        {
            return respond(
                request,
                400,
                json!({"error":{"message":"max_tokens exceeds 4096"}}),
            );
        }
        if is_chat {
            if payload.get("max_tokens").is_none() {
                payload["max_tokens"] = json!(256);
            }
            payload["chat_template_kwargs"] = json!({"enable_thinking":false});
        }
        let stream = payload
            .get("stream")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let conversation = request
            .headers()
            .iter()
            .find(|h| h.field.equiv("X-Sanctum-Conversation"))
            .map(|h| h.value.to_string())
            .unwrap_or(random_id()?);
        if conversation.len() > 64
            || !conversation
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        {
            return respond(
                request,
                400,
                json!({"error":{"message":"Invalid conversation ID"}}),
            );
        }
        let engine: &dyn Engine = if is_chat { &self.chat } else { &self.embedding };
        let reply = match engine.send(&path, &payload) {
            Ok(reply) => reply,
            Err(_) => {
                return respond(
                    request,
                    502,
                    json!({"error":{"message":"Local engine unavailable"}}),
                )
            }
        };
        let captured = Arc::new(Mutex::new(Vec::new()));
        let response = tiny_http::Response::new(
            tiny_http::StatusCode(reply.status),
            vec![
                tiny_http::Header::from_bytes("Content-Type", reply.content_type.as_str()).unwrap(),
                tiny_http::Header::from_bytes("X-Sanctum-Conversation", conversation.as_str())
                    .unwrap(),
                tiny_http::Header::from_bytes("Cache-Control", "no-store").unwrap(),
            ],
            Capture {
                inner: reply.body,
                captured: captured.clone(),
            },
            None,
            None,
        );
        request.respond(response)?;
        if is_chat && reply.status == 200 {
            let bytes = captured.lock().map_err(|_| "capture poisoned")?;
            self.store.save(
                "local-owner",
                &conversation,
                &payload,
                &String::from_utf8_lossy(&bytes),
                stream,
            )?;
        }
        Ok(())
    }
    fn static_file(&self, request: tiny_http::Request) -> Result<()> {
        let path = request.url().split('?').next().unwrap_or("/");
        let relative = if path == "/" {
            "index.html"
        } else {
            path.trim_start_matches('/')
        };
        if request.method() != &tiny_http::Method::Get
            || relative.split('/').any(|p| p == ".." || p.contains('\\'))
        {
            return respond(request, 404, json!({"error":"not_found"}));
        }
        let file = self.config.ui_dir.join(relative);
        let content = match fs::read(&file) {
            Ok(content) => content,
            Err(_) => return respond(request, 404, json!({"error":"not_found"})),
        };
        let mime = match file.extension().and_then(|s| s.to_str()) {
            Some("js") => "text/javascript",
            Some("css") => "text/css",
            _ => "text/html",
        };
        request.respond(tiny_http::Response::from_data(content).with_header(tiny_http::Header::from_bytes("Content-Type",mime).unwrap()).with_header(tiny_http::Header::from_bytes("Content-Security-Policy","default-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'").unwrap()))?;
        Ok(())
    }
}
struct Capture {
    inner: Box<dyn Read + Send + Sync>,
    captured: Arc<Mutex<Vec<u8>>>,
}
impl Read for Capture {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        let count = self.inner.read(buffer)?;
        let mut bytes = self
            .captured
            .lock()
            .map_err(|_| io::Error::other("capture poisoned"))?;
        if bytes.len() + count > 4 * 1024 * 1024 {
            return Err(io::Error::other("response exceeds capture limit"));
        }
        bytes.extend_from_slice(&buffer[..count]);
        Ok(count)
    }
}
fn respond(request: tiny_http::Request, status: u16, payload: Value) -> Result<()> {
    request.respond(
        tiny_http::Response::from_string(payload.to_string())
            .with_status_code(status)
            .with_header(
                tiny_http::Header::from_bytes("Content-Type", "application/json").unwrap(),
            ),
    )?;
    Ok(())
}
