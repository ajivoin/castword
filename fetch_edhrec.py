#!/usr/bin/env python3
"""
fetch_edhrec.py

Fetches deck-inclusion counts from EDHRec for all filtered MTG cards
and saves them to edhrec-cache.json for use by prepare_data.py.

Usage:
    python fetch_edhrec.py [--bulk-file oracle-cards.json] [--output edhrec-cache.json]
                           [--delay 0.1] [--workers 4]
"""

import json
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from unique_words import filter_cards, download_bulk_file

BULK_FILE  = Path(__file__).parent / "oracle-cards.json"
CACHE_FILE = Path(__file__).parent / "edhrec-cache.json"

EDHREC_BASE = "https://json.edhrec.com/cards/{slug}.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; CastwordGame/1.0)",
    "Accept":     "application/json",
}


def card_to_edhrec_slug(name: str) -> str:
    """Convert a card name to an EDHRec URL slug."""
    # For double-faced / split cards use only the front-face name
    name = name.split(" // ")[0].strip()
    slug = name.lower()
    # Drop apostrophes and commas (e.g. "Teferi's" → "teferis")
    slug = re.sub(r"[',]", "", slug)
    # Replace any run of non-alphanumeric characters with a hyphen
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def extract_num_decks(data: object) -> int | None:
    """
    Dig through the EDHRec JSON response to find the num_decks value.
    EDHRec's response structure has changed over time; we try several paths.
    """
    if not isinstance(data, dict):
        return None

    # Possible locations for num_decks
    candidates = [
        data,
        data.get("card") or {},
        data.get("data") or {},
        (data.get("container") or {}).get("json_dict") or {},
        ((data.get("container") or {}).get("json_dict") or {}).get("card") or {},
    ]
    for obj in candidates:
        if isinstance(obj, dict):
            val = obj.get("num_decks")
            if val is not None:
                try:
                    return int(val)
                except (TypeError, ValueError):
                    pass
    return None


def fetch_num_decks(name: str) -> tuple[str, int | None]:
    """
    Fetch the num_decks value for a single card from EDHRec.
    Returns (name, num_decks) where num_decks is:
      - an integer  if found
      - 0           if the card has no EDHRec page (404)
      - None        on any other network/parse error
    """
    slug = card_to_edhrec_slug(name)
    url  = EDHREC_BASE.format(slug=slug)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        num = extract_num_decks(data)
        return name, num
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return name, 0
        return name, None
    except Exception:
        return name, None


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Cache EDHRec deck counts for MTG cards.")
    parser.add_argument("--bulk-file", default=str(BULK_FILE),
                        help="Path to Scryfall oracle-cards.json (downloaded if missing).")
    parser.add_argument("--output", default=str(CACHE_FILE),
                        help="Output cache file path (default: edhrec-cache.json).")
    parser.add_argument("--delay", type=float, default=0.05,
                        help="Seconds to sleep between requests per worker (default: 0.05).")
    parser.add_argument("--workers", type=int, default=8,
                        help="Number of parallel fetch workers (default: 8).")
    args = parser.parse_args()

    bulk_path = Path(args.bulk_file)
    if not bulk_path.exists():
        print(f"{bulk_path} not found — downloading from Scryfall...", file=sys.stderr)
        download_bulk_file(bulk_path)

    out_path = Path(args.output)

    # Load existing cache to skip already-fetched cards
    cache: dict[str, int | None] = {}
    if out_path.exists():
        with open(out_path, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"Loaded {len(cache):,} cached entries from {out_path}", file=sys.stderr)

    print(f"Loading cards from {bulk_path} ...", file=sys.stderr)
    with open(bulk_path, encoding="utf-8") as f:
        all_cards = json.load(f)

    filtered = filter_cards(all_cards, include_digital=False, include_alchemy=False)
    all_names = sorted({c["name"] for c in filtered})
    to_fetch  = [n for n in all_names if n not in cache]

    print(
        f"  {len(all_names):,} unique card names total, "
        f"{len(to_fetch):,} not yet cached.",
        file=sys.stderr,
    )

    if not to_fetch:
        print("Nothing to fetch — cache is up to date.", file=sys.stderr)
        return

    done = 0
    errors = 0
    save_interval = 200

    def fetch_with_delay(name: str) -> tuple[str, int | None]:
        result = fetch_num_decks(name)
        time.sleep(args.delay)
        return result

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_with_delay, name): name for name in to_fetch}
        for future in as_completed(futures):
            name, num = future.result()
            cache[name] = num
            done += 1
            if num is None:
                errors += 1

            if done % save_interval == 0 or done == len(to_fetch):
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(cache, f, separators=(",", ":"))
                pct = done / len(to_fetch) * 100
                print(
                    f"  [{done}/{len(to_fetch)} {pct:.0f}%] "
                    f"errors={errors}  last: {name} → {num}",
                    file=sys.stderr,
                )

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, separators=(",", ":"))

    hit  = sum(1 for v in cache.values() if v is not None and v > 0)
    miss = sum(1 for v in cache.values() if v == 0)
    err  = sum(1 for v in cache.values() if v is None)
    print(
        f"\nDone.  Total cached: {len(cache):,}  "
        f"(found: {hit:,}, not-on-EDHREC: {miss:,}, errors: {err:,})",
        file=sys.stderr,
    )
    print(f"Wrote {out_path} ({out_path.stat().st_size / 1024:.0f} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
