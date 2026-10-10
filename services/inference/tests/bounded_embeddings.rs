use sanctum_inference::{bounded_send, Engine, Reply};
use serde_json::{json, Value};
use std::{
    io::{Cursor, Read},
    sync::Mutex,
};
struct Fake {
    calls: Mutex<Vec<usize>>,
}
impl Engine for Fake {
    fn send(&self, _: &str, payload: &Value) -> Result<Reply, String> {
        let input = payload["input"].as_array().unwrap();
        self.calls.lock().unwrap().push(input.len());
        let data: Vec<Value> = input.iter().enumerate().rev().map(|(index, text)| json!({"index":index,"object":"embedding","embedding":[text.as_str().unwrap().parse::<usize>().unwrap()]})).collect();
        Ok(Reply {status:200,content_type:"application/json".into(),body:Box::new(Cursor::new(serde_json::to_vec(&json!({"data":data,"object":"list","model":"fixture","usage":{"prompt_tokens":input.len(),"total_tokens":input.len()}})).unwrap()))})
    }
    fn healthy(&self) -> bool {
        true
    }
}
#[test]
fn combines_global_indices_and_usage_without_unbounded_engine_batches() {
    let engine = Fake {
        calls: Mutex::new(Vec::new()),
    };
    let input: Vec<String> = (0..17).map(|n| n.to_string()).collect();
    let mut reply = bounded_send(
        &engine,
        "/v1/embeddings",
        &json!({"model":"fixture","input":input}),
    )
    .unwrap();
    let mut bytes = Vec::new();
    reply.body.read_to_end(&mut bytes).unwrap();
    let data: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(*engine.calls.lock().unwrap(), [1; 17]);
    for n in 0..17 {
        assert_eq!(data["data"][n]["index"], n);
        assert_eq!(data["data"][n]["embedding"][0], n);
    }
    assert_eq!(data["usage"]["prompt_tokens"], 17);
}

struct FailsSecond {
    inner: Fake,
}
impl Engine for FailsSecond {
    fn send(&self, path: &str, payload: &Value) -> Result<Reply, String> {
        if self.inner.calls.lock().unwrap().len() == 1 {
            return Ok(Reply {
                status: 503,
                content_type: "application/json".into(),
                body: Box::new(Cursor::new(br#"{"error":"fixture busy"}"#.to_vec())),
            });
        }
        self.inner.send(path, payload)
    }
    fn healthy(&self) -> bool {
        true
    }
}
#[test]
fn failed_later_batch_never_publishes_partial_embeddings() {
    let engine = FailsSecond {
        inner: Fake {
            calls: Mutex::new(Vec::new()),
        },
    };
    let input: Vec<String> = (0..9).map(|n| n.to_string()).collect();
    let mut reply = bounded_send(&engine, "/v1/embeddings", &json!({"input": input})).unwrap();
    assert_eq!(reply.status, 503);
    let mut bytes = Vec::new();
    reply.body.read_to_end(&mut bytes).unwrap();
    let value: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(value.get("data").is_none());
    assert!(value.get("error").is_some());
}
struct DuplicateIndices;
impl Engine for DuplicateIndices {
    fn send(&self, _: &str, _: &Value) -> Result<Reply, String> {
        let rows: Vec<Value> = (0..8)
            .map(|_| json!({"index":0,"embedding":[1.0]}))
            .collect();
        Ok(Reply {
            status: 200,
            content_type: "application/json".into(),
            body: Box::new(Cursor::new(
                serde_json::to_vec(&json!({"data":rows})).unwrap(),
            )),
        })
    }
    fn healthy(&self) -> bool {
        true
    }
}
#[test]
fn duplicate_batch_indices_are_rejected() {
    assert!(bounded_send(
        &DuplicateIndices,
        "/v1/embeddings",
        &json!({"input":["0","1","2","3","4","5","6","7","8"]})
    )
    .is_err());
}
