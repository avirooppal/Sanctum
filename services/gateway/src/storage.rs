use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::path::Path;

pub struct Store {
    connection: Connection,
}
impl Store {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        Self::initialize(Connection::open(path)?)
    }
    pub fn memory() -> rusqlite::Result<Self> {
        Self::initialize(Connection::open_in_memory()?)
    }
    fn initialize(connection: Connection) -> rusqlite::Result<Self> {
        connection.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, owner TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS turns(id INTEGER PRIMARY KEY, conversation TEXT NOT NULL REFERENCES conversations(id), request TEXT NOT NULL, response TEXT NOT NULL, streaming INTEGER NOT NULL);")?;
        Ok(Self { connection })
    }
    pub fn save(
        &self,
        owner: &str,
        id: &str,
        request: &Value,
        response: &str,
        streaming: bool,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT OR IGNORE INTO conversations(id,owner) VALUES(?1,?2)",
            params![id, owner],
        )?;
        let actual: String = self.connection.query_row(
            "SELECT owner FROM conversations WHERE id=?1",
            [id],
            |r| r.get(0),
        )?;
        if actual != owner {
            return Err(rusqlite::Error::InvalidQuery);
        }
        self.connection.execute(
            "INSERT INTO turns(conversation,request,response,streaming) VALUES(?1,?2,?3,?4)",
            params![id, request.to_string(), response, streaming],
        )?;
        Ok(())
    }
    pub fn conversations(&self, owner: &str) -> rusqlite::Result<Vec<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT id FROM conversations WHERE owner=?1 ORDER BY rowid DESC")?;
        let rows = statement.query_map([owner], |r| r.get(0))?.collect();
        rows
    }
    pub fn turns(&self, owner: &str, id: &str) -> rusqlite::Result<Vec<Value>> {
        let mut statement = self.connection.prepare("SELECT t.request,t.response,t.streaming FROM turns t JOIN conversations c ON c.id=t.conversation WHERE c.owner=?1 AND c.id=?2 ORDER BY t.id")?;
        let rows=statement.query_map(params![owner,id],|r| Ok(json!({"request":r.get::<_,String>(0)?,"response":r.get::<_,String>(1)?,"streaming":r.get::<_,bool>(2)?})))?.collect();
        rows
    }
}
