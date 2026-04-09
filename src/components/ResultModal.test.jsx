import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResultModal, {
  guessEmojis,
  buildRoundShareText,
  buildCampaignShareText,
  buildSingleShareText,
} from './ResultModal.jsx'
import { CARD_COUNTERSPELL } from '../test/fixtures.js'

// ── guessEmojis ───────────────────────────────────────────────────────────────

describe('guessEmojis', () => {
  it('correct guess → 🟩', () => {
    expect(guessEmojis([{ value: 'Counterspell', correct: true }])).toBe('🟩')
  })

  it('skipped guess → ⬜', () => {
    expect(guessEmojis([{ skipped: true }])).toBe('⬜')
  })

  it('first wrong guess → 🟨', () => {
    expect(guessEmojis([{ value: 'Bolt', correct: false }])).toBe('🟨')
  })

  it('second wrong guess → 🟧', () => {
    expect(guessEmojis([
      { value: 'Bolt', correct: false },
      { value: 'Shock', correct: false },
    ])).toBe('🟨🟧')
  })

  it('third wrong guess → 🟥', () => {
    expect(guessEmojis([
      { value: 'A', correct: false },
      { value: 'B', correct: false },
      { value: 'C', correct: false },
    ])).toBe('🟨🟧🟥')
  })

  it('fourth wrong guess → 🟫', () => {
    const gs = Array(4).fill(null).map((_, i) => ({ value: String(i), correct: false }))
    expect(guessEmojis(gs)).toBe('🟨🟧🟥🟫')
  })

  it('fifth+ wrong guess → ⬛', () => {
    const gs = Array(5).fill(null).map((_, i) => ({ value: String(i), correct: false }))
    expect(guessEmojis(gs)).toBe('🟨🟧🟥🟫⬛')
  })

  it('mixed sequence: skip, wrong, correct', () => {
    const gs = [
      { skipped: true },
      { value: 'X', correct: false },
      { value: 'Counterspell', correct: true },
    ]
    expect(guessEmojis(gs)).toBe('⬜🟧🟩')
  })

  it('empty guesses → empty string', () => {
    expect(guessEmojis([])).toBe('')
  })
})

// ── buildRoundShareText ────────────────────────────────────────────────────────

describe('buildRoundShareText', () => {
  it('won in 1 guess → "1/5 🟩" (no preceding color)', () => {
    const guesses = [{ value: 'Counterspell', correct: true }]
    expect(buildRoundShareText(guesses, 5)).toBe('1/5 🟩')
  })

  it('won in 2 guesses shows count and emoji trail', () => {
    const guesses = [
      { value: 'Wrong', correct: false },
      { value: 'Counterspell', correct: true },
    ]
    const text = buildRoundShareText(guesses, 5)
    expect(text).toMatch(/^2\/5 /)
    expect(text).toContain('🟩')
  })

  it('lost (no correct guess) → "X/5 ..."', () => {
    const guesses = Array(5).fill(null).map((_, i) => ({ value: String(i), correct: false }))
    const text = buildRoundShareText(guesses, 5)
    expect(text).toMatch(/^X\/5 /)
  })

  it('skip counts as a guess in score', () => {
    const guesses = [
      { skipped: true },
      { value: 'Counterspell', correct: true },
    ]
    const text = buildRoundShareText(guesses, 5)
    expect(text).toMatch(/^2\/5 /)
  })
})

// ── buildCampaignShareText ────────────────────────────────────────────────────

describe('buildCampaignShareText', () => {
  const campaign = {
    normal: { guesses: [{ value: 'Counterspell', correct: true }], status: 'won' },
    bonus:  { guesses: [{ value: 'X', correct: false }, { value: 'Y', correct: false }, { value: 'Z', correct: false }, { value: 'A', correct: false }, { value: 'B', correct: false }], status: 'lost' },
  }

  it('includes "Castword Daily" header', () => {
    const text = buildCampaignShareText(campaign, 5)
    expect(text).toContain('Castword Daily')
  })

  it('includes a line for each completed variant', () => {
    const text = buildCampaignShareText(campaign, 5)
    expect(text).toContain('Oracle')
    expect(text).toContain('Flavor ✦')
  })

  it('omits variants not in campaign', () => {
    const text = buildCampaignShareText(campaign, 5)
    expect(text).not.toContain('Wildcard')
  })

  it('includes the castword URL', () => {
    const text = buildCampaignShareText(campaign, 5)
    expect(text).toContain('https://jivoin.com/castword')
  })
})

// ── buildSingleShareText ───────────────────────────────────────────────────────

describe('buildSingleShareText', () => {
  const guesses = [{ value: 'Counterspell', correct: true }]

  it('daily mode includes variant label and date', () => {
    const text = buildSingleShareText('daily', 'normal', guesses, 5, 0)
    expect(text).toContain('Oracle')
    expect(text).toContain('Castword')
  })

  it('daily mode includes URL with correct hash', () => {
    const text = buildSingleShareText('daily', 'normal', guesses, 5, 0)
    expect(text).toContain('#oracle')
  })

  it('infinite mode includes streak emoji', () => {
    const text = buildSingleShareText('infinite', 'normal', guesses, 5, 7)
    expect(text).toContain('🔥7')
  })

  it('infinite mode includes (Infinite) label', () => {
    const text = buildSingleShareText('infinite', 'normal', guesses, 5, 3)
    expect(text).toContain('(Infinite)')
  })

  it('daily mode does not include streak emoji', () => {
    const text = buildSingleShareText('daily', 'normal', guesses, 5, 0)
    expect(text).not.toContain('🔥')
  })
})

// ── ResultModal component ─────────────────────────────────────────────────────

describe('ResultModal component', () => {
  const baseProps = {
    mode: 'daily',
    variant: 'normal',
    card: CARD_COUNTERSPELL,
    guesses: [{ value: 'Counterspell', correct: true }],
    status: 'won',
    maxGuesses: 5,
    streak: 0,
    nextVariant: null,
    allRoundsComplete: false,
    campaign: {},
    onPlayAgain: vi.fn(),
    onAdvance: vi.fn(),
    onDismiss: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('shows "✓ Correct!" on win', () => {
    render(<ResultModal {...baseProps} />)
    expect(screen.getByText(/✓ Correct!/)).toBeInTheDocument()
  })

  it('shows "✗ Game over" on loss', () => {
    render(<ResultModal {...baseProps} status="lost" />)
    expect(screen.getByText(/✗ Game over/)).toBeInTheDocument()
  })

  it('shows streak in infinite mode', () => {
    render(<ResultModal {...baseProps} mode="infinite" streak={5} />)
    expect(screen.getByText(/🔥/)).toBeInTheDocument()
    expect(screen.getByText(/5/)).toBeInTheDocument()
  })

  it('does not show streak in daily mode', () => {
    render(<ResultModal {...baseProps} />)
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument()
  })

  it('shows "Next card" button in infinite mode', () => {
    render(<ResultModal {...baseProps} mode="infinite" />)
    expect(screen.getByText('Next card')).toBeInTheDocument()
  })

  it('shows advance button when nextVariant is set', () => {
    render(<ResultModal {...baseProps} nextVariant="bonus" allRoundsComplete={false} />)
    expect(screen.getByText(/Next: Flavor/)).toBeInTheDocument()
  })

  it('shows "Share all results" when allRoundsComplete', () => {
    render(<ResultModal {...baseProps} allRoundsComplete={true} />)
    expect(screen.getByText('Share all results')).toBeInTheDocument()
  })

  it('shows card name in modal heading', () => {
    render(<ResultModal {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Counterspell' })).toBeInTheDocument()
  })

  it('shows campaign progress pills in daily mode', () => {
    render(<ResultModal {...baseProps} />)
    // All three variant labels should appear as pills
    expect(screen.getByText('Oracle')).toBeInTheDocument()
    expect(screen.getByText('Flavor ✦')).toBeInTheDocument()
    expect(screen.getByText('Wildcard 🃏')).toBeInTheDocument()
  })

  it('does not show campaign pills in infinite mode', () => {
    render(<ResultModal {...baseProps} mode="infinite" />)
    // Pills only show in daily
    expect(screen.queryByText('Oracle')).not.toBeInTheDocument()
  })
})
