import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from app.config import get_settings

def _database_path() -> str:
    path = Path(get_settings().database_path)
    if path.parent != Path("."):
        path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)

@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(_database_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db() -> None:
    with connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS study_packs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                source_url TEXT,
                transcript TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                roadmap TEXT NOT NULL DEFAULT '',
                questions TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)

def pack_from_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "source_url": row["source_url"],
        "transcript": row["transcript"],
        "notes": row["notes"],
        "roadmap": row["roadmap"],
        "questions": row["questions"],
        "created_at": row["created_at"],
    }

def list_packs() -> list[dict]:
    with connection() as conn:
        rows = conn.execute("SELECT * FROM study_packs ORDER BY created_at DESC").fetchall()
        return [pack_from_row(row) for row in rows]

def get_pack(pack_id: str) -> dict | None:
    with connection() as conn:
        row = conn.execute("SELECT * FROM study_packs WHERE id = ?", (pack_id,)).fetchone()
        return pack_from_row(row) if row else None

def save_pack(pack_id: str, data: dict) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        existing = conn.execute("SELECT created_at FROM study_packs WHERE id = ?", (pack_id,)).fetchone()
        if existing:
            created_at = existing["created_at"]
            conn.execute("""
                UPDATE study_packs
                SET title=?, source_url=?, transcript=?, notes=?, roadmap=?, questions=?
                WHERE id=?
            """, (data["title"], data.get("source_url"), data.get("transcript", ""),
                  data.get("notes", ""), data.get("roadmap", ""), data.get("questions", ""), pack_id))
        else:
            conn.execute("""
                INSERT INTO study_packs
                (id, title, source_url, transcript, notes, roadmap, questions, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (pack_id, data["title"], data.get("source_url"), data.get("transcript", ""),
                  data.get("notes", ""), data.get("roadmap", ""), data.get("questions", ""), created_at))
    result = get_pack(pack_id)
    assert result is not None
    return result

def delete_pack(pack_id: str) -> bool:
    with connection() as conn:
        cursor = conn.execute("DELETE FROM study_packs WHERE id = ?", (pack_id,))
        return cursor.rowcount > 0
