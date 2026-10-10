use sanctum_gateway::{
    cancellable_io::ContextIo,
    supervision::{terminate, OwnedChild},
};
use sanctum_inference::cancellation::Cancellation;
use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub struct Knowledge {
    child: OwnedChild,
    input: ContextIo<std::process::ChildStdin>,
    output: BufReader<ContextIo<std::process::ChildStdout>>,
    settings: (PathBuf, PathBuf, PathBuf),
}
impl Knowledge {
    pub fn start(python: &Path, config: &Path, state: &Path) -> Result<Self> {
        let context = Cancellation::new(Instant::now() + Duration::from_secs(120));
        Self::start_with_context(python, config, state, &context)
    }
    fn start_with_context(
        python: &Path,
        config: &Path,
        state: &Path,
        context: &Cancellation,
    ) -> Result<Self> {
        context.check()?;
        let mut child = OwnedChild(
            Command::new(std::env::current_exe()?)
                .arg("--engine-child")
                .arg(python)
                .arg("services/knowledge/worker.py")
                .arg(config)
                .arg(state)
                .env_clear()
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()?,
        );
        let input = ContextIo::new(
            child.stdin.take().ok_or("missing worker stdin")?,
            context.clone(),
        )?;
        let output = BufReader::new(ContextIo::new(
            child.stdout.take().ok_or("missing worker stdout")?,
            context.clone(),
        )?);
        let mut instance = Self {
            child,
            input,
            output,
            settings: (python.into(), config.into(), state.into()),
        };
        let ready = instance.read()?;
        if ready["ready"] != true {
            return Err("knowledge worker failed startup".into());
        }
        Ok(instance)
    }
    fn read(&mut self) -> Result<Value> {
        let mut line = Vec::new();
        self.output
            .by_ref()
            .take(16 * 1024 * 1024 + 1)
            .read_until(b'\n', &mut line)?;
        if line.len() > 16 * 1024 * 1024 {
            return Err("oversized knowledge response".into());
        }
        Ok(serde_json::from_slice(&line)?)
    }
    pub fn call(
        &mut self,
        request: Value,
        context: &sanctum_inference::cancellation::Cancellation,
    ) -> Result<Value> {
        context.check()?;
        if self.child.try_wait()?.is_some() {
            // Restart only for the next request; never replay a possibly committed write.
            for _ in 0..10 {
                context.check()?;
                std::thread::sleep(Duration::from_millis(10));
            }
            let (python, config, state) = self.settings.clone();
            *self = Self::start_with_context(&python, &config, &state, context)?;
        }
        self.input.set_context(context.clone());
        self.output.get_mut().set_context(context.clone());
        let result = (|| {
            serde_json::to_writer(&mut self.input, &request)?;
            self.input.write_all(b"\n")?;
            self.input.flush()?;
            self.read()
        })();
        if result.is_err() {
            terminate(&mut self.child)?;
        }
        result
    }
}
