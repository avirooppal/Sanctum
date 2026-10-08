"""Real OpenAI SDK gate. Requires running confined engines; no canned responses."""

import argparse
import json
import math
import subprocess
import time
from pathlib import Path

from openai import OpenAI, AuthenticationError, BadRequestError

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8765/v1")
    parser.add_argument("--token-file", type=Path)
    parser.add_argument("--wsl-token", action="store_true")
    args = parser.parse_args()
    token = (
        subprocess.check_output(
            [
                "wsl",
                "-d",
                "Ubuntu-22.04",
                "--",
                "sh",
                "-c",
                'cat "$HOME/.local/share/sanctum/local.token"',
            ],
            text=True,
        ).strip()
        if args.wsl_token
        else args.token_file.read_text().strip()
    )
    config = json.loads((ROOT / "profiles/runtime-cpu.json").read_text())
    model, embed = config["chat"]["id"], config["embedding"]["id"]
    client = OpenAI(base_url=args.base_url, api_key=token, timeout=180, max_retries=0)
    passed = []
    assert {m.id for m in client.models.list()} == {model, embed}
    passed.append("models")
    begin = time.perf_counter()
    result = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Reply with the word hello."}],
        max_tokens=32,
        temperature=0,
    )
    duration = time.perf_counter() - begin
    assert result.choices[0].message.content
    passed.append("chat")
    begin = time.perf_counter()
    chunks = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Say hello briefly."}],
        max_tokens=32,
        temperature=0,
        stream=True,
    )
    first = None
    answer = ""
    for chunk in chunks:
        text = chunk.choices[0].delta.content if chunk.choices else None
        if text:
            first = first if first is not None else time.perf_counter() - begin
            answer += text
    assert answer and first is not None
    passed.append("streaming")
    result = client.embeddings.create(
        model=embed, input=["A local private assistant."], encoding_format="float"
    )
    vector = result.data[0].embedding
    assert len(vector) > 0 and all(math.isfinite(v) for v in vector)
    passed.append("embeddings")
    result = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Return answer equal to 4."}],
        max_tokens=48,
        temperature=0,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "answer",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {"answer": {"type": "integer"}},
                    "required": ["answer"],
                    "additionalProperties": False,
                },
            },
        },
    )
    structured = json.loads(result.choices[0].message.content)
    assert type(structured["answer"]) is int and set(structured) == {"answer"}
    passed.append("json_schema")
    result = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Get the weather in Paris."}],
        max_tokens=96,
        temperature=0,
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "weather",
                    "description": "Get weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"city": {"type": "string"}},
                        "required": ["city"],
                        "additionalProperties": False,
                    },
                },
            }
        ],
        tool_choice={"type": "function", "function": {"name": "weather"}},
    )
    calls = result.choices[0].message.tool_calls
    assert calls and calls[0].function.name == "weather"
    assert isinstance(json.loads(calls[0].function.arguments)["city"], str)
    passed.append("tools")
    try:
        OpenAI(base_url=args.base_url, api_key="wrong", max_retries=0).models.list()
        raise AssertionError("unauthenticated request accepted")
    except AuthenticationError:
        passed.append("authentication")
    try:
        client.chat.completions.create(
            model="unknown", messages=[{"role": "user", "content": "hello"}]
        )
        raise AssertionError("unknown model accepted")
    except BadRequestError:
        passed.append("unknown_model")
    record = {
        "suite": "phase1-real-openai-sdk",
        "passed": passed,
        "chat_seconds": round(duration, 4),
        "stream_ttft_seconds": round(first, 4),
        "embedding_dimensions": len(vector),
        "streamed_text": answer,
    }
    (ROOT / "evals/results/phase1-sdk.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
