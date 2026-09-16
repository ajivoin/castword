import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutModal from './AboutModal.jsx'
import { HINT_COUNT } from './HintPanel.jsx'
import { MAX_GUESSES } from '../hooks/useGame.js'

// The "How to play" list restates the hint ladder in prose, so it silently
// goes stale whenever a rung is added, removed, or reordered. These tie it
// back to the constants the game actually plays by.

describe('AboutModal how-to-play', () => {
  it('states the real number of guesses', () => {
    render(<AboutModal onClose={() => {}} />)
    expect(screen.getByText(`${MAX_GUESSES} guesses`)).toBeInTheDocument()
  })

  it('lists one clue per hint rung', () => {
    const { container } = render(<AboutModal onClose={() => {}} />)
    expect(container.querySelectorAll('.about-steps li')).toHaveLength(HINT_COUNT)
  })

  it('numbers the clues consecutively from one', () => {
    const { container } = render(<AboutModal onClose={() => {}} />)
    const numbers = [...container.querySelectorAll('.about-step-num')].map((el) => el.textContent)
    expect(numbers).toEqual(Array.from({ length: HINT_COUNT }, (_, i) => String(i + 1)))
  })

  it('lists flavor text before first printed, as the panel does', () => {
    const { container } = render(<AboutModal onClose={() => {}} />)
    const steps = [...container.querySelectorAll('.about-steps li')].map((el) => el.textContent)
    expect(steps.findIndex((s) => s.includes('Flavor text')))
      .toBeLessThan(steps.findIndex((s) => s.includes('First printed')))
  })

  it('ends on the name shape clue', () => {
    const { container } = render(<AboutModal onClose={() => {}} />)
    const steps = [...container.querySelectorAll('.about-steps li')]
    expect(steps[steps.length - 1].textContent).toContain('Name shape')
  })
})
