"""Bounded multipart upload decoding using the standard-library MIME parser."""

from email import policy
from email.parser import BytesParser
import json

MAX_UPLOAD = 8 * 1024 * 1024
FIELDS = {"model", "language", "prompt", "response_format", "diarize", "context"}


def parse_upload(content_type: str, body: bytes) -> tuple[dict, bytes]:
    if len(body) > MAX_UPLOAD:
        raise ValueError("upload exceeds 8 MiB")
    if len(content_type) > 256 or any(c in content_type for c in "\r\n\0"):
        raise ValueError("invalid content type")
    try:
        headers = ("Content-Type: " + content_type + "\r\nMIME-Version: 1.0\r\n\r\n").encode(
            "ascii"
        )
    except UnicodeEncodeError as error:
        raise ValueError("invalid content type") from error
    message = BytesParser(policy=policy.default).parsebytes(headers + body)
    if message.get_content_type() != "multipart/form-data" or not message.is_multipart():
        raise ValueError("multipart form data required")
    if message.defects or message.preamble or (message.epilogue or "").strip():
        raise ValueError("malformed multipart framing")
    fields = {}
    audio = None
    for part in message.iter_parts():
        if part.defects or part.is_multipart() or part.get("Content-Transfer-Encoding"):
            raise ValueError("nested or encoded multipart is unsupported")
        if len(part.get_all("Content-Disposition", [])) != 1:
            raise ValueError("one content disposition is required")
        if part.get_content_disposition() != "form-data":
            raise ValueError("form-data part required")
        name = part.get_param("name", header="Content-Disposition")
        data = part.get_payload(decode=True)
        if not isinstance(data, bytes):
            raise ValueError("binary part required")
        if name == "file":
            if audio is not None or not data:
                raise ValueError("exactly one nonempty file required")
            audio = data
        elif name not in FIELDS or name in fields or len(data) > 8192:
            raise ValueError("invalid or duplicate field")
        else:
            try:
                value = data.decode("utf-8")
            except UnicodeDecodeError as error:
                raise ValueError("text fields must be UTF-8") from error
            if name == "diarize":
                if value not in {"true", "false"}:
                    raise ValueError("diarize must be true or false")
                fields[name] = value == "true"
            elif name == "context":
                fields[name] = json.loads(value)
            else:
                fields[name] = value
    if audio is None:
        raise ValueError("file required")
    return fields, audio
