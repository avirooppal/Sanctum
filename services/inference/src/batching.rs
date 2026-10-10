//! Bound vendor-internal embedding task queues while preserving OpenAI results.
use crate::{Engine, Reply};
use serde_json::{json, Value};
use std::io::{Cursor, Read};
const MAX_RESPONSE: usize = 4 * 1024 * 1024;
pub fn bounded_send(engine: &dyn Engine, path: &str, payload: &Value) -> Result<Reply, String> {
    let inputs = payload.get("input").and_then(Value::as_array);
    if path != "/v1/embeddings"
        || inputs.is_none_or(|values| {
            values.len() <= 1 || !values.iter().all(|v| v.is_string() || v.is_array())
        })
    {
        return engine.send(path, payload);
    }
    let inputs = inputs.unwrap();
    let mut aggregate: Option<Value> = None;
    let mut rows = Vec::new();
    let mut usage = [0u64; 2];
    let mut size = 0;
    let mut content_type = String::new();
    for (batch_index, batch) in inputs.chunks(1).enumerate() {
        let mut request = payload.clone();
        request["input"] = Value::Array(batch.to_vec());
        let reply = engine.send(path, &request)?;
        if reply.status != 200 {
            return Ok(reply);
        }
        content_type = reply.content_type;
        let mut bytes = Vec::new();
        reply
            .body
            .take((MAX_RESPONSE + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() > MAX_RESPONSE {
            return Err("oversized embedding batch".into());
        }
        let mut value: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        let data = value
            .get_mut("data")
            .and_then(Value::as_array_mut)
            .ok_or("missing embedding data")?;
        let mut batch_rows = std::mem::take(data);
        if batch_rows.len() != batch.len() {
            return Err("incomplete embedding batch".into());
        }
        batch_rows.sort_by_key(|row| row.get("index").and_then(Value::as_u64));
        for (index, row) in batch_rows.iter().enumerate() {
            if row.get("index").and_then(Value::as_u64) != Some(index as u64) {
                return Err("invalid embedding indices".into());
            }
        }
        if let Some(first) = &aggregate {
            if first.get("model") != value.get("model") {
                return Err("embedding model changed within request".into());
            }
        } else {
            size = serde_json::to_vec(&value).map_err(|e| e.to_string())?.len();
            aggregate = Some(value.clone());
        }
        for (index, key) in ["prompt_tokens", "total_tokens"].iter().enumerate() {
            usage[index] = usage[index]
                .checked_add(value["usage"][*key].as_u64().unwrap_or(0))
                .ok_or("embedding usage overflow")?;
        }
        for (index, mut row) in batch_rows.into_iter().enumerate() {
            row["index"] = json!(batch_index + index);
            size += serde_json::to_vec(&row).map_err(|e| e.to_string())?.len() + 1;
            if size > MAX_RESPONSE {
                return Err("embedding response exceeds limit".into());
            }
            rows.push(row);
        }
    }
    let mut value = aggregate.ok_or("missing embedding aggregate")?;
    value["data"] = Value::Array(rows);
    value["usage"]["prompt_tokens"] = json!(usage[0]);
    value["usage"]["total_tokens"] = json!(usage[1]);
    let body = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
    if body.len() > MAX_RESPONSE {
        return Err("embedding response exceeds limit".into());
    }
    Ok(Reply {
        status: 200,
        content_type,
        body: Box::new(Cursor::new(body)),
    })
}
