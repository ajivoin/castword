import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HintPanel, { censorPatterns, renderText, symClass, formatFirstPrinted } from './HintPanel.jsx'
import { CARD_COUNTERSPELL } from '../test/fixtures.js'

// ── censorPatterns ────────────────────────────────────────────────────────────

describe('censorPatterns', () => {
  it('returns array containing the full card name', () => {
    expect(censorPatterns('Counterspell')).toContain('Counterspell')
  })

  it('returns a single entry for a simple name with no comma or //', () => {
    const patterns = censorPatterns('Counterspell')
    expect(patterns).toEqual(['Counterspell'])
  })

  it('includes both full name and pre-comma part for legendary names', () => {
    const patterns = censorPatterns('Urza, Lord of Ingenuity')
    expect(patterns).toContain('Urza, Lord of Ingenuity')
    expect(patterns).toContain('Urza')
  })

  it('sorts patterns longest-first', () => {
    const patterns = censorPatterns('Urza, Lord of Ingenuity')
    expect(patterns[0]).toBe('Urza, Lord of Ingenuity')
    expect(patterns[patterns.length - 1]).toBe('Urza')
  })

  it('handles split card names with //', () => {
    const patterns = censorPatterns('Fire // Ice')
    expect(patterns).toContain('Fire // Ice')
    expect(patterns).toContain('Fire')
    expect(patterns).toContain('Ice')
  })

  it('deduplicates when face name equals full name', () => {
    const patterns = censorPatterns('Counterspell')
    const unique = new Set(patterns)
    expect(patterns.length).toBe(unique.size)
  })

  it('handles name with comma but no // ', () => {
    const patterns = censorPatterns('Sol, Ring Bearer')
    expect(patterns).toContain('Sol, Ring Bearer')
    expect(patterns).toContain('Sol')
  })
})

// ── renderText ────────────────────────────────────────────────────────────────

describe('renderText', () => {
  it('replaces the card name with block characters', () => {
    const result = renderText('Counter target spell.', ['counter'], 'Counter')
    const flatText = result.map((el) => (typeof el === 'string' ? el : el.props?.className === 'redacted' ? '█' : el.props?.children)).join('')
    expect(flatText).not.toContain('Counter')
  })

  it('block replacement is at least 3 characters wide', () => {
    // Name "Ox" is 2 chars — should still produce 3 blocks
    const result = renderText('Ox enters the battlefield.', [], 'Ox')
    const redacted = result.find((el) => el?.props?.className === 'redacted')
    expect(redacted.props.children.length).toBeGreaterThanOrEqual(3)
  })

  it('block replacement is proportional to name length', () => {
    const shortResult = renderText('Ox runs.', [], 'Ox')
    const longResult  = renderText('Counterspell resolves.', [], 'Counterspell')
    const shortBlocks = shortResult.find((el) => el?.props?.className === 'redacted')
    const longBlocks  = longResult.find((el) => el?.props?.className === 'redacted')
    expect(longBlocks.props.children.length).toBeGreaterThan(shortBlocks.props.children.length)
  })

  it('wraps unique words in mark elements', () => {
    const result = renderText('Counter target spell.', ['counter'], 'Bolt')
    const mark = result.find((el) => el?.type === 'mark')
    expect(mark).toBeTruthy()
    expect(mark.props.children.toLowerCase()).toContain('counter')
  })

  it('passes through plain text without unique words or name', () => {
    const result = renderText('Destroy target creature.', [], 'Counterspell')
    const text = result.join('')
    expect(text).toBe('Destroy target creature.')
  })

  it('handles empty unique words array', () => {
    expect(() => renderText('Some text.', [], 'Bolt')).not.toThrow()
  })

  it('handles null unique words', () => {
    expect(() => renderText('Some text.', null, 'Bolt')).not.toThrow()
  })

  it('name match is case-insensitive', () => {
    const result = renderText('COUNTERSPELL counters spells.', [], 'Counterspell')
    const redacted = result.find((el) => el?.props?.className === 'redacted')
    expect(redacted).toBeTruthy()
  })
})

// ── symClass ──────────────────────────────────────────────────────────────────

describe('symClass', () => {
  it.each([
    ['W', 'w'],
    ['U', 'u'],
    ['B', 'b'],
    ['R', 'r'],
    ['G', 'g'],
    ['T', 't'],
    ['X', 'x'],
    ['0', '0'],
    ['1', '1'],
    ['2', '2'],
  ])('maps "%s" to "%s"', (input, expected) => {
    expect(symClass(input)).toBe(expected)
  })

  it('maps hybrid W/U to "wu"', () => {
    expect(symClass('W/U')).toBe('wu')
  })

  it('maps generic-hybrid 2/W to "2w"', () => {
    expect(symClass('2/W')).toBe('2w')
  })

  it('maps phyrexian W/P to "wp"', () => {
    expect(symClass('W/P')).toBe('wp')
  })
})

// ── HintPanel component ───────────────────────────────────────────────────────

describe('HintPanel component', () => {
  it('shows unique word chip at hintsRevealed 0', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={0} status="playing" variant="normal" />)
    expect(screen.getByText('counterspell')).toBeInTheDocument()
  })

  it('does not show mana cost at hintsRevealed 0', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={0} status="playing" variant="normal" />)
    expect(screen.queryByText('Mana cost')).not.toBeInTheDocument()
  })

  it('shows mana cost label at hintsRevealed 1', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={1} status="playing" variant="normal" />)
    expect(screen.getByText('Mana cost')).toBeInTheDocument()
  })

  it('shows type label at hintsRevealed 2', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={2} status="playing" variant="normal" />)
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Instant')).toBeInTheDocument()
  })

  it('shows first printed label at hintsRevealed 3', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={3} status="playing" variant="normal" />)
    expect(screen.getByText('First printed')).toBeInTheDocument()
  })

  it('shows card text label at hintsRevealed 4', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={4} status="playing" variant="normal" />)
    expect(screen.getByText('Card text')).toBeInTheDocument()
  })

  it('shows flavor text label at hintsRevealed 5', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={5} status="playing" variant="normal" />)
    expect(screen.getByText('Flavor text')).toBeInTheDocument()
  })

  it('shows all hints when status is won', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={0} status="won" variant="normal" />)
    expect(screen.getByText('Mana cost')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('First printed')).toBeInTheDocument()
    expect(screen.getByText('Card text')).toBeInTheDocument()
    expect(screen.getByText('Flavor text')).toBeInTheDocument()
  })

  it('bonus variant shows "Unique flavor word(s)" label', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={0} status="playing" variant="bonus" />)
    expect(screen.getByText('Unique flavor word(s)')).toBeInTheDocument()
  })

  it('normal variant shows "Unique word(s)" label', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={0} status="playing" variant="normal" />)
    expect(screen.getByText('Unique word(s)')).toBeInTheDocument()
  })
})

// ── formatFirstPrinted ────────────────────────────────────────────────────────

describe('formatFirstPrinted', () => {
  it('returns "Name (Year)" when both fields are present', () => {
    const card = { name: 'Counterspell', first_set_name: 'Limited Edition Alpha', first_printed_year: '1993' }
    expect(formatFirstPrinted(card)).toBe('Limited Edition Alpha (1993)')
  })

  it('returns just the name when year is missing', () => {
    const card = { name: 'Counterspell', first_set_name: 'Limited Edition Alpha', first_printed_year: '' }
    expect(formatFirstPrinted(card)).toBe('Limited Edition Alpha')
  })

  it('returns "—" when name is missing', () => {
    const card = { name: 'Counterspell', first_set_name: '', first_printed_year: '1993' }
    expect(formatFirstPrinted(card)).toBe('—')
  })

  it('returns "—" when both fields are undefined (old-shaped card object)', () => {
    const card = { name: 'Counterspell' }
    expect(formatFirstPrinted(card)).toBe('—')
  })
})

// ── first_printed spoiler redaction ──────────────────────────────────────────

describe('first_printed spoiler redaction', () => {
  it('redacts the hint value when the set name equals the card name', () => {
    const card = {
      ...CARD_COUNTERSPELL,
      name: 'Kamigawa',
      first_set_name: 'Kamigawa',
      first_printed_year: '2004',
    }
    render(<HintPanel card={card} hintsRevealed={3} status="playing" variant="normal" />)
    const hintPanel = screen.getByText('First printed').closest('.hint-row')
    expect(hintPanel.textContent).not.toContain('Kamigawa')
    expect(hintPanel.querySelector('.redacted')).toBeTruthy()
  })
})
