use serde_json::Value;
use std::{
    cell::RefCell,
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
};
type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub struct Knowledge {
    child: RefCell<Child>,
    output: RefCell<BufReader<std::process::ChildStdout>>,
}
impl Knowledge {
    pub fn start(python: &Path, config: &Path, state: &Path) -> Result<Self> {
        let mut child = Command::new(std::env::current_exe()?)
            .arg("--engine-child")
            .arg(python)
            .arg("services/knowledge/worker.py")
            .arg(config)
            .arg(state)
            .env_clear()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;
        let output = BufReader::new(child.stdout.take().ok_or("missing worker stdout")?);
        let instance = Self {
            child: RefCell::new(child),
            output: RefCell::new(output),
        };
        let ready = instance.read()?;
        if ready["ready"] != true {
            return Err("knowledge worker failed startup".into());
        }
        Ok(instance)
    }
    fn read(&self) -> Result<Value> {
        let mut line = Vec::new();
        self.output
            .borrow_mut()
            .by_ref()
            .take(16 * 1024 * 1024 + 1)
            .read_until(b'\n', &mut line)?;
        if line.len() > 16 * 1024 * 1024 {
            return Err("oversized knowledge response".into());
        }
        Ok(serde_json::from_slice(&line)?)
    }
    pub fn call(&self, request: Value) -> Result<Value> {
        let mut child = self.child.borrow_mut();
        let input = child.stdin.as_mut().ok_or("missing worker stdin")?;
        serde_json::to_writer(&mut *input, &request)?;
        input.write_all(b"\n")?;
        input.flush()?;
        self.read()
    }
}
impl Drop for Knowledge {
    fn drop(&mut self) {
        let _ = self.child.get_mut().kill();
        let _ = self.child.get_mut().wait();
    }
}
