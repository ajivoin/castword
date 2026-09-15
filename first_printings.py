"""
first_printings.py

Derives each card's first paper printing (set name + release date) from
Scryfall's `default_cards` bulk file, which contains every printing of
every card. The `oracle_cards` bulk file used elsewhere in this pipeline
carries only the most recent printing of each card, so it cannot answer
"when was this first printed?".

Deriving this from the bulk file means one download instead of one API
request per card — no rate limits, no partial failures, no cache to keep
in sync.

Importable API:
    from first_printings import load_first_printings
    printings = load_first_printings(Path("default-cards.jsonl.gz"))
    # -> {oracle_id: {"set_name": ..., "released_at": ...}}

CLI usage:
    python first_printings.py [--bulk-file default-cards.jsonl.gz]
"""

import gzip
import json
import sys
import urllib.request
from pathlib import Path
from typing import Iterable, Iterator

sys.path.insert(0, str(Path(__file__).parent))
from unique_words import HEADERS, fetch_bulk_download_url

DEFAULT_CARDS_FILE = Path(__file__).parent / "default-cards.jsonl.gz"

GZIP_MAGIC = b"\x1f\x8b"

# Platform a printing appeared on. PAPER is recorded explicitly rather than
# left blank so that "no platform" never has to be inferred from an empty
# string — a blank entry means "no first-printing data at all". Consumers
# suppress PAPER when rendering, since it is the unremarkable case.
PAPER = "Paper"
PLATFORMS_BY_GAME = {
    "arena": "Arena",
    "mtgo": "Magic Online",
    "astral": "Astral",
}


def _oracle_id(record: dict) -> str:
    """
    Pull a record's oracle_id. Reversible cards carry no top-level
    oracle_id — the id lives on the first face instead.
    """
    oracle_id = record.get("oracle_id")
    if isinstance(oracle_id, str) and oracle_id:
        return oracle_id

    faces = record.get("card_faces")
    if isinstance(faces, list) and faces and isinstance(faces[0], dict):
        face_id = faces[0].get("oracle_id")
        if isinstance(face_id, str) and face_id:
            return face_id

    return ""


def _platform(record: dict) -> str:
    """
    Name the platform a single printing appeared on, or "" if it names no
    playable platform at all. Scryfall leaves `games` empty on printings
    from unreleased sets, so "" also covers "not out yet".

    Paper wins over everything: a card released on paper is paper, however
    many digital clients it also appears on. Alchemy is checked before the
    game list because Alchemy printings are themselves tagged games=["arena"]
    — only set_type distinguishes them.
    """
    games = record.get("games")
    if not isinstance(games, list) or not games:
        return ""

    if "paper" in games:
        return PAPER

    if record.get("set_type") == "alchemy":
        return "Alchemy"

    for game in games:
        platform = PLATFORMS_BY_GAME.get(game)
        if platform:
            return platform

    return ""


def earliest_printings(records: Iterable[object]) -> dict[str, dict]:
    """
    Reduce an iterable of Scryfall printing records to a map of
    oracle_id -> {"set_name": ..., "released_at": ..., "platform": ...}
    describing each card's earliest printing.

    A card's earliest *paper* printing always wins. Cards that never saw
    paper — Alchemy and other Arena-only cards, Magic Online avatars, the
    1997 Astral set — fall back to their earliest digital printing, tagged
    with the platform it appeared on, rather than being dropped.

    Records that are malformed, undated, unreleased, or missing an oracle_id
    are skipped. Entries match the shape prepare_data.first_printed_fields()
    consumes.
    """
    paper: dict[str, dict] = {}
    digital: dict[str, dict] = {}

    for record in records:
        if not isinstance(record, dict):
            continue

        platform = _platform(record)
        if not platform:
            continue

        released_at = record.get("released_at")
        if not isinstance(released_at, str) or not released_at:
            continue

        oracle_id = _oracle_id(record)
        if not oracle_id:
            continue

        bucket = paper if platform == PAPER else digital

        # ISO-8601 dates sort lexicographically, so a string compare is
        # enough to find the earliest printing.
        current = bucket.get(oracle_id)
        if current is not None and current["released_at"] <= released_at:
            continue

        set_name = record.get("set_name")
        bucket[oracle_id] = {
            "set_name": set_name if isinstance(set_name, str) else "",
            "released_at": released_at,
            "platform": platform,
        }

    # Paper printings take precedence over any digital fallback.
    return {**digital, **paper}


def iter_bulk_records(path: Path) -> Iterator[dict]:
    """
    Stream card records from a Scryfall bulk JSON Lines file, gzipped or
    plain. Streaming keeps peak memory flat — the default-cards file holds
    well over 100,000 printings and need never be materialized at once.
    """
    with open(path, "rb") as probe:
        compressed = probe.read(2) == GZIP_MAGIC

    opener = gzip.open if compressed else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def load_first_printings(path: Path = DEFAULT_CARDS_FILE) -> dict[str, dict]:
    """
    Build the oracle_id -> first-paper-printing map from a bulk file.
    Returns an empty map if the file is absent, so the data pipeline can
    still complete (with blank hint fields) without it.
    """
    path = Path(path)
    if not path.exists():
        return {}
    return earliest_printings(iter_bulk_records(path))


def download_default_cards(dest: Path = DEFAULT_CARDS_FILE) -> None:
    """
    Download the Scryfall default-cards bulk file to `dest`, saving it
    exactly as served. Unlike unique_words.download_bulk_file(), the
    gzipped JSON Lines is *not* expanded into a JSON array: this file holds
    every printing of every card, and iter_bulk_records() streams it rather
    than loading it whole.
    """
    url = fetch_bulk_download_url("default_cards")
    print(f"Downloading default-cards bulk data from:\n  {url}", file=sys.stderr)

    dest = Path(dest)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as resp, open(tmp, "wb") as f:
            content_length = resp.headers.get("Content-Length")
            total = int(content_length) if content_length else None
            downloaded = 0
            while True:
                chunk = resp.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / total * 100
                    print(f"\r  {downloaded/1_000_000:.1f} / {total/1_000_000:.1f} MB ({pct:.0f}%)",
                          end="", file=sys.stderr)
            print(file=sys.stderr)
        tmp.rename(dest)
        print(f"Saved to {dest}", file=sys.stderr)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


def ensure_default_cards(path: Path = DEFAULT_CARDS_FILE) -> Path:
    """Download the default-cards bulk file if it isn't already on disk."""
    path = Path(path)
    if not path.exists():
        print(f"{path} not found — downloading from Scryfall...", file=sys.stderr)
        download_default_cards(path)
    return path


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Derive first paper printings from the Scryfall default-cards bulk file."
    )
    parser.add_argument("--bulk-file", default=str(DEFAULT_CARDS_FILE))
    args = parser.parse_args()

    printings = load_first_printings(ensure_default_cards(Path(args.bulk_file)))
    print(f"{len(printings):,} cards with a first printing.", file=sys.stderr)


if __name__ == "__main__":
    main()
