use rusqlite::{params, Connection};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;

pub struct Store {
    connection: Connection,
}
#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum SessionRequest {
    List { query: String, offset: usize },
    Rename { id: String, title: String },
    Delete { id: String },
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
        connection.execute_batch(include_str!("../migrations/0001-session-metadata.sql"))?;
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
        let deleted: bool = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM conversation_tombstones_v1 WHERE id=?1)",
            [id],
            |r| r.get(0),
        )?;
        if deleted {
            return Err(rusqlite::Error::InvalidQuery);
        }
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
    pub fn sessions(&mut self, owner: &str, request: SessionRequest) -> rusqlite::Result<Value> {
        match request {
            SessionRequest::List { query, offset } => {
                if query.chars().count() > 120 || offset > 1_000_000 {
                    return Err(rusqlite::Error::InvalidQuery);
                }
                let mut statement = self.connection.prepare(
                    "SELECT c.id,COALESCE(t.title,'Conversation ' || substr(c.id,1,8)) AS title FROM conversations c LEFT JOIN conversation_titles_v1 t ON t.id=c.id WHERE c.owner=?1 AND (instr(lower(COALESCE(t.title,'Conversation ' || substr(c.id,1,8))),lower(?2))>0 OR instr(lower(c.id),lower(?2))>0) ORDER BY c.rowid DESC LIMIT 101 OFFSET ?3")?;
                let mut data = statement
                    .query_map(params![owner, query, offset], |r| {
                        Ok(json!({"id":r.get::<_,String>(0)?,"title":r.get::<_,String>(1)?}))
                    })?
                    .collect::<rusqlite::Result<Vec<Value>>>()?;
                let has_more = data.len() > 100;
                data.truncate(100);
                Ok(json!({"data":data,"has_more":has_more}))
            }
            request => {
                let (id, title) = match request {
                    SessionRequest::Rename { id, title } => {
                        let title = title.trim().to_owned();
                        if title.is_empty()
                            || title.chars().count() > 120
                            || title.chars().any(char::is_control)
                        {
                            return Err(rusqlite::Error::InvalidQuery);
                        }
                        (id, Some(title))
                    }
                    SessionRequest::Delete { id } => (id, None),
                    SessionRequest::List { .. } => unreachable!(),
                };
                if id.is_empty()
                    || id.len() > 64
                    || !id
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
                {
                    return Err(rusqlite::Error::InvalidQuery);
                }
                let transaction = self.connection.transaction()?;
                let exists: bool = transaction.query_row(
                    "SELECT EXISTS(SELECT 1 FROM conversations WHERE id=?1 AND owner=?2)",
                    params![id, owner],
                    |r| r.get(0),
                )?;
                if !exists {
                    return Ok(json!({"changed":false}));
                }
                if let Some(title) = title {
                    transaction.execute("INSERT INTO conversation_titles_v1(id,title) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET title=excluded.title", params![id,title])?;
                } else {
                    transaction.execute(
                        "INSERT INTO conversation_tombstones_v1(id,owner) VALUES(?1,?2)",
                        params![id, owner],
                    )?;
                    transaction.execute("DELETE FROM turns WHERE conversation=?1", [&id])?;
                    transaction.execute(
                        "DELETE FROM conversations WHERE id=?1 AND owner=?2",
                        params![id, owner],
                    )?;
                }
                transaction.commit()?;
                Ok(json!({"changed":true}))
            }
        }
    }
    pub fn turns(&self, owner: &str, id: &str) -> rusqlite::Result<Vec<Value>> {
        let mut statement = self.connection.prepare("SELECT t.request,t.response,t.streaming FROM turns t JOIN conversations c ON c.id=t.conversation WHERE c.owner=?1 AND c.id=?2 ORDER BY t.id")?;
        let rows=statement.query_map(params![owner,id],|r| Ok(json!({"request":r.get::<_,String>(0)?,"response":r.get::<_,String>(1)?,"streaming":r.get::<_,bool>(2)?})))?.collect();
        rows
    }
}
