#!/usr/bin/env python3
"""
prepare_data.py

Enriches unique_words.py output with additional card fields needed for the
guessing game (mana_cost, oracle_text, image_url, colors), then writes:

  web/src/data/game-data.json   — puzzle cards (~1,256 entries)
  web/src/data/card-names.json  — all filtered card names for autocomplete

Usage:
    python prepare_data.py [--bulk-file oracle-cards.json]
"""

import json
import sys
from pathlib import Path

# Import functions directly from unique_words.py in the same directory
sys.path.insert(0, str(Path(__file__).parent))
from unique_words import (
    filter_cards,
    build_word_card_map,
    find_unique_word_cards,
    clean_text,
    tokenize,
)

BULK_FILE = Path(__file__).parent / "oracle-cards.json"
OUT_DIR = Path(__file__).parent / "src" / "data"

MIN_WORD_LEN = 3


def get_image_url(card: dict) -> str:
    """Return the normal-size image URL, handling multi-face cards."""
    if "image_uris" in card:
        return card["image_uris"].get("normal", "")
    faces = card.get("card_faces", [])
    if faces and "image_uris" in faces[0]:
        return faces[0]["image_uris"].get("normal", "")
    return ""


def get_oracle_text(card: dict) -> str:
    """Return combined oracle text, handling multi-face cards."""
    if "oracle_text" in card:
        return card["oracle_text"]
    faces = card.get("card_faces", [])
    parts = [f.get("oracle_text", "") for f in faces if f.get("oracle_text")]
    return "\n//\n".join(parts)


def get_flavor_text(card: dict) -> str:
    """Return combined flavor text, handling multi-face cards."""
    faces = card.get("card_faces") or [card]
    parts = [f.get("flavor_text", "") for f in faces if f.get("flavor_text")]
    return "\n//\n".join(parts)


def flavor_exclusive_words(card: dict, unique_words: list[str]) -> list[str]:
    """Return the subset of unique_words that appear in flavor text but NOT in oracle text."""
    faces = card.get("card_faces") or [card]
    oracle_tokens: set[str] = set()
    flavor_tokens: set[str] = set()
    for face in faces:
        ot = face.get("oracle_text", "")
        ft = face.get("flavor_text", "")
        if ot:
            oracle_tokens |= set(tokenize(clean_text(ot, False)))
        if ft:
            flavor_tokens |= set(tokenize(clean_text(ft, False)))
    return [w for w in unique_words if w in flavor_tokens and w not in oracle_tokens]


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--bulk-file", default=str(BULK_FILE))
    args = parser.parse_args()

    bulk_path = Path(args.bulk_file)
    if not bulk_path.exists():
        print(f"ERROR: {bulk_path} not found.", file=sys.stderr)
        sys.exit(1)

    print(f"Loading cards from {bulk_path} ...", file=sys.stderr)
    with open(bulk_path, encoding="utf-8") as f:
        all_cards = json.load(f)
    print(f"  {len(all_cards):,} cards loaded.", file=sys.stderr)

    filtered = filter_cards(all_cards, include_digital=False, include_alchemy=False)
    print(f"  {len(filtered):,} cards after filtering.", file=sys.stderr)

    # Build enrichment lookup: oracle_id -> extra fields
    card_lookup: dict[str, dict] = {c["oracle_id"]: c for c in filtered if c.get("oracle_id")}
    lookup: dict[str, dict] = {}
    for oid, card in card_lookup.items():
        lookup[oid] = {
            "mana_cost": card.get("mana_cost", ""),
            "colors": card.get("colors", []),
            "oracle_text": get_oracle_text(card),
            "flavor_text": get_flavor_text(card),
            "image_url": get_image_url(card),
        }

    # ── Normal game data (oracle-text unique words, mainline sets only) ──────
    mainline = [c for c in filtered if c.get("set_type") != "funny"]
    print(f"  {len(mainline):,} mainline cards (funny sets excluded).", file=sys.stderr)

    word_to_cards, meta = build_word_card_map(
        mainline,
        min_word_len=MIN_WORD_LEN,
        include_flavor=False,
        exclude_reminder=False,
    )
    results = find_unique_word_cards(word_to_cards, meta)
    print(f"  {len(results):,} oracle-unique puzzle cards found.", file=sys.stderr)

    game_data = []
    for entry in results:
        oid = entry["oracle_id"]
        extra = lookup.get(oid, {})
        game_data.append({
            "name": entry["name"],
            "oracle_id": oid,
            "scryfall_uri": entry["scryfall_uri"],
            "type_line": entry["type_line"],
            "mana_cost": extra.get("mana_cost", ""),
            "colors": extra.get("colors", []),
            "oracle_text": extra.get("oracle_text", ""),
            "image_url": extra.get("image_url", ""),
            "unique_words": entry["unique_words"],
        })

    # ── Flavor bonus data (flavor-text-exclusive unique words) ───────────────
    wc_flavor, meta_flavor = build_word_card_map(
        filtered,
        min_word_len=MIN_WORD_LEN,
        include_flavor=True,
        exclude_reminder=False,
    )
    flavor_results = find_unique_word_cards(wc_flavor, meta_flavor)

    flavor_data = []
    for entry in flavor_results:
        oid = entry["oracle_id"]
        card = card_lookup.get(oid)
        if not card:
            continue
        exclusive = flavor_exclusive_words(card, entry["unique_words"])
        if not exclusive:
            continue
        extra = lookup.get(oid, {})
        flavor_data.append({
            "name": entry["name"],
            "oracle_id": oid,
            "scryfall_uri": entry["scryfall_uri"],
            "type_line": entry["type_line"],
            "mana_cost": extra.get("mana_cost", ""),
            "colors": extra.get("colors", []),
            "oracle_text": extra.get("oracle_text", ""),
            "flavor_text": extra.get("flavor_text", ""),
            "image_url": extra.get("image_url", ""),
            "unique_words": exclusive,
        })
    flavor_data.sort(key=lambda r: r["name"])
    print(f"  {len(flavor_data):,} flavor-exclusive puzzle cards found.", file=sys.stderr)

    # ── Wildcard data (full pool incl. funny sets, oracle+flavor unique words) ─
    wc_wild, meta_wild = build_word_card_map(
        filtered,   # full pool, including funny set cards
        min_word_len=MIN_WORD_LEN,
        include_flavor=True,
        exclude_reminder=False,
    )
    wild_results = find_unique_word_cards(wc_wild, meta_wild)

    wildcard_data = []
    for entry in wild_results:
        oid = entry["oracle_id"]
        extra = lookup.get(oid, {})
        wildcard_data.append({
            "name": entry["name"],
            "oracle_id": oid,
            "scryfall_uri": entry["scryfall_uri"],
            "type_line": entry["type_line"],
            "mana_cost": extra.get("mana_cost", ""),
            "colors": extra.get("colors", []),
            "oracle_text": extra.get("oracle_text", ""),
            "flavor_text": extra.get("flavor_text", ""),
            "image_url": extra.get("image_url", ""),
            "unique_words": entry["unique_words"],
        })
    print(f"  {len(wildcard_data):,} wildcard puzzle cards found.", file=sys.stderr)

    # All card names for autocomplete
    card_names = sorted({card["name"] for card in filtered})
    print(f"  {len(card_names):,} card names for autocomplete.", file=sys.stderr)

    # Write output
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    game_data_path = OUT_DIR / "game-data.json"
    with open(game_data_path, "w", encoding="utf-8") as f:
        json.dump(game_data, f, separators=(",", ":"))
    print(f"Wrote {game_data_path} ({game_data_path.stat().st_size / 1024:.0f} KB)", file=sys.stderr)

    flavor_data_path = OUT_DIR / "flavor-data.json"
    with open(flavor_data_path, "w", encoding="utf-8") as f:
        json.dump(flavor_data, f, separators=(",", ":"))
    print(f"Wrote {flavor_data_path} ({flavor_data_path.stat().st_size / 1024:.0f} KB)", file=sys.stderr)

    wildcard_data_path = OUT_DIR / "wildcard-data.json"
    with open(wildcard_data_path, "w", encoding="utf-8") as f:
        json.dump(wildcard_data, f, separators=(",", ":"))
    print(f"Wrote {wildcard_data_path} ({wildcard_data_path.stat().st_size / 1024:.0f} KB)", file=sys.stderr)

    names_path = OUT_DIR / "card-names.json"
    with open(names_path, "w", encoding="utf-8") as f:
        json.dump(card_names, f, separators=(",", ":"))
    print(f"Wrote {names_path} ({names_path.stat().st_size / 1024:.0f} KB)", file=sys.stderr)

    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()
