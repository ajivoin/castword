#!/usr/bin/env python3
"""
fetch_first_printing.py

Fetches each card's first paper printing (set name + release date) from
Scryfall's search API and caches it in first-printing-cache.json. Only
oracle_ids not already in the cache are fetched, mirroring the caching
pattern used by fetch_edhrec.py and prepare_data.py.

Importable API:
    from fetch_first_printing import ensure_first_printing_cache
    cache = ensure_first_printing_cache(oracle_ids, Path("first-printing-cache.json"))

CLI usage:
    python fetch_first_printing.py [--bulk-file oracle-cards.json]
                                   [--output first-printing-cache.json]
                                   [--delay 0.5] [--workers 4]
"""

import json
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CACHE_FILE = Path(__file__).parent / "first-printing-cache.json"
BULK_FILE  = Path(__file__).parent / "oracle-cards.json"

SEARCH_BASE = "https://api.scryfall.com/cards/search"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; CastwordGame/1.0)",
    "Accept":     "application/json",
}


def extract_first_printing(data: object) -> dict | None:
    """
    Dig through a Scryfall /cards/search response (sorted released asc,
    unique=prints) to find the first paper printing's set name and
    release date. Returns {"set_name": ..., "released_at": ...}, or None
    if the response is empty, malformed, or missing entirely.
    """
    if not isinstance(data, dict):
        return None
    results = data.get("data")
    if not isinstance(results, list) or not results:
        return None
    first = results[0]
    if not isinstance(first, dict):
        return None
    return {
        "set_name":    first.get("set_name", ""),
        "released_at": first.get("released_at", ""),
    }


def fetch_first_printing(oracle_id: str) -> tuple[str, dict | None]:
    """
    Fetch the first paper printing for a single oracle_id from Scryfall.
    Returns (oracle_id, printing_info) where printing_info is:
      - {"set_name": ..., "released_at": ...}  if found
      - None                                    on 404 or any other error
    """
    query  = f"oracleid:{oracle_id} game:paper"
    params = urllib.parse.urlencode(
        {"q": query, "unique": "prints", "order": "released", "dir": "asc"}
    )
    url = f"{SEARCH_BASE}?{params}"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        return oracle_id, extract_first_printing(data)
    except urllib.error.HTTPError:
        return oracle_id, None  # 404 (no prints found) or any other HTTP error
    except Exception:
        return oracle_id, None


def ensure_first_printing_cache(
    oracle_ids: list[str],
    cache_path: Path = CACHE_FILE,
    # Scryfall's official API asks callers to keep ~50-100ms between
    # requests as a courtesy (unlike EDHRec's unofficial endpoint, which
    # fetch_edhrec.py hits harder). workers=4 with delay=0.5s per worker
    # caps sustained throughput at workers/delay = 4/0.5 = 8 req/s no
    # matter how many workers are configured, comfortably under the ~10
    # req/s ceiling regardless of worker count.
    workers: int = 4,
    delay: float = 0.5,
    save_interval: int = 200,
) -> dict[str, dict | None]:
    """
    Ensure every oracle_id in oracle_ids has an entry in the cache file.
    Missing entries are fetched from Scryfall and the file is updated in place.
    Returns the complete cache dict.

    Mirrors the Scryfall pattern in prepare_data.py:
        if not bulk_path.exists():
            download_bulk_file(bulk_path)
    """
    cache: dict[str, dict | None] = {}
    if cache_path.exists():
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"  First-printing cache: {len(cache):,} entries loaded from {cache_path}", file=sys.stderr)

    to_fetch = [oid for oid in oracle_ids if oid not in cache]
    if not to_fetch:
        print(f"  First-printing cache: up to date ({len(cache):,} entries).", file=sys.stderr)
        return cache

    print(
        f"  First-printing cache: {len(to_fetch):,} cards missing — fetching from Scryfall...",
        file=sys.stderr,
    )

    done = errors = 0

    def _fetch(oracle_id: str) -> tuple[str, dict | None]:
        result = fetch_first_printing(oracle_id)
        time.sleep(delay)
        return result

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_fetch, oid): oid for oid in to_fetch}
        for future in as_completed(futures):
            oracle_id, info = future.result()
            cache[oracle_id] = info
            done += 1
            if info is None:
                errors += 1

            if done % save_interval == 0 or done == len(to_fetch):
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(cache, f, separators=(",", ":"))
                pct = done / len(to_fetch) * 100
                print(
                    f"  First-printing cache: [{done}/{len(to_fetch)} {pct:.0f}%] "
                    f"errors={errors}",
                    file=sys.stderr,
                )

    print(
        f"  First-printing cache: done. "
        f"found={sum(1 for v in cache.values() if v)}  "
        f"errors={errors}",
        file=sys.stderr,
    )
    return cache


def main() -> None:
    import argparse
    sys.path.insert(0, str(Path(__file__).parent))
    from unique_words import filter_cards, download_bulk_file

    parser = argparse.ArgumentParser(description="Cache first paper printings for MTG cards.")
    parser.add_argument("--bulk-file", default=str(BULK_FILE))
    parser.add_argument("--output",    default=str(CACHE_FILE))
    parser.add_argument("--delay",   type=float, default=0.5)
    parser.add_argument("--workers", type=int,   default=4)
    args = parser.parse_args()

    bulk_path = Path(args.bulk_file)
    if not bulk_path.exists():
        print(f"{bulk_path} not found — downloading from Scryfall...", file=sys.stderr)
        download_bulk_file(bulk_path)

    with open(bulk_path, encoding="utf-8") as f:
        all_cards = json.load(f)

    filtered   = filter_cards(all_cards, include_digital=False, include_alchemy=False)
    oracle_ids = sorted({c["oracle_id"] for c in filtered if c.get("oracle_id")})

    ensure_first_printing_cache(
        oracle_ids,
        cache_path=Path(args.output),
        workers=args.workers,
        delay=args.delay,
    )


if __name__ == "__main__":
    main()
