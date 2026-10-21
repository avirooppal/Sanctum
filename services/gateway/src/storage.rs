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
    Pin { id: String, pinned: bool },
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
        connection.execute_batch(include_str!("../migrations/0002-user-preferences.sql"))?;
        connection.execute_batch(include_str!("../migrations/0003-session-pins.sql"))?;
        connection.execute_batch(include_str!("../migrations/0004-assistant-profiles.sql"))?;
        connection.execute_batch(include_str!(
            "../migrations/0005-turn-conversation-index.sql"
        ))?;
        connection.execute_batch(include_str!("../migrations/0006-mcp-servers.sql"))?;
        connection.execute_batch(include_str!("../migrations/0007-skills-and-memory.sql"))?;
        connection.execute_batch(include_str!("../migrations/0008-provider-keys.sql"))?;
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
                    "SELECT c.id, COALESCE(t.title, 'Conversation ' || substr(c.id, 1, 8)) AS title, COALESCE(p.pinned, 0) AS pinned \
                     FROM conversations c \
                     LEFT JOIN conversation_titles_v1 t ON t.id = c.id \
                     LEFT JOIN conversation_pins_v1 p ON p.id = c.id \
                     WHERE c.owner = ?1 \
                       AND ( \
                         instr(lower(COALESCE(t.title, 'Conversation ' || substr(c.id, 1, 8))), lower(?2)) > 0 \
                         OR instr(lower(c.id), lower(?2)) > 0 \
                         OR EXISTS(SELECT 1 FROM turns tr WHERE tr.conversation = c.id AND (instr(lower(tr.request), lower(?2)) > 0 OR instr(lower(tr.response), lower(?2)) > 0)) \
                       ) \
                     ORDER BY COALESCE(p.pinned, 0) DESC, c.rowid DESC \
                     LIMIT 101 OFFSET ?3",
                )?;
                let mut data = statement
                    .query_map(params![owner, query, offset], |r| {
                        Ok(json!({
                            "id": r.get::<_, String>(0)?,
                            "title": r.get::<_, String>(1)?,
                            "pinned": r.get::<_, i64>(2)? != 0
                        }))
                    })?
                    .collect::<rusqlite::Result<Vec<Value>>>()?;
                let has_more = data.len() > 100;
                data.truncate(100);
                Ok(json!({"data":data,"has_more":has_more}))
            }
            request => {
                enum Action {
                    Rename(String),
                    Delete,
                    Pin(bool),
                }
                let (id, action) = match request {
                    SessionRequest::Rename { id, title } => {
                        let title = title.trim().to_owned();
                        if title.is_empty()
                            || title.chars().count() > 120
                            || title.chars().any(char::is_control)
                        {
                            return Err(rusqlite::Error::InvalidQuery);
                        }
                        (id, Action::Rename(title))
                    }
                    SessionRequest::Delete { id } => (id, Action::Delete),
                    SessionRequest::Pin { id, pinned } => (id, Action::Pin(pinned)),
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
                match action {
                    Action::Rename(title) => {
                        transaction.execute(
                            "INSERT INTO conversation_titles_v1(id,title) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET title=excluded.title",
                            params![id, title],
                        )?;
                    }
                    Action::Pin(pinned) => {
                        if pinned {
                            transaction.execute(
                                "INSERT INTO conversation_pins_v1(id, pinned, updated_at) VALUES(?1, 1, unixepoch()) ON CONFLICT(id) DO UPDATE SET pinned=1, updated_at=excluded.updated_at",
                                params![id],
                            )?;
                        } else {
                            transaction.execute(
                                "DELETE FROM conversation_pins_v1 WHERE id=?1",
                                params![id],
                            )?;
                        }
                    }
                    Action::Delete => {
                        transaction.execute(
                            "INSERT INTO conversation_tombstones_v1(id,owner) VALUES(?1,?2)",
                            params![id, owner],
                        )?;
                        transaction
                            .execute("DELETE FROM conversation_pins_v1 WHERE id=?1", [&id])?;
                        transaction.execute("DELETE FROM turns WHERE conversation=?1", [&id])?;
                        transaction.execute(
                            "DELETE FROM conversations WHERE id=?1 AND owner=?2",
                            params![id, owner],
                        )?;
                    }
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

    pub fn conversation_usage(
        &self,
        owner: &str,
        id: &str,
        context_length: usize,
    ) -> rusqlite::Result<Value> {
        let mut statement = self.connection.prepare(
            "SELECT t.response FROM turns t JOIN conversations c ON c.id=?1 AND c.owner=?2",
        )?;
        let rows = statement.query_map(params![id, owner], |r| r.get::<_, String>(0))?;
        let mut prompt_tokens = 0;
        let mut completion_tokens = 0;
        let mut has_usage = false;
        for row in rows {
            let resp = row?;
            if let Ok(val) = serde_json::from_str::<Value>(&resp) {
                if let Some(usage) = val.get("usage") {
                    if let Some(pt) = usage.get("prompt_tokens").and_then(|p| p.as_u64()) {
                        prompt_tokens += pt as usize;
                        has_usage = true;
                    }
                    if let Some(ct) = usage.get("completion_tokens").and_then(|c| c.as_u64()) {
                        completion_tokens += ct as usize;
                        has_usage = true;
                    }
                }
            }
        }
        let total_tokens = prompt_tokens + completion_tokens;
        Ok(json!({
            "conversation_id": id,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "context_length": context_length,
            "has_data": has_usage
        }))
    }
    pub fn preferences(&self, owner: &str) -> rusqlite::Result<Option<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT preferences FROM user_preferences_v1 WHERE owner=?1")?;
        let mut rows = statement.query_map([owner], |r| r.get(0))?;
        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn save_preferences(&self, owner: &str, preferences: &str) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO user_preferences_v1(owner,preferences,updated_at) VALUES(?1,?2,unixepoch()) ON CONFLICT(owner) DO UPDATE SET preferences=excluded.preferences,updated_at=excluded.updated_at",
            params![owner, preferences],
        )?;
        Ok(())
    }

    pub fn profiles(&self, owner: &str) -> rusqlite::Result<Vec<Value>> {
        let mut statement = self.connection.prepare(
            "SELECT id, name, system_prompt, scope, created_at, updated_at FROM assistant_profiles_v1 WHERE owner=?1 ORDER BY updated_at DESC",
        )?;
        let rows = statement
            .query_map([owner], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "name": r.get::<_, String>(1)?,
                    "system_prompt": r.get::<_, String>(2)?,
                    "scope": r.get::<_, String>(3)?,
                    "created_at": r.get::<_, i64>(4)?,
                    "updated_at": r.get::<_, i64>(5)?
                }))
            })?
            .collect::<Result<Vec<Value>, _>>()?;
        Ok(rows)
    }

    pub fn save_profile(
        &self,
        owner: &str,
        id: &str,
        name: &str,
        system_prompt: &str,
        scope: &str,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO assistant_profiles_v1(id, owner, name, system_prompt, scope, created_at, updated_at) \
             VALUES(?1, ?2, ?3, ?4, ?5, unixepoch(), unixepoch()) \
             ON CONFLICT(id) DO UPDATE SET \
                name=excluded.name, \
                system_prompt=excluded.system_prompt, \
                scope=excluded.scope, \
                updated_at=excluded.updated_at \
             WHERE owner=excluded.owner",
            params![id, owner, name, system_prompt, scope],
        )?;
        Ok(())
    }

    pub fn delete_profile(&self, owner: &str, id: &str) -> rusqlite::Result<bool> {
        let count = self.connection.execute(
            "DELETE FROM assistant_profiles_v1 WHERE id=?1 AND owner=?2",
            params![id, owner],
        )?;
        Ok(count > 0)
    }

    // --- MCP Servers ---

    pub fn mcp_servers(&self, owner: &str) -> rusqlite::Result<Vec<Value>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, name, command, args, status, created_at FROM mcp_servers_v1 WHERE owner=?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt
            .query_map([owner], |r| {
                let args_str: String = r.get(3)?;
                let args_json: Value = serde_json::from_str(&args_str).unwrap_or_else(|_| json!([]));
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "name": r.get::<_, String>(1)?,
                    "command": r.get::<_, String>(2)?,
                    "args": args_json,
                    "status": r.get::<_, String>(4)?,
                    "created_at": r.get::<_, i64>(5)?
                }))
            })?
            .collect::<Result<Vec<Value>, _>>()?;
        Ok(rows)
    }

    pub fn save_mcp_server(
        &self,
        owner: &str,
        id: &str,
        name: &str,
        command: &str,
        args: &str,
        status: &str,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO mcp_servers_v1(id, owner, name, command, args, status, created_at) \
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, unixepoch()) \
             ON CONFLICT(id) DO UPDATE SET \
                name=excluded.name, \
                command=excluded.command, \
                args=excluded.args, \
                status=excluded.status \
             WHERE owner=excluded.owner",
            params![id, owner, name, command, args, status],
        )?;
        Ok(())
    }

    pub fn delete_mcp_server(&self, owner: &str, id: &str) -> rusqlite::Result<bool> {
        let count = self.connection.execute(
            "DELETE FROM mcp_servers_v1 WHERE id=?1 AND owner=?2",
            params![id, owner],
        )?;
        Ok(count > 0)
    }

    // --- Skills ---

    pub fn skills(&self, owner: &str) -> rusqlite::Result<Vec<Value>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, name, description, content, enabled, created_at, updated_at FROM skills_v1 WHERE owner=?1 ORDER BY name ASC",
        )?;
        let rows = stmt
            .query_map([owner], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "name": r.get::<_, String>(1)?,
                    "description": r.get::<_, String>(2)?,
                    "content": r.get::<_, String>(3)?,
                    "enabled": r.get::<_, i64>(4)? == 1,
                    "created_at": r.get::<_, i64>(5)?,
                    "updated_at": r.get::<_, i64>(6)?
                }))
            })?
            .collect::<Result<Vec<Value>, _>>()?;
        Ok(rows)
    }

    pub fn save_skill(
        &self,
        owner: &str,
        id: &str,
        name: &str,
        description: &str,
        content: &str,
        enabled: bool,
    ) -> rusqlite::Result<()> {
        let en: i64 = if enabled { 1 } else { 0 };
        self.connection.execute(
            "INSERT INTO skills_v1(id, owner, name, description, content, enabled, created_at, updated_at) \
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, unixepoch(), unixepoch()) \
             ON CONFLICT(id) DO UPDATE SET \
                name=excluded.name, \
                description=excluded.description, \
                content=excluded.content, \
                enabled=excluded.enabled, \
                updated_at=excluded.updated_at \
             WHERE owner=excluded.owner",
            params![id, owner, name, description, content, en],
        )?;
        Ok(())
    }

    pub fn delete_skill(&self, owner: &str, id: &str) -> rusqlite::Result<bool> {
        let count = self.connection.execute(
            "DELETE FROM skills_v1 WHERE id=?1 AND owner=?2",
            params![id, owner],
        )?;
        Ok(count > 0)
    }

    // --- Memories ---

    pub fn memories(&self, owner: &str, assistant_id: Option<&str>) -> rusqlite::Result<Vec<Value>> {
        let (query, has_asst) = match assistant_id {
            Some(_) => (
                "SELECT id, assistant_id, fact, category, created_at, updated_at FROM memories_v1 WHERE owner=?1 AND (assistant_id=?2 OR assistant_id IS NULL) ORDER BY updated_at DESC",
                true,
            ),
            None => (
                "SELECT id, assistant_id, fact, category, created_at, updated_at FROM memories_v1 WHERE owner=?1 ORDER BY updated_at DESC",
                false,
            ),
        };
        let mut stmt = self.connection.prepare(query)?;
        let rows = if has_asst {
            stmt.query_map(params![owner, assistant_id.unwrap()], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "assistant_id": r.get::<_, Option<String>>(1)?,
                    "fact": r.get::<_, String>(2)?,
                    "category": r.get::<_, String>(3)?,
                    "created_at": r.get::<_, i64>(4)?,
                    "updated_at": r.get::<_, i64>(5)?
                }))
            })?
            .collect::<Result<Vec<Value>, _>>()?
        } else {
            stmt.query_map([owner], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "assistant_id": r.get::<_, Option<String>>(1)?,
                    "fact": r.get::<_, String>(2)?,
                    "category": r.get::<_, String>(3)?,
                    "created_at": r.get::<_, i64>(4)?,
                    "updated_at": r.get::<_, i64>(5)?
                }))
            })?
            .collect::<Result<Vec<Value>, _>>()?
        };
        Ok(rows)
    }

    pub fn save_memory(
        &self,
        owner: &str,
        id: &str,
        assistant_id: Option<&str>,
        fact: &str,
        category: &str,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO memories_v1(id, owner, assistant_id, fact, category, created_at, updated_at) \
             VALUES(?1, ?2, ?3, ?4, ?5, unixepoch(), unixepoch()) \
             ON CONFLICT(id) DO UPDATE SET \
                fact=excluded.fact, \
                category=excluded.category, \
                updated_at=excluded.updated_at \
             WHERE owner=excluded.owner",
            params![id, owner, assistant_id, fact, category],
        )?;
        Ok(())
    }

    pub fn delete_memory(&self, owner: &str, id: &str) -> rusqlite::Result<bool> {
        let count = self.connection.execute(
            "DELETE FROM memories_v1 WHERE id=?1 AND owner=?2",
            params![id, owner],
        )?;
        Ok(count > 0)
    }

    // --- Provider Keys ---

    pub fn provider_keys(&self, owner: &str) -> rusqlite::Result<Vec<Value>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, base_url, updated_at FROM provider_keys_v1 WHERE owner=?1 ORDER BY id ASC",
        )?;
        let rows = stmt
            .query_map([owner], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "has_key": true,
                    "base_url": r.get::<_, Option<String>>(1)?,
                    "updated_at": r.get::<_, i64>(2)?
                }))
            })?
            .collect::<Result<Vec<Value>, _>>()?;
        Ok(rows)
    }

    pub fn save_provider_key(
        &self,
        owner: &str,
        id: &str,
        api_key: &str,
        base_url: Option<&str>,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO provider_keys_v1(id, owner, api_key, base_url, updated_at) \
             VALUES(?1, ?2, ?3, ?4, unixepoch()) \
             ON CONFLICT(id) DO UPDATE SET \
                api_key=excluded.api_key, \
                base_url=excluded.base_url, \
                updated_at=excluded.updated_at \
             WHERE owner=excluded.owner",
            params![id, owner, api_key, base_url],
        )?;
        Ok(())
    }

    pub fn delete_provider_key(&self, owner: &str, id: &str) -> rusqlite::Result<bool> {
        let count = self.connection.execute(
            "DELETE FROM provider_keys_v1 WHERE id=?1 AND owner=?2",
            params![id, owner],
        )?;
        Ok(count > 0)
    }

    pub fn purge_all(&self, owner: &str) -> rusqlite::Result<()> {
        let tx = self.connection.unchecked_transaction()?;
        tx.execute(
            "DELETE FROM turns WHERE conversation IN (SELECT id FROM conversations WHERE owner=?1)",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM conversation_titles_v1 WHERE id IN (SELECT id FROM conversations WHERE owner=?1)",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM conversation_pins_v1 WHERE id IN (SELECT id FROM conversations WHERE owner=?1)",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM conversation_tombstones_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM user_preferences_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM assistant_profiles_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM mcp_servers_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM skills_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM memories_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute(
            "DELETE FROM provider_keys_v1 WHERE owner=?1",
            params![owner],
        )?;
        tx.execute("DELETE FROM conversations WHERE owner=?1", params![owner])?;
        tx.commit()?;
        Ok(())
    }
}
