import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuessInput from './GuessInput.jsx'

// Mock card-names.json with a small controlled set.
// Data is inlined in the factory because vi.mock is hoisted above module-level
// variable declarations, making module-scope consts unavailable in factories.
vi.mock('../data/card-names.json', () => ({
  default: [
    'Ancestral Recall',
    'Black Lotus',
    'Counterspell',
    'Dark Ritual',
    'Elvish Mystic',
    'Force of Will',
    'Giant Growth',
    'Hymn to Tourach',
    'Islands',
    'Jace, the Mind Sculptor',
  ],
}))

const MOCK_CARD_NAMES = [
  'Ancestral Recall',
  'Black Lotus',
  'Counterspell',
  'Dark Ritual',
  'Elvish Mystic',
  'Force of Will',
  'Giant Growth',
  'Hymn to Tourach',
  'Islands',
  'Jace, the Mind Sculptor',
]

function renderGuessInput(props = {}) {
  const defaults = { onGuess: vi.fn(), disabled: false, pastGuesses: [] }
  return render(<GuessInput {...defaults} {...props} />)
}

describe('GuessInput', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ── suggestion display ────────────────────────────────────────────────────

  it('shows no suggestions for empty input', () => {
    renderGuessInput()
    // Initially no query has been typed — no suggestion list
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows no suggestions for 1-char input', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'C')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows suggestions matching typed substring', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Count')
    expect(screen.getByText('Counterspell')).toBeInTheDocument()
  })

  it('matching is case-insensitive', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'count')
    expect(screen.getByText('Counterspell')).toBeInTheDocument()
  })

  it('shows at most 8 suggestions', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    // single-char won't show, need 2+ chars but "a" is in 7 names — use "al" which is in "Ancestral Recall"
    await userEvent.type(input, 'al')
    const items = screen.queryAllByRole('option')
    expect(items.length).toBeLessThanOrEqual(8)
  })

  it('filters out names not matching query', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Ancestral')
    expect(screen.getByText('Ancestral Recall')).toBeInTheDocument()
    expect(screen.queryByText('Black Lotus')).not.toBeInTheDocument()
  })

  // ── previously guessed names ──────────────────────────────────────────────

  it('adds "used" class to already-guessed suggestions', async () => {
    renderGuessInput({
      pastGuesses: [{ value: 'Counterspell', correct: false }],
    })
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Count')
    const item = screen.getByText('Counterspell').closest('li')
    expect(item).toHaveClass('used')
  })

  it('does not call onGuess when clicking an already-guessed name', async () => {
    const onGuess = vi.fn()
    renderGuessInput({
      onGuess,
      pastGuesses: [{ value: 'Counterspell', correct: false }],
    })
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Count')
    const item = screen.getByText('Counterspell')
    fireEvent.mouseDown(item)
    expect(onGuess).not.toHaveBeenCalled()
  })

  // ── clicking a suggestion ─────────────────────────────────────────────────

  it('clicking a suggestion calls onGuess with that name', async () => {
    const onGuess = vi.fn()
    renderGuessInput({ onGuess })
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Black')
    fireEvent.mouseDown(screen.getByText('Black Lotus'))
    expect(onGuess).toHaveBeenCalledWith('Black Lotus')
  })

  it('clicking a suggestion clears the input', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Black')
    fireEvent.mouseDown(screen.getByText('Black Lotus'))
    expect(input.value).toBe('')
  })

  // ── keyboard: Enter ───────────────────────────────────────────────────────

  it('Enter with no item highlighted submits the first suggestion', async () => {
    const onGuess = vi.fn()
    renderGuessInput({ onGuess })
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Black')
    await userEvent.keyboard('{Enter}')
    expect(onGuess).toHaveBeenCalledWith('Black Lotus')
  })

  // ── keyboard: ArrowDown / ArrowUp ─────────────────────────────────────────

  it('ArrowDown highlights first suggestion', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Black')
    await userEvent.keyboard('{ArrowDown}')
    const item = screen.getByText('Black Lotus').closest('li')
    expect(item).toHaveClass('active')
  })

  it('ArrowDown then Enter submits highlighted item', async () => {
    const onGuess = vi.fn()
    renderGuessInput({ onGuess })
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Black')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    expect(onGuess).toHaveBeenCalledWith('Black Lotus')
  })

  // ── keyboard: Escape ──────────────────────────────────────────────────────

  it('Escape clears the suggestion list', async () => {
    renderGuessInput()
    const input = screen.getByPlaceholderText(/Search/)
    await userEvent.type(input, 'Black')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ── disabled state ─────────────────────────────────────────────────────────

  it('input is disabled when disabled prop is true', () => {
    renderGuessInput({ disabled: true })
    expect(screen.getByPlaceholderText(/Search/)).toBeDisabled()
  })
})
