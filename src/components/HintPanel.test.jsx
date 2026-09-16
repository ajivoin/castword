import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HintPanel, {
  censorPatterns,
  renderText,
  symClass,
  formatFirstPrinted,
  formatReprints,
  nameShape,
  HINT_COUNT,
} from './HintPanel.jsx'
import { MAX_GUESSES } from '../hooks/useGame.js'
import { CARD_COUNTERSPELL, CARD_LIGHTNING_BOLT } from '../test/fixtures.js'

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

  it('shows flavor text label at hintsRevealed 3', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={3} status="playing" variant="normal" />)
    expect(screen.getByText('Flavor text')).toBeInTheDocument()
  })

  it('does not show first printed until hintsRevealed 4', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={3} status="playing" variant="normal" />)
    expect(screen.queryByText('First printed')).not.toBeInTheDocument()
  })

  it('shows first printed label at hintsRevealed 4', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={4} status="playing" variant="normal" />)
    expect(screen.getByText('First printed')).toBeInTheDocument()
  })

  it('shows card text label at hintsRevealed 5', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={5} status="playing" variant="normal" />)
    expect(screen.getByText('Card text')).toBeInTheDocument()
  })

  it('shows name shape label at hintsRevealed 6', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={6} status="playing" variant="normal" />)
    expect(screen.getByText('Name shape')).toBeInTheDocument()
  })

  it('does not show name shape before the final hint', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={5} status="playing" variant="normal" />)
    expect(screen.queryByText('Name shape')).not.toBeInTheDocument()
  })

  it('shows all hints when status is won', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={0} status="won" variant="normal" />)
    expect(screen.getByText('Mana cost')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('First printed')).toBeInTheDocument()
    expect(screen.getByText('Card text')).toBeInTheDocument()
    expect(screen.getByText('Flavor text')).toBeInTheDocument()
    expect(screen.getByText('Name shape')).toBeInTheDocument()
  })

  it('renders the name shape of the answer', () => {
    render(<HintPanel card={CARD_LIGHTNING_BOLT} hintsRevealed={6} status="playing" variant="normal" />)
    expect(screen.getByText('█████████ ████')).toBeInTheDocument()
  })

  it('falls back to the reprints label when the card has no flavor text', () => {
    render(<HintPanel card={CARD_LIGHTNING_BOLT} hintsRevealed={3} status="playing" variant="normal" />)
    expect(screen.getByText('Reprints')).toBeInTheDocument()
    expect(screen.queryByText('Flavor text')).not.toBeInTheDocument()
  })

  it('renders the reprint count in place of missing flavor text', () => {
    render(<HintPanel card={CARD_LIGHTNING_BOLT} hintsRevealed={3} status="playing" variant="normal" />)
    expect(screen.getByText('Reprinted in 8 other sets')).toBeInTheDocument()
  })

  it('keeps the flavor text label when the card has flavor text', () => {
    render(<HintPanel card={CARD_COUNTERSPELL} hintsRevealed={3} status="playing" variant="normal" />)
    expect(screen.getByText('Flavor text')).toBeInTheDocument()
    expect(screen.queryByText('Reprints')).not.toBeInTheDocument()
  })

  it('has one hint rung per guess', () => {
    expect(HINT_COUNT).toBe(MAX_GUESSES)
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

  it('does not render the platform for paper cards', () => {
    const card = {
      name: 'Counterspell',
      first_set_name: 'Limited Edition Alpha',
      first_printed_year: '1993',
      first_printed_platform: 'Paper',
    }
    expect(formatFirstPrinted(card)).toBe('Limited Edition Alpha (1993)')
  })

  it('appends the platform for a card that never saw paper', () => {
    const card = {
      name: 'Davriel, Soul Broker',
      first_set_name: 'Jumpstart: Historic Horizons',
      first_printed_year: '2021',
      first_printed_platform: 'Arena',
    }
    expect(formatFirstPrinted(card)).toBe('Jumpstart: Historic Horizons (2021) · Arena')
  })

  it('appends the platform even when the year is missing', () => {
    const card = {
      name: 'Test', first_set_name: 'Unfinity',
      first_printed_year: '', first_printed_platform: 'Magic Online',
    }
    expect(formatFirstPrinted(card)).toBe('Unfinity · Magic Online')
  })

  // A set whose own name already announces the platform needs no tag.
  // Every Alchemy set is named "Alchemy...", and the MTGO-only avatar and
  // promo sets are named "Magic Online...".
  it.each([
    ['Alchemy', 'Alchemy: Murders at Karlov Manor', '2024'],
    ['Alchemy', "Alchemy Horizons: Baldur's Gate", '2022'],
    ['Magic Online', 'Magic Online Avatars', '2003'],
    ['Magic Online', 'Magic Online Promos', '2010'],
    ['Astral', 'Astral Cards', '1997'],
  ])('omits a redundant %s tag on "%s"', (platform, setName, year) => {
    const card = {
      name: 'Test', first_set_name: setName,
      first_printed_year: year, first_printed_platform: platform,
    }
    expect(formatFirstPrinted(card)).toBe(`${setName} (${year})`)
  })

  // ...but a set that does not name the platform still needs the tag.
  it.each([
    ['Arena', 'Jumpstart: Historic Horizons', '2021'],
    ['Magic Online', 'Unfinity', '2022'],
  ])('keeps an informative %s tag on "%s"', (platform, setName, year) => {
    const card = {
      name: 'Test', first_set_name: setName,
      first_printed_year: year, first_printed_platform: platform,
    }
    expect(formatFirstPrinted(card)).toBe(`${setName} (${year}) · ${platform}`)
  })

  it('matches the set name case-insensitively when deciding redundancy', () => {
    const card = {
      name: 'Test', first_set_name: 'ALCHEMY: INNISTRAD',
      first_printed_year: '2021', first_printed_platform: 'Alchemy',
    }
    expect(formatFirstPrinted(card)).toBe('ALCHEMY: INNISTRAD (2021)')
  })

  it('hides Paper even though no set name mentions it', () => {
    const card = {
      name: 'Test', first_set_name: 'Innistrad',
      first_printed_year: '2011', first_printed_platform: 'Paper',
    }
    expect(formatFirstPrinted(card)).toBe('Innistrad (2011)')
  })

  it('returns "—" when there is no set name, whatever the platform says', () => {
    const card = { name: 'Test', first_set_name: '', first_printed_platform: 'Arena' }
    expect(formatFirstPrinted(card)).toBe('—')
  })

  it('omits the platform when the field is absent (old-shaped card object)', () => {
    const card = { name: 'Test', first_set_name: 'Innistrad', first_printed_year: '2011' }
    expect(formatFirstPrinted(card)).toBe('Innistrad (2011)')
  })
})

// ── first_printed platform tag, end to end through the component ─────────────

describe('first_printed platform tag rendering', () => {
  const renderWith = (extra) => {
    render(
      <HintPanel
        card={{ ...CARD_COUNTERSPELL, ...extra }}
        hintsRevealed={4}
        status="playing"
        variant="normal"
      />
    )
    return screen.getByText('First printed').closest('.hint-row')
  }

  it('shows an informative platform tag in the rendered hint', () => {
    const row = renderWith({
      first_set_name: 'Jumpstart: Historic Horizons',
      first_printed_year: '2021',
      first_printed_platform: 'Arena',
    })
    expect(row.textContent).toContain('Jumpstart: Historic Horizons (2021) · Arena')
  })

  it('renders no tag for a paper card', () => {
    const row = renderWith({
      first_set_name: 'Limited Edition Alpha',
      first_printed_year: '1993',
      first_printed_platform: 'Paper',
    })
    expect(row.textContent).toContain('Limited Edition Alpha (1993)')
    expect(row.textContent).not.toContain('·')
    expect(row.textContent).not.toContain('Paper')
  })

  it('renders no tag when the set name already says the platform', () => {
    const row = renderWith({
      first_set_name: 'Magic Online Avatars',
      first_printed_year: '2003',
      first_printed_platform: 'Magic Online',
    })
    expect(row.textContent).toContain('Magic Online Avatars (2003)')
    expect(row.textContent).not.toContain('·')
  })

  it('still censors the card name when a platform tag is present', () => {
    const row = renderWith({
      name: 'Arena',
      first_set_name: 'Jumpstart: Historic Horizons',
      first_printed_year: '2021',
      first_printed_platform: 'Arena',
    })
    expect(row.querySelector('.redacted')).toBeTruthy()
    expect(row.textContent).not.toContain('Arena')
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
    render(<HintPanel card={card} hintsRevealed={4} status="playing" variant="normal" />)
    const hintPanel = screen.getByText('First printed').closest('.hint-row')
    expect(hintPanel.textContent).not.toContain('Kamigawa')
    expect(hintPanel.querySelector('.redacted')).toBeTruthy()
  })
})


// ── formatReprints ────────────────────────────────────────────────────────────

describe('formatReprints', () => {
  it('reports a single-set card as never reprinted', () => {
    expect(formatReprints({ printing_set_count: 1 })).toBe('Never reprinted')
  })

  it('uses the singular for exactly one other set', () => {
    expect(formatReprints({ printing_set_count: 2 })).toBe('Reprinted in 1 other set')
  })

  it('uses the plural for more than one other set', () => {
    expect(formatReprints({ printing_set_count: 9 })).toBe('Reprinted in 8 other sets')
  })

  it('returns "—" when no printing data was recorded', () => {
    expect(formatReprints({ printing_set_count: 0 })).toBe('—')
  })

  it('returns "—" for an old-shaped card object', () => {
    expect(formatReprints({})).toBe('—')
  })
})

// ── nameShape ─────────────────────────────────────────────────────────────────

describe('nameShape', () => {
  it('blanks every letter', () => {
    expect(nameShape('Counterspell')).toBe('████████████')
  })

  it('preserves spaces between words', () => {
    expect(nameShape('Lightning Bolt')).toBe('█████████ ████')
  })

  it('preserves commas', () => {
    expect(nameShape('Urza, Lord')).toBe('████, ████')
  })

  it('preserves apostrophes and hyphens', () => {
    expect(nameShape("Lim-Dul's Vault")).toBe("███-███'█ █████")
  })

  it('blanks accented letters', () => {
    expect(nameShape("Lim-Dûl's Vault")).toBe("███-███'█ █████")
  })

  it('blanks digits', () => {
    expect(nameShape('+2 Mace')).toBe('+█ ████')
  })

  it('preserves the split-card separator', () => {
    expect(nameShape('Fire // Ice')).toBe('████ // ███')
  })

  it('preserves literal underscores in a card name', () => {
    expect(nameShape('Wolf in _____ Clothing')).toBe('████ ██ _____ ████████')
  })

  it('leaves an all-underscore name untouched', () => {
    expect(nameShape('_____')).toBe('_____')
  })

  it('preserves the registered sign', () => {
    expect(nameShape('Coast®')).toBe('█████®')
  })

  it('preserves the modifier colon', () => {
    expect(nameShape('Ratonhnhaké꞉ton')).toBe('███████████꞉███')
  })

  it('preserves em dashes', () => {
    expect(nameShape('Human—Time')).toBe('█████—████')
  })

  it('preserves the exact length of the name', () => {
    const name = 'The Ultimate Nightmare of Wizards of the Coast® Customer Service'
    expect(nameShape(name)).toHaveLength(name.length)
  })
})
