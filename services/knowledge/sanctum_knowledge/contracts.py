from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Block:
    text: str
    heading: str
    page: int | None
    source: str


class Parser(Protocol):
    def parse(self, content: bytes, name: str) -> list[Block]: ...


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class VectorStore(Protocol):
    def upsert(self, rows: list[tuple[str, list[float]]]) -> None: ...
    def search(self, vector: list[float], eligible: list[str], k: int) -> list[str]: ...


class Reranker(Protocol):
    def rank(self, query: str, texts: list[str]) -> list[tuple[int, float]]: ...
