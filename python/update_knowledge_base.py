# python/update_knowledge_base.py

"""
Manual updater for the clinical knowledge base.

Usage:
    python update_knowledge_base.py --input data/raw_chunks.json --output python/knowledge_base.json
"""

import argparse
import json
import hashlib
from typing import List, Dict, Any


def _make_chunk_id(item: Dict[str, Any]) -> str:
    base = f"{item.get('source','')}-{item.get('title','')}-{item.get('year','')}-{item.get('topic','')}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:16]


def normalize_raw_chunks(raw_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for r in raw_chunks:
        text = (r.get("text") or "").strip()
        if not text:
            continue

        item = {
            "chunk_id": r.get("chunk_id") or _make_chunk_id(r),
            "title": r.get("title", "Untitled excerpt"),
            "source": r.get("source", "Unknown"),
            "source_type": r.get("source_type", "Guideline"),
            "year": int(r.get("year", 0)) if r.get("year") is not None else 0,
            "url": r.get("url", ""),
            "population": r.get("population", "under_5"),
            "topic": r.get("topic", "wasting"),
            "severity": r.get("severity", "any"),
            "language": r.get("language", "en"),
            "text": text,
            "keywords": r.get("keywords") or [],
        }
        normalized.append(item)
    return normalized


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Raw chunks JSON (from WHO/UNICEF/PMC processing)")
    parser.add_argument("--output", default="python/knowledge_base.json", help="Structured knowledge base path")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raise ValueError("Input file must contain a JSON array of raw chunks")

    kb = normalize_raw_chunks(raw)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(kb, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(kb)} chunks to {args.output}")


if __name__ == "__main__":
    main()
