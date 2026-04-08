# Agent Contribution Guide

This document describes conventions for AI agents contributing to this repository.

## Git identity

**Commit as the user, not as the agent.** Before committing, set git identity to match the repository owner:

```bash
git config user.name "ajivoin"
git config user.email "<email>"
```

Do not commit with AI-generated names like "Claude" or "GitHub Copilot".

## Commit messages

- Write clear, descriptive commit messages that explain *what* and *why*
- Follow the style used in this repo: `type: short description` (e.g. `feat:`, `fix:`, `docs:`, `chore:`)
- **Do not include links to chat sessions, AI tool sessions, or conversation URLs in commit messages**
- Do not mention the AI agent or tool that produced the change in the commit message or PR description

## Development workflow

### Setup

```bash
npm install
# Download oracle-cards.json from https://scryfall.com/docs/api/bulk-data
python prepare_data.py
```

### Running locally

```bash
npm run dev      # start dev server
npm run build    # production build → dist/
npm run preview  # preview production build
```

### Data pipeline

If you modify card filtering logic, regenerate the game datasets:

```bash
python prepare_data.py
```

Data files in `src/data/` are checked into the repo and must be regenerated when the pipeline changes. `fetch_edhrec.py` makes network requests and caches results; run it separately only when EDHRec data needs refreshing.

## Code conventions

- **Frontend**: React + Vite, plain CSS (no UI framework). Keep new components consistent with existing style.
- **Python**: Standard library only (no external dependencies). Scripts are standalone and should remain that way.
- **No TypeScript**: The project uses plain JavaScript. Do not introduce TypeScript.

## What to avoid

- Do not change the data pipeline outputs without regenerating all five `src/data/*.json` files.
- Do not add external JS or Python dependencies without a strong reason.
- Do not commit build artifacts from `dist/`.
- Do not break the four game variants (Easy, Oracle, Flavor, Wildcard) or the daily/infinite mode logic.

## Testing changes

There is no automated test suite. Before committing:

1. Run `npm run build` and confirm it succeeds with no errors.
2. Run `npm run preview` and manually verify the affected variants still work correctly.
3. If the data pipeline changed, confirm all five `src/data/*.json` files were regenerated and spot-check a few entries.
