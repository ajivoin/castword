export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// All name fragments that should be redacted, longest first so longer
// matches take priority in the alternation.
// Handles: full name, each face of a split card, and the first name of
// legendary creatures (the part before the first comma).
export function censorPatterns(cardName) {
  const faces = cardName.split(' // ').map((s) => s.trim())
  const parts = new Set([cardName])
  for (const face of faces) {
    parts.add(face)
    const beforeComma = face.split(',')[0].trim()
    if (beforeComma !== face) parts.add(beforeComma)
  }
  return [...parts].sort((a, b) => b.length - a.length)
}

// Renders text with name redaction + unique-word highlighting.
// Uses split-on-capturing-group: odd indices in the result are matches.
export function renderText(text, uniqueWords, cardName) {
  const nameRe = new RegExp(
    `(${censorPatterns(cardName).map(escapeRe).join('|')})`,
    'gi',
  )
  const wordRe = uniqueWords?.length
    ? new RegExp(`(${uniqueWords.map(escapeRe).join('|')})`, 'gi')
    : null

  const nameParts = text.split(nameRe)
  let k = 0

  return nameParts.flatMap((part, i) => {
    if (i % 2 === 1) {
      // Name match — redact with a block proportional to original length
      return [<span key={k++} className="redacted" aria-hidden="true">{'█'.repeat(Math.max(3, part.length))}</span>]
    }
    if (!wordRe || !part) return [part]
    return part.split(wordRe).map((wp, j) =>
      j % 2 === 1 ? <mark key={k++}>{wp}</mark> : wp,
    )
  })
}

// Maps a symbol string (contents of {…}) to the mana-font CSS class suffix.
// e.g. "W" → "w", "W/U" → "wu", "W/P" → "wp", "2/W" → "2w"
export function symClass(sym) {
  return sym.toLowerCase().replace('/', '')
}

// Cards that never saw a paper printing are tagged with the platform they
// debuted on (Arena, Magic Online, ...). Paper is recorded explicitly in the
// data so "no platform" never has to be inferred from a blank; it is listed
// here because it is the unremarkable case, not because it is unknown.
const HIDDEN_PLATFORMS = new Set(['Paper'])

// Whether a platform is worth tagging alongside the set it was printed in.
// Sets that already announce the platform in their own name — every Alchemy
// set is "Alchemy...", the MTGO-only avatar and promo sets are "Magic
// Online..." — would just repeat themselves. Sets that don't still need it:
// "Jumpstart: Historic Horizons" gives no hint that it is Arena-only, and
// Unfinity's MTGO-only "Name Sticker" Goblin is a different card from the
// paper _____ Goblin it shares a set with.
function platformWorthShowing(platform, setName) {
  if (!platform || HIDDEN_PLATFORMS.has(platform)) return false
  return !setName.toLowerCase().includes(platform.toLowerCase())
}

// Formats the "first printed" hint value from a card's first-printing fields.
// Defensive on undefined fields (older cached data may lack them entirely).
export function formatFirstPrinted(card) {
  const name = card.first_set_name ?? ''
  const year = card.first_printed_year ?? ''
  const platform = card.first_printed_platform ?? ''
  if (!name) return '—'

  const printing = year ? `${name} (${year})` : name
  return platformWorthShowing(platform, name) ? `${printing} · ${platform}` : printing
}

// Renders a mana cost string like "{2}{U}{U}" using mana-font icons
function ManaCost({ cost }) {
  if (!cost) return <span className="mana-cost">—</span>
  const parts = cost.split(/(\{[^}]+\})/).filter(Boolean)
  return (
    <span className="mana-cost">
      {parts.map((p, i) =>
        p.startsWith('{') ? (
          <i key={i} className={`ms ms-${symClass(p.slice(1, -1))} ms-cost`} aria-label={p} />
        ) : p
      )}
    </span>
  )
}

const HINT_DEFS_NORMAL = [
  { id: 'words',         label: 'Unique word(s)' },
  { id: 'cost',          label: 'Mana cost' },
  { id: 'type',          label: 'Type' },
  { id: 'first_printed', label: 'First printed' },
  { id: 'text',          label: 'Card text' },
  { id: 'flavor',        label: 'Flavor text' },
]

const HINT_DEFS_BONUS = [
  { id: 'words',         label: 'Unique flavor word(s)' },
  { id: 'cost',          label: 'Mana cost' },
  { id: 'type',          label: 'Type' },
  { id: 'first_printed', label: 'First printed' },
  { id: 'text',          label: 'Card text' },
  { id: 'flavor',        label: 'Flavor text' },
]

const HINT_DEFS_WILDCARD = [
  { id: 'words',         label: 'Unique word(s)' },
  { id: 'cost',          label: 'Mana cost' },
  { id: 'type',          label: 'Type' },
  { id: 'first_printed', label: 'First printed' },
  { id: 'text',          label: 'Card text' },
  { id: 'flavor',        label: 'Flavor text' },
]

const HINT_DEFS = { normal: HINT_DEFS_NORMAL, bonus: HINT_DEFS_BONUS, wildcard: HINT_DEFS_WILDCARD }

export default function HintPanel({ card, hintsRevealed, status, variant = 'normal' }) {
  const hintDefs = HINT_DEFS[variant] ?? HINT_DEFS_NORMAL
  const visibleCount = status !== 'playing' ? hintDefs.length : hintsRevealed + 1

  return (
    <div className="hint-panel">
      {hintDefs.slice(0, visibleCount).map(({ id, label }, idx) => (
        <div key={id} className={`hint-row ${idx > 0 && idx === hintsRevealed && status === 'playing' ? 'hint-new' : ''}`}>
          <span className="hint-label">{label}</span>
          <span className="hint-value">
            {id === 'words' && (
              <span className="word-chips">
                {card.unique_words.map((w) => (
                  <span key={w} className="word-chip">{w}</span>
                ))}
              </span>
            )}
            {id === 'type' && card.type_line}
            {id === 'cost' && <ManaCost cost={card.mana_cost} />}
            {id === 'first_printed' && (
              <span className="oracle-text">
                {renderText(formatFirstPrinted(card), [], card.name)}
              </span>
            )}
            {id === 'text' && (
              <span className="oracle-text">
                {renderText(card.oracle_text, card.unique_words, card.name)}
              </span>
            )}
            {id === 'flavor' && (
              <span className="oracle-text flavor-text">
                {renderText(card.flavor_text ?? '', card.unique_words, card.name)}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
