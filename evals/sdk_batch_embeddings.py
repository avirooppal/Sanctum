"""Official SDK check for bounded multi-input embedding result compatibility."""

import argparse
import json
from pathlib import Path
import time

from openai import OpenAI, DefaultHttpxClient


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    client = OpenAI(
        base_url="http://127.0.0.1:8769/v1",
        api_key=args.token_file.read_text().strip(),
        max_retries=0,
        timeout=60,
        http_client=DefaultHttpxClient(trust_env=False),
    )
    texts = [f"Local batch record {index}." for index in range(17)]
    started = time.monotonic()
    response = client.embeddings.create(model="embed-small-q8", input=texts)
    elapsed = time.monotonic() - started
    assert [row.index for row in response.data] == list(range(len(texts)))
    dimensions = [len(row.embedding) for row in response.data]
    assert dimensions == [1024] * len(texts)
    scalar = client.embeddings.create(model="embed-small-q8", input=texts[-1])
    difference = max(
        abs(a - b)
        for a, b in zip(response.data[-1].embedding, scalar.data[0].embedding, strict=True)
    )
    assert difference < 1e-5
    assert (
        response.usage.prompt_tokens > 0
        and response.usage.total_tokens >= response.usage.prompt_tokens
    )
    result = {
        "inputs": len(texts),
        "dimensions": 1024,
        "seconds": elapsed,
        "scalar_max_difference": difference,
        "usage": response.usage.model_dump(),
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    client.close()


if __name__ == "__main__":
    main()
