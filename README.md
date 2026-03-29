# Castword

A daily Magic: The Gathering guessing game. Each puzzle gives you a word that appears on exactly one card — your job is to name that card.


## How to play

You have **4 guesses**. After each wrong guess, a new hint is revealed:

1. The unique word (always shown)
2. Card type line
3. Mana cost / oracle text / flavor text *(varies by round)*
4. …and one more

Use the autocomplete search to pick a card name. The answer is revealed after 4 wrong guesses.

## Rounds

| Round | Word source | Card pool |
|-------|-------------|-----------|
| **Oracle** | Rules text only | Mainline sets (no Un-sets) |
| **Flavor ✦** | Flavor text only | All paper sets |
| **Wildcard 🃏** | Oracle + flavor text | All paper sets incl. Un-sets |

### Daily mode
One puzzle per round per day — the same card for everyone. Complete all three rounds to unlock a combined share of your results.

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

`unique_words.py` — finds all MTG cards that are the sole card containing a given word in their rules/flavor text. `prepare_data.py` calls into it and produces three game datasets:

| File | Description |
|------|-------------|
| `src/data/game-data.json` | Oracle round (~933 cards) |
| `src/data/flavor-data.json` | Flavor round (~6,735 cards) |
| `src/data/wildcard-data.json` | Wildcard round (~7,330 cards) |
| `src/data/card-names.json` | All card names for autocomplete |

Card data sourced from the [Scryfall bulk data API](https://scryfall.com/docs/api/bulk-data).

## Tech stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- Python 3 (data pipeline, no external dependencies)
- Plain CSS, no UI framework
