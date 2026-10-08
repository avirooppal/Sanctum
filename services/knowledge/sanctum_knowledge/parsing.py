"""Permissive upstream parsers; chunking preserves section and page provenance."""

from io import BytesIO
from markdown_it import MarkdownIt
from pypdf import PdfReader
from .contracts import Block


class StructuralParser:
    def parse(self, content: bytes, name: str) -> list[Block]:
        if len(content) > 10 * 1024 * 1024:
            raise ValueError("document exceeds 10 MiB")
        if name.lower().endswith(".md"):
            tokens = (
                MarkdownIt("commonmark", {"html": False})
                .enable("table")
                .parse(content.decode("utf-8"))
            )
            heading = ""
            output = []
            for index, token in enumerate(tokens):
                if token.type == "inline":
                    if index and tokens[index - 1].type == "heading_open":
                        heading = token.content
                    elif token.content.strip():
                        output.append(Block(token.content, heading, None, name))
                elif token.type in {"fence", "code_block"} and token.content.strip():
                    output.append(Block(token.content, heading, None, name))
            return output
        if name.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(content), strict=True)
            if reader.is_encrypted or len(reader.pages) > 500:
                raise ValueError("encrypted or oversized PDF unsupported")
            output = []
            for number, page in enumerate(reader.pages, 1):
                text = page.extract_text(extraction_mode="layout")
                if text.strip():
                    output.append(Block(text, f"Page {number}", number, name))
            if not output:
                raise ValueError("no extractable text; OCR required")
            return output
        raise ValueError("supported formats: .md and text-based .pdf")


def chunks(blocks: list[Block], max_chars: int = 1200) -> list[dict]:
    if max_chars < 20:
        raise ValueError("chunk size too small")
    output = []
    for block in blocks:
        parent = (block.heading + "\n" + block.text).strip()
        # Splitting only occurs within an already parsed structural block.
        offset = 0
        while offset < len(block.text):
            end = min(offset + max_chars, len(block.text))
            if end < len(block.text):
                split = block.text.rfind(" ", offset + max_chars // 2, end)
                if split > offset:
                    end = split
            text = block.text[offset:end].strip()
            if text:
                output.append(
                    dict(
                        text=text,
                        parent_text=parent,
                        page=block.page,
                        source=block.source,
                        heading=block.heading,
                    )
                )
            offset = end
    return output
