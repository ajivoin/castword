# Castword

A daily Magic: The Gathering guessing game. Each puzzle gives you a word that appears on exactly one card — your job is to name that card.


## How to play

You have **7 guesses**. Hints are revealed one at a time after each wrong guess:

1. The unique word(s) (always shown)
2. Mana cost
3. Card type
4. Flavor text — or, for the many cards that have none, how many sets the card has been printed in
5. First printed in
6. Card text
7. Name shape — the answer with its letters and digits blanked out

Use the autocomplete search to pick a card name. The answer is revealed if you run out of guesses.

## Variants

| Variant | Word source | Card pool |
|---------|-------------|-----------|
| **Easy ★** | Oracle + flavor text | Top 33% of mainline sets by EDHRec rank |
| **Oracle** | Rules text only | Mainline sets (no Un-sets) |
| **Flavor ✦** | Flavor text only | All paper sets |
| **Wildcard 🃏** | Oracle + flavor text | All paper sets incl. Un-sets |

### Daily mode
One puzzle per variant per day — the same card for everyone. Complete Oracle → Flavor → Wildcard to unlock a combined share of your results.

### Infinite mode
Endless random cards with a streak counter. Your in-progress card is preserved if you switch away and come back.

## Development

### Prerequisites

- Node.js ≥ 18
- Python 3.10+

### Setup

```bash
# Install JS dependencies
npm install

# Generate game data from the Scryfall bulk data file
# Download oracle-cards.json from https://scryfall.com/docs/api/bulk-data first
python prepare_data.py

# Start dev server
npm run dev
```

### Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

### Data pipeline

`unique_words.py` — finds all MTG cards that are the sole card containing a given word in their rules/flavor text.

`fetch_edhrec.py` — fetches and caches EDHRec deck-inclusion counts used to filter the Easy mode card pool.

`first_printings.py` — derives the facts that only a card's full printing history can answer, in a single pass over Scryfall's `default-cards` bulk file, which contains every printing of every card. (The `oracle-cards` dump used elsewhere carries only each card's *most recent* printing.) Three facts come out of that pass: the **first printing** (set name and year), the **number of distinct sets** a card has appeared in — which backs the reprint-count hint for the ~70% of puzzle cards that have no flavor text — and any **flavor text from an older printing**, for cards whose current printing dropped the flavor text an earlier one carried. Paper printings always win; cards that never saw paper — Alchemy and other Arena-only cards, Magic Online avatars, the 1997 Astral set — fall back to their first digital printing and are tagged with the platform, e.g. *Jumpstart: Historic Horizons (2021) · Arena*. The tag is dropped when the set name already says it (*Alchemy: Innistrad*, *Magic Online Avatars*) and kept when it doesn't (*Unfinity · Magic Online*, whose MTGO-only cards are distinct from their paper counterparts).

`prepare_data.py` calls into all three and produces five game datasets:

| File | Description |
|------|-------------|
| `src/data/easy-data.json` | Easy round (top 33% by EDHRec rank) |
| `src/data/game-data.json` | Oracle round |
| `src/data/flavor-data.json` | Flavor round |
| `src/data/wildcard-data.json` | Wildcard round |
| `src/data/card-names.json` | All card names for autocomplete |

Card data sourced from the [Scryfall bulk data API](https://scryfall.com/docs/api/bulk-data).

## Tech stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- Python 3 (data pipeline, no external dependencies)
- Plain CSS, no UI framework
