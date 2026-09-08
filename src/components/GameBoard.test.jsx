import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GameBoard from './GameBoard.jsx'
import { CARD_COUNTERSPELL, makeDailyGameState } from '../test/fixtures.js'

function baseProps(overrides = {}) {
  return {
    mode: 'daily',
    variant: 'normal',
    streak: 0,
    gameState: makeDailyGameState(CARD_COUNTERSPELL),
    onGuess: vi.fn(),
    onSkip: vi.fn(),
    onPlayAgain: vi.fn(),
    onAdvance: vi.fn(),
    maxGuesses: 6,
    nextVariant: null,
    allRoundsComplete: false,
    campaign: {},
    ...overrides,
  }
}

describe('GameBoard skip / give-up button', () => {
  it('shows a "Skip" button labeled with btn-skip when hints remain', () => {
    render(<GameBoard {...baseProps({
      gameState: { ...makeDailyGameState(CARD_COUNTERSPELL), hintsRevealed: 0, guesses: [] },
    })} />)
    const btn = screen.getByText('Skip')
    expect(btn).toBeInTheDocument()
    expect(btn.className).toBe('btn-skip')
  })

  it('shows "Give Up" with btn-give-up class on the last guess', () => {
    const guesses = Array(5).fill(null).map((_, i) => ({ value: 'Wrong ' + i, correct: false }))
    render(<GameBoard {...baseProps({
      gameState: { ...makeDailyGameState(CARD_COUNTERSPELL), hintsRevealed: 5, guesses },
    })} />)
    const btn = screen.getByText('Give Up')
    expect(btn).toBeInTheDocument()
    expect(btn.className).toBe('btn-give-up')
    expect(screen.queryByText('Skip')).not.toBeInTheDocument()
  })

  it('hides the skip button once hintsRevealed reaches 5 and it is not the last guess', () => {
    render(<GameBoard {...baseProps({
      gameState: { ...makeDailyGameState(CARD_COUNTERSPELL), hintsRevealed: 5, guesses: [{ value: 'Wrong', correct: false }] },
    })} />)
    expect(screen.queryByText('Skip')).not.toBeInTheDocument()
    expect(screen.queryByText('Give Up')).not.toBeInTheDocument()
  })

  it('still shows the skip button just below the hide threshold (hintsRevealed 4)', () => {
    render(<GameBoard {...baseProps({
      gameState: { ...makeDailyGameState(CARD_COUNTERSPELL), hintsRevealed: 4, guesses: [] },
    })} />)
    expect(screen.getByText('Skip')).toBeInTheDocument()
  })
})
