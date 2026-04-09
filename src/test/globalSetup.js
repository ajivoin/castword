/**
 * Vitest global setup — creates stub data files so Vite's import-analysis
 * can resolve the JSON imports in src/hooks/useGame.js and
 * src/components/GuessInput.jsx at transform time.
 *
 * The stubs are only written when the files are absent; real data generated
 * by `python prepare_data.py` takes precedence if it already exists.
 * Individual test files mock these imports with vi.mock() as needed.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../data')
const STUB_FILES = [
  'game-data.json',
  'flavor-data.json',
  'wildcard-data.json',
  'easy-data.json',
  'card-names.json',
]

export function setup() {
  mkdirSync(DATA_DIR, { recursive: true })
  for (const name of STUB_FILES) {
    const filePath = resolve(DATA_DIR, name)
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '[]')
    }
  }
}
