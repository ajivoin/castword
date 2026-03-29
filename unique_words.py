#!/usr/bin/env python3
"""
unique_words.py

Find all Magic: The Gathering cards that are the sole card containing
a given word in their rules text (and optionally flavor text).

Usage:
    python unique_words.py [options]

Options:
    --bulk-file PATH        Path to a local Scryfall oracle-cards JSON dump.
                            If omitted, the latest dump is downloaded automatically.
    --min-word-len N        Minimum token length to consider (default: 3).
    --include-flavor        Also tokenize flavor text (default: off).
    --exclude-reminder      Strip reminder text in parentheses before tokenizing.
    --output FORMAT         Output format: text (default), csv, or json.
    --out-file PATH         Write output to a file instead of stdout.
"""

import argparse
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------

BULK_DATA_API = "https://api.scryfall.com/bulk-data"


HEADERS = {"User-Agent": "MTGUniqueWords/1.0", "Accept": "application/json"}


def fetch_bulk_download_url() -> str:
    """Resolve the latest oracle-cards bulk download URL from the Scryfall API."""
    req = urllib.request.Request(BULK_DATA_API, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    for entry in data["data"]:
        if entry["type"] == "oracle_cards":
            return entry["download_uri"]
    raise RuntimeError("Could not find oracle_cards entry in Scryfall bulk-data response.")


def download_bulk_file(dest: Path) -> None:
    url = fetch_bulk_download_url()
    print(f"Downloading bulk data from:\n  {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers=HEADERS)
    tmp = dest.with_suffix(".tmp")
    try:
        with urllib.request.urlopen(req) as resp, open(tmp, "wb") as f:
            content_length = resp.headers.get("Content-Length")
            total = int(content_length) if content_length else None
            downloaded = 0
            chunk_size = 256 * 1024  # 256 KB
            while True:
                chunk = resp.read(chunk_size)
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


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

import unicodedata

MANA_SYMBOL_RE = re.compile(r"\{[^}]+\}")   # {T}, {2}, {W/U}, etc.
REMINDER_RE     = re.compile(r"\([^)]*\)")   # (reminder text in parens)
TOKEN_RE        = re.compile(r"[a-z]+(?:-[a-z]+)*")  # words, allowing hyphens


def normalize(text: str) -> str:
    """Lowercase and strip accents/non-ASCII so name tokens match oracle tokens."""
    text = text.lower()
    # Decompose accented chars (é -> e + combining accent) then drop non-ASCII
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text


def clean_text(text: str, exclude_reminder: bool) -> str:
    text = MANA_SYMBOL_RE.sub(" ", text)
    if exclude_reminder:
        text = REMINDER_RE.sub(" ", text)
    return normalize(text)


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text)


def card_name_variants(name: str) -> set[str]:
    """
    Return the set of name tokens to suppress, passed through the same
    normalize+tokenize pipeline used on oracle text so they always match.
    Handles double-faced / split card names like 'A // B'.
    """
    parts = {p.strip() for p in name.split("//")}
    variants: set[str] = set()
    for part in parts:
        # Tokenize the name the same way oracle text is tokenized
        for tok in tokenize(normalize(part)):
            variants.add(tok)
    return variants


# ---------------------------------------------------------------------------
# Oracle text extraction
# ---------------------------------------------------------------------------

def get_text_blocks(card: dict, include_flavor: bool, exclude_reminder: bool) -> list[str]:
    """
    Return a list of cleaned text strings to tokenize for this card.
    Handles normal cards and multi-face cards (card_faces).
    """
    blocks: list[str] = []

    faces = card.get("card_faces") or [card]
    for face in faces:
        oracle = face.get("oracle_text", "")
        if oracle:
            blocks.append(clean_text(oracle, exclude_reminder))
        if include_flavor:
            flavor = face.get("flavor_text", "")
            if flavor:
                blocks.append(clean_text(flavor, exclude_reminder=False))  # flavor has no reminder

    return blocks


# ---------------------------------------------------------------------------
# Main analysis
# ---------------------------------------------------------------------------

DIGITAL_SET_TYPES = {"alchemy", "memorabilia"}
DIGITAL_LAYOUTS   = {"attraction", "sticker", "contraption"}


def is_paper_card(card: dict) -> bool:
    """Return True if the card is a paper-legal card (not Alchemy or digital-only)."""
    if card.get("set_type") in DIGITAL_SET_TYPES:
        return False
    if card.get("layout") in DIGITAL_LAYOUTS:
        return False
    return True


def is_alchemy_card(card: dict) -> bool:
    """Return True if this is an A- prefixed Alchemy rebalance."""
    return card.get("name", "").startswith("A-")


def filter_cards(
    cards: list[dict],
    include_digital: bool,
    include_alchemy: bool,
) -> list[dict]:
    result = []
    for card in cards:
        if not include_alchemy and is_alchemy_card(card):
            continue
        if not include_digital and not is_paper_card(card):
            continue
        result.append(card)
    return result


# Fields to carry through for each card for downstream API use
CARD_META_FIELDS = ("name", "oracle_id", "scryfall_uri", "set", "collector_number", "type_line")


def extract_meta(card: dict) -> dict:
    """Pull the stable identifier fields we want to keep in output."""
    return {field: card.get(field, "") for field in CARD_META_FIELDS}


def build_word_card_map(
    cards: list[dict],
    min_word_len: int,
    include_flavor: bool,
    exclude_reminder: bool,
) -> tuple[dict[str, set[str]], dict[str, dict]]:
    """
    Returns:
      word_to_cards: word -> set of oracle_ids that contain that word
      meta:          oracle_id -> card metadata dict
    """
    word_to_cards: dict[str, set[str]] = defaultdict(set)
    meta: dict[str, dict] = {}

    for card in cards:
        name: str = card.get("name", "")
        oracle_id: str = card.get("oracle_id", "")
        if not name or not oracle_id:
            continue

        meta[oracle_id] = extract_meta(card)

        name_tokens = card_name_variants(name)
        text_blocks = get_text_blocks(card, include_flavor, exclude_reminder)

        if not text_blocks:
            continue

        card_tokens: set[str] = set()
        for block in text_blocks:
            for tok in tokenize(block):
                if len(tok) >= min_word_len and tok not in name_tokens:
                    card_tokens.add(tok)

        for tok in card_tokens:
            word_to_cards[tok].add(oracle_id)

    return word_to_cards, meta


def find_unique_word_cards(
    word_to_cards: dict[str, set[str]],
    meta: dict[str, dict],
) -> list[dict]:
    """
    Returns a list of result dicts, one per card that has at least one unique word.
    Each dict contains card metadata plus the list of unique words.
    """
    oracle_to_unique: dict[str, list[str]] = defaultdict(list)
    for word, oracle_set in word_to_cards.items():
        if len(oracle_set) == 1:
            (oracle_id,) = oracle_set
            oracle_to_unique[oracle_id].append(word)

    results = []
    for oracle_id, words in oracle_to_unique.items():
        entry = dict(meta[oracle_id])
        entry["unique_words"] = sorted(words)
        results.append(entry)

    return sorted(results, key=lambda r: r["name"])


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------

def output_text(results: list[dict], out) -> None:
    for entry in results:
        out.write(f"{entry['name']}\n")
        out.write(f"  oracle_id:    {entry['oracle_id']}\n")
        out.write(f"  scryfall_uri: {entry['scryfall_uri']}\n")
        out.write(f"  type:         {entry['type_line']}\n")
        out.write(f"  unique words: {', '.join(entry['unique_words'])}\n\n")


def output_csv(results: list[dict], out) -> None:
    import csv
    writer = csv.writer(out)
    writer.writerow(["name", "oracle_id", "scryfall_uri", "set", "collector_number", "type_line", "unique_words"])
    for entry in results:
        writer.writerow([
            entry["name"],
            entry["oracle_id"],
            entry["scryfall_uri"],
            entry["set"],
            entry["collector_number"],
            entry["type_line"],
            "|".join(entry["unique_words"]),
        ])


def output_json(results: list[dict], out) -> None:
    json.dump(results, out, indent=2)
    out.write("\n")


FORMATTERS = {
    "text": output_text,
    "csv":  output_csv,
    "json": output_json,
}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find MTG cards that are the sole card containing a given word."
    )
    parser.add_argument(
        "--bulk-file",
        type=Path,
        default=None,
        help="Path to a local Scryfall oracle-cards JSON dump. "
             "Downloaded automatically if omitted.",
    )
    parser.add_argument(
        "--include-alchemy",
        action="store_true",
        help="Include A- prefixed Alchemy rebalance cards (excluded by default).",
    )
    parser.add_argument(
        "--include-digital",
        action="store_true",
        help="Include digital-only card types: Attractions, Stickers, Contraptions (excluded by default).",
    )
    parser.add_argument(
        "--min-word-len",
        type=int,
        default=3,
        metavar="N",
        help="Minimum token length to consider (default: 3).",
    )
    parser.add_argument(
        "--include-flavor",
        action="store_true",
        help="Also tokenize flavor text (default: off).",
    )
    parser.add_argument(
        "--exclude-reminder",
        action="store_true",
        help="Strip reminder text in parentheses before tokenizing.",
    )
    parser.add_argument(
        "--output",
        choices=["text", "csv", "json"],
        default="text",
        help="Output format (default: text).",
    )
    parser.add_argument(
        "--out-file",
        type=Path,
        default=None,
        help="Write results to this file instead of stdout.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Resolve bulk file
    bulk_path = args.bulk_file
    if bulk_path is None:
        bulk_path = Path("oracle-cards.json")
        if not bulk_path.exists():
            download_bulk_file(bulk_path)
        else:
            print(f"Using cached bulk file: {bulk_path}", file=sys.stderr)

    print("Loading cards...", file=sys.stderr)
    with open(bulk_path, encoding="utf-8") as f:
        cards: list[dict] = json.load(f)
    print(f"  {len(cards):,} cards loaded.", file=sys.stderr)

    cards = filter_cards(
        cards,
        include_digital=args.include_digital,
        include_alchemy=args.include_alchemy,
    )
    print(f"  {len(cards):,} cards after filtering.", file=sys.stderr)

    print("Building word→card map...", file=sys.stderr)
    word_to_cards, meta = build_word_card_map(
        cards,
        min_word_len=args.min_word_len,
        include_flavor=args.include_flavor,
        exclude_reminder=args.exclude_reminder,
    )
    print(f"  {len(word_to_cards):,} distinct tokens found.", file=sys.stderr)

    print("Finding unique-word cards...", file=sys.stderr)
    results = find_unique_word_cards(word_to_cards, meta)
    print(f"  {len(results):,} cards have at least one unique word.", file=sys.stderr)

    formatter = FORMATTERS[args.output]
    if args.out_file:
        with open(args.out_file, "w", encoding="utf-8") as out:
            formatter(results, out)
        print(f"Results written to {args.out_file}", file=sys.stderr)
    else:
        formatter(results, sys.stdout)


if __name__ == "__main__":
    main()
