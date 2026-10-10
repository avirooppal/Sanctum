import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sanctum_speech.multipart import parse_upload


def body(parts):
    return (
        b"".join(
            b'--sample\r\nContent-Disposition: form-data; name="'
            + name.encode()
            + b'"'
            + (b'; filename="../../private.wav"' if name == "file" else b"")
            + b"\r\n\r\n"
            + value
            + b"\r\n"
            for name, value in parts
        )
        + b"--sample--\r\n"
    )


class MultipartTests(unittest.TestCase):
    def test_binary_file_and_text_fields_preserved(self):
        fields, audio = parse_upload(
            "multipart/form-data; boundary=sample",
            body([("model", b"asr"), ("file", b"\x00\xff\r\n"), ("diarize", b"false")]),
        )
        self.assertEqual(audio, b"\x00\xff\r\n")
        self.assertEqual(fields, {"model": "asr", "diarize": False})

    def test_rejects_duplicates_unknown_fields_and_missing_file(self):
        for parts in [
            [("file", b"x"), ("file", b"y")],
            [("file", b"x"), ("model", b"a"), ("model", b"b")],
            [("file", b"x"), ("user", b"admin")],
            [("model", b"a")],
            [("file", b"x"), ("diarize", b"maybe")],
            [("file", b"x"), ("language", b"\xff")],
        ]:
            with self.subTest(parts=parts), self.assertRaises(ValueError):
                parse_upload("multipart/form-data; boundary=sample", body(parts))

    def test_rejects_bad_framing_headers_and_size_before_parsing(self):
        valid = body([("file", b"x")])
        for content_type, data in [
            ("application/json", valid),
            ("multipart/form-data", valid),
            ("multipart/form-data; boundary=sample\r\nX-Evil: yes", valid),
            ("multipart/form-data; boundary=sample", valid[:-14]),
            ("multipart/form-data; boundary=sample", b"x" * (8 * 1024 * 1024 + 1)),
            (
                "multipart/form-data; boundary=sample",
                valid.replace(b"\r\n\r\n", b"\r\nContent-Transfer-Encoding: base64\r\n\r\n"),
            ),
        ]:
            with self.subTest(content_type=content_type), self.assertRaises(ValueError):
                parse_upload(content_type, data)
