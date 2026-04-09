import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useGame,
  VARIANT_SEQUENCE,
  VARIANT_LABELS,
  VARIANT_TO_HASH,
} from './useGame.js'

// vi.mock is hoisted to the top of the file (above all imports and declarations),
// so any variable referenced in a factory must be defined via vi.hoisted().
const MOCK_CARDS = vi.hoisted(() => [
  {
    name: 'Counterspell',
    oracle_id: 'oracle-001',
    scryfall_uri: 'https://scryfall.com/card/2ed/56',
    type_line: 'Instant',
    mana_cost: '{U}{U}',
    colors: ['U'],
    oracle_text: 'Counter target spell.',
    flavor_text: '"I have a better idea."',
    image_url: 'https://cards.scryfall.io/normal/front/a.jpg',
    image_url_back: '',
    unique_words: ['counterspell'],
  },
  {
    name: 'Lightning Bolt',
    oracle_id: 'oracle-002',
    scryfall_uri: 'https://scryfall.com/card/lea/161',
    type_line: 'Instant',
    mana_cost: '{R}',
    colors: ['R'],
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    flavor_text: '',
    image_url: 'https://cards.scryfall.io/normal/front/b.jpg',
    image_url_back: '',
    unique_words: ['bolt'],
  },
])

vi.mock('../data/game-data.json', () => ({ default: MOCK_CARDS }))
vi.mock('../data/flavor-data.json', () => ({ default: MOCK_CARDS }))
vi.mock('../data/wildcard-data.json', () => ({ default: MOCK_CARDS }))
vi.mock('../data/easy-data.json', () => ({ default: MOCK_CARDS }))

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Suppress history.replaceState calls in tests
vi.stubGlobal('history', { replaceState: vi.fn() })

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

// ── Constants ────────────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('VARIANT_SEQUENCE contains normal, bonus, wildcard in order', () => {
    expect(VARIANT_SEQUENCE).toEqual(['normal', 'bonus', 'wildcard'])
  })

  it('VARIANT_LABELS maps each variant to a human-readable string', () => {
    expect(VARIANT_LABELS.easy).toBe('Easy ★')
    expect(VARIANT_LABELS.normal).toBe('Oracle')
    expect(VARIANT_LABELS.bonus).toBe('Flavor ✦')
    expect(VARIANT_LABELS.wildcard).toBe('Wildcard 🃏')
  })

  it('VARIANT_TO_HASH maps each variant to its URL hash', () => {
    expect(VARIANT_TO_HASH.easy).toBe('easy')
    expect(VARIANT_TO_HASH.normal).toBe('oracle')
    expect(VARIANT_TO_HASH.bonus).toBe('flavor')
    expect(VARIANT_TO_HASH.wildcard).toBe('wildcard')
  })
})

// ── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts in daily mode', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.mode).toBe('daily')
  })

  it('starts with normal variant by default', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.variant).toBe('normal')
  })

  it('starts with streak 0', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.streak).toBe(0)
  })

  it('starts with a card and playing status', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.gameState.status).toBe('playing')
    expect(result.current.gameState.card).toBeTruthy()
    expect(result.current.gameState.guesses).toHaveLength(0)
    expect(result.current.gameState.hintsRevealed).toBe(0)
  })

  it('exposes maxGuesses of 5', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.maxGuesses).toBe(5)
  })
})

// ── submitGuess ───────────────────────────────────────────────────────────────

describe('submitGuess', () => {
  it('correct guess sets status to won', () => {
    const { result } = renderHook(() => useGame())
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    expect(result.current.gameState.status).toBe('won')
  })

  it('correct guess increments streak', () => {
    const { result } = renderHook(() => useGame())
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    expect(result.current.streak).toBe(1)
  })

  it('correct guess is case-insensitive', () => {
    const { result } = renderHook(() => useGame())
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName.toLowerCase()) })
    expect(result.current.gameState.status).toBe('won')
  })

  it('correct guess appends to guesses with correct:true', () => {
    const { result } = renderHook(() => useGame())
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    const guesses = result.current.gameState.guesses
    expect(guesses).toHaveLength(1)
    expect(guesses[0]).toEqual({ value: cardName, correct: true })
  })

  it('wrong guess stays playing', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.submitGuess('Not A Real Card') })
    expect(result.current.gameState.status).toBe('playing')
  })

  it('wrong guess increments hintsRevealed', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.submitGuess('Not A Real Card') })
    expect(result.current.gameState.hintsRevealed).toBe(1)
  })

  it('wrong guess does not change streak', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.submitGuess('Not A Real Card') })
    expect(result.current.streak).toBe(0)
  })

  it('5th wrong guess sets status to lost', () => {
    const { result } = renderHook(() => useGame())
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.submitGuess('Wrong Card ' + i)
      }
    })
    expect(result.current.gameState.status).toBe('lost')
  })

  it('5th wrong guess resets streak to 0', () => {
    const { result } = renderHook(() => useGame())
    // first win a game to build streak
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    expect(result.current.streak).toBe(1)
    // switch to infinite and lose
    act(() => { result.current.switchMode('infinite', 'normal') })
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.submitGuess('Wrong Card ' + i)
      }
    })
    expect(result.current.streak).toBe(0)
  })

  it('guess after game ends (won) is a no-op', () => {
    const { result } = renderHook(() => useGame())
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    const stateAfterWin = result.current.gameState
    act(() => { result.current.submitGuess('Another Card') })
    expect(result.current.gameState).toEqual(stateAfterWin)
  })

  it('hintsRevealed is capped at 4 regardless of additional wrong guesses', () => {
    const { result } = renderHook(() => useGame())
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.submitGuess('Wrong Card ' + i)
      }
    })
    expect(result.current.gameState.hintsRevealed).toBe(4)
  })
})

// ── skipTurn ──────────────────────────────────────────────────────────────────

describe('skipTurn', () => {
  it('adds a skipped guess entry', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.skipTurn() })
    expect(result.current.gameState.guesses).toHaveLength(1)
    expect(result.current.gameState.guesses[0]).toEqual({ skipped: true })
  })

  it('increments hintsRevealed', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.skipTurn() })
    expect(result.current.gameState.hintsRevealed).toBe(1)
  })

  it('status stays playing after one skip', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.skipTurn() })
    expect(result.current.gameState.status).toBe('playing')
  })

  it('5 skips result in lost status', () => {
    const { result } = renderHook(() => useGame())
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.skipTurn()
      }
    })
    expect(result.current.gameState.status).toBe('lost')
  })

  it('5 skips reset streak to 0', () => {
    const { result } = renderHook(() => useGame())
    // switch to infinite for streak tracking
    act(() => { result.current.switchMode('infinite', 'normal') })
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    expect(result.current.streak).toBe(1)
    act(() => { result.current.newGame() })
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.skipTurn()
      }
    })
    expect(result.current.streak).toBe(0)
  })
})

// ── campaign helpers ──────────────────────────────────────────────────────────

describe('nextVariant and allRoundsComplete', () => {
  it('nextVariant is null while game is playing', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.nextVariant).toBeNull()
  })

  it('nextVariant is bonus after winning normal in daily mode', () => {
    const { result } = renderHook(() => useGame())
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    expect(result.current.nextVariant).toBe('bonus')
  })

  it('allRoundsComplete is false initially', () => {
    const { result } = renderHook(() => useGame())
    expect(result.current.allRoundsComplete).toBe(false)
  })
})

// ── mode switching ────────────────────────────────────────────────────────────

describe('switchMode', () => {
  it('can switch to infinite mode', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.switchMode('infinite', 'normal') })
    expect(result.current.mode).toBe('infinite')
  })

  it('switching to daily resets streak to 0', () => {
    const { result } = renderHook(() => useGame())
    act(() => { result.current.switchMode('infinite', 'normal') })
    const cardName = result.current.gameState.card.name
    act(() => { result.current.submitGuess(cardName) })
    expect(result.current.streak).toBe(1)
    act(() => { result.current.switchMode('daily', 'normal') })
    expect(result.current.streak).toBe(0)
  })
})
